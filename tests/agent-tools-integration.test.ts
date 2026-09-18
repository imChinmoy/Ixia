import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import {
  ConversationManager,
  type LLMProvider,
  type LLMEvent,
  type LLMRequestOptions,
  type Message,
} from '@sora/core';
import { ToolRegistry, ToolExecutor } from '@sora/tools';
import { registerFilesystemTools } from '@sora/filesystem';
import { registerShellTools } from '@sora/shell';
import { AgentRuntime } from '@sora/agent';

class IntegrationMockProvider implements LLMProvider {
  readonly name = 'integration-mock';
  readonly model = 'mock-model';
  private turns: Array<(messages: Message[], options?: LLMRequestOptions) => AsyncIterable<LLMEvent>>;

  constructor(
    turns: Array<(messages: Message[], options?: LLMRequestOptions) => AsyncIterable<LLMEvent>>,
  ) {
    this.turns = [...turns];
  }

  async *stream(messages: Message[], options?: LLMRequestOptions): AsyncIterable<LLMEvent> {
    const turnFn = this.turns.shift();
    if (!turnFn) {
      yield { type: 'text_delta', content: 'Completed workflow.' };
      yield { type: 'completed' };
      return;
    }
    yield* turnFn(messages, options);
  }
}

describe('AgentRuntime with Filesystem and Shell Tools Integration (Phase 7)', () => {
  it('should autonomously inspect files and run terminal commands in the workspace', async () => {
    // Set up a temporary sandbox directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sora-agent-test-'));
    const testFile = path.join(tempDir, 'greeting.txt');
    await fs.writeFile(testFile, 'Hello from Sora Agent Loop!', 'utf-8');

    try {
      const mockProvider = new IntegrationMockProvider([
        // Turn 1: Read file
        async function* () {
          yield {
            type: 'tool_call',
            toolCall: {
              id: 'call_read',
              name: 'read_file',
              arguments: { path: 'greeting.txt' },
            },
          };
          yield { type: 'completed' };
        },
        // Turn 2: Run shell command based on read file
        async function* (messages: Message[]) {
          const toolMsg = messages.find((m) => m.toolCallId === 'call_read');
          expect(toolMsg?.content).toContain('Hello from Sora Agent Loop!');

          yield {
            type: 'tool_call',
            toolCall: {
              id: 'call_cmd',
              name: 'execute_command',
              arguments: { command: 'echo "Checked greeting"' },
            },
          };
          yield { type: 'completed' };
        },
        // Turn 3: Final answer
        async function* (messages: Message[]) {
          const cmdMsg = messages.find((m) => m.toolCallId === 'call_cmd');
          expect(cmdMsg?.content).toContain('Checked greeting');

          yield {
            type: 'text_delta',
            content: 'Successfully read greeting.txt and executed shell verification.',
          };
          yield { type: 'completed' };
        },
      ]);

      const conversationManager = new ConversationManager({ provider: mockProvider });
      const toolRegistry = new ToolRegistry();
      registerFilesystemTools(toolRegistry);
      registerShellTools(toolRegistry);

      const toolExecutor = new ToolExecutor({
        registry: toolRegistry,
        defaultCwd: tempDir,
      });

      const agent = new AgentRuntime({
        conversationManager,
        toolRegistry,
        toolExecutor,
        config: { cwd: tempDir },
      });

      const result = await agent.run('Verify workspace greeting');

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(3);
      expect(result.toolCallsCount).toBe(2);
      expect(result.output).toBe(
        'Successfully read greeting.txt and executed shell verification.',
      );

      // Verify conversation state has proper tool chain
      const messages = conversationManager.getMessages();
      expect(messages).toHaveLength(6);
      expect(messages[0]?.role).toBe('user');
      expect(messages[1]?.role).toBe('assistant');
      expect(messages[1]?.toolCalls?.[0]?.name).toBe('read_file');
      expect(messages[2]?.role).toBe('tool');
      expect(messages[2]?.toolName).toBe('read_file');
      expect(messages[3]?.role).toBe('assistant');
      expect(messages[3]?.toolCalls?.[0]?.name).toBe('execute_command');
      expect(messages[4]?.role).toBe('tool');
      expect(messages[4]?.toolName).toBe('execute_command');
      expect(messages[5]?.role).toBe('assistant');
      expect(messages[5]?.content).toContain('Successfully read');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
