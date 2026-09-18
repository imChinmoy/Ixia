import type { Tool, ToolRegistry } from '@ixia/tools';
import { ShellService } from '../services/shell.service.js';
import { ExecuteCommandTool } from './execute-command.tool.js';

export * from './execute-command.tool.js';

/**
 * Creates instances of the shell tools.
 */
export function createShellTools(service?: ShellService): Tool[] {
  const shellService = service ?? new ShellService();
  return [new ExecuteCommandTool(shellService)];
}

/**
 * Registers shell tools into the provided ToolRegistry.
 */
export function registerShellTools(
  registry: ToolRegistry,
  service?: ShellService,
): void {
  const tools = createShellTools(service);
  for (const tool of tools) {
    registry.register(tool);
  }
}
