import Groq from 'groq-sdk';

export interface GroqClientOptions {
  apiKey: string;
}

export function createGroqClient(options: GroqClientOptions): Groq {
  return new Groq({
    apiKey: options.apiKey,
  });
}
