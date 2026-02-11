export type TaskStatus = 'pending' | 'planning' | 'awaiting_approval' | 'running' | 'completed' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface TaskStep {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  tool?: string;
  toolInput?: Record<string, unknown>;
  result?: string;
  error?: string;
  diff?: import('./file.js').FileDiff;
  /** The assistant message ID after which this step should appear in the timeline */
  afterMessageId?: string;
  /** 在计划中的序号（从 0 开始） */
  planIndex?: number;
}

export interface Task {
  id: string;
  prompt: string;
  status: TaskStatus;
  steps: TaskStep[];
  summary?: string;
  /** 规划阶段生成的完整计划文本 */
  plan?: string;
  createdAt: number;
  updatedAt: number;
}
