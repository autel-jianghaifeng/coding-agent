import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, Task, ChatMessage } from '@coding-agent/shared';
import { v4 as uuid } from 'uuid';
import { streamPlanTask } from './planner.js';
import { executeStep } from './executor.js';
import { getFileTree } from '../services/workspace.js';
import * as sessionService from '../services/session.js';
import type { AIProvider, AIMessage, AIContentBlock } from '../providers/provider.js';

const MAX_ROUNDS = 3;

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
    status: 'running',
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

  // Conversation history with proper tool_use/tool_result structure
  const conversationHistory: AIMessage[] = [
    { role: 'user', content: userMessage },
  ];
  let round = 0;

  try {
    while (round < MAX_ROUNDS) {
      if (abortSignal.aborted) {
        task.status = 'cancelled';
        task.updatedAt = Date.now();
        socket.emit('task:updated', { ...task });
        await sessionService.upsertTaskInSession(sessionId, task);
        return;
      }

      round++;

      // Create a streaming message for this round's AI text
      const streamMsgId = uuid();
      socket.emit('chat:stream:start', { messageId: streamMsgId, taskId });

      // Stream plan from AI — conversationHistory already contains all context
      const plan = await streamPlanTask(
        provider,
        conversationHistory,
        {
          onText: (delta) => {
            socket.emit('chat:stream:delta', { messageId: streamMsgId, delta });
          },
        },
      );

      // End the stream
      socket.emit('chat:stream:end', { messageId: streamMsgId });

      // Emit assistant chat message for UI (text only)
      if (plan.content) {
        const assistantMsg: ChatMessage = {
          id: streamMsgId,
          role: 'assistant',
          content: plan.content,
          taskId,
          timestamp: Date.now(),
        };
        socket.emit('chat:message', assistantMsg);
        await sessionService.addMessageToSession(sessionId, assistantMsg);
      }

      // If no tool calls, add text to history and break
      if (plan.steps.length === 0) {
        if (plan.content) {
          conversationHistory.push({ role: 'assistant', content: plan.content });
          task.summary = plan.content;
        }
        break;
      }

      // Store the full assistant response with tool_use blocks in conversation history
      const assistantBlocks: AIContentBlock[] = [];
      if (plan.content) {
        assistantBlocks.push({ type: 'text', text: plan.content });
      }
      for (const tc of plan.toolCalls) {
        assistantBlocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
      }
      conversationHistory.push({ role: 'assistant', content: assistantBlocks });

      // Add steps to task, linking each to the assistant message from this round
      for (const step of plan.steps) {
        step.afterMessageId = streamMsgId;
      }
      task.steps.push(...plan.steps);
      task.updatedAt = Date.now();
      socket.emit('task:updated', { ...task });

      // Execute each step and collect results
      const stepResults: string[] = [];
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];

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

        // Execute
        const result = await executeStep(step);
        stepResults.push(result.toolResult.output);

        // If file was changed, attach diff to step and emit
        if (result.toolResult.diff) {
          result.step.diff = result.toolResult.diff;
          socket.emit('file:changed', result.toolResult.diff);
          const tree = await getFileTree();
          socket.emit('file:tree', tree);
        }

        // Emit step update (with diff attached if present)
        socket.emit('task:step:updated', { taskId, step: { ...result.step } });
      }

      // Add tool results as a single user message with proper tool_result blocks
      const toolResultBlocks: AIContentBlock[] = plan.toolCalls.map((tc, i) => ({
        type: 'tool_result' as const,
        tool_use_id: tc.id,
        content: stepResults[i] || 'No output',
      }));
      conversationHistory.push({ role: 'user', content: toolResultBlocks });

      console.log('[LLM Context] Tool results added to conversation as tool_result blocks');

      // Persist task after each execution round
      await sessionService.upsertTaskInSession(sessionId, task);
    }

    // Finalize task and persist
    task.status = abortSignal.aborted ? 'cancelled' : 'completed';
    task.updatedAt = Date.now();
    socket.emit('task:updated', { ...task });
    await sessionService.upsertTaskInSession(sessionId, task);
  } catch (err: any) {
    console.error('Agent loop error:', err);
    task.status = 'failed';
    task.updatedAt = Date.now();
    socket.emit('task:updated', { ...task });
    await sessionService.upsertTaskInSession(sessionId, task);
    socket.emit('error', { message: err.message });
  }
}
