import chokidar from 'chokidar';
import path from 'path';
import { config } from '../config.js';

type ChangeCallback = (eventType: string, filePath: string) => void;

let watcher: chokidar.FSWatcher | null = null;

export function startFileWatcher(onChange: ChangeCallback): void {
  if (watcher) return;

  watcher = chokidar.watch(config.workspaceRoot, {
    ignored: /(node_modules|\.git)/,
    persistent: true,
    ignoreInitial: true,
  });

  watcher
    .on('add', (fullPath) => {
      const rel = path.relative(config.workspaceRoot, fullPath);
      onChange('add', rel);
    })
    .on('change', (fullPath) => {
      const rel = path.relative(config.workspaceRoot, fullPath);
      onChange('change', rel);
    })
    .on('unlink', (fullPath) => {
      const rel = path.relative(config.workspaceRoot, fullPath);
      onChange('unlink', rel);
    });
}

export function stopFileWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}
