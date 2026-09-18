export interface ContextBudget {
  readonly maxFiles?: number;
  readonly maxTotalCharacters?: number;
  readonly maxStructureCharacters?: number;
  readonly maxStructureDepth?: number;
  readonly maxReadmeCharacters?: number;
}

export const DEFAULT_CONTEXT_BUDGET: Required<ContextBudget> = {
  maxFiles: 15,
  maxTotalCharacters: 4000,
  maxStructureCharacters: 1500,
  maxStructureDepth: 3,
  maxReadmeCharacters: 1000,
};
