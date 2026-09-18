export interface ShellExecutionOptions {
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly maxStdoutBytes?: number;
  readonly maxStderrBytes?: number;
  readonly env?: Record<string, string>;
}

export interface ShellExecutionResult {
  readonly command: string;
  readonly cwd: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly signal?: string;
  readonly durationMs: number;
  readonly timedOut: boolean;
  readonly truncated: boolean;
}

export interface ExecuteCommandInput {
  readonly command: string;
  readonly cwd?: string;
  readonly timeoutMs?: number;
}
