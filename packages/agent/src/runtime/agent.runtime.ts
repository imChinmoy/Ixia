import { randomUUID } from 'node:crypto';
import process from 'node:process';
import type { ConversationManager } from '@sora/core';
import type { ToolRegistry, ToolExecutor } from '@sora/tools';
import type { RepositoryContextBuilder, RepositoryContextSnapshot } from '@sora/context';
import type { PlannerService, PlanState, Plan } from '@sora/planner';
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
  planner?: PlannerService;
  config?: AgentConfig;
}

const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_MAX_TOOL_CALLS = 25;

export class AgentRuntime {
  private readonly conversationManager: ConversationManager;
  private readonly toolRegistry: ToolRegistry;
  private readonly toolExecutor: ToolExecutor;
  private readonly contextBuilder?: RepositoryContextBuilder;
  private readonly planner?: PlannerService;
  private readonly config: Required<AgentConfig>;

  private state: AgentState = 'idle';
  private activeAbortController: AbortController | null = null;
  private activePlanState: PlanState | null = null;

  constructor(options: AgentRuntimeOptions) {
    this.conversationManager = options.conversationManager;
    this.toolRegistry = options.toolRegistry;
    this.toolExecutor = options.toolExecutor;
    this.contextBuilder = options.contextBuilder;
    this.planner = options.planner;

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

  getPlanner(): PlannerService | undefined {
    return this.planner;
  }

  getActivePlan(): Readonly<Plan> | undefined {
    return this.activePlanState?.getSnapshot();
  }

  getConfig(): Required<AgentConfig> {
    return { ...this.config };
  }

  /**
   * Aborts any currently executing agent run.
   */
  cancel(reason = 'User requested cancellation'): void {
    if (this.activePlanState) {
      this.activePlanState.cancel(reason);
    }
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
      let repositorySnapshot: RepositoryContextSnapshot | undefined;

      if (this.contextBuilder && !options?.skipContext) {
        yield { type: 'context_build_started' };
        try {
          repositorySnapshot = await this.contextBuilder.build({
            rootPath: options?.cwd ?? this.config.cwd,
            query: trimmed,
          });
          initialContext = repositorySnapshot.formattedPromptContext;
          yield { type: 'context_build_completed', snapshot: repositorySnapshot };
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          logger.warn(
            `[AgentRuntime] Repository context build failed: ${error.message}`,
          );
          yield { type: 'context_build_failed', error };
          // Gracefully continue execution without repository context
        }
      }

      // 4. Planning Phase (Phase 9 Planning System)
      let planState: PlanState | undefined;
      const planningInput = {
        prompt: trimmed,
        context: repositorySnapshot,
        cwd: options?.cwd ?? this.config.cwd,
        history: this.conversationManager.getMessages(),
      };

      if (
        this.planner &&
        !options?.skipPlanning &&
        (options?.forcePlan || this.planner.shouldPlan(planningInput))
      ) {
        try {
          const provider = this.conversationManager.getProvider();
          const plan = await this.planner.generatePlan(planningInput, provider, {
            signal: abortController.signal,
          });

          yield { type: 'plan_created', plan };
          yield { type: 'plan_ready', plan };

          planState = this.planner.createPlanState(plan);
          this.activePlanState = planState;

          // Check if this is a "plan only" request (e.g. "Create a plan ... do not modify anything yet")
          if (this.planner.isPlanOnly(trimmed)) {
            const planDisplay = this.planner.formatPlanForDisplay(plan);
            this.conversationManager.addAssistantMessage(planDisplay);
            yield {
              type: 'agent_completed',
              output: planDisplay,
              totalIterations: 0,
              totalToolCalls: 0,
            };
            this.state = 'completed';
            return;
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          logger.warn(`[AgentRuntime] Plan generation failed: ${error.message}`);
          yield {
            type: 'plan_failed',
            plan: {
              id: 'failed-plan',
              goal: trimmed,
              steps: [],
              status: 'failed',
              version: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            error,
          };
          // Gracefully fall back to standard unguided loop
        }
      }

      // 5. Execution Phase (Planned vs Standard)
      if (planState) {
        planState.start();
        yield { type: 'plan_started', plan: planState.getSnapshot() };

        let currentStep = planState.getNextExecutableStep();

        while (currentStep && !abortController.signal.aborted) {
          planState.startStep(currentStep.id);
          yield {
            type: 'step_started',
            planId: planState.getSnapshot().id,
            step: currentStep,
          };

          // Format compact active plan context for this step
          const planPromptContext = this.planner!.formatPlanForPrompt(
            planState.getSnapshot(),
          );

          const stepContext = initialContext
            ? `${initialContext}\n\n${planPromptContext}`
            : planPromptContext;

          const stepLoop = new AgentLoop({
            conversationManager: this.conversationManager,
            toolRegistry: this.toolRegistry,
            toolExecutor: this.toolExecutor,
            config: this.config,
            initialContext: stepContext,
          });

          let stepSuccess = false;
          let stepError: Error | undefined;

          for await (const event of stepLoop.run({
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
              stepSuccess = true;
            } else if (event.type === 'agent_error') {
              stepError = event.error;
            } else if (event.type === 'agent_cancelled') {
              planState.cancel(event.reason);
              yield {
                type: 'plan_cancelled',
                plan: planState.getSnapshot(),
                reason: event.reason,
              };
              yield event;
              return;
            }

            yield event;
          }

          if (stepSuccess) {
            planState.completeStep(currentStep.id);
            yield {
              type: 'step_completed',
              planId: planState.getSnapshot().id,
              step: planState.getStep(currentStep.id)!,
            };
          } else if (stepError) {
            planState.failStep(currentStep.id, stepError.message);
            yield {
              type: 'step_failed',
              planId: planState.getSnapshot().id,
              step: planState.getStep(currentStep.id)!,
              error: stepError,
            };
            break;
          }

          // Advance to next executable step
          currentStep = planState.getNextExecutableStep();
        }

        if (abortController.signal.aborted) {
          planState.cancel('User requested cancellation');
          yield {
            type: 'plan_cancelled',
            plan: planState.getSnapshot(),
            reason: 'User requested cancellation',
          };
          return;
        }

        const finalPlan = planState.getSnapshot();
        const allCompleted = finalPlan.steps.every(
          (s) => s.status === 'completed' || s.status === 'skipped',
        );

        if (allCompleted) {
          planState.complete();
          yield { type: 'plan_completed', plan: planState.getSnapshot() };
        } else {
          yield {
            type: 'plan_failed',
            plan: finalPlan,
            error: new Error('Plan execution finished with incomplete steps'),
          };
        }

        return;
      }

      // 6. Normal unguided AgentLoop (for simple requests or when planning is bypassed)
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
