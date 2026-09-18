import { describe, it, expect, vi } from 'vitest';
import { createProgram } from '../apps/cli/src/cli.js';
import { startCommand } from '../apps/cli/src/commands/start.command.js';

describe('CLI Commander Program', () => {
  it('should have correct name, description, and version', () => {
    const program = createProgram();
    expect(program.name()).toBe('sora');
    expect(program.description()).toBe('AI coding agent for your terminal');
    expect(program.version()).toBe('0.1.0');
  });

  it('should have prompt argument registered', () => {
    const program = createProgram();
    const promptArg = program.registeredArguments.find((arg) => arg.name() === 'prompt');
    expect(promptArg).toBeDefined();
    expect(promptArg?.required).toBe(false);
  });

  it('should format help output properly', () => {
    const program = createProgram();
    const helpInfo = program.helpInformation();
    expect(helpInfo).toContain('Usage: sora [options] [prompt]');
    expect(helpInfo).toContain('-v, --version');
    expect(helpInfo).toContain('-h, --help');
    expect(helpInfo).toContain('Optional prompt');
  });

  it('should execute one-shot mode when prompt is provided', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await startCommand({ prompt: 'test query' });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('S O R A'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test query'));
    expect(consoleSpy).toHaveBeenCalledWith('Sora CLI is running in Phase 1.');
    expect(consoleSpy).toHaveBeenCalledWith('LLM integration will be added in Phase 2.');

    consoleSpy.mockRestore();
  });
});
