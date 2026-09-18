import { ConfigurationError } from '@sora/core';
import { DEFAULT_CONFIG } from './defaults.js';

export interface SoraConfig {
  version: string;
  theme: 'default';
  [key: string]: unknown;
}

export interface ConfigOptions {
  overrides?: Partial<SoraConfig>;
  configFile?: string;
}

export class ConfigManager {
  private config: SoraConfig;

  constructor(initialConfig: SoraConfig = DEFAULT_CONFIG) {
    this.config = { ...initialConfig };
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
    this.config = { ...this.config, ...partial };
  }
}

export function loadConfig(options?: ConfigOptions): SoraConfig {
  try {
    const config: SoraConfig = {
      ...DEFAULT_CONFIG,
      ...(options?.overrides ?? {}),
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

export function getDefaultConfig(): SoraConfig {
  return { ...DEFAULT_CONFIG };
}
