import { PlanValidationError } from '../errors/planner.errors.js';
import type { PlanStep } from '../types/plan.types.js';

export interface RawParsedPlan {
  goal: string;
  steps: PlanStep[];
}

export function parsePlanResponse(rawText: string): RawParsedPlan {
  if (!rawText || !rawText.trim()) {
    throw new PlanValidationError('Planner returned empty response');
  }

  let jsonStr = rawText.trim();

  // 1. Check for markdown code blocks (```json ... ``` or ``` ...)
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    jsonStr = codeBlockMatch[1].trim();
  } else {
    // 2. Fall back to finding first { and last }
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new PlanValidationError(
      `Failed to parse plan JSON: ${errorMsg}\nRaw Output: ${rawText.slice(0, 200)}...`,
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new PlanValidationError('Plan JSON must be an object');
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.goal !== 'string' || !obj.goal.trim()) {
    throw new PlanValidationError('Parsed plan is missing required "goal" string');
  }

  if (!Array.isArray(obj.steps)) {
    throw new PlanValidationError('Parsed plan is missing required "steps" array');
  }

  const steps: PlanStep[] = obj.steps.map((rawStep, index) => {
    if (!rawStep || typeof rawStep !== 'object') {
      throw new PlanValidationError(`Step at index ${index} is not an object`);
    }

    const s = rawStep as Record<string, unknown>;
    const id = typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `step-${index + 1}`;
    const title = typeof s.title === 'string' ? s.title.trim() : '';
    const description = typeof s.description === 'string' ? s.description.trim() : undefined;
    const dependencies = Array.isArray(s.dependencies)
      ? s.dependencies.filter((d): d is string => typeof d === 'string')
      : [];

    return {
      id,
      title,
      description,
      status: 'pending',
      dependencies,
    };
  });

  return {
    goal: obj.goal.trim(),
    steps,
  };
}
