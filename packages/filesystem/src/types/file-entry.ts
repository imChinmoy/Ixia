export type FileEntryType = 'file' | 'directory' | 'symlink' | 'other';

export interface DirectoryEntry {
  readonly name: string;
  readonly path: string;
  readonly type: FileEntryType;
  readonly size: number;
  readonly hidden: boolean;
  readonly modifiedAt?: string;
}

export interface ListDirectoryOptions {
  readonly path?: string;
  readonly showHidden?: boolean;
}

export interface ListDirectoryResult {
  readonly path: string;
  readonly entries: readonly DirectoryEntry[];
  readonly total: number;
}
