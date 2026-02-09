import React from 'react';
import { useStore } from '../../store';

export function ChatHeader() {
  const sessions = useStore((s) => s.sessions);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const sessionSidebarOpen = useStore((s) => s.sessionSidebarOpen);
  const setSessionSidebarOpen = useStore((s) => s.setSessionSidebarOpen);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 36,
        padding: '0 12px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
      }}
    >
      <button
        onClick={() => setSessionSidebarOpen(!sessionSidebarOpen)}
        style={{
          width: 28,
          height: 28,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
        title={sessionSidebarOpen ? 'Hide sessions' : 'Show sessions'}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="2" width="14" height="12" rx="1" />
          <line x1="5.5" y1="2" x2="5.5" y2="14" />
        </svg>
      </button>
      <span
        style={{
          fontSize: 13,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontWeight: 500,
        }}
      >
        {activeSession?.title || 'No session'}
      </span>
    </div>
  );
}
