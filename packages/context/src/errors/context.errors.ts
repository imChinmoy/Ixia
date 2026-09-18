export class RepositoryContextError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RepositoryContextError';
  }
}

export class RepositoryDiscoveryError extends RepositoryContextError {
  readonly rootPath: string;

  constructor(rootPath: string, message: string, options?: ErrorOptions) {
    super(`Repository discovery failed for "${rootPath}": ${message}`, options);
    this.name = 'RepositoryDiscoveryError';
    this.rootPath = rootPath;
  }
}

export class ProjectDetectionError extends RepositoryContextError {
  constructor(message: string, options?: ErrorOptions) {
    super(`Project detection failed: ${message}`, options);
    this.name = 'ProjectDetectionError';
  }
}

export class ContextBudgetExceededError extends RepositoryContextError {
  readonly limit: number;
  readonly actual: number;

  constructor(limit: number, actual: number, message?: string) {
    super(
      message ??
        `Repository context budget exceeded: limit is ${limit} characters, but generated ${actual} characters.`,
    );
    this.name = 'ContextBudgetExceededError';
    this.limit = limit;
    this.actual = actual;
  }
}
