import { describe, it, expect } from 'vitest';
import { EchoTool, ToolRegistry, ToolExecutor } from '@sora/tools';

describe('EchoTool', () => {
  it('should have correct name, description, and schema', () => {
    const echo = new EchoTool();

    expect(echo.name).toBe('echo');
    expect(echo.description).toBe('Echoes back the input message.');
    expect(echo.inputSchema).toEqual({
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to echo back.',
        },
      },
      required: ['message'],
    });
  });

  it('should execute successfully directly', async () => {
    const echo = new EchoTool();
    const result = await echo.execute({ message: 'hello sora' }, { cwd: '/test' });

    expect(result).toBe('hello sora');
  });

  it('should execute successfully through ToolRegistry and ToolExecutor', async () => {
    const registry = new ToolRegistry();
    const echo = new EchoTool();
    registry.register(echo);

    const executor = new ToolExecutor({ registry });

    const result = await executor.execute({
      id: 'echo_call_1',
      name: 'echo',
      arguments: { message: 'hello from executor' },
    });

    expect(result.success).toBe(true);
    expect(result.toolCallId).toBe('echo_call_1');
    expect(result.toolName).toBe('echo');
    expect(result.result).toBe('hello from executor');
    expect(result.error).toBeUndefined();
  });

  it('should fail with validation error when message is missing or wrong type', async () => {
    const registry = new ToolRegistry();
    registry.register(new EchoTool());
    const executor = new ToolExecutor({ registry });

    const missingResult = await executor.execute({
      id: 'echo_call_2',
      name: 'echo',
      arguments: {},
    });

    expect(missingResult.success).toBe(false);
    expect(missingResult.error?.name).toBe('ToolValidationError');
    expect(missingResult.error?.message).toContain('Missing required property "message"');

    const wrongTypeResult = await executor.execute({
      id: 'echo_call_3',
      name: 'echo',
      arguments: { message: 123 },
    });

    expect(wrongTypeResult.success).toBe(false);
    expect(wrongTypeResult.error?.name).toBe('ToolValidationError');
    expect(wrongTypeResult.error?.message).toContain(
      'Property "message" expected type "string", received "number"',
    );
  });
});
