import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ToolRegistry, ToolExecutor, ToolValidationError } from '@sora/tools';
import {
  createShellTools,
  registerShellTools,
  ExecuteCommandTool,
  type ShellExecutionResult,
  CommandAbortedError,
} from '@sora/shell';
import { WorkspaceViolationError } from '@sora/filesystem';

describe('Shell Tools Integration with Tool System', () => {
  let tempDir: string;
  let registry: ToolRegistry;
  let executor: ToolExecutor;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sora-shell-tool-test-'));
    registry = new ToolRegistry();
    registerShellTools(registry);
    executor = new ToolExecutor({ registry, defaultCwd: tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should create and register execute_command tool', () => {
    const tools = createShellTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]).toBeInstanceOf(ExecuteCommandTool);
    expect(tools[0]?.name).toBe('execute_command');

    expect(registry.has('execute_command')).toBe(true);

    const definitions = registry.getDefinitions();
    const toolDef = definitions.find((d) => d.name === 'execute_command');
    expect(toolDef).toBeDefined();
    expect(toolDef?.inputSchema.required).toContain('command');
    expect(toolDef?.inputSchema.properties['command']).toBeDefined();
    expect(toolDef?.inputSchema.properties['cwd']).toBeDefined();
    expect(toolDef?.inputSchema.properties['timeoutMs']).toBeDefined();
  });

  it('should execute a command through ToolExecutor and return structured result', async () => {
    const result = await executor.execute(
      {
        id: 'call_cmd_1',
        name: 'execute_command',
        arguments: { command: 'node -e "console.log(\'Executed via ToolExecutor\')"' },
      },
      { cwd: tempDir },
    );

    expect(result.success).toBe(true);
    expect(result.toolName).toBe('execute_command');
    expect(result.toolCallId).toBe('call_cmd_1');

    const data = result.result as ShellExecutionResult;
    expect(data.exitCode).toBe(0);
    expect(data.stdout.trim()).toBe('Executed via ToolExecutor');
    expect(data.stderr).toBe('');
    expect(data.timedOut).toBe(false);
    expect(data.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should return success = true with failure details when command exits with non-zero code', async () => {
    const result = await executor.execute(
      {
        id: 'call_cmd_failing',
        name: 'execute_command',
        arguments: {
          command: 'node -e "console.error(\'Command failed\'); process.exit(127)"',
        },
      },
      { cwd: tempDir },
    );

    expect(result.success).toBe(true);
    const data = result.result as ShellExecutionResult;
    expect(data.exitCode).toBe(127);
    expect(data.stderr.trim()).toBe('Command failed');
    expect(data.timedOut).toBe(false);
  });

  it('should reject path traversal in cwd with WorkspaceViolationError', async () => {
    const result = await executor.execute(
      {
        id: 'call_cmd_escape',
        name: 'execute_command',
        arguments: {
          command: 'pwd',
          cwd: '../../../../etc',
        },
      },
      { cwd: tempDir },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(WorkspaceViolationError);
    expect(result.error?.message).toContain('escapes the workspace boundary');
  });

  it('should validate tool input schema and reject missing command property', async () => {
    const result = await executor.execute(
      {
        id: 'call_cmd_invalid',
        name: 'execute_command',
        arguments: { cwd: '.' }, // missing required 'command'
      },
      { cwd: tempDir },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(ToolValidationError);
    expect(result.error?.message).toContain('Missing required property "command"');
  });

  it('should respect custom timeoutMs specified in tool arguments', async () => {
    const result = await executor.execute(
      {
        id: 'call_cmd_timeout',
        name: 'execute_command',
        arguments: {
          command: 'node -e "setTimeout(() => {}, 5000)"',
          timeoutMs: 150,
        },
      },
      { cwd: tempDir },
    );

    expect(result.success).toBe(true);
    const data = result.result as ShellExecutionResult;
    expect(data.timedOut).toBe(true);
    expect(data.durationMs).toBeGreaterThanOrEqual(100);
  });

  it('should handle context signal cancellation during execution', async () => {
    const controller = new AbortController();

    const executionPromise = executor.execute(
      {
        id: 'call_cmd_abort',
        name: 'execute_command',
        arguments: { command: 'node -e "setTimeout(() => {}, 5000)"' },
      },
      { cwd: tempDir, signal: controller.signal },
    );

    setTimeout(() => {
      controller.abort();
    }, 100);

    const result = await executionPromise;
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(CommandAbortedError);
  });
});
