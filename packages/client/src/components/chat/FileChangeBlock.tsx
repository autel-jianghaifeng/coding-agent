import React from 'react';
import type { FileDiff, DiffChange } from '@coding-agent/shared';
import { useStore } from '../../store';
import { socket } from '../../lib/socket';

/** Compute summary stats from the diff */
function diffStats(diff: FileDiff) {
  let added = 0;
  let removed = 0;
  for (const hunk of diff.hunks) {
    for (const c of hunk.changes) {
      if (c.type === 'add') added++;
      if (c.type === 'remove') removed++;
    }
  }
  return { added, removed };
}

/** Get a compact set of change lines with surrounding context (max ~8 lines) */
function getPreviewLines(diff: FileDiff): DiffChange[] {
  const allChanges = diff.hunks.flatMap((h) => h.changes);
  const result: DiffChange[] = [];
  const CONTEXT = 1;
  const MAX_LINES = 8;

  // Find indices of actual changes
  const changeIndices: number[] = [];
  allChanges.forEach((c, i) => {
    if (c.type !== 'normal') changeIndices.push(i);
  });

  if (changeIndices.length === 0) return [];

  // Build a set of lines to include (changes + context)
  const includeSet = new Set<number>();
  for (const idx of changeIndices) {
    for (let i = Math.max(0, idx - CONTEXT); i <= Math.min(allChanges.length - 1, idx + CONTEXT); i++) {
      includeSet.add(i);
    }
  }

  const sorted = [...includeSet].sort((a, b) => a - b);
  let prevIdx = -2;
  for (const idx of sorted) {
    if (result.length >= MAX_LINES) break;
    // Add ellipsis if there's a gap
    if (idx > prevIdx + 1 && result.length > 0) {
      result.push({ type: 'normal', content: '...', lineNumber: undefined });
    }
    result.push(allChanges[idx]);
    prevIdx = idx;
  }

  return result;
}

function getActionLabel(diff: FileDiff): string {
  if (diff.isNew) return 'Create';
  if (diff.isDeleted) return 'Delete';
  return 'Update';
}

function getActionColor(diff: FileDiff): string {
  if (diff.isNew) return 'var(--success)';
  if (diff.isDeleted) return 'var(--error)';
  return 'var(--accent)';
}

export function FileChangeBlock({ diff }: { diff: FileDiff }) {
  const setActiveDiff = useStore((s) => s.setActiveDiff);
  const setActiveFile = useStore((s) => s.setActiveFile);

  const stats = diffStats(diff);
  const preview = getPreviewLines(diff);
  const action = getActionLabel(diff);
  const actionColor = getActionColor(diff);

  const handleClick = () => {
    setActiveDiff(diff);
  };

  const handlePathClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Load the file content in the right panel, then show diff
    socket.emit('file:select', { path: diff.path });
    setActiveDiff(diff);
  };

  const summaryParts: string[] = [];
  if (stats.added > 0) summaryParts.push(`Added ${stats.added} line${stats.added > 1 ? 's' : ''}`);
  if (stats.removed > 0) summaryParts.push(`Removed ${stats.removed} line${stats.removed > 1 ? 's' : ''}`);

  return (
    <div
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        borderRadius: 6,
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-tertiary)',
        marginTop: 4,
        marginBottom: 4,
      }}
    >
      {/* Header: action + file path */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: actionColor,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
          {action}(
        </span>
        <span
          onClick={handlePathClick}
          style={{
            fontSize: 13,
            color: 'var(--accent)',
            textDecoration: 'underline',
            textDecorationColor: 'rgba(0,122,204,0.4)',
            textUnderlineOffset: 2,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.textDecorationColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.textDecorationColor = 'rgba(0,122,204,0.4)';
          }}
        >
          {diff.path}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>)</span>
      </div>

      {/* Summary */}
      {summaryParts.length > 0 && (
        <div
          style={{
            padding: '0 10px 4px 24px',
            fontSize: 12,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>└</span>
          <span>{summaryParts.join(', ')}</span>
        </div>
      )}

      {/* Inline diff preview */}
      {preview.length > 0 && (
        <div
          style={{
            background: 'var(--bg-primary)',
            borderTop: '1px solid var(--border-color)',
            padding: '4px 0',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            lineHeight: '18px',
            overflow: 'hidden',
          }}
        >
          {preview.map((line, i) => {
            const isAdd = line.type === 'add';
            const isRemove = line.type === 'remove';
            const isEllipsis = line.content === '...' && line.lineNumber === undefined;

            let bg = 'transparent';
            if (isAdd) bg = 'var(--diff-add-bg)';
            if (isRemove) bg = 'var(--diff-remove-bg)';

            let prefix = ' ';
            let prefixColor = 'transparent';
            if (isAdd) { prefix = '+'; prefixColor = 'var(--success)'; }
            if (isRemove) { prefix = '-'; prefixColor = 'var(--error)'; }

            if (isEllipsis) {
              return (
                <div
                  key={i}
                  style={{
                    padding: '0 10px',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                  }}
                >
                  <span style={{ display: 'inline-block', width: 38, textAlign: 'right', marginRight: 8 }}></span>
                  ···
                </div>
              );
            }

            return (
              <div
                key={i}
                style={{
                  padding: '0 10px',
                  background: bg,
                  display: 'flex',
                  whiteSpace: 'pre',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 38,
                    textAlign: 'right',
                    color: 'var(--text-muted)',
                    marginRight: 4,
                    flexShrink: 0,
                    userSelect: 'none',
                  }}
                >
                  {line.lineNumber ?? ''}
                </span>
                <span
                  style={{
                    display: 'inline-block',
                    width: 14,
                    textAlign: 'center',
                    color: prefixColor,
                    fontWeight: 600,
                    flexShrink: 0,
                    userSelect: 'none',
                  }}
                >
                  {prefix}
                </span>
                <span
                  style={{
                    color: isAdd ? '#b5e5a4' : isRemove ? '#e5a4a4' : 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {line.content}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
