import React, { useState } from 'react';
import type { FileNode } from '@coding-agent/shared';
import { socket } from '../../lib/socket';
import { useStore } from '../../store';

function FileIcon({ type, name, expanded }: { type: string; name: string; expanded?: boolean }) {
  if (type === 'directory') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <path
          d={expanded
            ? 'M1.5 3.5h4l1 1.5h8v8h-13z'
            : 'M1.5 3h4l1 1.5h8v8.5h-13z'
          }
          fill={expanded ? '#dcb67a' : '#c09553'}
          stroke="none"
        />
      </svg>
    );
  }
  const ext = name.split('.').pop() || '';
  const colors: Record<string, string> = {
    ts: '#3178c6',
    tsx: '#3178c6',
    js: '#f1e05a',
    jsx: '#f1e05a',
    json: '#cb8622',
    css: '#563d7c',
    html: '#e34c26',
    md: '#083fa1',
    py: '#3572a5',
  };
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="2" y="1" width="12" height="14" rx="1" fill={colors[ext] || '#6e6e6e'} opacity="0.3" />
      <rect x="2" y="1" width="12" height="14" rx="1" stroke={colors[ext] || '#6e6e6e'} strokeWidth="0.5" />
    </svg>
  );
}

export function FileTreeItem({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const activeFile = useStore((s) => s.activeFile);
  const isActive = activeFile?.path === node.path;

  const handleClick = () => {
    if (node.type === 'directory') {
      setExpanded(!expanded);
    } else {
      socket.emit('file:select', { path: node.path });
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          paddingLeft: depth * 16 + 8,
          cursor: 'pointer',
          background: isActive ? 'var(--bg-active)' : 'transparent',
          fontSize: 13,
          userSelect: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
        }}
      >
        {node.type === 'directory' && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="var(--text-secondary)"
            style={{
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.1s',
              flexShrink: 0,
            }}
          >
            <path d="M3 1l5 4-5 4z" />
          </svg>
        )}
        {node.type === 'file' && <span style={{ width: 10 }} />}
        <FileIcon type={node.type} name={node.name} expanded={expanded} />
        <span style={{ color: 'var(--text-primary)' }}>{node.name}</span>
      </div>
      {node.type === 'directory' && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
