import type { AIMessage } from '../providers/provider.js';
import type { Task } from '@coding-agent/shared';

export interface TaskHistory {
  taskId: string;
  messages: AIMessage[];
}

const MAX_CHAR_BUDGET = 100_000; // ~25k tokens
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

/** Estimate character count of an AIMessage array */
function estimateChars(messages: AIMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      total += msg.content.length;
    } else {
      for (const block of msg.content) {
        if (block.type === 'text') {
          total += block.text.length;
        } else if (block.type === 'tool_use') {
          total += JSON.stringify(block.input).length + block.name.length;
        } else if (block.type === 'tool_result') {
          total += block.content.length;
        }
      }
    }
  }
  return total;
}

/** Compress a task into a summary pair: [user prompt, assistant summary] */
function compressTask(task: Task): AIMessage[] {
  return [
    { role: 'user', content: task.prompt },
    { role: 'assistant', content: task.summary || '（任务已完成，无摘要）' },
  ];
}

/**
 * Build context history from previous tasks for LLM consumption.
 * - Most recent 1 task: full AIMessage[] (with tool_use/tool_result)
 * - Older tasks (up to 10): compressed to [user prompt, assistant summary]
 * - Enforces a character budget, trimming from oldest first
 */
export function buildContextHistory(
  taskHistories: TaskHistory[],
  tasks: Task[],
): AIMessage[] {
  if (taskHistories.length === 0) return [];

  // Build a map of taskId -> Task for quick lookup
  const taskMap = new Map<string, Task>();
  for (const t of tasks) {
    taskMap.set(t.id, t);
  }

  // Split into recent (last 1) and older
  const recent = taskHistories.slice(-1);
  const older = taskHistories.slice(0, -1).slice(-10); // at most 10 older

  // Compress older tasks into summary pairs
  const olderMessages: AIMessage[][] = [];
  for (const th of older) {
    const task = taskMap.get(th.taskId);
    if (task) {
      olderMessages.push(compressTask(task));
    }
  }

  // Recent task: full messages
  const recentMessages: AIMessage[] = recent[0]?.messages ?? [];

  // Assemble: older summaries first, then recent full history
  let result: AIMessage[] = [];

  // Add older (compressed) — trim from oldest if over budget
  for (const msgs of olderMessages) {
    result.push(...msgs);
  }

  // Add recent (full)
  result.push(...recentMessages);

  // Truncate large tool_result blocks in prior context to prevent history bloat
  for (const msg of result) {
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'tool_result') {
          block.content = truncateToolResult(block.content);
        }
      }
    }
  }

  // Enforce budget: trim from the beginning (oldest) until within budget
  let totalChars = estimateChars(result);
  while (totalChars > MAX_CHAR_BUDGET && result.length > 0) {
    const removed = result.shift()!;
    const removedChars = estimateChars([removed]);
    totalChars -= removedChars;
  }

  return result;
}
