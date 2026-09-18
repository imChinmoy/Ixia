import {
  type ToolCall,
  type Message,
  createSystemMessage,
  createAssistantToolCallMessage,
  type ConversationManager,
} from '@ixia/core';
import type { ToolRegistry, ToolExecutor } from '@ixia/tools';
import { logger } from '@ixia/logger';
import type { AgentConfig, AgentEvent, AgentRunOptions } from '../types/agent.js';
import {
  AgentIterationLimitError,
  AgentToolCallLimitError,
} from '../errors/agent.errors.js';
import { ToolCallHandler } from './tool-call-handler.js';

export interface AgentLoopOptions {
  conversationManager: ConversationManager;
  toolRegistry: ToolRegistry;
  toolExecutor: ToolExecutor;
  config: Required<AgentConfig>;
  initialContext?: string;
}

export class AgentLoop {
  private readonly conversationManager: ConversationManager;
  private readonly toolRegistry: ToolRegistry;
  private readonly toolCallHandler: ToolCallHandler;
  private readonly config: Required<AgentConfig>;
  private readonly initialContext?: string;

  constructor(options: AgentLoopOptions) {
    this.conversationManager = options.conversationManager;
    this.toolRegistry = options.toolRegistry;
    this.toolCallHandler = new ToolCallHandler(options.toolExecutor);
    this.config = options.config;
    this.initialContext = options.initialContext;
  }

  /**
   * Executes the multi-turn agent loop until a final text response is produced,
   * an iteration or tool call limit is exceeded, an error occurs, or execution is cancelled.
   */
  async *run(options?: AgentRunOptions): AsyncIterable<AgentEvent> {
    let iteration = 0;
    let totalToolCalls = 0;

    try {
      while (true) {
        if (options?.signal?.aborted) {
          logger.debug('[AgentLoop] AbortSignal detected before iteration');
          yield { type: 'agent_cancelled', reason: options.signal.reason };
          return;
        }

        if (iteration >= this.config.maxIterations) {
          logger.warn(
            `[AgentLoop] Max iterations limit (${this.config.maxIterations}) reached`,
          );
          throw new AgentIterationLimitError(this.config.maxIterations);
        }

        iteration++;
        yield { type: 'iteration_started', iteration };
        logger.debug(`[AgentLoop] Starting iteration ${iteration}`);

        // 1. Prepare messages payload for provider
        let systemPrompt = this.conversationManager.getSystemPrompt();
        if (this.initialContext) {
          systemPrompt = `${systemPrompt}\n\n${this.initialContext}`;
        }
        const systemMessage = createSystemMessage(systemPrompt);
        const conversationMessages = this.conversationManager.getMessages();
        const payload: Message[] = [systemMessage, ...conversationMessages];

        // 2. Prepare tool definitions
        const toolDefinitions = this.toolRegistry.getDefinitions();

        // 3. Dispatch stream to provider
        yield { type: 'llm_started', iteration };
        const provider = this.conversationManager.getProvider();

        let accumulatedText = '';
        const turnToolCalls: ToolCall[] = [];
        let providerErrored = false;

        for await (const event of provider.stream(payload, {
          signal: options?.signal,
          tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
        })) {
          if (options?.signal?.aborted) {
            yield { type: 'agent_cancelled', reason: options.signal.reason };
            return;
          }

          if (event.type === 'text_delta') {
            accumulatedText += event.content;
            yield {
              type: 'llm_text_delta',
              content: event.content,
              iteration,
            };
          } else if (event.type === 'tool_call') {
            turnToolCalls.push(event.toolCall);
          } else if (event.type === 'error') {
            providerErrored = true;
            yield { type: 'agent_error', error: event.error };
            return;
          }
        }

        if (providerErrored) {
          return;
        }

        if (options?.signal?.aborted) {
          yield { type: 'agent_cancelled', reason: options.signal.reason };
          return;
        }

        // 4. If no tool calls were made, we have the final assistant response
        if (turnToolCalls.length === 0) {
          logger.debug(
            `[AgentLoop] Turn finished with final response (no tool calls). Completed in ${iteration} iteration(s).`,
          );

          this.conversationManager.addAssistantMessage(accumulatedText);

          yield {
            type: 'agent_completed',
            output: accumulatedText,
            totalIterations: iteration,
            totalToolCalls,
          };
          return;
        }

        // 5. Check tool call budget
        if (totalToolCalls + turnToolCalls.length > this.config.maxToolCalls) {
          logger.warn(
            `[AgentLoop] Max tool calls limit (${this.config.maxToolCalls}) exceeded with ${turnToolCalls.length} new calls requested`,
          );
          throw new AgentToolCallLimitError(this.config.maxToolCalls);
        }

        // 6. Record assistant's tool call invocation in conversation history
        const assistantMessage = createAssistantToolCallMessage(
          turnToolCalls,
          accumulatedText,
        );
        this.conversationManager.addMessage(assistantMessage);

        // 7. Execute all requested tool calls sequentially
        for (const toolCall of turnToolCalls) {
          if (options?.signal?.aborted) {
            yield { type: 'agent_cancelled', reason: options.signal.reason };
            return;
          }

          yield { type: 'tool_call_started', toolCall, iteration };

          const execution = await this.toolCallHandler.handle(toolCall, {
            cwd: options?.cwd ?? this.config.cwd,
            signal: options?.signal,
            requestId: options?.requestId,
          });

          if (options?.signal?.aborted) {
            yield { type: 'agent_cancelled', reason: options.signal.reason };
            return;
          }

          if (execution.success) {
            yield {
              type: 'tool_call_completed',
              toolCall,
              result: execution.result,
              iteration,
            };
          } else {
            yield {
              type: 'tool_call_failed',
              toolCall,
              error: execution.error ?? new Error('Tool execution failed'),
              iteration,
            };
          }

          // Feed tool execution outcome back into conversation history
          this.conversationManager.addMessage(execution.message);
          totalToolCalls++;
        }

        // Continue loop to next iteration with tool feedback in history
      }
    } catch (error) {
      if (options?.signal?.aborted) {
        yield { type: 'agent_cancelled', reason: options?.signal.reason };
        return;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      yield { type: 'agent_error', error: err };
    }
  }
}
