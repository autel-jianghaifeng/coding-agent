import type { AIProvider, AIMessage, StreamCallbacks } from '../providers/provider.js';
import type { TaskStep } from '@coding-agent/shared';
import { v4 as uuid } from 'uuid';

// const SYSTEM_PROMPT = `You are a coding agent that helps users build software projects. You have access to a sandboxed workspace directory.

// Available tools:
// - read-file: Read a file from the workspace
// - write-file: Write content to a file (creates directories as needed)
// - create-dir: Create a directory
// - list-dir: List directory contents
// - search-files: Search for files matching a pattern

// When given a task:
// 1. Break it down into clear steps
// 2. Use the tools to accomplish each step
// 3. After all tool calls are executed, provide a summary

// Always write clean, well-structured code. Create complete, working files.`;

const SYSTEM_PROMPT = `你是一个编程助手，帮助用户完成编程任务。
每当用户提出一个编程任务时，你首先需要理解用户的需求，然后根据需求生成一个详细的计划，并使用工具执行计划。
总是编写清晰、结构良好的代码。创建完整的、可工作的文件。`;

export async function planTask(
  provider: AIProvider,
  userPrompt: string,
  conversationHistory: AIMessage[],
): Promise<{ content: string; steps: TaskStep[]; toolCalls: { name: string; input: Record<string, unknown> }[] }> {
  const messages: AIMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userPrompt },
  ];

  const response = await provider.chat(messages, SYSTEM_PROMPT);

  const steps: TaskStep[] = response.toolCalls.map((tc) => ({
    id: uuid(),
    title: `${tc.name}: ${getToolSummary(tc.name, tc.input)}`,
    description: JSON.stringify(tc.input, null, 2),
    status: 'pending' as const,
    tool: tc.name,
    toolInput: tc.input,
  }));

  return {
    content: response.content,
    steps,
    toolCalls: response.toolCalls,
  };
}

export async function streamPlanTask(
  provider: AIProvider,
  userPrompt: string,
  conversationHistory: AIMessage[],
  callbacks: StreamCallbacks,
): Promise<{ content: string; steps: TaskStep[]; toolCalls: { name: string; input: Record<string, unknown> }[] }> {
  const messages: AIMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userPrompt },
  ];

  const response = await provider.streamChat(messages, SYSTEM_PROMPT, callbacks);

  const steps: TaskStep[] = response.toolCalls.map((tc) => ({
    id: uuid(),
    title: `${tc.name}: ${getToolSummary(tc.name, tc.input)}`,
    description: JSON.stringify(tc.input, null, 2),
    status: 'pending' as const,
    tool: tc.name,
    toolInput: tc.input,
  }));

  return {
    content: response.content,
    steps,
    toolCalls: response.toolCalls,
  };
}

function getToolSummary(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'read-file':
      return `${input.path}`;
    case 'write-file':
      return `${input.path}`;
    case 'create-dir':
      return `${input.path}`;
    case 'list-dir':
      return `${input.path || '.'}`;
    case 'search-files':
      return `"${input.pattern}"`;
    default:
      return toolName;
  }
}

export { SYSTEM_PROMPT };
