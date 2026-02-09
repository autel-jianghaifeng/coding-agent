import React, { useState } from 'react';
import type { TaskStep as TaskStepType } from '@coding-agent/shared';
import { FileChangeBlock } from './FileChangeBlock';

function StatusIcon({ status }: { status: TaskStepType['status'] }) {
  switch (status) {
    case 'running':
      return (
        <div
          style={{
            width: 16,
            height: 16,
            border: '2px solid var(--accent)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      );
    case 'completed':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="var(--success)" opacity="0.2" />
          <path d="M5 8l2 2 4-4" stroke="var(--success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'failed':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="var(--error)" opacity="0.2" />
          <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="var(--error)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'skipped':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="var(--text-muted)" opacity="0.2" />
          <path d="M4 8h8" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: '1.5px solid var(--text-muted)',
          }}
        />
      );
  }
}

export function TaskStepComponent({ step, index }: { step: TaskStepType; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = step.diff != null;

  // For file write steps with a diff, render the FileChangeBlock style
  if (hasDiff && step.diff) {
    return (
      <div style={{ marginLeft: 8 }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        {/* Status line */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 0 0 0',
          }}
        >
          <StatusIcon status={step.status} />
        </div>
        {/* File change block */}
        <div style={{ marginLeft: 24, marginTop: 2 }}>
          <FileChangeBlock diff={step.diff} />
        </div>
      </div>
    );
  }

  // Default rendering for non-file steps
  return (
    <div style={{ marginLeft: 8 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 0',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <StatusIcon status={step.status} />
        <span
          style={{
            fontSize: 13,
            color: step.status === 'failed' ? 'var(--error)' : 'var(--text-primary)',
          }}
        >
          {step.title}
        </span>
      </div>
      {expanded && (
        <div
          style={{
            marginLeft: 24,
            padding: '4px 8px',
            fontSize: 12,
            color: 'var(--text-secondary)',
            background: 'var(--bg-tertiary)',
            borderRadius: 4,
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: 200,
            overflow: 'auto',
          }}
        >
          {step.error || step.result || step.description}
        </div>
      )}
    </div>
  );
}
