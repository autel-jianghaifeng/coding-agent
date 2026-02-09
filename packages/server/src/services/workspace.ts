import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import type { FileNode } from '@coding-agent/shared';

function resolveSafe(filePath: string): string {
  const resolved = path.resolve(config.workspaceRoot, filePath);
  if (!resolved.startsWith(config.workspaceRoot)) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }
  return resolved;
}

export async function ensureWorkspace(): Promise<void> {
  await fs.mkdir(config.workspaceRoot, { recursive: true });
}

export async function readFile(filePath: string): Promise<string> {
  const resolved = resolveSafe(filePath);
  return fs.readFile(resolved, 'utf-8');
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  const resolved = resolveSafe(filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, content, 'utf-8');
}

export async function createDir(dirPath: string): Promise<void> {
  const resolved = resolveSafe(dirPath);
  await fs.mkdir(resolved, { recursive: true });
}

export async function listDir(dirPath: string = '.'): Promise<string[]> {
  const resolved = resolveSafe(dirPath);
  const entries = await fs.readdir(resolved, { withFileTypes: true });
  return entries.map((e) => (e.isDirectory() ? e.name + '/' : e.name));
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const resolved = resolveSafe(filePath);
    await fs.access(resolved);
    return true;
  } catch {
    return false;
  }
}

export async function searchFiles(pattern: string, dirPath: string = '.'): Promise<string[]> {
  const resolved = resolveSafe(dirPath);
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          await walk(fullPath);
        }
      } else if (entry.name.includes(pattern) || fullPath.includes(pattern)) {
        results.push(path.relative(config.workspaceRoot, fullPath));
      }
    }
  }

  await walk(resolved);
  return results;
}

export async function getFileTree(dirPath: string = '.'): Promise<FileNode[]> {
  const resolved = resolveSafe(dirPath);
  const entries = await fs.readdir(resolved, { withFileTypes: true });
  const nodes: FileNode[] = [];

  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    const relativePath = path.relative(config.workspaceRoot, path.join(resolved, entry.name));
    if (entry.name === 'node_modules' || entry.name === '.git') continue;

    if (entry.isDirectory()) {
      const children = await getFileTree(relativePath);
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: 'directory',
        children,
      });
    } else {
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: 'file',
      });
    }
  }

  return nodes;
}

export function getLanguageFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.html': 'html',
    '.css': 'css',
    '.md': 'markdown',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.java': 'java',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.xml': 'xml',
    '.sh': 'shell',
    '.sql': 'sql',
    '.txt': 'plaintext',
  };
  return map[ext] || 'plaintext';
}
