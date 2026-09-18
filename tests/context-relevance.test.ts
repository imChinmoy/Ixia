import { describe, it, expect } from 'vitest';
import {
  tokenizeQuery,
  RelevanceScorer,
  RelevanceSelector,
  type RepositoryFile,
} from '@sora/context';

function createFile(
  relPath: string,
  overrides?: Partial<RepositoryFile>,
): RepositoryFile {
  const parts = relPath.split('/');
  const name = parts[parts.length - 1]!;
  const ext = name.includes('.') ? `.${name.split('.').pop()}` : undefined;

  return {
    path: relPath,
    name,
    extension: ext,
    size: 200,
    isDirectory: false,
    isImportant: false,
    isSensitive: false,
    isTest: false,
    isDoc: false,
    isEntryPoint: false,
    isConfig: false,
    ...overrides,
  };
}

describe('Relevance Heuristics (Phase 8)', () => {
  describe('Query Tokenizer', () => {
    it('should return empty array for empty or whitespace query', () => {
      expect(tokenizeQuery('')).toEqual([]);
      expect(tokenizeQuery('   ')).toEqual([]);
    });

    it('should split camelCase, PascalCase, snake_case, and kebab-case tokens', () => {
      const tokens = tokenizeQuery('UserProfile authService get_user_by_id payment-gateway');
      expect(tokens).toContain('user');
      expect(tokens).toContain('profile');
      expect(tokens).toContain('auth');
      expect(tokens).toContain('service');
      expect(tokens).toContain('payment');
      expect(tokens).toContain('gateway');
    });

    it('should filter out common English stopwords', () => {
      const tokens = tokenizeQuery('how does the auth system work in this project');
      expect(tokens).toContain('auth');
      expect(tokens).toContain('system');
      expect(tokens).toContain('project');
      expect(tokens).not.toContain('how');
      expect(tokens).not.toContain('does');
      expect(tokens).not.toContain('the');
      expect(tokens).not.toContain('in');
      expect(tokens).not.toContain('this');
    });

    it('should expand domain synonyms', () => {
      const authTokens = tokenizeQuery('auth');
      expect(authTokens).toContain('auth');
      expect(authTokens).toContain('authentication');

      const dbTokens = tokenizeQuery('db');
      expect(dbTokens).toContain('db');
      expect(dbTokens).toContain('database');

      const testTokens = tokenizeQuery('test');
      expect(testTokens).toContain('test');
      expect(testTokens).toContain('spec');
    });
  });

  describe('RelevanceScorer', () => {
    const scorer = new RelevanceScorer();

    it('should give 0 score to sensitive files regardless of query', () => {
      const sensitiveFile = createFile('.env', { isSensitive: true });
      const scored = scorer.score(sensitiveFile, ['env', 'secret', 'key']);
      expect(scored.score).toBe(0);
      expect(scored.matchedSignals).toHaveLength(0);
    });

    it('should score exact filename matches higher than directory matches', () => {
      const fileMatch = createFile('src/auth/login.ts');
      const dirMatch = createFile('src/auth/helpers/format.ts');

      const scoreFile = scorer.score(fileMatch, ['login']);
      const scoreDir = scorer.score(dirMatch, ['auth']);

      expect(scoreFile.score).toBeGreaterThan(scoreDir.score);
      expect(scoreFile.matchedSignals).toContain('filename_exact:login');
      expect(scoreDir.matchedSignals).toContain('dir_exact:auth');
    });

    it('should boost test files when query is test-related', () => {
      const testFile = createFile('tests/auth.test.ts', { isTest: true });
      const testScored = scorer.score(testFile, ['auth', 'test']);
      expect(testScored.matchedSignals).toContain('test_file_boost');
    });

    it('should penalize test files when query is not test-related', () => {
      const sourceFile = createFile('src/auth.ts');
      const testFile = createFile('tests/auth.test.ts', { isTest: true });

      const sourceScored = scorer.score(sourceFile, ['auth']);
      const testScored = scorer.score(testFile, ['auth']);

      expect(sourceScored.score).toBeGreaterThan(testScored.score);
    });
  });

  describe('RelevanceSelector', () => {
    const selector = new RelevanceSelector();

    const sampleFiles: RepositoryFile[] = [
      createFile('src/auth/auth.service.ts'),
      createFile('src/auth/login.controller.ts'),
      createFile('src/database/connection.ts'),
      createFile('src/billing/payment.service.ts'),
      createFile('tests/auth.service.test.ts', { isTest: true }),
      createFile('.env', { isSensitive: true }),
      createFile('secrets.json', { isSensitive: true }),
      createFile('package.json', { isImportant: true }),
    ];

    it('should select files relevant to "authentication login"', () => {
      const results = selector.select(sampleFiles, 'how does authentication login work', {
        limit: 3,
      });

      const paths = results.map((f) => f.path);
      expect(paths).toContain('src/auth/auth.service.ts');
      expect(paths).toContain('src/auth/login.controller.ts');
      // Payment/Database should not be in the top auth results
      expect(paths).not.toContain('src/billing/payment.service.ts');
      expect(paths).not.toContain('src/database/connection.ts');
    });

    it('should NEVER select sensitive files even if query mentions them', () => {
      const results = selector.select(sampleFiles, 'check secrets and env file', {
        limit: 5,
      });

      const paths = results.map((f) => f.path);
      expect(paths).not.toContain('.env');
      expect(paths).not.toContain('secrets.json');
    });

    it('should respect the limit option', () => {
      const results = selector.select(sampleFiles, 'service auth', { limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should fall back to important files when query is empty', () => {
      const results = selector.select(sampleFiles, '');
      expect(results.some((f) => f.path === 'package.json')).toBe(true);
    });
  });
});
