import type { Tool, ToolExecutionContext, ToolSchema } from '@ixia/tools';
import type { ShellService } from '../services/shell.service.js';
import type { ExecuteCommandInput, ShellExecutionResult } from '../types/shell.js';

export class ExecuteCommandTool
  implements Tool<ExecuteCommandInput, ShellExecutionResult>
{
  readonly name = 'execute_command';
  readonly description =
    'Executes a terminal shell command within the project workspace and returns stdout, stderr, exit code, and execution metrics.';
  readonly inputSchema: ToolSchema = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The terminal command to execute.',
      },
      cwd: {
        type: 'string',
        description: 'Optional working directory relative to the workspace root.',
      },
      timeoutMs: {
        type: 'number',
        description: 'Optional execution timeout in milliseconds (defaults to 30000).',
      },
    },
    required: ['command'],
  };

  private readonly shellService: ShellService;

  constructor(shellService: ShellService) {
    this.shellService = shellService;
  }

  async execute(
    input: ExecuteCommandInput,
    context: ToolExecutionContext,
  ): Promise<ShellExecutionResult> {
    return this.shellService.execute(
      input.command,
      {
        cwd: input.cwd,
        timeoutMs: input.timeoutMs,
        signal: context.signal,
      },
      context.cwd,
    );
  }
}
