import type { FileEntryType } from './file-entry.js';

export interface ReadFileOptions {
  readonly startLine?: number;
  readonly endLine?: number;
  readonly maxFileSize?: number;
}

export interface ReadFileResult {
  readonly path: string;
  readonly content: string;
  readonly size: number;
  readonly totalLines: number;
  readonly startLine: number;
  readonly endLine: number;
}

export interface FileInfoResult {
  readonly path: string;
  readonly type: FileEntryType;
  readonly size: number;
  readonly modifiedAt: string;
  readonly createdAt?: string;
  readonly extension?: string;
  readonly isText: boolean;
  readonly isHidden: boolean;
}

export interface SearchMatch {
  readonly path: string;
  readonly line: number;
  readonly text: string;
}

export interface SearchFilesOptions {
  readonly query: string;
  readonly path?: string;
  readonly maxResults?: number;
  readonly maxFileSize?: number;
  readonly maxFilesScanned?: number;
  readonly ignoredDirectories?: readonly string[];
  readonly caseSensitive?: boolean;
}

export interface SearchFilesResult {
  readonly query: string;
  readonly matches: readonly SearchMatch[];
  readonly totalMatches: number;
  readonly filesScanned: number;
  readonly truncated: boolean;
  readonly reason?: string;
}
