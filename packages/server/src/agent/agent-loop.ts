import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, Task, ChatMessage } from '@coding-agent/shared';
import { v4 as uuid } from 'uuid';
import { streamPlanTask, SYSTEM_PROMPT } from './planner.js';
import { executeStep } from './executor.js';
import { getFileTree } from '../services/workspace.js';
import * as sessionService from '../services/session.js';
import type { AIProvider, AIMessage } from '../providers/provider.js';

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

  const conversationHistory: AIMessage[] = [];
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

      // Stream plan from AI — text deltas are forwarded to client in real-time
      const plan = await streamPlanTask(
        provider,
        round === 1 ? userMessage : 'Continue executing the plan. Use tools if needed, or provide a final summary if done.',
        conversationHistory,
        {
          onText: (delta) => {
            socket.emit('chat:stream:delta', { messageId: streamMsgId, delta });
          },
        },
      );

      // End the stream
      socket.emit('chat:stream:end', { messageId: streamMsgId });

      if (plan.content) {
        conversationHistory.push({ role: 'assistant', content: plan.content });

        // Persist the assistant message for every round that has text
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

      // If no tool calls, we're done
      if (plan.steps.length === 0) {
        if (plan.content) {
          task.summary = plan.content;
        }
        break;
      }

      // Add steps to task
      task.steps.push(...plan.steps);
      task.updatedAt = Date.now();
      socket.emit('task:updated', { ...task });

      // Execute each step
      for (const step of plan.steps) {
        if (abortSignal.aborted) {
          step.status = 'skipped';
          socket.emit('task:step:updated', { taskId, step: { ...step } });
          continue;
        }

        // Mark step running
        step.status = 'running';
        socket.emit('task:step:updated', { taskId, step: { ...step } });

        // Small delay for UI visibility
        await new Promise((r) => setTimeout(r, 300));

        // Execute
        const result = await executeStep(step);

        // If file was changed, attach diff to step and emit
        if (result.toolResult.diff) {
          result.step.diff = result.toolResult.diff;
          socket.emit('file:changed', result.toolResult.diff);
          const tree = await getFileTree();
          socket.emit('file:tree', tree);
        }

        // Emit step update (with diff attached if present)
        socket.emit('task:step:updated', { taskId, step: { ...result.step } });

        // Add tool result to conversation context
        conversationHistory.push({
          role: 'user',
          content: `Tool "${step.tool}" executed. Result: ${result.toolResult.output}`,
        });
      }

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
