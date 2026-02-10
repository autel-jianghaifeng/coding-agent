import type { AIProvider, AIMessage, AIContentBlock, AIResponse, StreamCallbacks } from '../providers/provider.js';
import type { TaskStep } from '@coding-agent/shared';
import { v4 as uuid } from 'uuid';

const SYSTEM_PROMPT = `你是一个编程助手，帮助用户完成编程任务。
每当用户提出一个编程任务时，你首先需要理解用户的需求，然后根据需求生成一个详细的计划，并使用工具执行计划。
总是编写清晰、结构良好的代码。创建完整的、可工作的文件。`;

export interface PlanResult {
  content: string;
  steps: TaskStep[];
  toolCalls: { id: string; name: string; input: Record<string, unknown> }[];
  stopReason: AIResponse['stopReason'];
}

export async function planTask(
  provider: AIProvider,
  userPrompt: string,
  conversationHistory: AIMessage[],
): Promise<PlanResult> {
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
    stopReason: response.stopReason,
  };
}

/**
 * Stream a plan from the AI provider.
 * @param conversationHistory - Full conversation history (including user messages and tool results).
 *   For the first round, the caller should append the user message before calling.
 *   For continuation rounds, the history already ends with a tool_result user message.
 */
export async function streamPlanTask(
  provider: AIProvider,
  conversationHistory: AIMessage[],
  callbacks: StreamCallbacks,
): Promise<PlanResult> {
  const response = await provider.streamChat(conversationHistory, SYSTEM_PROMPT, callbacks);

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
    stopReason: response.stopReason,
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
