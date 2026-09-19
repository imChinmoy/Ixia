import { describe, it, expect } from 'vitest';
import {
  ConversationManager,
  type LLMProvider,
  type LLMEvent,
  type LLMRequestOptions,
  type Message,
} from '@ixia/core';
import {
  ToolRegistry,
  ToolExecutor,
  type Tool,
  type ToolExecutionContext,
  type ToolSchema,
} from '@ixia/tools';
import { AgentRuntime, type AgentEvent } from '@ixia/agent';
import { PlannerService } from '@ixia/planner';
import { VerifierService, VerificationPolicy, type VerificationCheck } from '@ixia/verification';

class ScriptableLLMProvider implements LLMProvider {
  readonly name = 'scriptable-mock';
  readonly model = 'mock-model';
  private turns: Array<
    (messages: Message[], options?: LLMRequestOptions) => AsyncIterable<LLMEvent>
  >;
  public calls: Array<{ messages: Message[]; options?: LLMRequestOptions }> = [];

  constructor(
    turns: Array<
      (messages: Message[], options?: LLMRequestOptions) => AsyncIterable<LLMEvent>
    >,
  ) {
    this.turns = [...turns];
  }

  async *stream(
    messages: Message[],
    options?: LLMRequestOptions,
  ): AsyncIterable<LLMEvent> {
    this.calls.push({ messages: [...messages], options });
    const turnFn = this.turns.shift();
    if (!turnFn) {
      yield { type: 'text_delta', content: 'Fallback response' };
      yield { type: 'completed' };
      return;
    }
    yield* turnFn(messages, options);
  }
}

class MockCommandTool implements Tool<{ command: string }, { stdout: string; stderr: string; exitCode: number; durationMs: number; timedOut: boolean; truncated: boolean }> {
  readonly name = 'execute_command';
  readonly description = 'Executes command';
  readonly inputSchema: ToolSchema = {
    type: 'object',
    properties: {
      command: { type: 'string' },
    },
    required: ['command'],
  };

  private handler: (cmd: string) => { stdout: string; stderr: string; exitCode: number };

  constructor(handler: (cmd: string) => { stdout: string; stderr: string; exitCode: number }) {
    this.handler = handler;
  }

  setHandler(handler: (cmd: string) => { stdout: string; stderr: string; exitCode: number }): void {
    this.handler = handler;
  }

  async execute(input: { command: string }, _context: ToolExecutionContext) {
    const res = this.handler(input.command);
    return {
      command: input.command,
      cwd: process.cwd(),
      stdout: res.stdout,
      stderr: res.stderr,
      exitCode: res.exitCode,
      durationMs: 10,
      timedOut: false,
      truncated: false,
    };
  }
}

class FixedPolicy extends VerificationPolicy {
  private checks: VerificationCheck[];

  constructor(checks: VerificationCheck[]) {
    super();
    this.checks = checks;
  }

  setChecks(checks: VerificationCheck[]): void {
    this.checks = checks;
  }

  override async discoverChecks(): Promise<VerificationCheck[]> {
    return this.checks;
  }

  override async selectChecks(): Promise<VerificationCheck[]> {
    return this.checks;
  }
}

describe('Agent Self-Correction & Verification Integration', () => {
  it('should verify step and complete plan when verification passes', async () => {
    let commandCalls = 0;
    const mockCommand = new MockCommandTool(() => {
      commandCalls++;
      return { stdout: 'All tests passing', stderr: '', exitCode: 0 };
    });

    const registry = new ToolRegistry();
    registry.register(mockCommand);
    const toolExecutor = new ToolExecutor({ registry });

    const policy = new FixedPolicy([
      {
        id: 'chk-test',
        type: 'test',
        name: 'Automated tests',
        status: 'pending',
        command: 'pnpm test',
      },
    ]);

    const verifier = new VerifierService({
      toolExecutor,
      policy,
    });

    const planner = new PlannerService();

    const planJson = JSON.stringify({
      goal: 'Implement authentication',
      steps: [
        {
          id: 'step-1',
          title: 'Implement authentication',
          description: 'Write auth middleware',
          dependencies: [],
        },
      ],
    });

    const provider = new ScriptableLLMProvider([
      // Turn 1: Planner generates plan
      async function* () {
        yield { type: 'text_delta', content: `\`\`\`json\n${planJson}\n\`\`\`` };
        yield { type: 'completed' };
      },
      // Turn 2: Step execution response
      async function* () {
        yield { type: 'text_delta', content: 'Implemented auth middleware.' };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider });
    const runtime = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor,
      planner,
      verifier,
    });

    const events: AgentEvent[] = [];
    for await (const event of runtime.runStream('Implement authentication', { forcePlan: true })) {
      events.push(event);
    }

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('plan_started');
    expect(eventTypes).toContain('step_started');
    expect(eventTypes).toContain('verification_started');
    expect(eventTypes).toContain('verification_check_started');
    expect(eventTypes).toContain('verification_check_completed');
    expect(eventTypes).toContain('verification_passed');
    expect(eventTypes).toContain('step_completed');
    expect(eventTypes).toContain('plan_completed');

    expect(commandCalls).toBeGreaterThan(0);
  });

  it('should trigger self-correction on verification failure and succeed on second attempt', async () => {
    let verifyCount = 0;
    const mockCommand = new MockCommandTool((cmd) => {
      if (cmd.includes('typecheck')) {
        verifyCount++;
        if (verifyCount === 1) {
          // First attempt fails with TypeScript error
          return {
            stdout: "src/auth.ts:42:15 - error TS2339: Property 'userId' does not exist on type 'Request'.",
            stderr: '',
            exitCode: 2,
          };
        }
        // Second attempt succeeds
        return {
          stdout: 'TypeScript exited with 0 errors',
          stderr: '',
          exitCode: 0,
        };
      }
      return { stdout: 'OK', stderr: '', exitCode: 0 };
    });

    const registry = new ToolRegistry();
    registry.register(mockCommand);
    const toolExecutor = new ToolExecutor({ registry });

    const policy = new FixedPolicy([
      {
        id: 'chk-tc',
        type: 'typecheck',
        name: 'TypeScript typecheck',
        status: 'pending',
        command: 'pnpm typecheck',
      },
    ]);

    const verifier = new VerifierService({
      toolExecutor,
      policy,
      recoveryPolicy: { maxVerificationAttempts: 3 },
    });

    const planner = new PlannerService();

    const planJson = JSON.stringify({
      goal: 'Add authentication',
      steps: [
        {
          id: 'step-1',
          title: 'Add authentication',
          description: 'Create middleware',
          dependencies: [],
        },
      ],
    });

    const provider = new ScriptableLLMProvider([
      // Turn 1: Generate plan
      async function* () {
        yield { type: 'text_delta', content: `\`\`\`json\n${planJson}\n\`\`\`` };
        yield { type: 'completed' };
      },
      // Turn 2: Initial implementation (which will fail verification)
      async function* () {
        yield { type: 'text_delta', content: 'Initial auth middleware created.' };
        yield { type: 'completed' };
      },
      // Turn 3: Correction response from existing Agent Runtime
      async function* (messages) {
        // Verify that failure context was provided to the LLM
        const lastMsg = messages[messages.length - 1];
        expect(lastMsg?.content).toContain('VERIFICATION FAILURE');
        expect(lastMsg?.content).toContain('Property \'userId\' does not exist');
        yield { type: 'text_delta', content: 'Fixed userId type definition in auth middleware.' };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider });
    const runtime = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor,
      planner,
      verifier,
    });

    const events: AgentEvent[] = [];
    for await (const event of runtime.runStream('Add authentication', { forcePlan: true })) {
      events.push(event);
    }

    const eventTypes = events.map((e) => e.type);

    expect(eventTypes).toContain('verification_failed');
    expect(eventTypes).toContain('recovery_started');
    expect(eventTypes).toContain('recovery_attempted');
    expect(eventTypes).toContain('recovery_completed');
    expect(eventTypes).toContain('verification_passed');
    expect(eventTypes).toContain('step_completed');
    expect(eventTypes).toContain('plan_completed');

    // 1 failure + 1 recovery success + 1 final plan verification
    expect(verifyCount).toBe(3);
  });

  it('should stop and exhaust recovery when failure persists beyond maxVerificationAttempts', async () => {
    // Persistent failure
    const mockCommand = new MockCommandTool(() => {
      return {
        stdout: "tests/auth.test.ts: FAIL Assertion error: expected 200, got 500",
        stderr: '',
        exitCode: 1,
      };
    });

    const registry = new ToolRegistry();
    registry.register(mockCommand);
    const toolExecutor = new ToolExecutor({ registry });

    const policy = new FixedPolicy([
      {
        id: 'chk-test',
        type: 'test',
        name: 'Unit tests',
        status: 'pending',
        command: 'pnpm test',
      },
    ]);

    const verifier = new VerifierService({
      toolExecutor,
      policy,
      recoveryPolicy: { maxVerificationAttempts: 2 },
    });

    const planner = new PlannerService();

    const planJson = JSON.stringify({
      goal: 'Refactor database',
      steps: [
        {
          id: 'step-1',
          title: 'Refactor database',
          dependencies: [],
        },
      ],
    });

    const provider = new ScriptableLLMProvider([
      // Turn 1: Plan
      async function* () {
        yield { type: 'text_delta', content: `\`\`\`json\n${planJson}\n\`\`\`` };
        yield { type: 'completed' };
      },
      // Turn 2: Initial execution
      async function* () {
        yield { type: 'text_delta', content: 'Database refactored.' };
        yield { type: 'completed' };
      },
      // Turn 3: Attempt 1
      async function* () {
        yield { type: 'text_delta', content: 'Attempted fix 1.' };
        yield { type: 'completed' };
      },
      // Turn 4: Attempt 2
      async function* () {
        yield { type: 'text_delta', content: 'Attempted fix 2.' };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider });
    const runtime = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor,
      planner,
      verifier,
    });

    const events: AgentEvent[] = [];
    for await (const event of runtime.runStream('Refactor database', { forcePlan: true })) {
      events.push(event);
    }

    const eventTypes = events.map((e) => e.type);

    expect(eventTypes).toContain('recovery_started');
    expect(eventTypes).toContain('recovery_exhausted');
    expect(eventTypes).toContain('step_failed');
    expect(eventTypes).toContain('plan_failed');
    expect(eventTypes).not.toContain('plan_completed');
  });

  it('should cleanly abort when cancelled during verification', async () => {
    const controller = new AbortController();

    const mockCommand = new MockCommandTool(() => {
      // Abort during command execution
      controller.abort('User stopped during verification');
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    const registry = new ToolRegistry();
    registry.register(mockCommand);
    const toolExecutor = new ToolExecutor({ registry });

    const policy = new FixedPolicy([
      {
        id: 'chk-test',
        type: 'test',
        name: 'Unit tests',
        status: 'pending',
        command: 'pnpm test',
      },
    ]);

    const verifier = new VerifierService({ toolExecutor, policy });
    const planner = new PlannerService();

    const planJson = JSON.stringify({
      goal: 'Migrate schema',
      steps: [{ id: 'step-1', title: 'Migrate schema', dependencies: [] }],
    });

    const provider = new ScriptableLLMProvider([
      async function* () {
        yield { type: 'text_delta', content: `\`\`\`json\n${planJson}\n\`\`\`` };
        yield { type: 'completed' };
      },
      async function* () {
        yield { type: 'text_delta', content: 'Schema migrated.' };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider });
    const runtime = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor,
      planner,
      verifier,
    });

    const events: AgentEvent[] = [];
    for await (const event of runtime.runStream('Migrate schema', {
      forcePlan: true,
      signal: controller.signal,
    })) {
      events.push(event);
    }

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('plan_cancelled');
    expect(runtime.getState()).toBe('idle');
  });

  it('should run and pass final plan verification', async () => {
    const mockCommand = new MockCommandTool(() => ({
      stdout: 'All checks passed',
      stderr: '',
      exitCode: 0,
    }));

    const registry = new ToolRegistry();
    registry.register(mockCommand);
    const toolExecutor = new ToolExecutor({ registry });

    const policy = new FixedPolicy([
      {
        id: 'final-check',
        type: 'build',
        name: 'Final build check',
        status: 'pending',
        command: 'pnpm build',
      },
    ]);

    const verifier = new VerifierService({ toolExecutor, policy });
    const planner = new PlannerService();

    const planJson = JSON.stringify({
      goal: 'Build application',
      steps: [{ id: 'step-1', title: 'Compile code', dependencies: [] }],
    });

    const provider = new ScriptableLLMProvider([
      async function* () {
        yield { type: 'text_delta', content: `\`\`\`json\n${planJson}\n\`\`\`` };
        yield { type: 'completed' };
      },
      async function* () {
        yield { type: 'text_delta', content: 'Code compiled.' };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider });
    const runtime = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor,
      planner,
      verifier,
    });

    const events: AgentEvent[] = [];
    for await (const event of runtime.runStream('Build application', { forcePlan: true })) {
      events.push(event);
    }

    const finalVerificationPassed = events.some(
      (e) => e.type === 'verification_passed' && e.target === 'final',
    );
    expect(finalVerificationPassed).toBe(true);
    expect(events.some((e) => e.type === 'plan_completed')).toBe(true);
  });
});
