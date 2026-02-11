import { create } from 'zustand';
import type { ChatMessage, Task, TaskStep, FileNode, FileContent, FileDiff, Session, SessionSummary } from '@coding-agent/shared';

export type ViewMode = 'code' | 'diff';

interface AppState {
  // Connection
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // Sessions
  sessions: SessionSummary[];
  activeSessionId: string | null;
  sessionSidebarOpen: boolean;
  setSessions: (sessions: SessionSummary[]) => void;
  setActiveSessionId: (id: string | null) => void;
  addSession: (summary: SessionSummary) => void;
  removeSession: (sessionId: string) => void;
  setSessionSidebarOpen: (open: boolean) => void;
  loadSessionData: (session: Session) => void;

  // Messages
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;

  // Streaming
  streamingMessageId: string | null;
  startStreamingMessage: (messageId: string, taskId?: string) => void;
  appendStreamingDelta: (messageId: string, delta: string) => void;
  endStreamingMessage: (messageId: string) => void;

  // Tasks
  tasks: Map<string, Task>;
  activeTaskId: string | null;
  isProcessing: boolean;
  pendingPlanTaskId: string | null;
  setTask: (task: Task) => void;
  updateTaskStep: (taskId: string, step: TaskStep) => void;
  setProcessing: (processing: boolean) => void;
  setPendingPlan: (taskId: string) => void;
  clearPendingPlan: () => void;

  // File tree
  fileTree: FileNode[];
  setFileTree: (tree: FileNode[]) => void;

  // Active file
  activeFile: FileContent | null;
  setActiveFile: (file: FileContent | null) => void;

  // Diffs
  activeDiff: FileDiff | null;
  setActiveDiff: (diff: FileDiff | null) => void;

  // View mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Error
  error: string | null;
  setError: (error: string | null) => void;
}

export const useStore = create<AppState>((set, get) => ({
  connected: false,
  setConnected: (connected) => set({ connected }),

  // Sessions
  sessions: [],
  activeSessionId: localStorage.getItem('activeSessionId') || null,
  sessionSidebarOpen: true,
  setSessions: (sessions) => set({ sessions }),
  setActiveSessionId: (activeSessionId) => {
    if (activeSessionId) {
      localStorage.setItem('activeSessionId', activeSessionId);
    } else {
      localStorage.removeItem('activeSessionId');
    }
    set({ activeSessionId });
  },
  addSession: (summary) =>
    set((state) => ({ sessions: [summary, ...state.sessions] })),
  removeSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      ...(state.activeSessionId === sessionId
        ? { activeSessionId: null, messages: [], tasks: new Map(), activeTaskId: null }
        : {}),
    })),
  setSessionSidebarOpen: (sessionSidebarOpen) => set({ sessionSidebarOpen }),
  loadSessionData: (session) => {
    const tasks = new Map<string, Task>();
    for (const task of session.tasks) {
      tasks.set(task.id, task);
    }
    if (session.id) {
      localStorage.setItem('activeSessionId', session.id);
    }
    set({
      messages: session.messages,
      tasks,
      activeSessionId: session.id,
      activeTaskId: null,
      isProcessing: false,
    });
  },

  messages: [],
  addMessage: (message) =>
    set((state) => {
      // If a message with this ID already exists (from streaming), replace it
      const existingIndex = state.messages.findIndex((m) => m.id === message.id);
      if (existingIndex >= 0) {
        const updated = [...state.messages];
        updated[existingIndex] = message;
        return { messages: updated };
      }
      return { messages: [...state.messages, message] };
    }),
  clearMessages: () => set({ messages: [] }),

  // Streaming
  streamingMessageId: null,
  startStreamingMessage: (messageId, taskId) =>
    set((state) => ({
      streamingMessageId: messageId,
      messages: [
        ...state.messages,
        {
          id: messageId,
          role: 'assistant' as const,
          content: '',
          taskId,
          timestamp: Date.now(),
        },
      ],
    })),
  appendStreamingDelta: (messageId, delta) =>
    set((state) => {
      const idx = state.messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return state;
      const updated = [...state.messages];
      updated[idx] = { ...updated[idx], content: updated[idx].content + delta };
      return { messages: updated };
    }),
  endStreamingMessage: (messageId) =>
    set((state) => ({
      streamingMessageId: state.streamingMessageId === messageId ? null : state.streamingMessageId,
    })),

  tasks: new Map(),
  activeTaskId: null,
  isProcessing: false,
  pendingPlanTaskId: null,
  setTask: (task) =>
    set((state) => {
      const tasks = new Map(state.tasks);
      tasks.set(task.id, task);
      const isProcessing = task.status === 'running' || task.status === 'pending' || task.status === 'planning';
      return { tasks, activeTaskId: task.id, isProcessing };
    }),
  updateTaskStep: (taskId, step) =>
    set((state) => {
      const tasks = new Map(state.tasks);
      const task = tasks.get(taskId);
      if (task) {
        const stepIndex = task.steps.findIndex((s) => s.id === step.id);
        if (stepIndex >= 0) {
          task.steps[stepIndex] = step;
        } else {
          task.steps.push(step);
        }
        tasks.set(taskId, { ...task, updatedAt: Date.now() });
      }
      return { tasks };
    }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  setPendingPlan: (taskId) => set({ pendingPlanTaskId: taskId }),
  clearPendingPlan: () => set({ pendingPlanTaskId: null }),

  fileTree: [],
  setFileTree: (fileTree) => set({ fileTree }),

  activeFile: null,
  setActiveFile: (activeFile) => set({ activeFile, viewMode: 'code', activeDiff: null }),

  activeDiff: null,
  setActiveDiff: (activeDiff) =>
    set({
      activeDiff,
      viewMode: activeDiff ? 'diff' : 'code',
    }),

  viewMode: 'code',
  setViewMode: (viewMode) => set({ viewMode }),

  error: null,
  setError: (error) => set({ error }),
}));
