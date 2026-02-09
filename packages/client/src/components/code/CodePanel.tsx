import React from 'react';
import { useStore } from '../../store';
import { FileTree } from './FileTree';
import { FileBreadcrumb } from './FileBreadcrumb';
import { CodeViewer } from './CodeViewer';
import { DiffViewer } from './DiffViewer';

export function CodePanel() {
  const viewMode = useStore((s) => s.viewMode);
  const activeFile = useStore((s) => s.activeFile);
  const activeDiff = useStore((s) => s.activeDiff);
  const setViewMode = useStore((s) => s.setViewMode);

  const filePath = viewMode === 'diff' ? activeDiff?.path : activeFile?.path;
  const showToggle = activeDiff !== null;

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-primary)' }}>
      <FileTree />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 34,
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            flexShrink: 0,
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            {filePath && <FileBreadcrumb path={filePath} />}
          </div>
          {showToggle && (
            <div style={{ display: 'flex', gap: 2, padding: '0 8px' }}>
              <button
                onClick={() => setViewMode('code')}
                style={{
                  padding: '2px 10px',
                  borderRadius: 4,
                  fontSize: 12,
                  background: viewMode === 'code' ? 'var(--bg-hover)' : 'transparent',
                  color: viewMode === 'code' ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                Code
              </button>
              <button
                onClick={() => setViewMode('diff')}
                style={{
                  padding: '2px 10px',
                  borderRadius: 4,
                  fontSize: 12,
                  background: viewMode === 'diff' ? 'var(--bg-hover)' : 'transparent',
                  color: viewMode === 'diff' ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                Diff
              </button>
            </div>
          )}
        </div>
        {/* Editor area */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {viewMode === 'diff' && activeDiff ? <DiffViewer /> : <CodeViewer />}
        </div>
      </div>
    </div>
  );
}
