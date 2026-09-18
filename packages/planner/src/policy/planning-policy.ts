import type { PlanningInput } from '../types/plan.types.js';

export interface PlanningPolicy {
  shouldPlan(input: PlanningInput): boolean;
  isPlanOnlyRequest(prompt: string): boolean;
}

export class DefaultPlanningPolicy implements PlanningPolicy {
  private readonly complexVerbs = [
    'refactor',
    'implement',
    'migrate',
    'migration',
    'redesign',
    'architecture',
    'add feature',
    'build',
    'integrate',
    'integration',
    'restructure',
    'rewrite',
    'upgrade',
  ];

  private readonly explicitPlanTriggers = [
    'create a plan',
    'make a plan',
    'propose a plan',
    'give me a plan',
    'plan for',
    'plan to',
    'generate a plan',
    'steps to',
    'plan the',
  ];

  private readonly simplePrefixes = [
    'what is',
    'what does',
    'explain',
    'where is',
    'show me',
    'how does',
    'tell me',
    'describe',
    'find',
    'read',
    'list',
    'inspect file',
  ];

  private readonly planOnlyPhrases = [
    'do not modify',
    "don't modify",
    'do not execute',
    "don't execute",
    'plan only',
    'just a plan',
    'just the plan',
    'without modifying',
    'without executing',
    'no code changes',
    'do not make any changes',
    'do not run anything',
  ];

  shouldPlan(input: PlanningInput): boolean {
    const raw = input.prompt.trim().toLowerCase();

    // 1. Explicit request for a plan always triggers planning
    for (const trigger of this.explicitPlanTriggers) {
      if (raw.includes(trigger)) {
        return true;
      }
    }

    // 2. Simple informational / inspection requests bypass planning
    for (const prefix of this.simplePrefixes) {
      if (raw.startsWith(prefix) && !this.containsComplexIntent(raw)) {
        return false;
      }
    }

    // Single-tool or very brief queries (e.g. "pwd", "ls", "npm test") bypass planning
    if (
      raw.startsWith('run ') ||
      raw.startsWith('exec ') ||
      raw === 'pwd' ||
      raw === 'ls'
    ) {
      return false;
    }

    // 3. Complex multi-step task triggers
    if (this.containsComplexIntent(raw)) {
      return true;
    }

    // 4. Large prompt with multiple sentences and repository context
    const sentences = raw.split(/[.!?]+/).filter(Boolean);
    if (sentences.length >= 3 && input.context?.project.isMonorepo) {
      return true;
    }

    return false;
  }

  isPlanOnlyRequest(prompt: string): boolean {
    const lower = prompt.toLowerCase();
    return this.planOnlyPhrases.some((phrase) => lower.includes(phrase));
  }

  private containsComplexIntent(prompt: string): boolean {
    return this.complexVerbs.some((verb) => prompt.includes(verb));
  }
}
