import { describe, it, expect } from 'vitest';
import {
  ToolRegistry,
  ToolRegistrationError,
  type Tool,
  type ToolExecutionContext,
} from '@sora/tools';

describe('ToolRegistry', () => {
  const createMockTool = (name = 'test_tool', description = 'A test tool'): Tool => ({
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
    execute: async (input: unknown, _context: ToolExecutionContext) => input,
  });

  it('should register and retrieve a tool by name', () => {
    const registry = new ToolRegistry();
    const tool = createMockTool('search');

    registry.register(tool);

    expect(registry.has('search')).toBe(true);
    expect(registry.get('search')).toBe(tool);
  });

  it('should list all registered tools', () => {
    const registry = new ToolRegistry();
    const tool1 = createMockTool('tool_1');
    const tool2 = createMockTool('tool_2');

    registry.register(tool1);
    registry.register(tool2);

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list).toContain(tool1);
    expect(list).toContain(tool2);
  });

  it('should unregister a tool by name', () => {
    const registry = new ToolRegistry();
    const tool = createMockTool('temp_tool');

    registry.register(tool);
    expect(registry.has('temp_tool')).toBe(true);

    const removed = registry.unregister('temp_tool');
    expect(removed).toBe(true);
    expect(registry.has('temp_tool')).toBe(false);
    expect(registry.get('temp_tool')).toBeUndefined();

    const removedAgain = registry.unregister('temp_tool');
    expect(removedAgain).toBe(false);
  });

  it('should throw ToolRegistrationError on duplicate registration', () => {
    const registry = new ToolRegistry();
    const tool = createMockTool('duplicate');

    registry.register(tool);

    expect(() => registry.register(tool)).toThrow(ToolRegistrationError);
    expect(() => registry.register(createMockTool('duplicate'))).toThrow(
      'Tool "duplicate" is already registered.',
    );
  });

  it('should throw ToolRegistrationError for invalid or empty tool names', () => {
    const registry = new ToolRegistry();

    expect(() =>
      registry.register({
        name: '',
        description: 'empty name',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {},
      }),
    ).toThrow(ToolRegistrationError);

    expect(() =>
      registry.register({
        name: '   ',
        description: 'whitespace name',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {},
      }),
    ).toThrow(ToolRegistrationError);
  });

  it('should return undefined when looking up an unknown tool', () => {
    const registry = new ToolRegistry();
    expect(registry.get('non_existent')).toBeUndefined();
    expect(registry.has('non_existent')).toBe(false);
  });

  it('should export provider-neutral tool definitions', () => {
    const registry = new ToolRegistry();
    const tool = createMockTool('my_tool', 'Does something useful');

    registry.register(tool);

    const definitions = registry.getDefinitions();
    expect(definitions).toEqual([
      {
        name: 'my_tool',
        description: 'Does something useful',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
    ]);
  });

  it('should clear all tools', () => {
    const registry = new ToolRegistry();
    registry.register(createMockTool('tool_a'));
    registry.register(createMockTool('tool_b'));

    expect(registry.list()).toHaveLength(2);
    registry.clear();
    expect(registry.list()).toHaveLength(0);
    expect(registry.has('tool_a')).toBe(false);
  });
});
