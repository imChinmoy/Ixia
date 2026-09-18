import { randomUUID } from 'node:crypto';
import process from 'node:process';
import type { ConversationManager } from '@sora/core';
import type { ToolRegistry, ToolExecutor } from '@sora/tools';
import type { RepositoryContextBuilder } from '@sora/context';
import { logger } from '@sora/logger';
import type {
  AgentConfig,
  AgentEvent,
  AgentRunOptions,
  AgentRunResult,
  AgentState,
} from '../types/agent.js';
import { AgentBusyError } from '../errors/agent.errors.js';
import { AgentLoop } from '../loop/agent-loop.js';

export interface AgentRuntimeOptions {
  conversationManager: ConversationManager;
  toolRegistry: ToolRegistry;
  toolExecutor: ToolExecutor;
  contextBuilder?: RepositoryContextBuilder;
  config?: AgentConfig;
}

const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_MAX_TOOL_CALLS = 25;

export class AgentRuntime {
  private readonly conversationManager: ConversationManager;
  private readonly toolRegistry: ToolRegistry;
  private readonly toolExecutor: ToolExecutor;
  private readonly contextBuilder?: RepositoryContextBuilder;
  private readonly config: Required<AgentConfig>;

  private state: AgentState = 'idle';
  private activeAbortController: AbortController | null = null;

  constructor(options: AgentRuntimeOptions) {
    this.conversationManager = options.conversationManager;
    this.toolRegistry = options.toolRegistry;
    this.toolExecutor = options.toolExecutor;
    this.contextBuilder = options.contextBuilder;

    this.config = {
      maxIterations: options.config?.maxIterations ?? DEFAULT_MAX_ITERATIONS,
      maxToolCalls: options.config?.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS,
      temperature: options.config?.temperature ?? 0.2,
      maxTokens: options.config?.maxTokens ?? 4096,
      cwd: options.config?.cwd ?? process.cwd(),
    };
  }

  getState(): AgentState {
    return this.state;
  }

  getConversationManager(): ConversationManager {
    return this.conversationManager;
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  getToolExecutor(): ToolExecutor {
    return this.toolExecutor;
  }

  getContextBuilder(): RepositoryContextBuilder | undefined {
    return this.contextBuilder;
  }

  getConfig(): Required<AgentConfig> {
    return { ...this.config };
  }

  /**
   * Aborts any currently executing agent run.
   */
  cancel(reason = 'User requested cancellation'): void {
    if (this.activeAbortController) {
      logger.debug(`[AgentRuntime] Cancelling active run: ${reason}`);
      this.activeAbortController.abort(reason);
      this.state = 'cancelled';
    }
  }

  /**
   * Executes a user turn as an asynchronous stream of lifecycle events.
   */
  async *runStream(
    input: string,
    options?: AgentRunOptions,
  ): AsyncIterable<AgentEvent> {
    if (this.state === 'running' || this.state === 'waiting_for_tool') {
      throw new AgentBusyError(
        'Agent is already executing a task. Please wait or cancel the active run.',
      );
    }

    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }

    this.state = 'running';
    const runId = randomUUID();
    const abortController = new AbortController();
    this.activeAbortController = abortController;

    const onExternalAbort = () => {
      abortController.abort(options?.signal?.reason);
    };

    if (options?.signal) {
      if (options.signal.aborted) {
        abortController.abort(options.signal.reason);
      } else {
        options.signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    try {
      // 1. Record user message in conversation
      this.conversationManager.addUserMessage(trimmed);

      // 2. Emit start event
      yield { type: 'agent_started', runId, prompt: trimmed };

      // 3. Build repository context snapshot (Phase 8 Context Engine)
      let initialContext: string | undefined;

      if (this.contextBuilder && !options?.skipContext) {
        yield { type: 'context_build_started' };
        try {
          const snapshot = await this.contextBuilder.build({
            rootPath: options?.cwd ?? this.config.cwd,
            query: trimmed,
          });
          initialContext = snapshot.formattedPromptContext;
          yield { type: 'context_build_completed', snapshot };
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          logger.warn(
            `[AgentRuntime] Repository context build failed: ${error.message}`,
          );
          yield { type: 'context_build_failed', error };
          // Gracefully continue execution without repository context
        }
      }

      // 4. Run multi-turn agent loop with repository context orientation
      const loop = new AgentLoop({
        conversationManager: this.conversationManager,
        toolRegistry: this.toolRegistry,
        toolExecutor: this.toolExecutor,
        config: this.config,
        initialContext,
      });

      for await (const event of loop.run({
        ...options,
        signal: abortController.signal,
        cwd: options?.cwd ?? this.config.cwd,
      })) {
        if (event.type === 'tool_call_started') {
          this.state = 'waiting_for_tool';
        } else if (
          event.type === 'tool_call_completed' ||
          event.type === 'tool_call_failed'
        ) {
          this.state = 'running';
        } else if (event.type === 'agent_completed') {
          this.state = 'completed';
        } else if (event.type === 'agent_error') {
          this.state = 'failed';
        } else if (event.type === 'agent_cancelled') {
          this.state = 'cancelled';
        }

        yield event;
      }
    } finally {
      if (options?.signal) {
        options.signal.removeEventListener('abort', onExternalAbort);
      }
      this.activeAbortController = null;
      if (this.state === 'running' || this.state === 'waiting_for_tool') {
        this.state = 'idle';
      }
    }
  }

  /**
   * Executes a user turn and resolves with the final AgentRunResult.
   */
  async run(input: string, options?: AgentRunOptions): Promise<AgentRunResult> {
    let success = false;
    let output = '';
    let iterations = 0;
    let toolCallsCount = 0;
    let error: Error | undefined;
    let cancelled = false;

    for await (const event of this.runStream(input, options)) {
      if (event.type === 'iteration_started') {
        iterations = event.iteration;
      } else if (
        event.type === 'tool_call_completed' ||
        event.type === 'tool_call_failed'
      ) {
        toolCallsCount++;
      } else if (event.type === 'agent_completed') {
        success = true;
        output = event.output;
        iterations = event.totalIterations;
        toolCallsCount = event.totalToolCalls;
      } else if (event.type === 'agent_error') {
        success = false;
        error = event.error;
      } else if (event.type === 'agent_cancelled') {
        cancelled = true;
        success = false;
      }
    }

    return {
      success,
      output,
      iterations,
      toolCallsCount,
      error,
      cancelled,
    };
  }
}
