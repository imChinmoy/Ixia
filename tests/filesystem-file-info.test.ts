import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { FilesystemService, FileNotFoundError } from '@sora/filesystem';

describe('FilesystemService: getFileInfo', () => {
  let tempDir: string;
  let service: FilesystemService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sora-fileinfo-test-'));
    service = new FilesystemService();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should return complete metadata for a regular file', async () => {
    const filePath = path.join(tempDir, 'data.json');
    const content = '{"name": "sora"}';
    await fs.writeFile(filePath, content);

    const info = await service.getFileInfo('data.json', tempDir);

    expect(info.path).toBe('data.json');
    expect(info.type).toBe('file');
    expect(info.size).toBe(Buffer.byteLength(content));
    expect(info.extension).toBe('.json');
    expect(info.isText).toBe(true);
    expect(info.isHidden).toBe(false);
    expect(info.modifiedAt).toBeDefined();
  });

  it('should return metadata for a directory', async () => {
    const subDir = path.join(tempDir, 'components');
    await fs.mkdir(subDir);

    const info = await service.getFileInfo('components', tempDir);

    expect(info.path).toBe('components');
    expect(info.type).toBe('directory');
    expect(info.isText).toBe(false);
    expect(info.isHidden).toBe(false);
  });

  it('should identify hidden files', async () => {
    const hiddenPath = path.join(tempDir, '.gitignore');
    await fs.writeFile(hiddenPath, 'node_modules\n');

    const info = await service.getFileInfo('.gitignore', tempDir);

    expect(info.path).toBe('.gitignore');
    expect(info.isHidden).toBe(true);
  });

  it('should mark binary files as isText: false', async () => {
    const binPath = path.join(tempDir, 'photo.jpg');
    await fs.writeFile(binPath, 'fake-jpeg-data');

    const info = await service.getFileInfo('photo.jpg', tempDir);

    expect(info.type).toBe('file');
    expect(info.extension).toBe('.jpg');
    expect(info.isText).toBe(false);
  });

  it('should throw FileNotFoundError for non-existent path', async () => {
    await expect(service.getFileInfo('phantom.txt', tempDir)).rejects.toThrow(FileNotFoundError);
  });
});
