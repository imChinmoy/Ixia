import { SoraError, EXIT_CODES } from '@sora/core';

export class LLMError extends SoraError {
  constructor(message: string, code = 'LLM_ERROR', exitCode: number = EXIT_CODES.ERROR) {
    super(message, code, exitCode);
    this.name = 'LLMError';
  }
}

export class AuthenticationError extends LLMError {
  constructor(message = 'Groq API authentication failed. Please check your GROQ_PROVIDER_KEY.') {
    super(message, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends LLMError {
  constructor(message = 'Groq API rate limit reached. Please try again later.') {
    super(message, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

export class NetworkError extends LLMError {
  constructor(
    message = 'Unable to reach the Groq API. Please check your network connection and try again.',
  ) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

export class InvalidModelError extends LLMError {
  constructor(model: string, details?: string) {
    super(
      details ?? `Invalid model "${model}". Please check your model configuration.`,
      'INVALID_MODEL_ERROR',
    );
    this.name = 'InvalidModelError';
  }
}
