import process from 'node:process';
import { PathService } from '@ixia/filesystem';
import { ProcessExecutor } from './process-executor.js';
import type { ShellExecutionOptions, ShellExecutionResult } from '../types/shell.js';
import { ShellError } from '../errors/shell.errors.js';

export class ShellService {
  private readonly pathService: PathService;
  private readonly processExecutor: ProcessExecutor;

  constructor(pathService?: PathService, processExecutor?: ProcessExecutor) {
    this.pathService = pathService ?? new PathService();
    this.processExecutor = processExecutor ?? new ProcessExecutor();
  }

  getPathService(): PathService {
    return this.pathService;
  }

  getProcessExecutor(): ProcessExecutor {
    return this.processExecutor;
  }

  /**
   * Executes a command within the specified workspace directory, validating path boundaries.
   */
  async execute(
    command: string,
    options: ShellExecutionOptions = {},
    workspaceRoot: string = process.cwd(),
  ): Promise<ShellExecutionResult> {
    if (typeof command !== 'string' || !command.trim()) {
      throw new ShellError('Command must be a non-empty string.', 'INVALID_COMMAND');
    }

    // Resolve safe working directory within workspace boundary
    const targetCwd = options.cwd ?? '.';
    const resolvedCwd = await this.pathService.resolveSafePath(targetCwd, workspaceRoot);

    return this.processExecutor.spawnCommand(command.trim(), resolvedCwd, options);
  }
}
