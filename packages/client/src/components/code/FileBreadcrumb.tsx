import React from 'react';
import { socket } from '../../lib/socket';

export function FileBreadcrumb({ path }: { path: string }) {
  const parts = path.split('/');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '4px 12px',
        fontSize: 13,
        color: 'var(--text-secondary)',
        overflow: 'hidden',
      }}
    >
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span style={{ margin: '0 2px', color: 'var(--text-muted)' }}>/</span>
          )}
          <span
            style={{
              cursor: i === parts.length - 1 ? 'default' : 'pointer',
              color: i === parts.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {part}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}
