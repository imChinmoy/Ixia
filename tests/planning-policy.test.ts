import { describe, it, expect } from 'vitest';
import { DefaultPlanningPolicy } from '@sora/planner';

describe('DefaultPlanningPolicy', () => {
  const policy = new DefaultPlanningPolicy();

  describe('shouldPlan', () => {
    it('returns true when explicit plan triggers are present', () => {
      expect(
        policy.shouldPlan({
          prompt: 'Create a plan to migrate from Jest to Vitest',
          cwd: '/repo',
        }),
      ).toBe(true);

      expect(
        policy.shouldPlan({
          prompt: 'Give me a plan for restructuring the components folder',
          cwd: '/repo',
        }),
      ).toBe(true);

      expect(
        policy.shouldPlan({
          prompt: 'Plan the implementation of WebSockets',
          cwd: '/repo',
        }),
      ).toBe(true);
    });

    it('returns false for simple informational or inspection queries', () => {
      expect(
        policy.shouldPlan({
          prompt: 'What is this repository doing?',
          cwd: '/repo',
        }),
      ).toBe(false);

      expect(
        policy.shouldPlan({
          prompt: 'Explain the purpose of packages/core',
          cwd: '/repo',
        }),
      ).toBe(false);

      expect(
        policy.shouldPlan({
          prompt: 'Where is the main entry point?',
          cwd: '/repo',
        }),
      ).toBe(false);

      expect(
        policy.shouldPlan({
          prompt: 'Show me package.json',
          cwd: '/repo',
        }),
      ).toBe(false);

      expect(
        policy.shouldPlan({
          prompt: 'pwd',
          cwd: '/repo',
        }),
      ).toBe(false);

      expect(
        policy.shouldPlan({
          prompt: 'run npm test',
          cwd: '/repo',
        }),
      ).toBe(false);
    });

    it('returns true for complex multi-step engineering tasks', () => {
      expect(
        policy.shouldPlan({
          prompt: 'Refactor the authentication service to use JWT and add unit tests',
          cwd: '/repo',
        }),
      ).toBe(true);

      expect(
        policy.shouldPlan({
          prompt: 'Implement a new caching layer with Redis across the API routes',
          cwd: '/repo',
        }),
      ).toBe(true);

      expect(
        policy.shouldPlan({
          prompt: 'Migrate the database schema from SQLite to PostgreSQL',
          cwd: '/repo',
        }),
      ).toBe(true);

      expect(
        policy.shouldPlan({
          prompt: 'Redesign the error handling architecture in the agent package',
          cwd: '/repo',
        }),
      ).toBe(true);
    });
  });

  describe('isPlanOnlyRequest', () => {
    it('detects requests that explicitly ask not to modify or execute yet', () => {
      expect(
        policy.isPlanOnlyRequest(
          'Analyze the repository and create a plan to refactor the agent, but do not modify anything yet',
        ),
      ).toBe(true);

      expect(
        policy.isPlanOnlyRequest('Generate a migration plan. Plan only, do not execute.'),
      ).toBe(true);

      expect(
        policy.isPlanOnlyRequest('Plan for restructuring modules without modifying files'),
      ).toBe(true);

      expect(
        policy.isPlanOnlyRequest('Propose a strategy with no code changes'),
      ).toBe(true);
    });

    it('returns false when execution is intended', () => {
      expect(
        policy.isPlanOnlyRequest('Implement user registration with email verification'),
      ).toBe(false);

      expect(
        policy.isPlanOnlyRequest('Fix the failing test in packages/tools'),
      ).toBe(false);

      expect(
        policy.isPlanOnlyRequest('Create a plan and then execute it'),
      ).toBe(false);
    });
  });
});
