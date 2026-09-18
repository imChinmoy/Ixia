import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  FilesystemService,
  FileNotFoundError,
  BinaryFileError,
  FileTooLargeError,
  FilesystemError,
} from '@ixia/filesystem';

describe('FilesystemService: readFile', () => {
  let tempDir: string;
  let service: FilesystemService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ixia-readfile-test-'));
    service = new FilesystemService();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should read a normal text file completely', async () => {
    const filePath = path.join(tempDir, 'hello.txt');
    const content = 'Line 1\nLine 2\nLine 3';
    await fs.writeFile(filePath, content);

    const result = await service.readFile('hello.txt', tempDir);

    expect(result.path).toBe('hello.txt');
    expect(result.content).toBe(content);
    expect(result.totalLines).toBe(3);
    expect(result.startLine).toBe(1);
    expect(result.endLine).toBe(3);
  });

  it('should read an empty file', async () => {
    const filePath = path.join(tempDir, 'empty.txt');
    await fs.writeFile(filePath, '');

    const result = await service.readFile('empty.txt', tempDir);

    expect(result.content).toBe('');
    expect(result.size).toBe(0);
    expect(result.totalLines).toBe(1);
  });

  it('should support reading specific line ranges', async () => {
    const filePath = path.join(tempDir, 'code.ts');
    const lines = ['const a = 1;', 'const b = 2;', 'const c = 3;', 'const d = 4;', 'const e = 5;'];
    await fs.writeFile(filePath, lines.join('\n'));

    const rangeResult = await service.readFile('code.ts', tempDir, {
      startLine: 2,
      endLine: 4,
    });

    expect(rangeResult.content).toBe('const b = 2;\nconst c = 3;\nconst d = 4;');
    expect(rangeResult.startLine).toBe(2);
    expect(rangeResult.endLine).toBe(4);
    expect(rangeResult.totalLines).toBe(5);
  });

  it('should handle startLine beyond total line count gracefully', async () => {
    const filePath = path.join(tempDir, 'short.txt');
    await fs.writeFile(filePath, 'only line');

    const result = await service.readFile('short.txt', tempDir, { startLine: 10 });
    expect(result.content).toBe('');
    expect(result.startLine).toBe(10);
  });

  it('should clamp endLine to total line count if larger', async () => {
    const filePath = path.join(tempDir, 'two-lines.txt');
    await fs.writeFile(filePath, 'line 1\nline 2');

    const result = await service.readFile('two-lines.txt', tempDir, {
      startLine: 1,
      endLine: 50,
    });

    expect(result.content).toBe('line 1\nline 2');
    expect(result.startLine).toBe(1);
    expect(result.endLine).toBe(2);
  });

  it('should throw FilesystemError on invalid line ranges', async () => {
    const filePath = path.join(tempDir, 'sample.txt');
    await fs.writeFile(filePath, 'content');

    await expect(service.readFile('sample.txt', tempDir, { startLine: 0 })).rejects.toThrow(
      FilesystemError,
    );

    await expect(
      service.readFile('sample.txt', tempDir, { startLine: 5, endLine: 2 }),
    ).rejects.toThrow(FilesystemError);
  });

  it('should throw FileNotFoundError for non-existent file', async () => {
    await expect(service.readFile('non_existent.txt', tempDir)).rejects.toThrow(FileNotFoundError);
  });

  it('should throw FilesystemError when attempting to read a directory as a file', async () => {
    const subDir = path.join(tempDir, 'sub_dir');
    await fs.mkdir(subDir);

    await expect(service.readFile('sub_dir', tempDir)).rejects.toThrow(FilesystemError);
  });

  it('should reject binary files with known binary extensions', async () => {
    const imgPath = path.join(tempDir, 'image.png');
    await fs.writeFile(imgPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    await expect(service.readFile('image.png', tempDir)).rejects.toThrow(BinaryFileError);
  });

  it('should detect and reject binary files without known extension via null-byte inspection', async () => {
    const binPath = path.join(tempDir, 'unknown_data.dat');
    // Buffer containing null byte
    const binBuffer = Buffer.from([0x48, 0x65, 0x6c, 0x00, 0x6f]);
    await fs.writeFile(binPath, binBuffer);

    await expect(service.readFile('unknown_data.dat', tempDir)).rejects.toThrow(BinaryFileError);
  });

  it('should throw FileTooLargeError when file exceeds maxFileSize limit', async () => {
    const largePath = path.join(tempDir, 'large.txt');
    const largeContent = 'A'.repeat(500);
    await fs.writeFile(largePath, largeContent);

    // Set maxFileSize to 200 bytes
    await expect(service.readFile('large.txt', tempDir, { maxFileSize: 200 })).rejects.toThrow(
      FileTooLargeError,
    );
  });
});
