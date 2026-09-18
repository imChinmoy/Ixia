import type { Tool, ToolExecutionContext, ToolSchema } from '@sora/tools';
import type { FilesystemService } from '../services/filesystem.service.js';
import type { ListDirectoryResult } from '../types/file-entry.js';

export interface ListDirectoryInput {
  path?: string;
}

export class ListDirectoryTool implements Tool<ListDirectoryInput, ListDirectoryResult> {
  readonly name = 'list_directory';
  readonly description =
    'Lists files and directories inside a specified directory path within the project workspace.';
  readonly inputSchema: ToolSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the directory to list (defaults to "." for workspace root).',
      },
    },
  };

  private readonly filesystemService: FilesystemService;

  constructor(filesystemService: FilesystemService) {
    this.filesystemService = filesystemService;
  }

  async execute(
    input: ListDirectoryInput,
    context: ToolExecutionContext,
  ): Promise<ListDirectoryResult> {
    return this.filesystemService.listDirectory(input?.path ?? '.', context.cwd);
  }
}
