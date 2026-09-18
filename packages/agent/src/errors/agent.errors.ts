export class AgentRuntimeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AgentRuntimeError';
  }
}

export class AgentIterationLimitError extends AgentRuntimeError {
  readonly limit: number;

  constructor(limit: number) {
    super(`Agent exceeded the maximum allowed iterations limit of ${limit}.`);
    this.name = 'AgentIterationLimitError';
    this.limit = limit;
  }
}

export class AgentToolCallLimitError extends AgentRuntimeError {
  readonly limit: number;

  constructor(limit: number) {
    super(`Agent exceeded the maximum allowed tool calls limit of ${limit}.`);
    this.name = 'AgentToolCallLimitError';
    this.limit = limit;
  }
}

export class AgentCancelledError extends AgentRuntimeError {
  constructor(reason?: string) {
    super(reason ? `Agent run was cancelled: ${reason}` : 'Agent run was cancelled.');
    this.name = 'AgentCancelledError';
  }
}

export class AgentBusyError extends AgentRuntimeError {
  constructor(message = 'Agent is currently busy processing another request.') {
    super(message);
    this.name = 'AgentBusyError';
  }
}
