import { describe, it, expect } from 'vitest';
import {
  ToolRegistry,
  ToolExecutor,
  ToolNotFoundError,
  ToolValidationError,
  ToolExecutionError,
  ToolSystemError,
  type Tool,
  type ToolCall,
} from '@sora/tools';

describe('ToolExecutor', () => {
  const sampleTool: Tool<{ message: string }, string> = {
    name: 'greet',
    description: 'Greets someone',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
      required: ['message'],
    },
    execute: async (input, context) => {
      return `Hello, ${input.message}! (cwd: ${context.cwd})`;
    },
  };

  const failingTool: Tool<{ shouldFail: boolean }, void> = {
    name: 'failing_tool',
    description: 'Always fails when called',
    inputSchema: {
      type: 'object',
      properties: {
        shouldFail: { type: 'boolean' },
      },
      required: ['shouldFail'],
    },
    execute: async () => {
      throw new Error('Database connection failed');
    },
  };

  const createExecutor = () => {
    const registry = new ToolRegistry();
    registry.register(sampleTool);
    registry.register(failingTool);
    return new ToolExecutor({ registry, defaultCwd: '/test/cwd' });
  };

  it('should execute a registered tool successfully and return normalized result', async () => {
    const executor = createExecutor();

    const result = await executor.execute({
      id: 'call_1',
      name: 'greet',
      arguments: { message: 'World' },
    });

    expect(result.success).toBe(true);
    expect(result.toolCallId).toBe('call_1');
    expect(result.toolName).toBe('greet');
    expect(result.result).toBe('Hello, World! (cwd: /test/cwd)');
    expect(result.error).toBeUndefined();
  });

  it('should return ToolNotFoundError for unknown tool', async () => {
    const executor = createExecutor();

    const result = await executor.execute({
      id: 'call_2',
      name: 'non_existent_tool',
      arguments: {},
    });

    expect(result.success).toBe(false);
    expect(result.toolCallId).toBe('call_2');
    expect(result.toolName).toBe('non_existent_tool');
    expect(result.result).toBeUndefined();
    expect(result.error).toBeInstanceOf(ToolNotFoundError);
    expect(result.error?.message).toContain('Tool "non_existent_tool" not found');
  });

  it('should return ToolValidationError when arguments are invalid', async () => {
    const executor = createExecutor();

    const result = await executor.execute({
      id: 'call_3',
      name: 'greet',
      arguments: { wrongProp: 123 }, // missing 'message'
    });

    expect(result.success).toBe(false);
    expect(result.toolCallId).toBe('call_3');
    expect(result.toolName).toBe('greet');
    expect(result.result).toBeUndefined();
    expect(result.error).toBeInstanceOf(ToolValidationError);
    expect(result.error?.message).toContain('Missing required property "message"');
  });

  it('should return ToolExecutionError when tool execution throws', async () => {
    const executor = createExecutor();

    const result = await executor.execute({
      id: 'call_4',
      name: 'failing_tool',
      arguments: { shouldFail: true },
    });

    expect(result.success).toBe(false);
    expect(result.toolCallId).toBe('call_4');
    expect(result.toolName).toBe('failing_tool');
    expect(result.result).toBeUndefined();
    expect(result.error).toBeInstanceOf(ToolExecutionError);
    expect(result.error?.message).toContain('Database connection failed');
    expect((result.error as ToolExecutionError).cause).toBeDefined();
  });

  it('should abort execution if signal is already aborted', async () => {
    const executor = createExecutor();
    const controller = new AbortController();
    controller.abort(new Error('Operation cancelled by user'));

    const result = await executor.execute(
      {
        id: 'call_5',
        name: 'greet',
        arguments: { message: 'World' },
      },
      { signal: controller.signal },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(ToolExecutionError);
    expect(result.error?.message).toContain('aborted');
  });

  it('should pass custom execution context without mutating default context', async () => {
    const executor = createExecutor();

    const result = await executor.execute(
      {
        id: 'call_6',
        name: 'greet',
        arguments: { message: 'Alice' },
      },
      { cwd: '/custom/workspace' },
    );

    expect(result.success).toBe(true);
    expect(result.result).toContain('/custom/workspace');

    // Subsequent call still uses defaultCwd
    const result2 = await executor.execute({
      id: 'call_7',
      name: 'greet',
      arguments: { message: 'Bob' },
    });

    expect(result2.success).toBe(true);
    expect(result2.result).toContain('/test/cwd');
  });

  it('should return ToolSystemError on malformed tool call payload', async () => {
    const executor = createExecutor();

    const result = await executor.execute(null as unknown as ToolCall);

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(ToolSystemError);
  });
});
