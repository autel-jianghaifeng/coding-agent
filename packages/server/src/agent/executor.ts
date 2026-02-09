import { toolMap, type ToolResult } from './tools/index.js';
import type { TaskStep, FileDiff } from '@coding-agent/shared';

export interface ExecutionResult {
  step: TaskStep;
  toolResult: ToolResult;
}

export async function executeStep(step: TaskStep): Promise<ExecutionResult> {
  const tool = toolMap.get(step.tool!);

  if (!tool) {
    step.status = 'failed';
    step.error = `Unknown tool: ${step.tool}`;
    return {
      step,
      toolResult: { success: false, output: step.error },
    };
  }

  try {
    step.status = 'running';
    const result = await tool.execute(step.toolInput || {});

    if (result.success) {
      step.status = 'completed';
      step.result = result.output;
    } else {
      step.status = 'failed';
      step.error = result.output;
    }

    return { step, toolResult: result };
  } catch (err: any) {
    step.status = 'failed';
    step.error = err.message;
    return {
      step,
      toolResult: { success: false, output: err.message },
    };
  }
}
