export type LLMProviderType = 'groq';

export interface LLMConfig {
  provider: LLMProviderType;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}
