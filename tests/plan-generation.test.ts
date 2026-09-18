import { describe, it, expect } from 'vitest';
import {
  type LLMProvider,
  type LLMEvent,
  type LLMRequestOptions,
  type Message,
} from '@ixia/core';
import {
  PlanGenerator,
  parsePlanResponse,
  PlanGenerationError,
  PlanValidationError,
} from '@ixia/planner';

class MockLLMProvider implements LLMProvider {
  readonly name = 'mock-llm';
  readonly model = 'mock-model';
  private responses: string[];

  constructor(responses: string[]) {
    this.responses = [...responses];
  }

  async *stream(_messages: Message[], _options?: LLMRequestOptions): AsyncIterable<LLMEvent> {
    const next = this.responses.shift();
    if (next === undefined) {
      yield { type: 'error', error: new Error('No more mock responses') };
      return;
    }
    if (next.startsWith('__ERROR__:')) {
      yield { type: 'error', error: new Error(next.replace('__ERROR__:', '')) };
      return;
    }
    yield { type: 'text_delta', content: next };
    yield { type: 'completed' };
  }
}

describe('Plan Parser and Generator', () => {
  describe('parsePlanResponse', () => {
    it('parses pure JSON string correctly', () => {
      const json = JSON.stringify({
        goal: 'Refactor auth service',
        steps: [
          { id: 's1', title: 'Step 1', dependencies: [] },
          { id: 's2', title: 'Step 2', dependencies: ['s1'] },
        ],
      });

      const parsed = parsePlanResponse(json);
      expect(parsed.goal).toBe('Refactor auth service');
      expect(parsed.steps).toHaveLength(2);
      expect(parsed.steps[0]?.id).toBe('s1');
      expect(parsed.steps[1]?.dependencies).toEqual(['s1']);
    });

    it('extracts JSON from markdown code blocks', () => {
      const markdown = `
Here is the plan for your request:
\`\`\`json
{
  "goal": "Migrate database schema",
  "steps": [
    {
      "id": "step-1",
      "title": "Create migration file",
      "dependencies": []
    }
  ]
}
\`\`\`
Hope this helps!
`;
      const parsed = parsePlanResponse(markdown);
      expect(parsed.goal).toBe('Migrate database schema');
      expect(parsed.steps).toHaveLength(1);
    });

    it('throws PlanValidationError on empty or whitespace response', () => {
      expect(() => parsePlanResponse('')).toThrow(PlanValidationError);
      expect(() => parsePlanResponse('   \n  ')).toThrow(PlanValidationError);
    });

    it('throws PlanValidationError on malformed JSON', () => {
      expect(() => parsePlanResponse('Not JSON at all')).toThrow(PlanValidationError);
    });

    it('throws PlanValidationError when goal or steps are missing', () => {
      expect(() => parsePlanResponse(JSON.stringify({ steps: [] }))).toThrow(
        PlanValidationError,
      );
      expect(() =>
        parsePlanResponse(JSON.stringify({ goal: 'Some goal' })),
      ).toThrow(PlanValidationError);
    });
  });

  describe('PlanGenerator', () => {
    it('generates and validates a complete plan using LLM provider', async () => {
      const provider = new MockLLMProvider([
        JSON.stringify({
          goal: 'Implement payment gateway',
          steps: [
            {
              id: 'step-1',
              title: 'Review existing billing module',
              description: 'Examine stripe types and client setup',
              dependencies: [],
            },
            {
              id: 'step-2',
              title: 'Add webhook handler',
              description: 'Implement /api/webhooks/stripe',
              dependencies: ['step-1'],
            },
          ],
        }),
      ]);

      const generator = new PlanGenerator();
      const plan = await generator.generate(
        { prompt: 'Implement payment gateway', cwd: '/test' },
        provider,
      );

      expect(plan.id).toBeDefined();
      expect(plan.goal).toBe('Implement payment gateway');
      expect(plan.status).toBe('ready');
      expect(plan.steps).toHaveLength(2);
      expect(plan.steps[0]?.status).toBe('pending');
      expect(plan.steps[1]?.dependencies).toEqual(['step-1']);
    });

    it('throws PlanGenerationError when LLM provider emits an error', async () => {
      const provider = new MockLLMProvider(['__ERROR__:Rate limit reached']);
      const generator = new PlanGenerator();

      await expect(
        generator.generate({ prompt: 'Implement payment', cwd: '/test' }, provider),
      ).rejects.toThrow(PlanGenerationError);
    });

    it('throws PlanValidationError when LLM returns invalid plan schema', async () => {
      const provider = new MockLLMProvider([
        JSON.stringify({
          goal: '', // invalid empty goal
          steps: [],
        }),
      ]);

      const generator = new PlanGenerator();
      await expect(
        generator.generate({ prompt: 'Implement payment', cwd: '/test' }, provider),
      ).rejects.toThrow(PlanValidationError);
    });
  });
});
