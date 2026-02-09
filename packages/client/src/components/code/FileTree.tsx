import React from 'react';
import { useStore } from '../../store';
import { FileTreeItem } from './FileTreeItem';

export function FileTree() {
  const fileTree = useStore((s) => s.fileTree);

  return (
    <div
      style={{
        width: 220,
        minWidth: 180,
        borderRight: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        overflow: 'auto',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Explorer
      </div>
      {fileTree.length === 0 ? (
        <div style={{ padding: '16px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
          No files in workspace
        </div>
      ) : (
        fileTree.map((node) => <FileTreeItem key={node.path} node={node} />)
      )}
    </div>
  );
}
