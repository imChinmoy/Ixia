import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { FilesystemService } from '@sora/filesystem';

describe('FilesystemService: searchFiles', () => {
  let tempDir: string;
  let service: FilesystemService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sora-search-test-'));
    service = new FilesystemService();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should find text matches with correct line numbers and paths', async () => {
    const file1 = path.join(tempDir, 'service.ts');
    await fs.writeFile(
      file1,
      '// Auth service\nexport function authenticateUser() {\n  return true;\n}',
    );

    const result = await service.searchFiles({ query: 'authenticateUser' }, tempDir);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.path).toBe('service.ts');
    expect(result.matches[0]?.line).toBe(2);
    expect(result.matches[0]?.text).toBe('export function authenticateUser() {');
    expect(result.truncated).toBe(false);
  });

  it('should search recursively through subdirectories', async () => {
    const nestedDir = path.join(tempDir, 'src', 'features', 'auth');
    await fs.mkdir(nestedDir, { recursive: true });
    await fs.writeFile(path.join(nestedDir, 'login.ts'), 'function doLogin() { /* login code */ }');

    const result = await service.searchFiles({ query: 'doLogin' }, tempDir);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.path).toBe('src/features/auth/login.ts');
    expect(result.matches[0]?.line).toBe(1);
  });

  it('should ignore default ignored directories such as node_modules and .git', async () => {
    const nodeModulesDir = path.join(tempDir, 'node_modules', 'dep');
    await fs.mkdir(nodeModulesDir, { recursive: true });
    await fs.writeFile(path.join(nodeModulesDir, 'index.js'), 'const token = "secret";');

    const appFile = path.join(tempDir, 'app.js');
    await fs.writeFile(appFile, 'const token = "public";');

    const result = await service.searchFiles({ query: 'token' }, tempDir);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.path).toBe('app.js');
  });

  it('should return empty matches when query is not found', async () => {
    await fs.writeFile(path.join(tempDir, 'file.txt'), 'Hello world');

    const result = await service.searchFiles({ query: 'quantum_physics' }, tempDir);

    expect(result.matches).toHaveLength(0);
    expect(result.totalMatches).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it('should truncate results when maxResults limit is reached', async () => {
    const file = path.join(tempDir, 'multi.txt');
    const content = Array.from({ length: 20 }, (_, i) => `match line ${i}`).join('\n');
    await fs.writeFile(file, content);

    const result = await service.searchFiles({ query: 'match', maxResults: 5 }, tempDir);

    expect(result.matches).toHaveLength(5);
    expect(result.truncated).toBe(true);
    expect(result.reason).toContain('maxResults limit of 5 reached');
  });

  it('should truncate and stop when maxFilesScanned limit is reached', async () => {
    // Create 10 files
    for (let i = 0; i < 10; i++) {
      await fs.writeFile(path.join(tempDir, `file_${i}.txt`), `line in file ${i}`);
    }

    const result = await service.searchFiles({ query: 'line', maxFilesScanned: 3 }, tempDir);

    expect(result.truncated).toBe(true);
    expect(result.reason).toContain('maxFilesScanned limit of 3 reached');
  });

  it('should skip binary files during search', async () => {
    const binFile = path.join(tempDir, 'asset.png');
    await fs.writeFile(binFile, Buffer.from('TARGET_STRING_IN_PNG'));

    const textFile = path.join(tempDir, 'clean.txt');
    await fs.writeFile(textFile, 'TARGET_STRING_IN_PNG');

    const result = await service.searchFiles({ query: 'TARGET_STRING_IN_PNG' }, tempDir);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.path).toBe('clean.txt');
  });
});
