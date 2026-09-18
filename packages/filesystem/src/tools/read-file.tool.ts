import type { Tool, ToolExecutionContext, ToolSchema } from '@sora/tools';
import type { FilesystemService } from '../services/filesystem.service.js';
import type { ReadFileResult } from '../types/filesystem.js';

export interface ReadFileInput {
  path: string;
  startLine?: number;
  endLine?: number;
}

export class ReadFileTool implements Tool<ReadFileInput, ReadFileResult> {
  readonly name = 'read_file';
  readonly description =
    'Reads text content from a specified file within the project workspace, with optional line range bounds.';
  readonly inputSchema: ToolSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file to read within the workspace.',
      },
      startLine: {
        type: 'integer',
        description: 'Optional 1-based start line number (inclusive).',
      },
      endLine: {
        type: 'integer',
        description: 'Optional 1-based end line number (inclusive).',
      },
    },
    required: ['path'],
  };

  private readonly filesystemService: FilesystemService;

  constructor(filesystemService: FilesystemService) {
    this.filesystemService = filesystemService;
  }

  async execute(input: ReadFileInput, context: ToolExecutionContext): Promise<ReadFileResult> {
    return this.filesystemService.readFile(input.path, context.cwd, {
      startLine: input.startLine,
      endLine: input.endLine,
    });
  }
}
