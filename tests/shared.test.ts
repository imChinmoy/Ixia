import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { formatPath, createHeaderBox, ConsoleTerminalRenderer } from '@ixia/shared';

describe('Shared Package - formatPath', () => {
  it('should replace home directory with ~', () => {
    const home = os.homedir();
    const testPath = path.join(home, 'projects', 'ixia');
    expect(formatPath(testPath)).toBe('~/projects/ixia');
  });

  it('should return ~ when path is home directory itself', () => {
    const home = os.homedir();
    expect(formatPath(home)).toBe('~');
  });

  it('should return absolute path if not under home directory', () => {
    expect(formatPath('/var/log')).toBe('/var/log');
  });
});

describe('Shared Package - createHeaderBox', () => {
  it('should generate standard header box with app title and description', () => {
    const header = createHeaderBox(false);
    expect(header).toContain('S O R A');
    expect(header).toContain('AI coding agent for your terminal');
  });

  it('should generate compact header box with app title', () => {
    const compactHeader = createHeaderBox(true);
    expect(compactHeader).toContain('S O R A');
    expect(compactHeader).not.toContain('AI coding agent for your terminal');
  });
});

describe('Shared Package - ConsoleTerminalRenderer', () => {
  it('should write formatted user and system messages', () => {
    let output = '';
    const mockStream = {
      write: (str: string) => {
        output += str;
        return true;
      },
    } as unknown as NodeJS.WriteStream;

    const renderer = new ConsoleTerminalRenderer(mockStream);
    renderer.user('hello world');
    expect(output).toContain('hello world');

    renderer.system('system message');
    expect(output).toContain('system message');

    renderer.info('info message');
    expect(output).toContain('info message');

    renderer.error('error message');
    expect(output).toContain('error message');
  });
});
