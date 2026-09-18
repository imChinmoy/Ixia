import type { Tool } from '../types/tool.js';
import type { ToolSchema } from '../types/tool-schema.js';
import type { ToolExecutionContext } from '../types/execution-context.js';

export interface EchoInput {
  message: string;
}

export class EchoTool implements Tool<EchoInput, string> {
  readonly name = 'echo';
  readonly description = 'Echoes back the input message.';
  readonly inputSchema: ToolSchema = {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The message to echo back.',
      },
    },
    required: ['message'],
  };

  async execute(input: EchoInput, _context: ToolExecutionContext): Promise<string> {
    return input.message;
  }
}
