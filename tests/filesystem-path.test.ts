import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { PathService, WorkspaceViolationError, InvalidPathError } from '@sora/filesystem';

describe('PathService & Workspace Security', () => {
  let tempDir: string;
  let service: PathService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sora-path-test-'));
    service = new PathService();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should validate and normalize valid relative paths within workspace', async () => {
    const safePath = await service.resolveSafePath('src/main.ts', tempDir);
    expect(safePath).toBe(path.join(tempDir, 'src/main.ts'));
  });

  it('should resolve workspace root when given "." or empty string', async () => {
    const safeDot = await service.resolveSafePath('.', tempDir);
    expect(safeDot).toBe(tempDir);

    const safeEmpty = await service.resolveSafePath('', tempDir);
    expect(safeEmpty).toBe(tempDir);
  });

  it('should accept valid absolute path if inside workspace', async () => {
    const inside = path.join(tempDir, 'nested/file.txt');
    const resolved = await service.resolveSafePath(inside, tempDir);
    expect(resolved).toBe(inside);
  });

  it('should reject path containing null bytes', async () => {
    await expect(service.resolveSafePath('test\0.txt', tempDir)).rejects.toThrow(InvalidPathError);
  });

  it('should reject path escaping workspace using ".."', async () => {
    await expect(service.resolveSafePath('../outside.txt', tempDir)).rejects.toThrow(
      WorkspaceViolationError,
    );

    await expect(service.resolveSafePath('nested/../../outside.txt', tempDir)).rejects.toThrow(
      WorkspaceViolationError,
    );
  });

  it('should reject absolute paths pointing outside workspace', async () => {
    const outside = os.tmpdir();
    if (outside !== tempDir) {
      await expect(service.resolveSafePath('/etc/passwd', tempDir)).rejects.toThrow(
        WorkspaceViolationError,
      );
    }
  });

  it('should detect and reject symlinks resolving outside workspace', async () => {
    // Create an external directory
    const externalDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sora-external-'));
    const externalFile = path.join(externalDir, 'secret.txt');
    await fs.writeFile(externalFile, 'classified data');

    try {
      // Create a symlink inside the workspace pointing to the external file
      const linkInside = path.join(tempDir, 'leak-link');
      await fs.symlink(externalFile, linkInside);

      // Attempting to resolve leak-link should be detected as escaping the workspace
      await expect(service.resolveSafePath('leak-link', tempDir)).rejects.toThrow(
        WorkspaceViolationError,
      );
    } finally {
      await fs.rm(externalDir, { recursive: true, force: true });
    }
  });

  it('should correctly format relative POSIX paths', () => {
    const nested = path.join(tempDir, 'src', 'app', 'index.ts');
    expect(service.getRelativePath(nested, tempDir)).toBe('src/app/index.ts');
    expect(service.getRelativePath(tempDir, tempDir)).toBe('.');
  });
});
