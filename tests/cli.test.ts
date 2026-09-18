import process from 'node:process';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProgram } from '../apps/cli/src/cli.js';
import { startCommand } from '../apps/cli/src/commands/start.command.js';
import * as llmModule from '@sora/llm';

describe('CLI Commander Program', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

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

  it('should execute one-shot mode and stream output when prompt is provided', async () => {
    process.env['GROQ_PROVIDER_KEY'] = 'test-key';

    // Mock ConversationManager sendMessage generator
    vi.spyOn(llmModule.ConversationManager.prototype, 'sendMessage').mockImplementation(
      async function* () {
        yield { type: 'text_delta', content: 'Streamed response chunk' };
        yield { type: 'completed' };
      },
    );

    let output = '';
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      output += String(chunk);
      return true;
    });

    await startCommand({ prompt: 'test query' });

    expect(output).toContain('Sora:');
    expect(output).toContain('Streamed response chunk');

    stdoutSpy.mockRestore();
  });
});
