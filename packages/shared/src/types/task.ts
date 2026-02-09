export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
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
}

export interface Task {
  id: string;
  prompt: string;
  status: TaskStatus;
  steps: TaskStep[];
  summary?: string;
  createdAt: number;
  updatedAt: number;
}
