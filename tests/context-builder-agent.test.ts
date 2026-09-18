import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  ConversationManager,
  type LLMProvider,
  type LLMEvent,
  type LLMRequestOptions,
  type Message,
} from '@sora/core';
import { ToolRegistry, ToolExecutor } from '@sora/tools';
import { AgentRuntime, type AgentEvent } from '@sora/agent';
import {
  RepositoryContextBuilder,
  ContextCache,
  BudgetEnforcer,
} from '@sora/context';

class MockLLMProvider implements LLMProvider {
  readonly name = 'mock-llm';
  readonly model = 'mock-model';
  public calls: Array<{ messages: Message[]; options?: LLMRequestOptions }> = [];

  async *stream(messages: Message[], options?: LLMRequestOptions): AsyncIterable<LLMEvent> {
    this.calls.push({ messages: [...messages], options });
    yield { type: 'text_delta', content: 'Agent response after receiving context.' };
    yield { type: 'completed' };
  }
}

describe('Context Builder & Agent Integration (Phase 8)', () => {
  describe('ContextCache', () => {
    it('should cache and retrieve snapshot objects', () => {
      const cache = new ContextCache(60_000); // 60s TTL
      const mockCached = {
        discovery: {
          rootPath: '/test',
          files: [],
          directories: [],
          sensitiveFiles: [],
          sensitiveFilesFound: [],
          truncated: false,
        },
        project: {
          projectTypes: ['Node.js'],
          languages: ['TypeScript'],
          packageManagersFound: ['pnpm'],
          isMonorepo: false,
          areas: [],
          entryPoints: [],
        },
        structure: {
          formattedTree: '.',
          totalDirectories: 0,
          totalFiles: 0,
          truncated: false,
        },
        cachedAt: Date.now(),
      };

      cache.set('/test', mockCached);
      expect(cache.get('/test')).toEqual(mockCached);

      cache.invalidate('/test');
      expect(cache.get('/test')).toBeUndefined();
    });

    it('should expire entries after TTL', async () => {
      const cache = new ContextCache(10); // 10ms TTL
      cache.set('/test', {
        discovery: {
          rootPath: '/test',
          files: [],
          directories: [],
          sensitiveFiles: [],
          sensitiveFilesFound: [],
          truncated: false,
        },
        project: {
          projectTypes: [],
          languages: [],
          packageManagersFound: [],
          isMonorepo: false,
          areas: [],
          entryPoints: [],
        },
        structure: {
          formattedTree: '.',
          totalDirectories: 0,
          totalFiles: 0,
          truncated: false,
        },
        cachedAt: Date.now() - 50, // older than 10ms
      });

      expect(cache.get('/test')).toBeUndefined();
    });
  });

  describe('BudgetEnforcer', () => {
    it('should enforce structure tree character limit', () => {
      const enforcer = new BudgetEnforcer({ maxStructureCharacters: 50 });
      const longTree = 'a'.repeat(100);
      const truncated = enforcer.truncateStructure(longTree);
      expect(truncated.length).toBeLessThanOrEqual(75);
      expect(truncated).toContain('[truncated]');
    });

    it('should enforce total prompt context character limit', () => {
      const enforcer = new BudgetEnforcer({ maxTotalCharacters: 80 });
      const longContent = 'Hello world! '.repeat(20);
      const truncated = enforcer.enforceTotalBudget(longContent);
      expect(truncated.length).toBeLessThanOrEqual(100);
      expect(truncated).toContain('[truncated]');
    });
  });

  describe('RepositoryContextBuilder (Snapshot Generation & Safety)', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sora-builder-test-'));
      await fs.mkdir(path.join(tempDir, 'src', 'auth'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'packages', 'web'), { recursive: true });

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'mock-app', version: '1.0.0' }),
      );
      await fs.writeFile(path.join(tempDir, 'pnpm-lock.yaml'), 'lockfileVersion: 5.4');
      await fs.writeFile(path.join(tempDir, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"');
      await fs.writeFile(path.join(tempDir, 'tsconfig.json'), '{}');
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Mock Project\nThis is a test application.');
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export const main = 1;');
      await fs.writeFile(path.join(tempDir, 'src', 'auth', 'auth.service.ts'), 'export class AuthService {}');
      await fs.writeFile(path.join(tempDir, '.env'), 'SUPER_SECRET_TOKEN=xyz987654321');
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should build a complete snapshot for a project workspace', async () => {
      const builder = new RepositoryContextBuilder();
      const snapshot = await builder.build({
        rootPath: tempDir,
        query: 'how does auth work',
      });

      expect(snapshot.project.projectTypes).toContain('Node.js');
      expect(snapshot.project.projectTypes).toContain('TypeScript');
      expect(snapshot.project.packageManager).toBe('pnpm');
      expect(snapshot.project.isMonorepo).toBe(true);

      // Structure tree should contain src/
      expect(snapshot.structure.formattedTree).toContain('src/');

      // Candidate relevant files should contain auth.service.ts
      const relevantPaths = snapshot.relevantFiles.map((f) => f.path);
      expect(relevantPaths).toContain('src/auth/auth.service.ts');

      // Sensitive file .env must be tracked in sensitiveFilesFound
      expect(snapshot.sensitiveFilesFound).toContain('.env');

      // Crucial security check: Secret content must NEVER appear in formattedPromptContext
      expect(snapshot.formattedPromptContext).not.toContain('SUPER_SECRET_TOKEN');
      expect(snapshot.formattedPromptContext).not.toContain('xyz987654321');

      // Formatted prompt context should contain orientation sections
      expect(snapshot.formattedPromptContext).toContain('[Repository Context]');
      expect(snapshot.formattedPromptContext).toContain('Project: Node.js, TypeScript (Monorepo)');
      expect(snapshot.formattedPromptContext).toContain('Package Manager: pnpm');
      expect(snapshot.formattedPromptContext).toContain('src/auth/auth.service.ts');
    });

    it('should reuse cache for identical workspace root', async () => {
      const builder = new RepositoryContextBuilder();
      const snapshot1 = await builder.build({ rootPath: tempDir, query: 'auth' });
      const snapshot2 = await builder.build({ rootPath: tempDir, query: 'auth' });

      // Created at timestamp or cached object is reused
      expect(builder.getCache().get(path.resolve(tempDir))).toBeDefined();
      expect(snapshot1.project.projectTypes).toEqual(snapshot2.project.projectTypes);
    });
  });

  describe('AgentRuntime Integration with Context Engine', () => {
    let tempDir: string;
    let mockProvider: MockLLMProvider;
    let conversationManager: ConversationManager;
    let toolRegistry: ToolRegistry;
    let toolExecutor: ToolExecutor;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sora-agent-ctx-test-'));
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'package.json'), '{"name": "test-agent-ctx"}');
      await fs.writeFile(path.join(tempDir, 'src', 'main.ts'), 'console.log("hello");');

      mockProvider = new MockLLMProvider();
      conversationManager = new ConversationManager({
        provider: mockProvider,
        systemPrompt: 'You are Sora.',
      });
      toolRegistry = new ToolRegistry();
      toolExecutor = new ToolExecutor(toolRegistry);
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should emit context lifecycle events and feed prompt context to AgentLoop', async () => {
      const contextBuilder = new RepositoryContextBuilder();
      const runtime = new AgentRuntime({
        conversationManager,
        toolRegistry,
        toolExecutor,
        contextBuilder,
        config: {
          cwd: tempDir,
        },
      });

      const events: AgentEvent[] = [];
      for await (const event of runtime.runStream('Explain the project structure')) {
        events.push(event);
      }

      // Verify lifecycle events
      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain('context_build_started');
      expect(eventTypes).toContain('context_build_completed');
      expect(eventTypes).toContain('iteration_started');
      expect(eventTypes).toContain('agent_completed');

      // Verify LLM provider received initialContext in system message
      expect(mockProvider.calls.length).toBeGreaterThan(0);
      const systemMessage = mockProvider.calls[0]!.messages.find((m) => m.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage!.content).toContain('You are Sora.');
      expect(systemMessage!.content).toContain('[Repository Context]');
      expect(systemMessage!.content).toContain('Project: Node.js');
    });

    it('should gracefully degrade and continue run if context building fails', async () => {
      const failingBuilder = {
        build: async () => {
          throw new Error('Simulated context engine failure');
        },
      } as unknown as RepositoryContextBuilder;

      const runtime = new AgentRuntime({
        conversationManager,
        toolRegistry,
        toolExecutor,
        contextBuilder: failingBuilder,
        config: {
          cwd: tempDir,
        },
      });

      const events: AgentEvent[] = [];
      for await (const event of runtime.runStream('Hello agent')) {
        events.push(event);
      }

      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain('context_build_started');
      expect(eventTypes).toContain('context_build_failed');
      expect(eventTypes).toContain('agent_completed');

      // Loop still ran and completed normally
      expect(mockProvider.calls.length).toBe(1);
      const systemMessage = mockProvider.calls[0]!.messages.find((m) => m.role === 'system');
      expect(systemMessage!.content).toBe('You are Sora.');
    });
  });
});
