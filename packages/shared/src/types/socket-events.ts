import type { ChatMessage } from './message.js';
import type { Task, TaskStep } from './task.js';
import type { FileNode, FileContent, FileDiff } from './file.js';
import type { Session, SessionSummary } from './session.js';

export interface ClientToServerEvents {
  'chat:send': (data: { message: string; sessionId: string }) => void;
  'chat:cancel': () => void;
  'file:select': (data: { path: string }) => void;
  'file:tree': () => void;
  'workspace:init': () => void;
  'session:list': () => void;
  'session:create': (data: { title?: string }) => void;
  'session:load': (data: { sessionId: string }) => void;
  'session:delete': (data: { sessionId: string }) => void;
  'plan:approve': (data: { taskId: string }) => void;
  'plan:reject': (data: { taskId: string }) => void;
}

export interface ServerToClientEvents {
  'chat:message': (message: ChatMessage) => void;
  'task:created': (task: Task) => void;
  'task:updated': (task: Task) => void;
  'task:step:updated': (data: { taskId: string; step: TaskStep }) => void;
  'file:tree': (tree: FileNode[]) => void;
  'file:content': (file: FileContent) => void;
  'file:changed': (diff: FileDiff) => void;
  'chat:stream:start': (data: { messageId: string; taskId?: string }) => void;
  'chat:stream:delta': (data: { messageId: string; delta: string }) => void;
  'chat:stream:end': (data: { messageId: string }) => void;
  'error': (data: { message: string }) => void;
  'session:list': (sessions: SessionSummary[]) => void;
  'session:created': (summary: SessionSummary) => void;
  'session:loaded': (session: Session) => void;
  'plan:ready': (data: { taskId: string; plan: string; steps: TaskStep[] }) => void;
  'session:deleted': (data: { sessionId: string }) => void;
}
