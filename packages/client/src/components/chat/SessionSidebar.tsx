import React from 'react';
import { useStore } from '../../store';
import { socket } from '../../lib/socket';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function SessionSidebar() {
  const sessions = useStore((s) => s.sessions);
  const activeSessionId = useStore((s) => s.activeSessionId);

  const handleCreate = () => {
    socket.emit('session:create', {});
  };

  const handleSelect = (sessionId: string) => {
    if (sessionId === activeSessionId) return;
    socket.emit('session:load', { sessionId });
  };

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    socket.emit('session:delete', { sessionId });
  };

  return (
    <div
      style={{
        width: 240,
        minWidth: 200,
        borderRight: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Sessions
        </span>
        <button
          onClick={handleCreate}
          style={{
            padding: '3px 8px',
            borderRadius: 4,
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          + New
        </button>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          return (
            <div
              key={session.id}
              onClick={() => handleSelect(session.id)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: isActive ? 'var(--bg-active)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)';
                const btn = e.currentTarget.querySelector('[data-delete]') as HTMLElement;
                if (btn) btn.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                const btn = e.currentTarget.querySelector('[data-delete]') as HTMLElement;
                if (btn) btn.style.opacity = '0';
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  paddingRight: 20,
                }}
              >
                {session.title}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  gap: 8,
                }}
              >
                <span>{formatTime(session.updatedAt)}</span>
                <span>{session.messageCount} msgs</span>
              </div>
              <button
                data-delete
                onClick={(e) => handleDelete(e, session.id)}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                  width: 18,
                  height: 18,
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.1s',
                  color: 'var(--text-muted)',
                  fontSize: 14,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--error)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          );
        })}
        {sessions.length === 0 && (
          <div style={{ padding: '16px 12px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
            No sessions yet
          </div>
        )}
      </div>
    </div>
  );
}
