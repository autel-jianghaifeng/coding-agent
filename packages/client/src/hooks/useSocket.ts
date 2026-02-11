import { useEffect } from 'react';
import { socket } from '../lib/socket';
import { useStore } from '../store';

export function useSocket() {
  const {
    setConnected,
    addMessage,
    setTask,
    updateTaskStep,
    setFileTree,
    setActiveFile,
    setActiveDiff,
    setProcessing,
    setError,
    setSessions,
    addSession,
    loadSessionData,
    removeSession,
    setActiveSessionId,
    clearMessages,
    startStreamingMessage,
    appendStreamingDelta,
    endStreamingMessage,
    setPendingPlan,
    clearPendingPlan,
  } = useStore();

  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('workspace:init');
      socket.emit('session:list');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('chat:message', (message) => {
      addMessage(message);
    });

    socket.on('task:created', (task) => {
      setTask(task);
      setProcessing(true);
    });

    socket.on('task:updated', (task) => {
      setTask(task);
      if (task.status !== 'running' && task.status !== 'pending' && task.status !== 'planning' && task.status !== 'awaiting_approval') {
        setProcessing(false);
        clearPendingPlan();
      }
    });

    socket.on('task:step:updated', ({ taskId, step }) => {
      updateTaskStep(taskId, step);
    });

    socket.on('plan:ready', ({ taskId }) => {
      setPendingPlan(taskId);
      setProcessing(false);
    });

    socket.on('file:tree', (tree) => {
      setFileTree(tree);
    });

    socket.on('file:content', (file) => {
      setActiveFile(file);
    });

    socket.on('file:changed', (diff) => {
      setActiveDiff(diff);
    });

    // Streaming events
    socket.on('chat:stream:start', ({ messageId, taskId }) => {
      startStreamingMessage(messageId, taskId);
    });

    socket.on('chat:stream:delta', ({ messageId, delta }) => {
      appendStreamingDelta(messageId, delta);
    });

    socket.on('chat:stream:end', ({ messageId }) => {
      endStreamingMessage(messageId);
    });

    socket.on('error', ({ message }) => {
      setError(message);
      setTimeout(() => setError(null), 5000);
    });

    // Session events
    socket.on('session:list', (sessions) => {
      setSessions(sessions);

      const storedId = useStore.getState().activeSessionId;
      if (storedId && sessions.some((s) => s.id === storedId)) {
        // Reload the stored session
        socket.emit('session:load', { sessionId: storedId });
      } else if (sessions.length > 0) {
        // Load the most recent session
        const mostRecent = sessions[0];
        setActiveSessionId(mostRecent.id);
        socket.emit('session:load', { sessionId: mostRecent.id });
      } else {
        // No sessions exist, create one
        socket.emit('session:create', {});
      }
    });

    socket.on('session:created', (summary) => {
      addSession(summary);
      setActiveSessionId(summary.id);
      // Clear current chat for the new session
      useStore.setState({ messages: [], tasks: new Map(), activeTaskId: null });
    });

    socket.on('session:loaded', (session) => {
      loadSessionData(session);
    });

    socket.on('session:deleted', ({ sessionId }) => {
      removeSession(sessionId);
      // If we just deleted the active session, load another or create new
      if (useStore.getState().activeSessionId === null) {
        const remaining = useStore.getState().sessions;
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
          socket.emit('session:load', { sessionId: remaining[0].id });
        } else {
          socket.emit('session:create', {});
        }
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('chat:message');
      socket.off('task:created');
      socket.off('task:updated');
      socket.off('task:step:updated');
      socket.off('file:tree');
      socket.off('file:content');
      socket.off('file:changed');
      socket.off('error');
      socket.off('session:list');
      socket.off('session:created');
      socket.off('session:loaded');
      socket.off('chat:stream:start');
      socket.off('chat:stream:delta');
      socket.off('chat:stream:end');
      socket.off('plan:ready');
      socket.off('session:deleted');
      socket.disconnect();
    };
  }, []);
}
