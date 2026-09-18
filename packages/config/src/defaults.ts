import { DEFAULT_VERSION } from '@sora/core';
import type { SoraConfig } from './config.js';

export const DEFAULT_LLM_MODEL = 'openai/gpt-oss-120b';

export const DEFAULT_CONFIG: SoraConfig = {
  version: DEFAULT_VERSION,
  theme: 'default',
  llm: {
    provider: 'groq',
    model: DEFAULT_LLM_MODEL,
    apiKey: '',
  },
};
