import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plan, PlanStep } from '@ixia/planner';
import type { VerificationCheck } from './types/check.js';

export interface VerificationSelectionContext {
  readonly task: string;
  readonly step?: PlanStep;
  readonly plan?: Plan;
  readonly cwd?: string;
  readonly isFinal?: boolean;
}

export class VerificationPolicy {
  /**
   * Automatically discovers verification checks for the project in cwd.
   * Inspects package manifests (package.json, Cargo.toml, pyproject.toml, go.mod, etc.)
   */
  async discoverChecks(cwd: string = process.cwd()): Promise<VerificationCheck[]> {
    const checks: VerificationCheck[] = [];

    // 1. Node.js / TypeScript (package.json)
    const packageJsonPath = path.join(cwd, 'package.json');
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content) as { scripts?: Record<string, string> };
      if (pkg.scripts && typeof pkg.scripts === 'object') {
        const pm = await this.detectNodePackageManager(cwd);

        if ('typecheck' in pkg.scripts) {
          checks.push({
            id: 'check-typecheck',
            type: 'typecheck',
            name: 'TypeScript typecheck',
            description: 'Runs TypeScript compiler type checking',
            status: 'pending',
            command: `${pm} ${pm === 'npm' ? 'run ' : ''}typecheck`,
          });
        }

        if ('test' in pkg.scripts) {
          checks.push({
            id: 'check-test',
            type: 'test',
            name: 'Test suite',
            description: 'Runs project automated test suite',
            status: 'pending',
            command: `${pm} test`,
          });
        }

        if ('lint' in pkg.scripts) {
          checks.push({
            id: 'check-lint',
            type: 'lint',
            name: 'Linter',
            description: 'Runs static analysis / linter',
            status: 'pending',
            command: `${pm} ${pm === 'npm' ? 'run ' : ''}lint`,
          });
        }

        if ('build' in pkg.scripts) {
          checks.push({
            id: 'check-build',
            type: 'build',
            name: 'Build verification',
            description: 'Verifies compilation and asset build',
            status: 'pending',
            command: `${pm} ${pm === 'npm' ? 'run ' : ''}build`,
          });
        }
      }
    } catch {
      // package.json does not exist or invalid
    }

    if (checks.length > 0) {
      return checks;
    }

    // 2. Python (pyproject.toml, pytest.ini, requirements.txt, setup.py)
    try {
      const pyprojectPath = path.join(cwd, 'pyproject.toml');
      const pytestIniPath = path.join(cwd, 'pytest.ini');
      let isPython = false;
      let pyContent = '';

      try {
        pyContent = await fs.readFile(pyprojectPath, 'utf-8');
        isPython = true;
      } catch {
        try {
          await fs.access(pytestIniPath);
          isPython = true;
        } catch {
          // not found
        }
      }

      if (isPython) {
        if (pyContent.includes('pytest') || (await this.fileExists(pytestIniPath))) {
          checks.push({
            id: 'check-pytest',
            type: 'test',
            name: 'Python pytest',
            description: 'Runs pytest test suite',
            status: 'pending',
            command: 'pytest',
          });
        }
        if (pyContent.includes('mypy')) {
          checks.push({
            id: 'check-mypy',
            type: 'typecheck',
            name: 'Python mypy',
            description: 'Runs mypy static type checking',
            status: 'pending',
            command: 'mypy .',
          });
        }
        if (pyContent.includes('ruff')) {
          checks.push({
            id: 'check-ruff',
            type: 'lint',
            name: 'Ruff linter',
            description: 'Runs ruff code linter',
            status: 'pending',
            command: 'ruff check .',
          });
        }
      }
    } catch {
      // not python
    }

    if (checks.length > 0) {
      return checks;
    }

    // 3. Rust (Cargo.toml)
    const cargoPath = path.join(cwd, 'Cargo.toml');
    if (await this.fileExists(cargoPath)) {
      checks.push(
        {
          id: 'check-cargo-check',
          type: 'typecheck',
          name: 'Cargo check',
          description: 'Typechecks Rust codebase',
          status: 'pending',
          command: 'cargo check',
        },
        {
          id: 'check-cargo-test',
          type: 'test',
          name: 'Cargo test',
          description: 'Runs Rust unit and integration tests',
          status: 'pending',
          command: 'cargo test',
        },
      );
      return checks;
    }

    // 4. Go (go.mod)
    const goModPath = path.join(cwd, 'go.mod');
    if (await this.fileExists(goModPath)) {
      checks.push(
        {
          id: 'check-go-vet',
          type: 'lint',
          name: 'Go vet',
          description: 'Examines Go source code for suspicious constructs',
          status: 'pending',
          command: 'go vet ./...',
        },
        {
          id: 'check-go-test',
          type: 'test',
          name: 'Go test',
          description: 'Runs Go tests',
          status: 'pending',
          command: 'go test ./...',
        },
      );
      return checks;
    }

    // 5. Dart / Flutter (pubspec.yaml)
    const pubspecPath = path.join(cwd, 'pubspec.yaml');
    if (await this.fileExists(pubspecPath)) {
      checks.push(
        {
          id: 'check-dart-analyze',
          type: 'typecheck',
          name: 'Dart analyze',
          description: 'Static analysis for Dart/Flutter',
          status: 'pending',
          command: 'dart analyze',
        },
        {
          id: 'check-dart-test',
          type: 'test',
          name: 'Dart test',
          description: 'Runs Dart/Flutter test suites',
          status: 'pending',
          command: 'dart test',
        },
      );
      return checks;
    }

    return checks;
  }

  /**
   * Selects targeted verification checks proportional to the given step, task, or final state.
   */
  async selectChecks(
    context: VerificationSelectionContext,
  ): Promise<VerificationCheck[]> {
    const cwd = context.cwd ?? process.cwd();
    const discovered = await this.discoverChecks(cwd);

    if (discovered.length === 0) {
      return [];
    }

    // Final verification: run primary suites (typecheck and test, and build if available)
    if (context.isFinal) {
      const finalChecks = discovered.filter(
        (c) => c.type === 'typecheck' || c.type === 'test' || c.type === 'build',
      );
      return finalChecks.length > 0 ? finalChecks : discovered;
    }

    const taskText = `${context.task} ${context.step?.title ?? ''} ${context.step?.description ?? ''}`.toLowerCase();

    // Check if the step is purely informational / exploratory (no code changes expected)
    const isInformational = this.isInformationalStep(taskText);
    if (isInformational) {
      return [];
    }

    // Targeted test check
    const mentionsTest = /\b(test|tests|spec|specs|testing|unit test)\b/i.test(taskText);
    const mentionsType = /\b(type|types|typecheck|typing|interface)\b/i.test(taskText);
    const mentionsLint = /\b(lint|linter|formatting|style|eslint)\b/i.test(taskText);
    const mentionsBuild = /\b(build|bundle|compile|compilation)\b/i.test(taskText);
    const mentionsCodeChange = /\b(implement|fix|add|refactor|update|create|modify|rewrite|migrate|patch|delete|remove)\b/i.test(
      taskText,
    );

    const selected: VerificationCheck[] = [];

    if (mentionsTest) {
      const testChecks = discovered.filter((c) => c.type === 'test');
      selected.push(...testChecks);
    }

    if (mentionsType) {
      const typeChecks = discovered.filter((c) => c.type === 'typecheck');
      selected.push(...typeChecks);
    }

    if (mentionsLint) {
      const lintChecks = discovered.filter((c) => c.type === 'lint');
      selected.push(...lintChecks);
    }

    if (mentionsBuild) {
      const buildChecks = discovered.filter((c) => c.type === 'build');
      selected.push(...buildChecks);
    }

    if (mentionsCodeChange && selected.length === 0) {
      // If code was modified, run typecheck first, then tests if available
      const typeCheck = discovered.find((c) => c.type === 'typecheck');
      const testCheck = discovered.find((c) => c.type === 'test');
      if (typeCheck) selected.push(typeCheck);
      if (testCheck) selected.push(testCheck);
    }

    // Deduplicate selected checks
    const unique = selected.filter(
      (check, index, self) => self.findIndex((c) => c.id === check.id) === index,
    );

    return unique.length > 0 ? unique : discovered.slice(0, 2);
  }

  private isInformationalStep(text: string): boolean {
    const infoVerbs = [
      'inspect',
      'explore',
      'investigate',
      'read',
      'analyze',
      'list',
      'search',
      'find',
      'view',
      'understand',
      'check status',
      'review',
      'explain',
    ];

    const hasInfoVerb = infoVerbs.some((v) => text.includes(v));
    const hasModVerb = [
      'implement',
      'fix',
      'add',
      'refactor',
      'modify',
      'create',
      'write',
      'update',
      'delete',
    ].some((v) => text.includes(v));

    return hasInfoVerb && !hasModVerb;
  }

  private async detectNodePackageManager(cwd: string): Promise<string> {
    if (await this.fileExists(path.join(cwd, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    if (await this.fileExists(path.join(cwd, 'yarn.lock'))) {
      return 'yarn';
    }
    return 'npm';
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
