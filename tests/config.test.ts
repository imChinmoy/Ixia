import process from 'node:process';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadConfig,
  getDefaultConfig,
  validateLLMConfig,
  ConfigManager,
  DEFAULT_CONFIG,
  DEFAULT_LLM_MODEL,
} from '@sora/config';
import { ConfigurationError } from '@sora/core';

describe('Config Package', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return valid default configuration', () => {
    const config = getDefaultConfig();
    expect(config.version).toBe('0.1.0');
    expect(config.theme).toBe('default');
    expect(config.llm.model).toBe(DEFAULT_LLM_MODEL);
    expect(config.llm.provider).toBe('groq');
  });

  it('should load GROQ_PROVIDER_KEY from environment', () => {
    process.env['GROQ_PROVIDER_KEY'] = 'test-key-12345';
    const config = loadConfig({ skipEnv: true });
    expect(config.llm.apiKey).toBe('test-key-12345');
  });

  it('should load default model when SORA_LLM_MODEL is not set', () => {
    delete process.env['SORA_LLM_MODEL'];
    const config = loadConfig({ skipEnv: true });
    expect(config.llm.model).toBe('openai/gpt-oss-120b');
  });

  it('should load custom model when SORA_LLM_MODEL is set', () => {
    process.env['SORA_LLM_MODEL'] = 'custom-test-model';
    const config = loadConfig({ skipEnv: true });
    expect(config.llm.model).toBe('custom-test-model');
  });

  it('should validate LLM config and fail when key is missing', () => {
    expect(() => {
      validateLLMConfig({
        provider: 'groq',
        model: DEFAULT_LLM_MODEL,
        apiKey: '',
      });
    }).toThrow(ConfigurationError);

    expect(() => {
      validateLLMConfig({
        provider: 'groq',
        model: DEFAULT_LLM_MODEL,
        apiKey: '   ',
      });
    }).toThrow(/Missing GROQ_PROVIDER_KEY/);
  });

  it('should succeed validation when key is present', () => {
    expect(() => {
      validateLLMConfig({
        provider: 'groq',
        model: DEFAULT_LLM_MODEL,
        apiKey: 'valid-test-key',
      });
    }).not.toThrow();
  });

  it('should merge overrides when loading config', () => {
    const config = loadConfig({
      skipEnv: true,
      overrides: {
        theme: 'default',
        llm: {
          provider: 'groq',
          model: 'overridden-model',
          apiKey: 'overridden-key',
        },
      },
    });

    expect(config.version).toBe('0.1.0');
    expect(config.llm.model).toBe('overridden-model');
    expect(config.llm.apiKey).toBe('overridden-key');
  });

  it('should throw ConfigurationError when version is empty', () => {
    expect(() => {
      loadConfig({
        skipEnv: true,
        overrides: {
          version: '',
        },
      });
    }).toThrow(ConfigurationError);
  });

  it('should manage config values using ConfigManager', () => {
    const manager = new ConfigManager(DEFAULT_CONFIG);
    expect(manager.get('version')).toBe('0.1.0');

    manager.set('theme', 'default');
    expect(manager.get('theme')).toBe('default');

    manager.merge({ llm: { provider: 'groq', model: 'new-model', apiKey: 'abc' } });
    const all = manager.getAll();
    expect(all.llm.model).toBe('new-model');
  });
});
