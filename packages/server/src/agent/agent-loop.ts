import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, Task, TaskStep, ChatMessage } from '@coding-agent/shared';
import { v4 as uuid } from 'uuid';
import { streamGeneratePlan, parsePlanSteps, streamExecutePlan } from './planner.js';
import { executeStep } from './executor.js';
import { getFileTree } from '../services/workspace.js';
import * as sessionService from '../services/session.js';
import { buildContextHistory } from './history.js';
import type { AIProvider, AIMessage, AIContentBlock } from '../providers/provider.js';

const MAX_ROUNDS = 5;
const MAX_TOOL_RESULT_CHARS = 20_000; // ~5k tokens

function truncateToolResult(output: string): string {
  if (output.length <= MAX_TOOL_RESULT_CHARS) return output;
  const half = Math.floor(MAX_TOOL_RESULT_CHARS / 2);
  return (
    output.slice(0, half) +
    `\n\n... [已截断 ${output.length - MAX_TOOL_RESULT_CHARS} 字符] ...\n\n` +
    output.slice(-half)
  );
}

// --- Approval mechanism ---

const pendingApprovals = new Map<string, { resolve: (approved: boolean) => void }>();

export function approvePlan(taskId: string): void {
  const p = pendingApprovals.get(taskId);
  if (p) { p.resolve(true); pendingApprovals.delete(taskId); }
}

export function rejectPlan(taskId: string): void {
  const p = pendingApprovals.get(taskId);
  if (p) { p.resolve(false); pendingApprovals.delete(taskId); }
}

function waitForApproval(taskId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(taskId);
      resolve(true); // 30秒自动审批
    }, 30_000);
    pendingApprovals.set(taskId, {
      resolve: (approved) => { clearTimeout(timer); resolve(approved); },
    });
  });
}

// --- Step matching ---

function matchToolCallToStep(
  toolName: string,
  toolInput: Record<string, unknown>,
  pendingSteps: TaskStep[],
): TaskStep | null {
  return pendingSteps.find(
    (s) => s.status === 'pending' && s.tool === toolName &&
           s.toolInput?.path === toolInput.path
  ) ?? null;
}

// --- Main agent loop ---

export async function runAgentLoop(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  provider: AIProvider,
  userMessage: string,
  abortSignal: { aborted: boolean },
  sessionId: string,
): Promise<void> {
  const taskId = uuid();
  const task: Task = {
    id: taskId,
    prompt: userMessage,
    status: 'planning',
    steps: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Emit user message and persist
  const userChatMsg: ChatMessage = {
    id: uuid(),
    role: 'user',
    content: userMessage,
    taskId,
    timestamp: Date.now(),
  };
  socket.emit('chat:message', userChatMsg);
  await sessionService.addMessageToSession(sessionId, userChatMsg);

  // Emit task created and persist
  socket.emit('task:created', { ...task });
  await sessionService.upsertTaskInSession(sessionId, task);

  // Load prior task context from this session
  const taskHistories = await sessionService.getTaskHistories(sessionId);
  const session = await sessionService.getSession(sessionId);
  const priorContext = buildContextHistory(taskHistories, session.tasks);

  // Conversation history with proper tool_use/tool_result structure
  const conversationHistory: AIMessage[] = [
    ...priorContext,
    { role: 'user', content: userMessage },
  ];

  try {
    // ========== Phase 1: Planning ==========
    console.log('[Agent Loop] Phase 1: Planning');

    const planStreamMsgId = uuid();
    socket.emit('chat:stream:start', { messageId: planStreamMsgId, taskId });

    const planResult = await streamGeneratePlan(
      provider,
      conversationHistory,
      {
        onText: (delta) => {
          socket.emit('chat:stream:delta', { messageId: planStreamMsgId, delta });
        },
      },
    );

    socket.emit('chat:stream:end', { messageId: planStreamMsgId });

    // Emit assistant chat message for UI (plan text)
    if (planResult.content) {
      const assistantMsg: ChatMessage = {
        id: planStreamMsgId,
        role: 'assistant',
        content: planResult.content,
        taskId,
        timestamp: Date.now(),
      };
      socket.emit('chat:message', assistantMsg);
      await sessionService.addMessageToSession(sessionId, assistantMsg);
    }

    // Parse plan steps
    const planSteps = parsePlanSteps(planResult.content);

    // If no steps parsed → pure conversation reply, complete immediately
    if (planSteps.length === 0) {
      if (planResult.content) {
        conversationHistory.push({ role: 'assistant', content: planResult.content });
        task.summary = planResult.content;
      }
      task.status = 'completed';
      task.updatedAt = Date.now();
      socket.emit('task:updated', { ...task });
      await sessionService.upsertTaskInSession(sessionId, task);

      const thisTaskMessages = conversationHistory.slice(priorContext.length);
      await sessionService.appendTaskHistory(sessionId, { taskId, messages: thisTaskMessages });
      return;
    }

    // Attach plan steps to task
    for (const step of planSteps) {
      step.afterMessageId = planStreamMsgId;
    }
    task.steps = planSteps;
    task.plan = planResult.content;
    task.status = 'awaiting_approval';
    task.updatedAt = Date.now();
    socket.emit('task:updated', { ...task });
    await sessionService.upsertTaskInSession(sessionId, task);

    // Emit plan:ready for client approval UI
    socket.emit('plan:ready', { taskId, plan: planResult.content, steps: planSteps });

    // ========== Wait for approval ==========
    console.log('[Agent Loop] Waiting for approval (taskId: %s)', taskId);

    if (abortSignal.aborted) {
      task.status = 'cancelled';
      task.updatedAt = Date.now();
      socket.emit('task:updated', { ...task });
      await sessionService.upsertTaskInSession(sessionId, task);
      return;
    }

    const approved = await waitForApproval(taskId);

    if (!approved) {
      console.log('[Agent Loop] Plan rejected (taskId: %s)', taskId);
      task.status = 'cancelled';
      task.updatedAt = Date.now();
      // Mark all steps as skipped
      for (const step of task.steps) {
        step.status = 'skipped';
        socket.emit('task:step:updated', { taskId, step: { ...step } });
      }
      socket.emit('task:updated', { ...task });
      await sessionService.upsertTaskInSession(sessionId, task);

      const thisTaskMessages = conversationHistory.slice(priorContext.length);
      if (thisTaskMessages.length > 0) {
        if (thisTaskMessages.at(-1)?.role === 'user') {
          thisTaskMessages.push({ role: 'assistant', content: planResult.content || '计划已取消。' });
        }
        await sessionService.appendTaskHistory(sessionId, { taskId, messages: thisTaskMessages });
      }
      return;
    }

    // ========== Phase 2: Execution ==========
    console.log('[Agent Loop] Phase 2: Execution');

    task.status = 'running';
    task.updatedAt = Date.now();
    socket.emit('task:updated', { ...task });
    await sessionService.upsertTaskInSession(sessionId, task);

    // Add plan as assistant message and a follow-up user message to conversation
    conversationHistory.push({ role: 'assistant', content: planResult.content });
    conversationHistory.push({ role: 'user', content: '好的，请开始执行计划。' });

    let round = 0;

    while (round < MAX_ROUNDS) {
      if (abortSignal.aborted) {
        task.status = 'cancelled';
        task.updatedAt = Date.now();
        // Mark remaining pending steps as skipped
        for (const step of task.steps) {
          if (step.status === 'pending') {
            step.status = 'skipped';
            socket.emit('task:step:updated', { taskId, step: { ...step } });
          }
        }
        socket.emit('task:updated', { ...task });
        await sessionService.upsertTaskInSession(sessionId, task);

        const thisTaskMessages = conversationHistory.slice(priorContext.length);
        if (thisTaskMessages.length > 0) {
          if (thisTaskMessages.at(-1)?.role === 'user') {
            thisTaskMessages.push({ role: 'assistant', content: '任务已取消。' });
          }
          await sessionService.appendTaskHistory(sessionId, { taskId, messages: thisTaskMessages });
        }
        return;
      }

      round++;

      // Create a streaming message for this round's AI text
      const streamMsgId = uuid();
      socket.emit('chat:stream:start', { messageId: streamMsgId, taskId });

      // Stream execution from AI — with plan in system prompt
      const execResult = await streamExecutePlan(
        provider,
        conversationHistory,
        planResult.content,
        {
          onText: (delta) => {
            socket.emit('chat:stream:delta', { messageId: streamMsgId, delta });
          },
        },
      );

      socket.emit('chat:stream:end', { messageId: streamMsgId });

      // Emit assistant chat message for UI (text only)
      if (execResult.content) {
        const assistantMsg: ChatMessage = {
          id: streamMsgId,
          role: 'assistant',
          content: execResult.content,
          taskId,
          timestamp: Date.now(),
        };
        socket.emit('chat:message', assistantMsg);
        await sessionService.addMessageToSession(sessionId, assistantMsg);
      }

      // If no tool calls: check if response was truncated
      if (execResult.steps.length === 0) {
        if (execResult.stopReason === 'max_tokens') {
          console.log('[Agent Loop] max_tokens hit, requesting continuation (round %d/%d)', round, MAX_ROUNDS);
          if (execResult.content) {
            conversationHistory.push({ role: 'assistant', content: execResult.content });
          }
          conversationHistory.push({ role: 'user', content: '继续' });
          continue;
        }
        if (execResult.content) {
          conversationHistory.push({ role: 'assistant', content: execResult.content });
          task.summary = execResult.content;
        }
        break;
      }

      // Store the full assistant response with tool_use blocks in conversation history
      const assistantBlocks: AIContentBlock[] = [];
      if (execResult.content) {
        assistantBlocks.push({ type: 'text', text: execResult.content });
      }
      for (const tc of execResult.toolCalls) {
        assistantBlocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
      }
      conversationHistory.push({ role: 'assistant', content: assistantBlocks });

      // Match tool calls to plan steps or create new steps
      const newSteps = execResult.steps;
      const resolvedSteps: TaskStep[] = [];

      for (let i = 0; i < newSteps.length; i++) {
        const newStep = newSteps[i];
        const matched = matchToolCallToStep(
          newStep.tool!,
          newStep.toolInput!,
          task.steps,
        );

        if (matched) {
          // Reuse the existing planned step
          matched.afterMessageId = streamMsgId;
          resolvedSteps.push(matched);
        } else {
          // Unmatched: add as a new step to the task
          newStep.afterMessageId = streamMsgId;
          task.steps.push(newStep);
          resolvedSteps.push(newStep);
        }
      }

      task.updatedAt = Date.now();
      socket.emit('task:updated', { ...task });

      // Execute each step and collect results
      const stepResults: string[] = [];
      for (let i = 0; i < resolvedSteps.length; i++) {
        const step = resolvedSteps[i];

        if (abortSignal.aborted) {
          step.status = 'skipped';
          socket.emit('task:step:updated', { taskId, step: { ...step } });
          stepResults.push('Skipped');
          continue;
        }

        // Mark step running
        step.status = 'running';
        socket.emit('task:step:updated', { taskId, step: { ...step } });

        // Small delay for UI visibility
        await new Promise((r) => setTimeout(r, 300));

        // Execute — use the newSteps entry for tool input (it has the full input from LLM)
        const execStep = newSteps[i];
        const result = await executeStep(execStep);
        stepResults.push(result.toolResult.output);

        // Update the resolved step with execution results
        step.status = result.step.status;
        step.result = result.step.result;
        step.error = result.step.error;

        // If file was changed, attach diff to step and emit
        if (result.toolResult.diff) {
          step.diff = result.toolResult.diff;
          socket.emit('file:changed', result.toolResult.diff);
          const tree = await getFileTree();
          socket.emit('file:tree', tree);
        }

        // Emit step update (with diff attached if present)
        socket.emit('task:step:updated', { taskId, step: { ...step } });
      }

      // Add tool results as a single user message with proper tool_result blocks
      const toolResultBlocks: AIContentBlock[] = execResult.toolCalls.map((tc, i) => ({
        type: 'tool_result' as const,
        tool_use_id: tc.id,
        content: truncateToolResult(stepResults[i] || 'No output'),
      }));
      conversationHistory.push({ role: 'user', content: toolResultBlocks });

      console.log('[LLM Context] Tool results added to conversation as tool_result blocks');

      // Persist task after each execution round
      await sessionService.upsertTaskInSession(sessionId, task);
    }

    // Mark remaining pending steps as skipped
    for (const step of task.steps) {
      if (step.status === 'pending') {
        step.status = 'skipped';
        socket.emit('task:step:updated', { taskId, step: { ...step } });
      }
    }

    // Handle trailing user turn (e.g. MAX_ROUNDS exhausted after tool_result)
    if (conversationHistory.at(-1)?.role === 'user') {
      conversationHistory.push({
        role: 'assistant',
        content: task.summary || '任务处理已达到最大轮次。',
      });
    }

    // Finalize task and persist
    task.status = abortSignal.aborted ? 'cancelled' : 'completed';
    task.updatedAt = Date.now();
    socket.emit('task:updated', { ...task });
    await sessionService.upsertTaskInSession(sessionId, task);

    // Save this task's conversation history for future context
    const thisTaskMessages = conversationHistory.slice(priorContext.length);
    await sessionService.appendTaskHistory(sessionId, { taskId, messages: thisTaskMessages });
  } catch (err: any) {
    console.error('Agent loop error:', err);
    task.status = 'failed';
    task.updatedAt = Date.now();
    socket.emit('task:updated', { ...task });
    await sessionService.upsertTaskInSession(sessionId, task);

    // Save partial history even on error
    const thisTaskMessages = conversationHistory.slice(priorContext.length);
    if (thisTaskMessages.length > 0) {
      // Ensure no trailing user turn
      if (thisTaskMessages.at(-1)?.role === 'user') {
        thisTaskMessages.push({
          role: 'assistant',
          content: task.summary || '任务处理出错。',
        });
      }
      await sessionService.appendTaskHistory(sessionId, { taskId, messages: thisTaskMessages });
    }

    socket.emit('error', { message: err.message });
  }
}
