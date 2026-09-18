import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  ShellService,
  ProcessExecutor,
  ShellError,
  CommandAbortedError,
} from '@sora/shell';
import { WorkspaceViolationError } from '@sora/filesystem';

describe('ShellService and ProcessExecutor', () => {
  let tempDir: string;
  let shellService: ShellService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sora-shell-test-'));
    shellService = new ShellService();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should provide access to underlying services', () => {
    expect(shellService.getProcessExecutor()).toBeInstanceOf(ProcessExecutor);
    expect(shellService.getPathService()).toBeDefined();
  });

  it('should execute a simple command successfully and capture stdout and duration', async () => {
    const result = await shellService.execute(
      'node -e "console.log(\'Hello Sora Shell\')"',
      {},
      tempDir,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('Hello Sora Shell');
    expect(result.stderr).toBe('');
    expect(result.timedOut).toBe(false);
    expect(result.truncated).toBe(false);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.cwd).toBe(tempDir);
  });

  it('should capture stderr and non-zero exit code without throwing an unhandled error', async () => {
    const result = await shellService.execute(
      'node -e "console.error(\'Standard error message\'); process.exit(5)"',
      {},
      tempDir,
    );

    expect(result.exitCode).toBe(5);
    expect(result.stderr.trim()).toBe('Standard error message');
    expect(result.stdout).toBe('');
    expect(result.timedOut).toBe(false);
    expect(result.truncated).toBe(false);
  });

  it('should respect working directory when specified inside the workspace', async () => {
    const subDir = path.join(tempDir, 'subfolder');
    await fs.mkdir(subDir);

    const result = await shellService.execute(
      'node -e "console.log(process.cwd())"',
      { cwd: 'subfolder' },
      tempDir,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(subDir);
    expect(result.cwd).toBe(subDir);
  });

  it('should reject cwd that attempts path traversal outside workspace', async () => {
    await expect(
      shellService.execute(
        'node -e "console.log(process.cwd())"',
        { cwd: '../../../../etc' },
        tempDir,
      ),
    ).rejects.toThrow(WorkspaceViolationError);
  });

  it('should handle command timeouts gracefully by terminating process and setting timedOut = true', async () => {
    const result = await shellService.execute(
      'node -e "setTimeout(() => {}, 5000)"',
      { timeoutMs: 150 },
      tempDir,
    );

    expect(result.timedOut).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(100);
    // Process terminated by signal
    expect(result.signal === 'SIGTERM' || result.exitCode !== 0).toBe(true);
  });

  it('should truncate stdout when output exceeds maxStdoutBytes and terminate process', async () => {
    const result = await shellService.execute(
      'node -e "console.log(\'A\'.repeat(10000))"',
      { maxStdoutBytes: 50 },
      tempDir,
    );

    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(result.stdout, 'utf-8')).toBeLessThanOrEqual(50);
  });

  it('should truncate stderr when output exceeds maxStderrBytes and terminate process', async () => {
    const result = await shellService.execute(
      'node -e "console.error(\'B\'.repeat(10000))"',
      { maxStderrBytes: 50 },
      tempDir,
    );

    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(result.stderr, 'utf-8')).toBeLessThanOrEqual(50);
  });

  it('should abort running command when AbortSignal is triggered', async () => {
    const controller = new AbortController();

    const promise = shellService.execute(
      'node -e "setTimeout(() => {}, 5000)"',
      { signal: controller.signal },
      tempDir,
    );

    // Trigger abort after brief delay
    setTimeout(() => {
      controller.abort();
    }, 100);

    await expect(promise).rejects.toThrow(CommandAbortedError);
  });

  it('should reject immediately if AbortSignal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      shellService.execute(
        'node -e "console.log(\'should not run\')"',
        { signal: controller.signal },
        tempDir,
      ),
    ).rejects.toThrow(CommandAbortedError);
  });

  it('should reject invalid or empty commands', async () => {
    await expect(shellService.execute('', {}, tempDir)).rejects.toThrow(ShellError);
    await expect(shellService.execute('   ', {}, tempDir)).rejects.toThrow(ShellError);
  });

  it('should support custom environment variables in execution options', async () => {
    const result = await shellService.execute(
      'node -e "console.log(process.env.SORA_TEST_VAR)"',
      { env: { SORA_TEST_VAR: 'custom_value_42' } },
      tempDir,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('custom_value_42');
  });
});
