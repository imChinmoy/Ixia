export interface ToolExecutionContext {
  readonly cwd: string;
  readonly signal?: AbortSignal;
  readonly requestId?: string;
}
