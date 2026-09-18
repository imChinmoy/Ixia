import { ToolRegistrationError } from '../errors/tool.errors.js';
import type { Tool, ToolDefinition } from '../types/tool.js';

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  /**
   * Register a new tool. Throws ToolRegistrationError if the tool name is empty
   * or a tool with the same name is already registered.
   */
  register(tool: Tool): void {
    if (!tool || typeof tool !== 'object') {
      throw new ToolRegistrationError('', 'Cannot register an invalid tool.');
    }
    if (!tool.name || typeof tool.name !== 'string' || !tool.name.trim()) {
      throw new ToolRegistrationError('', 'Tool name must be a non-empty string.');
    }
    if (this.tools.has(tool.name)) {
      throw new ToolRegistrationError(tool.name, `Tool "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool by name. Returns true if removed, false if not found.
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Retrieve a registered tool by name. Returns undefined if not found.
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check whether a tool with the given name is registered.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * List all currently registered tools.
   */
  list(): readonly Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Expose provider-neutral tool definitions suitable for LLM providers.
   */
  getDefinitions(): readonly ToolDefinition[] {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  /**
   * Remove all registered tools.
   */
  clear(): void {
    this.tools.clear();
  }
}
