import type { RepositoryFile, ScoredFile } from '../types/context.types.js';
import { tokenizeQuery } from './query-tokenizer.js';
import { RelevanceScorer } from './relevance-scorer.js';

export interface SelectionOptions {
  limit?: number;
  scorer?: RelevanceScorer;
}

export class RelevanceSelector {
  private readonly scorer: RelevanceScorer;

  constructor(scorer?: RelevanceScorer) {
    this.scorer = scorer ?? new RelevanceScorer();
  }

  select(
    files: readonly RepositoryFile[],
    query?: string,
    options?: SelectionOptions,
  ): RepositoryFile[] {
    const limit = options?.limit ?? 10;
    const scorer = options?.scorer ?? this.scorer;

    if (!query || !query.trim()) {
      // If no query, return top important files up to limit
      return files
        .filter((f) => !f.isDirectory && f.isImportant && !f.isSensitive)
        .slice(0, limit);
    }

    const tokens = tokenizeQuery(query);
    if (tokens.length === 0) {
      return files
        .filter((f) => !f.isDirectory && f.isImportant && !f.isSensitive)
        .slice(0, limit);
    }

    const scored: ScoredFile[] = [];

    for (const file of files) {
      if (file.isDirectory) continue;
      const result = scorer.score(file, tokens);
      if (result.score > 0) {
        scored.push(result);
      }
    }

    // Sort descending by score, deterministic alphabetical secondary sort
    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.file.path.localeCompare(b.file.path);
    });

    return scored.slice(0, limit).map((s) => s.file);
  }
}
