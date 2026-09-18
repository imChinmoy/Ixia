import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { PathService } from './path.service.js';
import {
  FileSearchService,
  KNOWN_BINARY_EXTENSIONS,
  isBinaryBuffer,
} from './file-search.service.js';
import type {
  DirectoryEntry,
  FileEntryType,
  ListDirectoryOptions,
  ListDirectoryResult,
} from '../types/file-entry.js';
import type {
  FileInfoResult,
  ReadFileOptions,
  ReadFileResult,
  SearchFilesOptions,
  SearchFilesResult,
} from '../types/filesystem.js';
import {
  BinaryFileError,
  DirectoryNotFoundError,
  FileNotFoundError,
  FileTooLargeError,
  FilesystemError,
  PermissionDeniedError,
} from '../errors/filesystem.errors.js';

export const DEFAULT_MAX_READ_FILE_SIZE = 1024 * 1024; // 1 MB

export class FilesystemService {
  private readonly pathService: PathService;
  private readonly fileSearchService: FileSearchService;

  constructor(pathService?: PathService, fileSearchService?: FileSearchService) {
    this.pathService = pathService ?? new PathService();
    this.fileSearchService = fileSearchService ?? new FileSearchService(this.pathService);
  }

  getPathService(): PathService {
    return this.pathService;
  }

  /**
   * Lists files and subdirectories in the specified directory.
   */
  async listDirectory(
    dirPath = '.',
    workspaceRoot = process.cwd(),
    options?: ListDirectoryOptions,
  ): Promise<ListDirectoryResult> {
    const resolvedPath = await this.pathService.resolveSafePath(dirPath, workspaceRoot);

    let stats;
    try {
      stats = await fs.stat(resolvedPath);
    } catch (err) {
      throw this.mapNodeError(err, dirPath, 'directory');
    }

    if (!stats.isDirectory()) {
      throw new DirectoryNotFoundError(dirPath, undefined, undefined);
    }

    let dirEntries;
    try {
      dirEntries = await fs.readdir(resolvedPath, { withFileTypes: true });
    } catch (err) {
      throw this.mapNodeError(err, dirPath, 'directory');
    }

    const entries: DirectoryEntry[] = [];

    for (const dirent of dirEntries) {
      const isHidden = dirent.name.startsWith('.');
      if (isHidden && options?.showHidden === false) {
        continue;
      }

      const fullEntryPath = path.join(resolvedPath, dirent.name);
      const relativeEntryPath = this.pathService.getRelativePath(fullEntryPath, workspaceRoot);

      let type: FileEntryType = 'other';
      if (dirent.isDirectory()) {
        type = 'directory';
      } else if (dirent.isFile()) {
        type = 'file';
      } else if (dirent.isSymbolicLink()) {
        type = 'symlink';
      }

      let size = 0;
      let modifiedAt: string | undefined;

      try {
        const entryStats = await fs.stat(fullEntryPath);
        size = entryStats.size;
        modifiedAt = entryStats.mtime.toISOString();
      } catch {
        // Unreadable entry stats, preserve 0 size
      }

      entries.push({
        name: dirent.name,
        path: relativeEntryPath,
        type,
        size,
        hidden: isHidden,
        modifiedAt,
      });
    }

    // Deterministic sorting: directories first, then files, alphabetical within category
    entries.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return {
      path: this.pathService.getRelativePath(resolvedPath, workspaceRoot),
      entries,
      total: entries.length,
    };
  }

  /**
   * Reads text content from a file within the workspace with optional line bounds.
   */
  async readFile(
    filePath: string,
    workspaceRoot = process.cwd(),
    options?: ReadFileOptions,
  ): Promise<ReadFileResult> {
    const resolvedPath = await this.pathService.resolveSafePath(filePath, workspaceRoot);

    let stats;
    try {
      stats = await fs.stat(resolvedPath);
    } catch (err) {
      throw this.mapNodeError(err, filePath, 'file');
    }

    if (stats.isDirectory()) {
      throw new FilesystemError(`Cannot read directory as file: "${filePath}".`);
    }

    const relativePath = this.pathService.getRelativePath(resolvedPath, workspaceRoot);

    // File size check
    const maxFileSize = options?.maxFileSize ?? DEFAULT_MAX_READ_FILE_SIZE;
    if (stats.size > maxFileSize) {
      throw new FileTooLargeError(relativePath, stats.size, maxFileSize);
    }

    // Known binary extension check
    const ext = path.extname(resolvedPath).toLowerCase();
    if (KNOWN_BINARY_EXTENSIONS.has(ext)) {
      throw new BinaryFileError(relativePath);
    }

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(resolvedPath);
    } catch (err) {
      throw this.mapNodeError(err, filePath, 'file');
    }

    // Content null byte check for binary files
    if (isBinaryBuffer(buffer)) {
      throw new BinaryFileError(relativePath);
    }

    const fullContent = buffer.toString('utf-8');

    // Handle line slicing
    const lines = fullContent.split(/\r?\n/);
    const totalLines = lines.length;

    if (options?.startLine !== undefined && options.startLine < 1) {
      throw new FilesystemError(
        `Invalid line range: startLine (${options.startLine}) must be >= 1.`,
      );
    }

    if (
      options?.startLine !== undefined &&
      options?.endLine !== undefined &&
      options.endLine < options.startLine
    ) {
      throw new FilesystemError(
        `Invalid line range: endLine (${options.endLine}) must be >= startLine (${options.startLine}).`,
      );
    }

    let startLine = 1;
    let endLine = totalLines;
    let content = fullContent;

    if (options?.startLine !== undefined || options?.endLine !== undefined) {
      startLine = options?.startLine ?? 1;
      endLine = options?.endLine ? Math.min(totalLines, options.endLine) : totalLines;

      if (startLine > totalLines) {
        content = '';
      } else {
        const slicedLines = lines.slice(startLine - 1, endLine);
        content = slicedLines.join('\n');
      }
    }

    return {
      path: relativePath,
      content,
      size: Buffer.byteLength(content, 'utf-8'),
      totalLines,
      startLine,
      endLine,
    };
  }

  /**
   * Searches for query text across files in a workspace directory.
   */
  async searchFiles(
    options: SearchFilesOptions,
    workspaceRoot = process.cwd(),
  ): Promise<SearchFilesResult> {
    const targetDir = options.path ?? '.';
    const resolvedPath = await this.pathService.resolveSafePath(targetDir, workspaceRoot);

    let stats;
    try {
      stats = await fs.stat(resolvedPath);
    } catch (err) {
      throw this.mapNodeError(err, targetDir, 'directory');
    }

    if (!stats.isDirectory()) {
      throw new DirectoryNotFoundError(targetDir);
    }

    return this.fileSearchService.search(options, resolvedPath, workspaceRoot);
  }

  /**
   * Retrieves metadata about a file or directory.
   */
  async getFileInfo(targetPath: string, workspaceRoot = process.cwd()): Promise<FileInfoResult> {
    const resolvedPath = await this.pathService.resolveSafePath(targetPath, workspaceRoot);

    let stats;
    try {
      stats = await fs.lstat(resolvedPath);
    } catch (err) {
      throw this.mapNodeError(err, targetPath, 'file');
    }

    let type: FileEntryType = 'other';
    if (stats.isDirectory()) {
      type = 'directory';
    } else if (stats.isFile()) {
      type = 'file';
    } else if (stats.isSymbolicLink()) {
      type = 'symlink';
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const isHidden = path.basename(resolvedPath).startsWith('.');
    const isText = stats.isFile() && !KNOWN_BINARY_EXTENSIONS.has(ext);

    return {
      path: this.pathService.getRelativePath(resolvedPath, workspaceRoot),
      type,
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      createdAt: stats.birthtime ? stats.birthtime.toISOString() : undefined,
      extension: ext || undefined,
      isText,
      isHidden,
    };
  }

  private mapNodeError(
    err: unknown,
    cleanPath: string,
    expectedKind: 'file' | 'directory',
  ): FilesystemError {
    if (err instanceof FilesystemError) {
      return err;
    }

    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') {
      return expectedKind === 'directory'
        ? new DirectoryNotFoundError(cleanPath)
        : new FileNotFoundError(cleanPath);
    }

    if (nodeErr.code === 'EACCES' || nodeErr.code === 'EPERM') {
      return new PermissionDeniedError(cleanPath, undefined, undefined, err);
    }

    if (nodeErr.code === 'ENOTDIR') {
      return new DirectoryNotFoundError(cleanPath);
    }

    return new FilesystemError(
      `Filesystem operation failed on "${cleanPath}": ${nodeErr.message || String(err)}`,
      'FILESYSTEM_ERROR',
      { cause: err },
    );
  }
}
