import path from 'node:path';
import type { RepositoryFile, ScoredFile } from '../types/context.types.js';

export interface ScoringWeights {
  filenameExact: number;
  filenamePartial: number;
  dirExact: number;
  dirPartial: number;
  testFileMatch: number;
  testFilePenalty: number;
  docFileMatch: number;
  importantBonus: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  filenameExact: 50,
  filenamePartial: 25,
  dirExact: 30,
  dirPartial: 15,
  testFileMatch: 40,
  testFilePenalty: 15,
  docFileMatch: 35,
  importantBonus: 10,
};

export class RelevanceScorer {
  private readonly weights: ScoringWeights;

  constructor(weights: Partial<ScoringWeights> = {}) {
    this.weights = { ...DEFAULT_SCORING_WEIGHTS, ...weights };
  }

  score(file: RepositoryFile, queryTokens: readonly string[]): ScoredFile {
    if (file.isSensitive) {
      // Sensitive files should never be highlighted as candidates for reading
      return { file, score: 0, matchedSignals: [] };
    }

    if (queryTokens.length === 0) {
      // When no query is provided, score purely based on file importance
      const score = file.isImportant ? this.weights.importantBonus : 0;
      return {
        file,
        score,
        matchedSignals: file.isImportant ? ['important_file'] : [],
      };
    }

    let score = 0;
    const matchedSignals: string[] = [];

    const isTestQuery = queryTokens.some((t) => t === 'test' || t === 'tests' || t === 'spec');
    const isDocQuery = queryTokens.some(
      (t) => t === 'doc' || t === 'docs' || t === 'documentation' || t === 'readme',
    );

    const relPath = file.path.split(path.sep).join('/').toLowerCase();
    const filename = file.name.toLowerCase();
    const baseNameNoExt = path.parse(filename).name;

    const filenameSubTokens = baseNameNoExt
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const dirParts = path
      .dirname(relPath)
      .split('/')
      .filter((p) => p && p !== '.');

    for (const token of queryTokens) {
      // 1. Filename matches
      if (filenameSubTokens.includes(token)) {
        score += this.weights.filenameExact;
        matchedSignals.push(`filename_exact:${token}`);
      } else if (filename.includes(token)) {
        score += this.weights.filenamePartial;
        matchedSignals.push(`filename_partial:${token}`);
      }

      // 2. Directory matches
      if (dirParts.includes(token)) {
        score += this.weights.dirExact;
        matchedSignals.push(`dir_exact:${token}`);
      } else if (dirParts.some((dp) => dp.includes(token))) {
        score += this.weights.dirPartial;
        matchedSignals.push(`dir_partial:${token}`);
      }
    }

    // 3. Test file handling
    if (file.isTest) {
      if (isTestQuery) {
        score += this.weights.testFileMatch;
        matchedSignals.push('test_file_boost');
      } else {
        // If not asking for tests, slightly deprioritize tests in favor of source
        score -= this.weights.testFilePenalty;
      }
    }

    // 4. Doc file handling
    if (file.isDoc && isDocQuery) {
      score += this.weights.docFileMatch;
      matchedSignals.push('doc_file_boost');
    }

    // 5. Important file bonus
    if (file.isImportant && score > 0) {
      score += this.weights.importantBonus;
      matchedSignals.push('important_bonus');
    }

    return {
      file,
      score: Math.max(0, score),
      matchedSignals,
    };
  }
}
