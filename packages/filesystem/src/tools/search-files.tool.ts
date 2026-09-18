import type { Tool, ToolExecutionContext, ToolSchema } from '@ixia/tools';
import type { FilesystemService } from '../services/filesystem.service.js';
import type { SearchFilesResult } from '../types/filesystem.js';

export interface SearchFilesInput {
  query: string;
  path?: string;
  maxResults?: number;
}

export class SearchFilesTool implements Tool<SearchFilesInput, SearchFilesResult> {
  readonly name = 'search_files';
  readonly description = 'Searches for query text across files inside the project workspace.';
  readonly inputSchema: ToolSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The text to search for across project files.',
      },
      path: {
        type: 'string',
        description: 'Optional relative directory path to search within (defaults to ".").',
      },
      maxResults: {
        type: 'number',
        description: 'Optional maximum number of matching lines to return (default: 50).',
      },
    },
    required: ['query'],
  };

  private readonly filesystemService: FilesystemService;

  constructor(filesystemService: FilesystemService) {
    this.filesystemService = filesystemService;
  }

  async execute(
    input: SearchFilesInput,
    context: ToolExecutionContext,
  ): Promise<SearchFilesResult> {
    return this.filesystemService.searchFiles(
      {
        query: input.query,
        path: input.path ?? '.',
        maxResults: input.maxResults,
      },
      context.cwd,
    );
  }
}
