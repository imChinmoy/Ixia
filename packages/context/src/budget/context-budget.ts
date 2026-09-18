import type { ContextBudget } from '../types/budget.types.js';
import { DEFAULT_CONTEXT_BUDGET } from '../types/budget.types.js';

export class BudgetEnforcer {
  private readonly budget: Required<ContextBudget>;

  constructor(customBudget?: ContextBudget) {
    this.budget = {
      maxFiles: customBudget?.maxFiles ?? DEFAULT_CONTEXT_BUDGET.maxFiles,
      maxTotalCharacters:
        customBudget?.maxTotalCharacters ?? DEFAULT_CONTEXT_BUDGET.maxTotalCharacters,
      maxStructureCharacters:
        customBudget?.maxStructureCharacters ??
        DEFAULT_CONTEXT_BUDGET.maxStructureCharacters,
      maxStructureDepth:
        customBudget?.maxStructureDepth ?? DEFAULT_CONTEXT_BUDGET.maxStructureDepth,
      maxReadmeCharacters:
        customBudget?.maxReadmeCharacters ?? DEFAULT_CONTEXT_BUDGET.maxReadmeCharacters,
    };
  }

  getBudget(): Required<ContextBudget> {
    return { ...this.budget };
  }

  truncateString(content: string, limit: number, suffix = '... [truncated]'): string {
    if (content.length <= limit) {
      return content;
    }
    const safeLimit = Math.max(0, limit - suffix.length);
    return content.slice(0, safeLimit).trimEnd() + '\n' + suffix;
  }

  truncateReadme(content: string): string {
    return this.truncateString(content, this.budget.maxReadmeCharacters);
  }

  truncateStructure(tree: string): string {
    return this.truncateString(tree, this.budget.maxStructureCharacters);
  }

  enforceTotalBudget(formattedContext: string): string {
    return this.truncateString(formattedContext, this.budget.maxTotalCharacters);
  }
}
