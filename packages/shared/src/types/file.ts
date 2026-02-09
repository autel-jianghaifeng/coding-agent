export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export interface FileContent {
  path: string;
  content: string;
  language: string;
}

export interface DiffChange {
  type: 'add' | 'remove' | 'normal';
  content: string;
  lineNumber?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  changes: DiffChange[];
}

export interface FileDiff {
  path: string;
  oldContent: string;
  newContent: string;
  hunks: DiffHunk[];
  isNew: boolean;
  isDeleted: boolean;
}
