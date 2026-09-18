import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigurationError } from '@sora/core';
import { DEFAULT_CONFIG, DEFAULT_LLM_MODEL } from './defaults.js';

export interface LLMConfig {
  provider: 'groq';
  model: string;
  apiKey: string;
}

export interface SoraConfig {
  version: string;
  theme: 'default';
  llm: LLMConfig;
  [key: string]: unknown;
}

export interface ConfigOptions {
  overrides?: Partial<SoraConfig>;
  configFile?: string;
  skipEnv?: boolean;
}

export class ConfigManager {
  private config: SoraConfig;

  constructor(initialConfig: SoraConfig = DEFAULT_CONFIG) {
    this.config = {
      ...initialConfig,
      llm: { ...initialConfig.llm },
    };
  }

  get<K extends keyof SoraConfig>(key: K): SoraConfig[K] {
    return this.config[key];
  }

  getAll(): Readonly<SoraConfig> {
    return Object.freeze({ ...this.config });
  }

  set<K extends keyof SoraConfig>(key: K, value: SoraConfig[K]): void {
    this.config[key] = value;
  }

  merge(partial: Partial<SoraConfig>): void {
    this.config = {
      ...this.config,
      ...partial,
      llm: {
        ...this.config.llm,
        ...(partial.llm ?? {}),
      },
    };
  }
}

export function findEnvFile(startDir: string): string | undefined {
  try {
    let currentDir = path.resolve(startDir);
    while (true) {
      const candidate = path.join(currentDir, '.env');
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }
  } catch {
    // ignore
  }
  return undefined;
}

function parseAndApplyEnv(content: string): void {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match && match[1]) {
      const key = match[1].trim();
      let val = match[2]?.trim() ?? '';
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

export function loadEnv(customPath?: string): void {
  const envPath =
    customPath ??
    findEnvFile(process.cwd()) ??
    findEnvFile(fileURLToPath(import.meta.url));

  if (!envPath) {
    return;
  }

  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envPath);
    } else {
      const content = fs.readFileSync(envPath, 'utf-8');
      parseAndApplyEnv(content);
    }
  } catch {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      parseAndApplyEnv(content);
    } catch {
      // ignore
    }
  }
}

export function loadConfig(options?: ConfigOptions): SoraConfig {
  if (!options?.skipEnv) {
    loadEnv();
  }

  try {
    const envApiKey = process.env['GROQ_PROVIDER_KEY'] ?? '';
    const envModel = process.env['SORA_LLM_MODEL'] || DEFAULT_LLM_MODEL;

    const baseConfig: SoraConfig = {
      ...DEFAULT_CONFIG,
      llm: {
        provider: 'groq',
        model: envModel,
        apiKey: envApiKey,
      },
    };

    const config: SoraConfig = {
      ...baseConfig,
      ...(options?.overrides ?? {}),
      llm: {
        ...baseConfig.llm,
        ...(options?.overrides?.llm ?? {}),
      },
    };

    if (!config.version) {
      throw new ConfigurationError('Invalid configuration: version is required.');
    }

    return config;
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }
    throw new ConfigurationError(
      `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function validateLLMConfig(config: LLMConfig): void {
  if (!config.apiKey || config.apiKey.trim().length === 0) {
    throw new ConfigurationError('Missing GROQ_PROVIDER_KEY.\n\nPlease add it to your .env file.');
  }
}

export function getDefaultConfig(): SoraConfig {
  return {
    ...DEFAULT_CONFIG,
    llm: { ...DEFAULT_CONFIG.llm },
  };
}
