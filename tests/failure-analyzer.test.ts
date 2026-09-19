import { describe, it, expect } from 'vitest';
import { FailureAnalyzer, type VerificationCheck } from '@ixia/verification';

describe('FailureAnalyzer', () => {
  const analyzer = new FailureAnalyzer({ maxOutputLength: 1000 });

  it('should analyze TypeScript compiler errors as type_error with location', () => {
    const check: VerificationCheck = {
      id: 'check-1',
      type: 'typecheck',
      name: 'TypeScript typecheck',
      status: 'failed',
      command: 'pnpm typecheck',
      exitCode: 2,
    };

    const output = `
src/auth/middleware.ts(42,15): error TS2339: Property 'userId' does not exist on type 'Request'.
src/auth/middleware.ts(45,3): error TS2322: Type 'null' is not assignable to type 'string'.
    `;

    const failures = analyzer.analyze(check, output);

    expect(failures).toHaveLength(1);
    const failure = failures[0]!;
    expect(failure.category).toBe('type_error');
    expect(failure.recoverable).toBe(true);
    expect(failure.file).toBe('src/auth/middleware.ts');
    expect(failure.line).toBe(42);
    expect(failure.message).toContain("Property 'userId' does not exist on type 'Request'");
  });

  it('should detect vitest/jest test failure', () => {
    const check: VerificationCheck = {
      id: 'check-2',
      type: 'test',
      name: 'Test suite',
      status: 'failed',
      command: 'pnpm test',
      exitCode: 1,
    };

    const output = `
FAIL tests/auth.test.ts
  ● Auth Middleware > should authenticate valid tokens
    AssertionError: expected false to be true
      at tests/auth.test.ts:35:10
    `;

    const failures = analyzer.analyze(check, output);

    expect(failures).toHaveLength(1);
    const failure = failures[0]!;
    expect(failure.category).toBe('test_failure');
    expect(failure.recoverable).toBe(true);
    expect(failure.file).toBe('tests/auth.test.ts');
    expect(failure.message).toContain('expected false to be true');
  });

  it('should detect linting rule violations', () => {
    const check: VerificationCheck = {
      id: 'check-3',
      type: 'lint',
      name: 'Linter',
      status: 'failed',
      command: 'pnpm lint',
      exitCode: 1,
    };

    const output = `
/home/user/project/src/index.ts:15:3: 'unusedVar' is defined but never used. @typescript-eslint/no-unused-vars
    `;

    const failures = analyzer.analyze(check, output);

    expect(failures).toHaveLength(1);
    const failure = failures[0]!;
    expect(failure.category).toBe('lint_error');
    expect(failure.recoverable).toBe(true);
    expect(failure.file).toBe('/home/user/project/src/index.ts');
    expect(failure.line).toBe(15);
  });

  it('should detect build failures', () => {
    const check: VerificationCheck = {
      id: 'check-4',
      type: 'build',
      name: 'Build',
      status: 'failed',
      command: 'pnpm build',
      exitCode: 1,
    };

    const output = `
Cannot find module './missing-file.js' imported from src/index.ts
Build failed with 1 error
    `;

    const failures = analyzer.analyze(check, output);

    expect(failures).toHaveLength(1);
    const failure = failures[0]!;
    expect(failure.category).toBe('build_failure');
    expect(failure.recoverable).toBe(true);
    expect(failure.message).toContain("Cannot find module './missing-file.js'");
  });

  it('should detect environment failures (permission denied) as unrecoverable', () => {
    const check: VerificationCheck = {
      id: 'check-5',
      type: 'command',
      name: 'Write cache',
      status: 'failed',
      command: 'mkdir -p /root/cache',
      exitCode: 1,
    };

    const output = 'EACCES: permission denied, mkdir /root/cache';

    const failures = analyzer.analyze(check, output);

    expect(failures).toHaveLength(1);
    const failure = failures[0]!;
    expect(failure.category).toBe('environment_failure');
    expect(failure.recoverable).toBe(false);
  });

  it('should detect environment failures (network unavailable) as unrecoverable', () => {
    const check: VerificationCheck = {
      id: 'check-6',
      type: 'command',
      name: 'Install package',
      status: 'failed',
      command: 'npm install',
      exitCode: 1,
    };

    const output = 'npm error request to https://registry.npmjs.org/ failed, reason: getaddrinfo ENOTFOUND';

    const failures = analyzer.analyze(check, output);

    expect(failures).toHaveLength(1);
    const failure = failures[0]!;
    expect(failure.category).toBe('environment_failure');
    expect(failure.recoverable).toBe(false);
  });

  it('should detect missing file errors', () => {
    const check: VerificationCheck = {
      id: 'check-7',
      type: 'file',
      name: 'Read config',
      status: 'failed',
    };

    const output = "ENOENT: no such file or directory, open 'config.json'";

    const failures = analyzer.analyze(check, output);

    expect(failures).toHaveLength(1);
    const failure = failures[0]!;
    expect(failure.category).toBe('missing_file');
    expect(failure.file).toBe('config.json');
  });

  it('should categorize generic non-zero exit code as command_failure', () => {
    const check: VerificationCheck = {
      id: 'check-8',
      type: 'command',
      name: 'Custom script',
      status: 'failed',
      command: './script.sh',
      exitCode: 137,
    };

    const failures = analyzer.analyze(check, 'Script terminated');

    expect(failures).toHaveLength(1);
    const failure = failures[0]!;
    expect(failure.category).toBe('command_failure');
    expect(failure.recoverable).toBe(true);
  });

  it('should fall back to unknown category when evidence is insufficient', () => {
    const check: VerificationCheck = {
      id: 'check-9',
      type: 'custom',
      name: 'Custom check',
      status: 'failed',
      error: 'Unspecified failure occurred',
    };

    const failures = analyzer.analyze(check, '');

    expect(failures).toHaveLength(1);
    const failure = failures[0]!;
    expect(failure.category).toBe('unknown');
    expect(failure.message).toBe('Unspecified failure occurred');
  });

  it('should truncate excessively long output to avoid flooding LLM context', () => {
    const customAnalyzer = new FailureAnalyzer({ maxOutputLength: 100 });
    const check: VerificationCheck = {
      id: 'check-10',
      type: 'test',
      name: 'Huge output test',
      status: 'failed',
    };

    const hugeOutput = 'FAIL '.padEnd(500, 'x');
    const failures = customAnalyzer.analyze(check, hugeOutput);

    expect(failures[0]!.details!.length).toBeLessThanOrEqual(150);
    expect(failures[0]!.details).toContain('[output truncated]');
  });
});
