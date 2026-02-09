import React from 'react';
import { useStore } from '../../store';

export function AppShell({ children }: { children: React.ReactNode }) {
  const connected = useStore((s) => s.connected);
  const error = useStore((s) => s.error);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>Coding Agent</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: connected ? 'var(--success)' : 'var(--error)',
            }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </header>
      {error && (
        <div
          style={{
            padding: '8px 16px',
            background: 'rgba(244, 71, 71, 0.15)',
            color: 'var(--error)',
            fontSize: 13,
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          {error}
        </div>
      )}
      <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}
