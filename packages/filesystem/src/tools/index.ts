import type { Tool, ToolRegistry } from '@ixia/tools';
import { FilesystemService } from '../services/filesystem.service.js';
import { ListDirectoryTool } from './list-directory.tool.js';
import { ReadFileTool } from './read-file.tool.js';
import { SearchFilesTool } from './search-files.tool.js';
import { FileInfoTool } from './file-info.tool.js';

export * from './list-directory.tool.js';
export * from './read-file.tool.js';
export * from './search-files.tool.js';
export * from './file-info.tool.js';

/**
 * Creates instances of all four filesystem tools.
 */
export function createFilesystemTools(service?: FilesystemService): Tool[] {
  const fsService = service ?? new FilesystemService();
  return [
    new ListDirectoryTool(fsService),
    new ReadFileTool(fsService),
    new SearchFilesTool(fsService),
    new FileInfoTool(fsService),
  ];
}

/**
 * Registers all filesystem tools into the provided ToolRegistry.
 */
export function registerFilesystemTools(registry: ToolRegistry, service?: FilesystemService): void {
  const tools = createFilesystemTools(service);
  for (const tool of tools) {
    registry.register(tool);
  }
}
