import { randomUUID } from 'node:crypto';
import type { VerificationCheck } from './types/check.js';
import type { VerificationFailure } from './types/failure.js';

export interface FailureAnalyzerOptions {
  readonly maxOutputLength?: number;
}

export class FailureAnalyzer {
  private readonly maxOutputLength: number;

  constructor(options?: FailureAnalyzerOptions) {
    this.maxOutputLength = options?.maxOutputLength ?? 4000;
  }

  /**
   * Analyzes output and error signals from a failed verification check,
   * producing structured VerificationFailure objects.
   */
  analyze(
    check: VerificationCheck,
    output?: string,
  ): VerificationFailure[] {
    const rawOutput = (output ?? check.output ?? check.error ?? '').trim();
    const truncatedOutput =
      rawOutput.length > this.maxOutputLength
        ? `${rawOutput.slice(0, this.maxOutputLength)}\n... [output truncated]`
        : rawOutput;

    // 1. Environment / Transient failures (e.g. network, permissions, missing env)
    const envFailure = this.detectEnvironmentFailure(check, rawOutput, truncatedOutput);
    if (envFailure) {
      return [envFailure];
    }

    // 2. Typecheck failure
    if (check.type === 'typecheck' || this.isTypeScriptOutput(rawOutput)) {
      const typeFailure = this.detectTypeFailure(check, rawOutput, truncatedOutput);
      if (typeFailure) {
        return [typeFailure];
      }
    }

    // 3. Test failure
    if (check.type === 'test' || this.isTestOutput(rawOutput)) {
      const testFailure = this.detectTestFailure(check, rawOutput, truncatedOutput);
      if (testFailure) {
        return [testFailure];
      }
    }

    // 4. Lint failure
    if (check.type === 'lint' || this.isLintOutput(rawOutput)) {
      const lintFailure = this.detectLintFailure(check, rawOutput, truncatedOutput);
      if (lintFailure) {
        return [lintFailure];
      }
    }

    // 5. Build failure
    if (check.type === 'build' || this.isBuildOutput(rawOutput)) {
      const buildFailure = this.detectBuildFailure(check, rawOutput, truncatedOutput);
      if (buildFailure) {
        return [buildFailure];
      }
    }

    // 6. Missing file / path error
    const missingFileFailure = this.detectMissingFileFailure(check, rawOutput, truncatedOutput);
    if (missingFileFailure) {
      return [missingFileFailure];
    }

    // 7. General command failure
    if (
      check.command ||
      (check.exitCode !== undefined &&
        check.exitCode !== null &&
        check.exitCode !== 0)
    ) {
      return [
        {
          id: `fail-${randomUUID()}`,
          checkId: check.id,
          category: 'command_failure',
          message:
            check.error ??
            (check.exitCode !== null && check.exitCode !== undefined
              ? `Command exited with non-zero exit code: ${check.exitCode}`
              : 'Command execution failed'),
          details: truncatedOutput || undefined,
          recoverable: true,
          command: check.command,
        },
      ];
    }

    // 8. Unknown fallback
    return [
      {
        id: `fail-${randomUUID()}`,
        checkId: check.id,
        category: 'unknown',
        message: check.error || 'Verification check failed with unknown error',
        details: truncatedOutput || undefined,
        recoverable: true,
      },
    ];
  }

  private detectEnvironmentFailure(
    check: VerificationCheck,
    output: string,
    details: string,
  ): VerificationFailure | null {
    const envPatterns = [
      { pattern: /EACCES|permission denied|operation not permitted/i, message: 'Permission denied in workspace environment' },
      { pattern: /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed|network timeout|registry timeout/i, message: 'Network or external service unavailable' },
      { pattern: /missing environment variable|is not defined in environment|API key not configured/i, message: 'Required environment variable is missing' },
      { pattern: /command not found|is not recognized as an internal or external command/i, message: 'Required executable is not installed in the environment' },
    ];

    for (const { pattern, message } of envPatterns) {
      if (pattern.test(output) || (check.error && pattern.test(check.error))) {
        return {
          id: `fail-${randomUUID()}`,
          checkId: check.id,
          category: 'environment_failure',
          message,
          details: details || undefined,
          recoverable: false,
          command: check.command,
        };
      }
    }

    return null;
  }

  private isTypeScriptOutput(output: string): boolean {
    return (
      /error TS\d+:/.test(output) ||
      /Property '[^']+' does not exist on type/.test(output) ||
      /Type '[^']+' is not assignable to type/.test(output) ||
      /Cannot find module '[^']+' or its corresponding type declarations/.test(output)
    );
  }

  private detectTypeFailure(
    check: VerificationCheck,
    output: string,
    details: string,
  ): VerificationFailure | null {
    // Match TS output: file.ts(42,5): error TS2339: Property 'userId' does not exist on type 'Request'.
    // or file.ts:42:5 - error TS2339: ...
    const tsRegex = /([a-zA-Z0-9_./\\-]+\.[jt]sx?)[:(](\d+)[:,\s](\d+)\)?:?\s*(?:-?\s*error\s*TS\d*:)?\s*(.+)/;
    const match = output.match(tsRegex);

    if (match) {
      const file = match[1];
      const line = match[2] ? parseInt(match[2], 10) : undefined;
      const column = match[3] ? parseInt(match[3], 10) : undefined;
      const reason = (match[4] || '').trim();

      return {
        id: `fail-${randomUUID()}`,
        checkId: check.id,
        category: 'type_error',
        message: reason || 'TypeScript compiler typecheck failed',
        details,
        recoverable: true,
        file,
        line: Number.isNaN(line) ? undefined : line,
        column: Number.isNaN(column) ? undefined : column,
        command: check.command,
      };
    }

    // Match generic property or type mismatch lines
    const propMatch = output.match(/Property '([^']+)' does not exist on type '([^']+)'/);
    if (propMatch) {
      return {
        id: `fail-${randomUUID()}`,
        checkId: check.id,
        category: 'type_error',
        message: `Property '${propMatch[1]}' does not exist on type '${propMatch[2]}'`,
        details,
        recoverable: true,
        command: check.command,
      };
    }

    if (check.type === 'typecheck') {
      return {
        id: `fail-${randomUUID()}`,
        checkId: check.id,
        category: 'type_error',
        message: 'Typecheck suite failed',
        details,
        recoverable: true,
        command: check.command,
      };
    }

    return null;
  }

  private isTestOutput(output: string): boolean {
    return (
      /FAIL\s+/.test(output) ||
      /AssertionError/.test(output) ||
      /Expected:.*Received:/.test(output) ||
      /test failed|tests failed/i.test(output) ||
      /--- FAIL:/.test(output) ||
      /FAILED tests\//.test(output)
    );
  }

  private detectTestFailure(
    check: VerificationCheck,
    output: string,
    details: string,
  ): VerificationFailure | null {
    // Vitest/Jest: FAIL path/to/file.test.ts > suite > test name
    const failFileMatch = output.match(/FAIL\s+([a-zA-Z0-9_./\\-]+\.(?:test|spec)\.[jt]sx?)/);
    const assertMatch = output.match(/(?:AssertionError|Error):\s*([^\n\r]+)/);
    const testNameMatch = output.match(/❯\s*([^\n\r]+)/);

    const file = failFileMatch ? failFileMatch[1] : undefined;
    let message = 'Test suite failed';

    if (assertMatch && assertMatch[1]) {
      message = assertMatch[1].trim();
    } else if (testNameMatch && testNameMatch[1]) {
      message = `Test failed: ${testNameMatch[1].trim()}`;
    } else if (file) {
      message = `Test failed in ${file}`;
    }

    return {
      id: `fail-${randomUUID()}`,
      checkId: check.id,
      category: 'test_failure',
      message,
      details,
      recoverable: true,
      file,
      command: check.command,
    };
  }

  private isLintOutput(output: string): boolean {
    return (
      /eslint/i.test(output) ||
      /clippy/i.test(output) ||
      /ruff/i.test(output) ||
      /\d+ problems? \(\d+ errors?/.test(output)
    );
  }

  private detectLintFailure(
    check: VerificationCheck,
    output: string,
    details: string,
  ): VerificationFailure | null {
    const lintFileMatch = output.match(/([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+):(\d+):(\d+):\s*(.+)/);
    if (lintFileMatch) {
      const file = lintFileMatch[1];
      const line = lintFileMatch[2] ? parseInt(lintFileMatch[2], 10) : undefined;
      const column = lintFileMatch[3] ? parseInt(lintFileMatch[3], 10) : undefined;
      const message = lintFileMatch[4]?.trim() || 'Linting rule violation';

      return {
        id: `fail-${randomUUID()}`,
        checkId: check.id,
        category: 'lint_error',
        message,
        details,
        recoverable: true,
        file,
        line: Number.isNaN(line) ? undefined : line,
        column: Number.isNaN(column) ? undefined : column,
        command: check.command,
      };
    }

    return {
      id: `fail-${randomUUID()}`,
      checkId: check.id,
      category: 'lint_error',
      message: 'Linting check failed',
      details,
      recoverable: true,
      command: check.command,
    };
  }

  private isBuildOutput(output: string): boolean {
    return (
      /build failed/i.test(output) ||
      /Module not found/i.test(output) ||
      /Failed to compile/i.test(output) ||
      /SyntaxError/i.test(output)
    );
  }

  private detectBuildFailure(
    check: VerificationCheck,
    output: string,
    details: string,
  ): VerificationFailure | null {
    const moduleMatch = output.match(/Cannot find module '([^']+)'/i);
    const syntaxMatch = output.match(/SyntaxError:\s*([^\n\r]+)/i);

    let message = 'Build failed';
    if (moduleMatch && moduleMatch[1]) {
      message = `Cannot find module '${moduleMatch[1]}'`;
    } else if (syntaxMatch && syntaxMatch[1]) {
      message = `Syntax error: ${syntaxMatch[1]}`;
    }

    return {
      id: `fail-${randomUUID()}`,
      checkId: check.id,
      category: 'build_failure',
      message,
      details,
      recoverable: true,
      command: check.command,
    };
  }

  private detectMissingFileFailure(
    check: VerificationCheck,
    output: string,
    details: string,
  ): VerificationFailure | null {
    const missingMatch = output.match(/ENOENT: no such file or directory, (?:open|stat)\s*'([^']+)'/i);
    if (missingMatch && missingMatch[1]) {
      return {
        id: `fail-${randomUUID()}`,
        checkId: check.id,
        category: 'missing_file',
        message: `Expected file does not exist: ${missingMatch[1]}`,
        details,
        recoverable: true,
        file: missingMatch[1],
        command: check.command,
      };
    }
    return null;
  }
}
