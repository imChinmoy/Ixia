import { describe, it, expect } from 'vitest';
import { loadConfig, getDefaultConfig, ConfigManager, DEFAULT_CONFIG } from '@sora/config';
import { ConfigurationError } from '@sora/core';

describe('Config Package', () => {
  it('should return valid default configuration', () => {
    const config = getDefaultConfig();
    expect(config.version).toBe('0.1.0');
    expect(config.theme).toBe('default');
  });

  it('should merge overrides when loading config', () => {
    const config = loadConfig({
      overrides: {
        theme: 'default',
        customOption: 'test-value',
      },
    });

    expect(config.version).toBe('0.1.0');
    expect(config.customOption).toBe('test-value');
  });

  it('should throw ConfigurationError when version is empty', () => {
    expect(() => {
      loadConfig({
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

    manager.merge({ newKey: 123 });
    const all = manager.getAll();
    expect(all.newKey).toBe(123);
  });
});
