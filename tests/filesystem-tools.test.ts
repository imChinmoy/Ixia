import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ToolRegistry, ToolExecutor, ToolValidationError } from '@sora/tools';
import {
  registerFilesystemTools,
  createFilesystemTools,
  WorkspaceViolationError,
  FileNotFoundError,
  type ListDirectoryResult,
  type ReadFileResult,
  type SearchFilesResult,
  type FileInfoResult,
} from '@sora/filesystem';

describe('Filesystem Tools Integration with Tool System', () => {
  let tempDir: string;
  let registry: ToolRegistry;
  let executor: ToolExecutor;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sora-tools-integ-'));
    registry = new ToolRegistry();
    registerFilesystemTools(registry);
    executor = new ToolExecutor({ registry, defaultCwd: tempDir });

    // Seed test files in temporary workspace
    await fs.mkdir(path.join(tempDir, 'src'));
    await fs.writeFile(
      path.join(tempDir, 'src', 'index.ts'),
      'console.log("Hello from Sora");\nexport const answer = 42;\n',
    );
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      '{"name": "test-project", "version": "1.0.0"}\n',
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should create and register all four filesystem tools', () => {
    const tools = createFilesystemTools();
    expect(tools).toHaveLength(4);

    expect(registry.has('list_directory')).toBe(true);
    expect(registry.has('read_file')).toBe(true);
    expect(registry.has('search_files')).toBe(true);
    expect(registry.has('file_info')).toBe(true);

    const definitions = registry.getDefinitions();
    const toolNames = definitions.map((d) => d.name);
    expect(toolNames).toContain('list_directory');
    expect(toolNames).toContain('read_file');
    expect(toolNames).toContain('search_files');
    expect(toolNames).toContain('file_info');
  });

  it('should execute list_directory through ToolExecutor', async () => {
    const result = await executor.execute(
      {
        id: 'call_list_1',
        name: 'list_directory',
        arguments: { path: '.' },
      },
      { cwd: tempDir },
    );

    expect(result.success).toBe(true);
    expect(result.toolName).toBe('list_directory');
    const data = result.result as ListDirectoryResult;
    expect(data.total).toBe(2);
    const names = data.entries.map((e) => e.name);
    expect(names).toContain('src');
    expect(names).toContain('package.json');
  });

  it('should execute read_file through ToolExecutor', async () => {
    const result = await executor.execute(
      {
        id: 'call_read_1',
        name: 'read_file',
        arguments: { path: 'package.json' },
      },
      { cwd: tempDir },
    );

    expect(result.success).toBe(true);
    const data = result.result as ReadFileResult;
    expect(data.path).toBe('package.json');
    expect(data.content).toContain('test-project');
    expect(data.totalLines).toBeGreaterThanOrEqual(1);
  });

  it('should execute search_files through ToolExecutor', async () => {
    const result = await executor.execute(
      {
        id: 'call_search_1',
        name: 'search_files',
        arguments: { query: 'Hello from Sora' },
      },
      { cwd: tempDir },
    );

    expect(result.success).toBe(true);
    const data = result.result as SearchFilesResult;
    expect(data.matches).toHaveLength(1);
    expect(data.matches[0]?.path).toBe('src/index.ts');
    expect(data.matches[0]?.text).toContain('Hello from Sora');
  });

  it('should execute file_info through ToolExecutor', async () => {
    const result = await executor.execute(
      {
        id: 'call_info_1',
        name: 'file_info',
        arguments: { path: 'src/index.ts' },
      },
      { cwd: tempDir },
    );

    expect(result.success).toBe(true);
    const data = result.result as FileInfoResult;
    expect(data.path).toBe('src/index.ts');
    expect(data.type).toBe('file');
    expect(data.extension).toBe('.ts');
    expect(data.isText).toBe(true);
  });

  it('should return normalized WorkspaceViolationError when path escapes workspace', async () => {
    const result = await executor.execute(
      {
        id: 'call_escape_1',
        name: 'read_file',
        arguments: { path: '../../../../etc/passwd' },
      },
      { cwd: tempDir },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(WorkspaceViolationError);
    expect(result.error?.name).toBe('WorkspaceViolationError');
    expect(result.error?.message).toContain('escapes the workspace boundary');
  });

  it('should return normalized FileNotFoundError for non-existent file', async () => {
    const result = await executor.execute(
      {
        id: 'call_missing_1',
        name: 'read_file',
        arguments: { path: 'missing.txt' },
      },
      { cwd: tempDir },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(FileNotFoundError);
    expect(result.error?.message).toContain('File not found');
  });

  it('should return ToolValidationError for missing required arguments', async () => {
    const result = await executor.execute(
      {
        id: 'call_invalid_1',
        name: 'read_file',
        arguments: {}, // missing required 'path'
      },
      { cwd: tempDir },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(ToolValidationError);
    expect(result.error?.message).toContain('Missing required property "path"');
  });
});
