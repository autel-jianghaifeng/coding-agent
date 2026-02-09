import React from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { useStore } from '../../store';

export function DiffViewer() {
  const activeDiff = useStore((s) => s.activeDiff);

  if (!activeDiff) {
    return null;
  }

  const language = getLanguage(activeDiff.path);

  return (
    <DiffEditor
      height="100%"
      language={language}
      original={activeDiff.oldContent}
      modified={activeDiff.newContent}
      theme="vs-dark"
      options={{
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: 'var(--font-mono)',
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        renderSideBySide: false,
        padding: { top: 8 },
      }}
    />
  );
}

function getLanguage(path: string): string {
  const ext = path.split('.').pop() || '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    html: 'html',
    css: 'css',
    md: 'markdown',
    py: 'python',
    rs: 'rust',
    go: 'go',
  };
  return map[ext] || 'plaintext';
}
