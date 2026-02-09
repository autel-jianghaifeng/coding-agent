import { diffLines } from 'diff';
import type { FileDiff, DiffHunk, DiffChange } from '@coding-agent/shared';

const snapshots = new Map<string, string>();

export function snapshotFile(filePath: string, content: string): void {
  snapshots.set(filePath, content);
}

export function getSnapshot(filePath: string): string | undefined {
  return snapshots.get(filePath);
}

export function clearSnapshot(filePath: string): void {
  snapshots.delete(filePath);
}

export function computeDiff(filePath: string, oldContent: string, newContent: string): FileDiff {
  const changes = diffLines(oldContent, newContent);
  const hunks: DiffHunk[] = [];
  const diffChanges: DiffChange[] = [];

  let oldLine = 1;
  let newLine = 1;

  for (const change of changes) {
    const lines = change.value.replace(/\n$/, '').split('\n');

    if (change.added) {
      for (const line of lines) {
        diffChanges.push({ type: 'add', content: line, lineNumber: newLine++ });
      }
    } else if (change.removed) {
      for (const line of lines) {
        diffChanges.push({ type: 'remove', content: line, lineNumber: oldLine++ });
      }
    } else {
      for (const line of lines) {
        diffChanges.push({ type: 'normal', content: line, lineNumber: newLine });
        oldLine++;
        newLine++;
      }
    }
  }

  if (diffChanges.length > 0) {
    hunks.push({
      oldStart: 1,
      oldLines: oldLine - 1,
      newStart: 1,
      newLines: newLine - 1,
      changes: diffChanges,
    });
  }

  return {
    path: filePath,
    oldContent,
    newContent,
    hunks,
    isNew: oldContent === '',
    isDeleted: newContent === '',
  };
}
