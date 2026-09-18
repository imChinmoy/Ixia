import type { Tool, ToolExecutionContext, ToolSchema } from '@sora/tools';
import type { FilesystemService } from '../services/filesystem.service.js';
import type { FileInfoResult } from '../types/filesystem.js';

export interface FileInfoInput {
  path: string;
}

export class FileInfoTool implements Tool<FileInfoInput, FileInfoResult> {
  readonly name = 'file_info';
  readonly description =
    'Retrieves metadata about a file or directory within the project workspace.';
  readonly inputSchema: ToolSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file or directory to inspect.',
      },
    },
    required: ['path'],
  };

  private readonly filesystemService: FilesystemService;

  constructor(filesystemService: FilesystemService) {
    this.filesystemService = filesystemService;
  }

  async execute(input: FileInfoInput, context: ToolExecutionContext): Promise<FileInfoResult> {
    return this.filesystemService.getFileInfo(input.path, context.cwd);
  }
}
