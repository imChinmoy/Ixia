import { describe, it, expect } from 'vitest';
import { handleSlashCommand, isSlashCommand } from '../apps/cli/src/ui/slash.js';

describe('Slash Commands', () => {
  it('should identify slash commands correctly', () => {
    expect(isSlashCommand('/help')).toBe(true);
    expect(isSlashCommand('/clear')).toBe(true);
    expect(isSlashCommand('  /status  ')).toBe(true);
    expect(isSlashCommand('Explain what /help means in Linux')).toBe(false);
    expect(isSlashCommand('help')).toBe(false);
  });

  it('should handle /help command', () => {
    const result = handleSlashCommand('/help');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('help');
    if (result && result.type === 'help') {
      expect(result.message).toContain('Sora Commands');
      expect(result.message).toContain('/help');
      expect(result.message).toContain('/clear');
      expect(result.message).toContain('/status');
      expect(result.message).toContain('/model');
      expect(result.message).toContain('/exit');
      expect(result.message).toContain('/quit');
    }
  });

  it('should handle /clear command', () => {
    const result = handleSlashCommand('/clear');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('clear');
    if (result && result.type === 'clear') {
      expect(result.message).toBe('Conversation cleared.');
    }
  });

  it('should handle /status command with session context', () => {
    const result = handleSlashCommand('/status', {
      version: '0.2.0',
      provider: 'Groq',
      model: 'openai/gpt-oss-120b',
      cwd: '/home/user/my-project',
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe('status');
    if (result && result.type === 'status') {
      expect(result.message).toContain('Sora Status');
      expect(result.message).toContain('0.2.0');
      expect(result.message).toContain('Groq');
      expect(result.message).toContain('openai/gpt-oss-120b');
    }
  });

  it('should handle /model command', () => {
    const result = handleSlashCommand('/model', {
      model: 'openai/gpt-oss-120b',
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe('model');
    if (result && result.type === 'model') {
      expect(result.message).toContain('Current model:');
      expect(result.message).toContain('openai/gpt-oss-120b');
    }
  });

  it('should handle /exit and /quit commands', () => {
    const exitResult = handleSlashCommand('/exit');
    expect(exitResult?.type).toBe('exit');

    const quitResult = handleSlashCommand('/quit');
    expect(quitResult?.type).toBe('exit');
  });

  it('should handle unknown slash commands gracefully', () => {
    const result = handleSlashCommand('/unknown');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('unknown');
    if (result && result.type === 'unknown') {
      expect(result.message).toContain('Unknown command: /unknown');
      expect(result.message).toContain('Type /help for available commands');
    }
  });

  it('should return null for non-slash inputs', () => {
    expect(handleSlashCommand('What is a REST API?')).toBeNull();
    expect(handleSlashCommand('Explain /help in bash')).toBeNull();
  });
});
