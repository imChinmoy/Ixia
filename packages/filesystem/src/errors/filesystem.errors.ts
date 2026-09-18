import { ToolError, type ToolErrorOptions } from '@ixia/tools';

export class FilesystemError extends ToolError {
  constructor(message: string, code = 'FILESYSTEM_ERROR', options?: ToolErrorOptions) {
    super(message, code, options);
    this.name = 'FilesystemError';
  }
}

export class FileNotFoundError extends FilesystemError {
  readonly path: string;

  constructor(filePath: string, toolName?: string, toolCallId?: string) {
    super(`File not found: "${filePath}"`, 'FILE_NOT_FOUND', { toolName, toolCallId });
    this.name = 'FileNotFoundError';
    this.path = filePath;
  }
}

export class DirectoryNotFoundError extends FilesystemError {
  readonly path: string;

  constructor(dirPath: string, toolName?: string, toolCallId?: string) {
    super(`Directory not found: "${dirPath}"`, 'DIRECTORY_NOT_FOUND', { toolName, toolCallId });
    this.name = 'DirectoryNotFoundError';
    this.path = dirPath;
  }
}

export class WorkspaceViolationError extends FilesystemError {
  readonly path: string;
  readonly workspaceRoot: string;

  constructor(targetPath: string, workspaceRoot: string, toolName?: string, toolCallId?: string) {
    super(
      `Access denied: path "${targetPath}" escapes the workspace boundary "${workspaceRoot}".`,
      'WORKSPACE_VIOLATION',
      { toolName, toolCallId },
    );
    this.name = 'WorkspaceViolationError';
    this.path = targetPath;
    this.workspaceRoot = workspaceRoot;
  }
}

export class BinaryFileError extends FilesystemError {
  readonly path: string;

  constructor(filePath: string, toolName?: string, toolCallId?: string) {
    super(`Cannot read binary file as text: "${filePath}".`, 'BINARY_FILE_ERROR', {
      toolName,
      toolCallId,
    });
    this.name = 'BinaryFileError';
    this.path = filePath;
  }
}

export class FileTooLargeError extends FilesystemError {
  readonly path: string;
  readonly size: number;
  readonly maxSize: number;

  constructor(
    filePath: string,
    size: number,
    maxSize: number,
    toolName?: string,
    toolCallId?: string,
  ) {
    super(
      `File "${filePath}" size (${size} bytes) exceeds the maximum allowed read limit (${maxSize} bytes).`,
      'FILE_TOO_LARGE',
      { toolName, toolCallId },
    );
    this.name = 'FileTooLargeError';
    this.path = filePath;
    this.size = size;
    this.maxSize = maxSize;
  }
}

export class InvalidPathError extends FilesystemError {
  readonly path: string;

  constructor(pathStr: string, reason?: string, toolName?: string, toolCallId?: string) {
    super(`Invalid path "${pathStr}"${reason ? `: ${reason}` : ''}.`, 'INVALID_PATH', {
      toolName,
      toolCallId,
    });
    this.name = 'InvalidPathError';
    this.path = pathStr;
  }
}

export class PermissionDeniedError extends FilesystemError {
  readonly path: string;

  constructor(filePath: string, toolName?: string, toolCallId?: string, cause?: unknown) {
    super(`Permission denied accessing path: "${filePath}".`, 'PERMISSION_DENIED', {
      toolName,
      toolCallId,
      cause,
    });
    this.name = 'PermissionDeniedError';
    this.path = filePath;
  }
}

export class SearchError extends FilesystemError {
  constructor(message: string, toolName?: string, toolCallId?: string, cause?: unknown) {
    super(message, 'SEARCH_ERROR', { toolName, toolCallId, cause });
    this.name = 'SearchError';
  }
}

export function isFilesystemError(error: unknown): error is FilesystemError {
  return error instanceof FilesystemError;
}
