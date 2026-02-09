import React from 'react';
import Editor from '@monaco-editor/react';
import { useStore } from '../../store';

export function CodeViewer() {
  const activeFile = useStore((s) => s.activeFile);

  if (!activeFile) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: 14,
        }}
      >
        Select a file to view its contents
      </div>
    );
  }

  return (
    <Editor
      height="100%"
      language={activeFile.language}
      value={activeFile.content}
      theme="vs-dark"
      options={{
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: 'var(--font-mono)',
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        padding: { top: 8 },
      }}
    />
  );
}
