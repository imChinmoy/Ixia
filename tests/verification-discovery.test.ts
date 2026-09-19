import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { VerificationPolicy } from '@ixia/verification';

describe('VerificationPolicy Discovery & Selection', () => {
  let tempDir: string;
  const policy = new VerificationPolicy();

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ixia-verify-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should discover typecheck, test, lint, and build from package.json with pnpm', async () => {
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-pkg',
        scripts: {
          typecheck: 'tsc --noEmit',
          test: 'vitest run',
          lint: 'eslint .',
          build: 'tsc',
        },
      }),
    );
    await fs.writeFile(path.join(tempDir, 'pnpm-lock.yaml'), '');

    const checks = await policy.discoverChecks(tempDir);

    expect(checks).toHaveLength(4);
    const types = checks.map((c) => c.type);
    expect(types).toContain('typecheck');
    expect(types).toContain('test');
    expect(types).toContain('lint');
    expect(types).toContain('build');

    const typecheckCheck = checks.find((c) => c.type === 'typecheck');
    expect(typecheckCheck?.command).toBe('pnpm typecheck');

    const testCheck = checks.find((c) => c.type === 'test');
    expect(testCheck?.command).toBe('pnpm test');
  });

  it('should detect npm run when package-lock.json is present', async () => {
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        scripts: {
          typecheck: 'tsc --noEmit',
          test: 'jest',
        },
      }),
    );
    await fs.writeFile(path.join(tempDir, 'package-lock.json'), '');

    const checks = await policy.discoverChecks(tempDir);
    const typecheckCheck = checks.find((c) => c.type === 'typecheck');
    expect(typecheckCheck?.command).toBe('npm run typecheck');
  });

  it('should discover Python checks when pyproject.toml is present', async () => {
    await fs.writeFile(
      path.join(tempDir, 'pyproject.toml'),
      '[tool.pytest.ini_options]\n[tool.mypy]\n[tool.ruff]\n',
    );

    const checks = await policy.discoverChecks(tempDir);
    const types = checks.map((c) => c.type);
    expect(types).toContain('test');
    expect(types).toContain('typecheck');
    expect(types).toContain('lint');
  });

  it('should discover Rust checks when Cargo.toml is present', async () => {
    await fs.writeFile(
      path.join(tempDir, 'Cargo.toml'),
      '[package]\nname = "test_crate"\nversion = "0.1.0"\n',
    );

    const checks = await policy.discoverChecks(tempDir);
    const commands = checks.map((c) => c.command);
    expect(commands).toContain('cargo check');
    expect(commands).toContain('cargo test');
  });

  it('should discover Go checks when go.mod is present', async () => {
    await fs.writeFile(
      path.join(tempDir, 'go.mod'),
      'module example.com/test\n',
    );

    const checks = await policy.discoverChecks(tempDir);
    const commands = checks.map((c) => c.command);
    expect(commands).toContain('go test ./...');
    expect(commands).toContain('go vet ./...');
  });

  it('should not invent checks if no manifest or configuration can be discovered', async () => {
    const checks = await policy.discoverChecks(tempDir);
    expect(checks).toHaveLength(0);
  });

  it('should bypass checks for purely informational / exploratory steps', async () => {
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        scripts: { test: 'vitest', typecheck: 'tsc' },
      }),
    );

    const selected = await policy.selectChecks({
      task: 'Inspect directory layout and explore dependencies',
      step: {
        id: 's1',
        title: 'Inspect directory layout',
        description: 'Read package.json and list files',
        status: 'pending',
        dependencies: [],
      },
      cwd: tempDir,
    });

    expect(selected).toHaveLength(0);
  });

  it('should select targeted test check when step mentions testing', async () => {
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        scripts: { test: 'pnpm test', typecheck: 'pnpm typecheck', lint: 'pnpm lint' },
      }),
    );

    const selected = await policy.selectChecks({
      task: 'Run auth middleware tests and verify behavior',
      step: {
        id: 's2',
        title: 'Add unit tests for auth middleware',
        status: 'pending',
        dependencies: [],
      },
      cwd: tempDir,
    });

    expect(selected.some((c) => c.type === 'test')).toBe(true);
  });

  it('should select primary checks for final verification', async () => {
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        scripts: {
          typecheck: 'tsc --noEmit',
          test: 'vitest run',
          lint: 'eslint .',
          build: 'tsc',
        },
      }),
    );

    const selected = await policy.selectChecks({
      task: 'Complete authentication refactor',
      isFinal: true,
      cwd: tempDir,
    });

    const types = selected.map((c) => c.type);
    expect(types).toContain('typecheck');
    expect(types).toContain('test');
    expect(types).toContain('build');
  });
});
