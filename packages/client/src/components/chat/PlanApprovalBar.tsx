import React, { useState, useEffect, useCallback } from 'react';
import { socket } from '../../lib/socket';
import { useStore } from '../../store';

export function PlanApprovalBar() {
  const pendingPlanTaskId = useStore((s) => s.pendingPlanTaskId);
  const clearPendingPlan = useStore((s) => s.clearPendingPlan);
  const tasks = useStore((s) => s.tasks);
  const [countdown, setCountdown] = useState(30);

  const task = pendingPlanTaskId ? tasks.get(pendingPlanTaskId) : null;
  const stepCount = task?.steps.length ?? 0;

  useEffect(() => {
    if (!pendingPlanTaskId) return;
    setCountdown(30);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          socket.emit('plan:approve', { taskId: pendingPlanTaskId });
          clearPendingPlan();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pendingPlanTaskId, clearPendingPlan]);

  const approve = useCallback(() => {
    if (!pendingPlanTaskId) return;
    socket.emit('plan:approve', { taskId: pendingPlanTaskId });
    clearPendingPlan();
  }, [pendingPlanTaskId, clearPendingPlan]);

  const reject = useCallback(() => {
    if (!pendingPlanTaskId) return;
    socket.emit('plan:reject', { taskId: pendingPlanTaskId });
    clearPendingPlan();
  }, [pendingPlanTaskId, clearPendingPlan]);

  if (!pendingPlanTaskId) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '12px 16px',
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Plan ready: {stepCount} step{stepCount !== 1 ? 's' : ''} ({countdown}s auto-execute)
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={approve}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            background: 'var(--success, #22c55e)',
            color: '#fff',
            fontWeight: 500,
            fontSize: 13,
            minHeight: 36,
            cursor: 'pointer',
            border: 'none',
          }}
        >
          Execute Plan
        </button>
        <button
          onClick={reject}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            fontWeight: 500,
            fontSize: 13,
            minHeight: 36,
            cursor: 'pointer',
            border: '1px solid var(--border-color)',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
