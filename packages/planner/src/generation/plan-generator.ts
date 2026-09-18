import { randomUUID } from 'node:crypto';
import { type LLMProvider, type Message, createSystemMessage, createUserMessage } from '@sora/core';
import type { Plan, PlanningInput } from '../types/plan.types.js';
import { PlanGenerationError } from '../errors/planner.errors.js';
import { parsePlanResponse } from './plan-parser.js';
import { PlanValidator } from '../validation/plan-validator.js';

export class PlanGenerator {
  private readonly validator: PlanValidator;

  constructor(validator?: PlanValidator) {
    this.validator = validator ?? new PlanValidator();
  }

  async generate(
    input: PlanningInput,
    provider: LLMProvider,
    options?: { signal?: AbortSignal },
  ): Promise<Plan> {
    const messages = this.buildPrompt(input);

    let accumulatedText = '';

    try {
      for await (const event of provider.stream(messages, {
        signal: options?.signal,
        temperature: 0.1,
        maxTokens: 2048,
        responseFormat: { type: 'json_object' },
      })) {
        if (event.type === 'text_delta') {
          accumulatedText += event.content;
        } else if (event.type === 'error') {
          throw new PlanGenerationError(
            `LLM provider error while generating plan: ${event.error.message}`,
            event.error,
          );
        }
      }
    } catch (err) {
      if (err instanceof PlanGenerationError) {
        throw err;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      throw new PlanGenerationError(
        `Failed to generate plan from LLM: ${error.message}`,
        error,
      );
    }

    const parsed = parsePlanResponse(accumulatedText);
    const now = new Date();

    const plan: Plan = {
      id: `plan-${randomUUID()}`,
      goal: parsed.goal,
      steps: parsed.steps,
      status: 'ready',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    this.validator.validate(plan);

    return plan;
  }

  private buildPrompt(input: PlanningInput): Message[] {
    const systemInstructions = [
      'You are Sora Planner, an expert software engineering planner.',
      'Your task is to analyze the user request and repository context, then generate a structured, ordered, actionable development plan.',
      '',
      'OUTPUT FORMAT:',
      'You MUST respond with valid JSON matching this exact schema:',
      '{',
      '  "goal": "High-level goal description",',
      '  "steps": [',
      '    {',
      '      "id": "step-1",',
      '      "title": "Actionable step title",',
      '      "description": "Optional details on what should be done",',
      '      "dependencies": []',
      '    },',
      '    {',
      '      "id": "step-2",',
      '      "title": "Next step title",',
      '      "description": "...",',
      '      "dependencies": ["step-1"]',
      '    }',
      '  ]',
      '}',
      '',
      'GUIDELINES:',
      '1. Granularity: Steps must be high-level and meaningful (e.g. "Inspect authentication architecture", "Implement token middleware", "Run tests and verify"). DO NOT create one step per single shell command or single file read.',
      '2. IDs: Each step must have a unique stable ID like "step-1", "step-2", "step-3".',
      '3. Dependencies: Specify step IDs that must be completed before a step can start. Do NOT create self-dependencies or dependency cycles.',
      '4. Boundedness: Produce between 2 and 8 steps for standard complex tasks. Keep the plan concise, focused, and realistic.',
      '5. Only output JSON.',
    ].join('\n');

    const promptParts: string[] = [];

    if (input.context?.formattedPromptContext) {
      promptParts.push(input.context.formattedPromptContext);
      promptParts.push('');
    }

    promptParts.push(`User Request: ${input.prompt}`);

    return [
      createSystemMessage(systemInstructions),
      createUserMessage(promptParts.join('\n')),
    ];
  }
}
