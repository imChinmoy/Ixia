import { describe, it, expect } from 'vitest';
import {
  APP_NAME,
  APP_DESCRIPTION,
  DEFAULT_VERSION,
  PROMPT_SYMBOL,
  EXIT_COMMANDS,
  EXIT_CODES,
  SoraError,
  ConfigurationError,
  CLIError,
  isSoraError,
} from '@sora/core';

describe('Core Constants', () => {
  it('should define application metadata constants', () => {
    expect(APP_NAME).toBe('Sora');
    expect(APP_DESCRIPTION).toBe('AI coding agent for your terminal');
    expect(DEFAULT_VERSION).toBe('0.1.0');
    expect(PROMPT_SYMBOL).toBe('❯');
  });

  it('should define exit commands and exit codes', () => {
    expect(EXIT_COMMANDS).toContain('exit');
    expect(EXIT_COMMANDS).toContain('quit');
    expect(EXIT_CODES.SUCCESS).toBe(0);
    expect(EXIT_CODES.ERROR).toBe(1);
    expect(EXIT_CODES.SIGINT).toBe(130);
  });
});

describe('Core Errors', () => {
  it('should create SoraError with default and custom codes', () => {
    const defaultErr = new SoraError('A basic error');
    expect(defaultErr.name).toBe('SoraError');
    expect(defaultErr.code).toBe('SORA_ERROR');
    expect(defaultErr.exitCode).toBe(1);
    expect(isSoraError(defaultErr)).toBe(true);

    const customErr = new SoraError('Custom error', 'CUSTOM_CODE', 2);
    expect(customErr.code).toBe('CUSTOM_CODE');
    expect(customErr.exitCode).toBe(2);
  });

  it('should create ConfigurationError with CONFIG_ERROR code', () => {
    const configErr = new ConfigurationError('Invalid config');
    expect(configErr.name).toBe('ConfigurationError');
    expect(configErr.code).toBe('CONFIG_ERROR');
    expect(isSoraError(configErr)).toBe(true);
  });

  it('should create CLIError with CLI_ERROR code', () => {
    const cliErr = new CLIError('CLI failed', 2);
    expect(cliErr.name).toBe('CLIError');
    expect(cliErr.code).toBe('CLI_ERROR');
    expect(cliErr.exitCode).toBe(2);
    expect(isSoraError(cliErr)).toBe(true);
  });

  it('should return false for non-SoraError in isSoraError', () => {
    expect(isSoraError(new Error('standard error'))).toBe(false);
    expect(isSoraError('string error')).toBe(false);
    expect(isSoraError(null)).toBe(false);
  });
});
