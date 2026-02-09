import * as workspace from '../../services/workspace.js';
import { snapshotFile, getSnapshot, computeDiff } from '../../services/diff.js';
import type { FileDiff } from '@coding-agent/shared';

export interface ToolResult {
  success: boolean;
  output: string;
  diff?: FileDiff;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

const readFileTool: ToolDefinition = {
  name: 'read-file',
  description: 'Read the contents of a file',
  parameters: {
    path: { type: 'string', description: 'File path relative to workspace', required: true },
  },
  async execute(params) {
    try {
      const content = await workspace.readFile(params.path as string);
      return { success: true, output: content };
    } catch (err: any) {
      return { success: false, output: `Error reading file: ${err.message}` };
    }
  },
};

const writeFileTool: ToolDefinition = {
  name: 'write-file',
  description: 'Write content to a file (creates parent directories as needed)',
  parameters: {
    path: { type: 'string', description: 'File path relative to workspace', required: true },
    content: { type: 'string', description: 'Content to write', required: true },
  },
  async execute(params) {
    const filePath = params.path as string;
    const newContent = params.content as string;

    try {
      let oldContent = '';
      try {
        oldContent = await workspace.readFile(filePath);
      } catch {
        // File doesn't exist yet
      }
      snapshotFile(filePath, oldContent);

      await workspace.writeFile(filePath, newContent);
      const diff = computeDiff(filePath, oldContent, newContent);
      return { success: true, output: `File written: ${filePath}`, diff };
    } catch (err: any) {
      return { success: false, output: `Error writing file: ${err.message}` };
    }
  },
};

const createDirTool: ToolDefinition = {
  name: 'create-dir',
  description: 'Create a directory (and parent directories if needed)',
  parameters: {
    path: { type: 'string', description: 'Directory path relative to workspace', required: true },
  },
  async execute(params) {
    try {
      await workspace.createDir(params.path as string);
      return { success: true, output: `Directory created: ${params.path}` };
    } catch (err: any) {
      return { success: false, output: `Error creating directory: ${err.message}` };
    }
  },
};

const listDirTool: ToolDefinition = {
  name: 'list-dir',
  description: 'List contents of a directory',
  parameters: {
    path: { type: 'string', description: 'Directory path relative to workspace (default: root)', required: false },
  },
  async execute(params) {
    try {
      const entries = await workspace.listDir((params.path as string) || '.');
      return { success: true, output: entries.join('\n') };
    } catch (err: any) {
      return { success: false, output: `Error listing directory: ${err.message}` };
    }
  },
};

const searchFilesTool: ToolDefinition = {
  name: 'search-files',
  description: 'Search for files matching a pattern',
  parameters: {
    pattern: { type: 'string', description: 'Search pattern', required: true },
    path: { type: 'string', description: 'Directory to search in (default: root)', required: false },
  },
  async execute(params) {
    try {
      const results = await workspace.searchFiles(
        params.pattern as string,
        (params.path as string) || '.',
      );
      return { success: true, output: results.length > 0 ? results.join('\n') : 'No files found' };
    } catch (err: any) {
      return { success: false, output: `Error searching files: ${err.message}` };
    }
  },
};

export const tools: ToolDefinition[] = [
  readFileTool,
  writeFileTool,
  createDirTool,
  listDirTool,
  searchFilesTool,
];

export const toolMap = new Map(tools.map((t) => [t.name, t]));
