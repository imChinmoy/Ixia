import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { FilesystemService, DirectoryNotFoundError } from '@sora/filesystem';

describe('FilesystemService: listDirectory', () => {
  let tempDir: string;
  let service: FilesystemService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sora-listdir-test-'));
    service = new FilesystemService();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should list an empty directory', async () => {
    const result = await service.listDirectory('.', tempDir);
    expect(result.path).toBe('.');
    expect(result.entries).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should list and deterministically sort entries (directories first, files second, alphabetical)', async () => {
    // Create unsorted files and directories
    await fs.writeFile(path.join(tempDir, 'zebra.txt'), 'z');
    await fs.writeFile(path.join(tempDir, 'alpha.txt'), 'a');
    await fs.mkdir(path.join(tempDir, 'zoo'));
    await fs.mkdir(path.join(tempDir, 'apple'));
    await fs.writeFile(path.join(tempDir, 'beta.json'), '{}');

    const result = await service.listDirectory('.', tempDir);

    expect(result.total).toBe(5);
    const names = result.entries.map((e) => e.name);
    const types = result.entries.map((e) => e.type);

    // Directories first, then files
    expect(names).toEqual(['apple', 'zoo', 'alpha.txt', 'beta.json', 'zebra.txt']);
    expect(types).toEqual(['directory', 'directory', 'file', 'file', 'file']);
  });

  it('should handle hidden files and options to filter them', async () => {
    await fs.writeFile(path.join(tempDir, '.env'), 'SECRET=123');
    await fs.writeFile(path.join(tempDir, 'visible.txt'), 'visible');

    const resultWithHidden = await service.listDirectory('.', tempDir);
    expect(resultWithHidden.entries.some((e) => e.name === '.env')).toBe(true);

    const envEntry = resultWithHidden.entries.find((e) => e.name === '.env');
    expect(envEntry?.hidden).toBe(true);

    const resultWithoutHidden = await service.listDirectory('.', tempDir, { showHidden: false });
    expect(resultWithoutHidden.entries.some((e) => e.name === '.env')).toBe(false);
    expect(resultWithoutHidden.entries.length).toBe(1);
  });

  it('should list subdirectories using relative path', async () => {
    const sub = path.join(tempDir, 'src', 'components');
    await fs.mkdir(sub, { recursive: true });
    await fs.writeFile(path.join(sub, 'Button.tsx'), 'export const Button = 1;');

    const result = await service.listDirectory('src/components', tempDir);
    expect(result.path).toBe('src/components');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.name).toBe('Button.tsx');
    expect(result.entries[0]?.path).toBe('src/components/Button.tsx');
  });

  it('should throw DirectoryNotFoundError for non-existent directory', async () => {
    await expect(service.listDirectory('ghost_dir', tempDir)).rejects.toThrow(
      DirectoryNotFoundError,
    );
  });

  it('should throw DirectoryNotFoundError when path points to a file', async () => {
    const filePath = path.join(tempDir, 'file.txt');
    await fs.writeFile(filePath, 'hello');

    await expect(service.listDirectory('file.txt', tempDir)).rejects.toThrow(
      DirectoryNotFoundError,
    );
  });
});
