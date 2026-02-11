import type { AIProvider, AIMessage, AIContentBlock, AIResponse, StreamCallbacks } from '../providers/provider.js';
import type { TaskStep } from '@coding-agent/shared';
import { v4 as uuid } from 'uuid';

const SYSTEM_PROMPT = `你是一个编程助手，帮助用户完成编程任务。
每当用户提出一个编程任务时，你首先需要理解用户的需求，然后根据需求生成一个详细的计划，并使用工具执行计划。
总是编写清晰、结构良好的代码。创建完整的、可工作的文件。`;

const PLANNING_SYSTEM_PROMPT = `你是一个编程助手，帮助用户完成编程任务。

当用户提出编程任务时，你需要：
1. 仔细分析用户的需求
2. 考虑实现方案
3. 生成详细的分步执行计划

你的输出必须包含以下部分：

### 分析
对任务的理解和技术方案。

### 计划
用以下格式列出每个步骤（每行一个）：

1. [STEP:tool_name:target_path] 步骤描述
2. [STEP:tool_name:target_path] 步骤描述

可用的 tool_name：read-file, write-file, create-dir, list-dir, search-files
target_path 是工具操作的目标路径。

示例：
1. [STEP:list-dir:.] 查看当前项目结构
2. [STEP:read-file:src/index.ts] 读取入口文件了解现有代码
3. [STEP:write-file:src/components/Button.tsx] 创建按钮组件
4. [STEP:write-file:src/index.ts] 更新入口文件

请确保计划尽可能具体，每个步骤对应一个工具操作。`;

function buildExecutionSystemPrompt(planText: string): string {
  return `你是一个编程助手，正在按照预定计划执行编程任务。

以下是完整的执行计划：
${planText}

请严格按照计划顺序使用工具完成每个步骤。
总是编写清晰、结构良好的代码。创建完整的、可工作的文件。`;
}

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

  const response = await provider.chat(messages, SYSTEM_PROMPT, { enableCaching: true });

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
  const response = await provider.streamChat(conversationHistory, SYSTEM_PROMPT, callbacks, { enableCaching: true });

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
 * Stream a plan generation call (no tools, pure text output).
 */
export async function streamGeneratePlan(
  provider: AIProvider,
  conversationHistory: AIMessage[],
  callbacks: StreamCallbacks,
): Promise<{ content: string; stopReason: AIResponse['stopReason'] }> {
  const response = await provider.streamChat(
    conversationHistory,
    PLANNING_SYSTEM_PROMPT,
    callbacks,
    { enableCaching: true, disableTools: true },
  );
  return { content: response.content, stopReason: response.stopReason };
}

/**
 * Parse plan text into TaskStep[] from [STEP:tool:path] format.
 */
export function parsePlanSteps(planText: string): TaskStep[] {
  const stepRegex = /^\d+\.\s*\[STEP:([\w-]+):([^\]]*)\]\s*(.+)$/gm;
  const steps: TaskStep[] = [];
  let match;
  let index = 0;
  while ((match = stepRegex.exec(planText)) !== null) {
    const [, toolName, targetPath, description] = match;
    steps.push({
      id: uuid(),
      title: `${toolName}: ${targetPath.trim()}`,
      description: description.trim(),
      status: 'pending' as const,
      tool: toolName,
      toolInput: { path: targetPath.trim() },
      planIndex: index++,
    });
  }
  return steps;
}

/**
 * Stream an execution call with plan context injected into system prompt.
 */
export async function streamExecutePlan(
  provider: AIProvider,
  conversationHistory: AIMessage[],
  planText: string,
  callbacks: StreamCallbacks,
): Promise<PlanResult> {
  const response = await provider.streamChat(
    conversationHistory,
    buildExecutionSystemPrompt(planText),
    callbacks,
    { enableCaching: true },
  );

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

export { SYSTEM_PROMPT, PLANNING_SYSTEM_PROMPT };
