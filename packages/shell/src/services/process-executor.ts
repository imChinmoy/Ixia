import { spawn } from 'node:child_process';
import process from 'node:process';
import type { ShellExecutionOptions, ShellExecutionResult } from '../types/shell.js';
import { CommandAbortedError, CommandStartError } from '../errors/shell.errors.js';

export const DEFAULT_SHELL_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024; // 1 MB

export class ProcessExecutor {
  /**
   * Executes a shell command asynchronously and captures its output, exit code, and duration.
   */
  async spawnCommand(
    command: string,
    resolvedCwd: string,
    options: ShellExecutionOptions = {},
  ): Promise<ShellExecutionResult> {
    if (options.signal?.aborted) {
      throw new CommandAbortedError(command, undefined, undefined, options.signal.reason);
    }

    const timeoutMs =
      options.timeoutMs ??
      (process.env['IXIA_SHELL_TIMEOUT_MS']
        ? parseInt(process.env['IXIA_SHELL_TIMEOUT_MS'], 10)
        : DEFAULT_SHELL_TIMEOUT_MS);

    const maxStdoutBytes = options.maxStdoutBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
    const maxStderrBytes = options.maxStderrBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

    const isWindows = process.platform === 'win32';
    const shell = isWindows
      ? process.env['COMSPEC'] || 'cmd.exe'
      : process.env['SHELL'] || '/bin/sh';
    const shellArgs = isWindows ? ['/d', '/s', '/c', command] : ['-c', command];

    return new Promise<ShellExecutionResult>((resolve, reject) => {
      const startTime = process.hrtime.bigint();

      let stdout = '';
      let stderr = '';
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let truncated = false;
      let timedOut = false;
      let aborted = false;
      let settled = false;

      let timer: NodeJS.Timeout | undefined;
      let forceKillTimer: NodeJS.Timeout | undefined;

      const child = spawn(shell, shellArgs, {
        cwd: resolvedCwd,
        env: {
          ...process.env,
          ...(options.env ?? {}),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
        if (forceKillTimer) {
          clearTimeout(forceKillTimer);
          forceKillTimer = undefined;
        }
        if (options.signal && onAbort) {
          options.signal.removeEventListener('abort', onAbort);
        }
      };

      const terminateProcess = (sig: NodeJS.Signals = 'SIGTERM') => {
        try {
          if (!child.killed) {
            child.kill(sig);
          }
        } catch {
          // Process may have already exited
        }

        // Schedule fallback SIGKILL if still running
        if (!forceKillTimer) {
          forceKillTimer = setTimeout(() => {
            try {
              if (!child.killed) {
                child.kill('SIGKILL');
              }
            } catch {
              // Ignore
            }
          }, 1000);
          forceKillTimer.unref();
        }
      };

      // Handle AbortSignal
      const onAbort = () => {
        aborted = true;
        terminateProcess('SIGTERM');
      };

      if (options.signal) {
        options.signal.addEventListener('abort', onAbort, { once: true });
      }

      // Handle Timeout
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          timedOut = true;
          terminateProcess('SIGTERM');
        }, timeoutMs);
        timer.unref();
      }

      // Collect stdout
      child.stdout?.on('data', (chunk: Buffer | string) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf-8');
        const chunkLength = buf.length;

        if (stdoutBytes + chunkLength > maxStdoutBytes) {
          truncated = true;
          const allowed = Math.max(0, maxStdoutBytes - stdoutBytes);
          if (allowed > 0) {
            stdout += buf.subarray(0, allowed).toString('utf-8');
            stdoutBytes += allowed;
          }
          // Terminate runaway process exceeding output limit
          terminateProcess('SIGTERM');
        } else {
          stdout += buf.toString('utf-8');
          stdoutBytes += chunkLength;
        }
      });

      // Collect stderr
      child.stderr?.on('data', (chunk: Buffer | string) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf-8');
        const chunkLength = buf.length;

        if (stderrBytes + chunkLength > maxStderrBytes) {
          truncated = true;
          const allowed = Math.max(0, maxStderrBytes - stderrBytes);
          if (allowed > 0) {
            stderr += buf.subarray(0, allowed).toString('utf-8');
            stderrBytes += allowed;
          }
          terminateProcess('SIGTERM');
        } else {
          stderr += buf.toString('utf-8');
          stderrBytes += chunkLength;
        }
      });

      // Handle spawn error
      child.on('error', (err: Error) => {
        cleanup();
        if (!settled) {
          settled = true;
          reject(new CommandStartError(command, err.message, undefined, undefined, err));
        }
      });

      // Handle close
      child.on('close', (code: number | null, signalStr: NodeJS.Signals | null) => {
        cleanup();
        if (settled) return;
        settled = true;

        if (aborted) {
          reject(new CommandAbortedError(command, undefined, undefined, options.signal?.reason));
          return;
        }

        const durationMs = Number((process.hrtime.bigint() - startTime) / 1_000_000n);

        resolve({
          command,
          cwd: resolvedCwd,
          stdout,
          stderr,
          exitCode: code,
          signal: signalStr ? String(signalStr) : undefined,
          durationMs,
          timedOut,
          truncated,
        });
      });
    });
  }
}
