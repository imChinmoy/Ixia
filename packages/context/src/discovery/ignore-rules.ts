import fs from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  'target',
  '.cache',
  '.turbo',
  '.dart_tool',
  '.gradle',
  '.idea',
  '.vscode',
  '.output',
  '.svelte-kit',
]);

export interface IgnoreRule {
  readonly pattern: string;
  readonly isNegation: boolean;
  readonly isDirectoryOnly: boolean;
  readonly isAnchored: boolean;
  readonly regex: RegExp;
}

export class IgnoreManager {
  private readonly rules: IgnoreRule[] = [];
  private readonly customIgnoredDirs: Set<string>;

  constructor(customIgnoredDirs?: Iterable<string>) {
    this.customIgnoredDirs = new Set(customIgnoredDirs ?? DEFAULT_IGNORED_DIRS);
  }

  /**
   * Loads and parses .gitignore if present in workspaceRoot.
   */
  async loadGitignore(workspaceRoot: string): Promise<void> {
    const gitignorePath = path.join(workspaceRoot, '.gitignore');
    try {
      const content = await fs.readFile(gitignorePath, 'utf-8');
      this.parse(content);
    } catch {
      // .gitignore does not exist or cannot be read - continue with default rules
    }
  }

  /**
   * Parses gitignore content into structured rules.
   */
  parse(content: string): void {
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      let pattern = line;
      let isNegation = false;

      if (pattern.startsWith('!')) {
        isNegation = true;
        pattern = pattern.slice(1).trim();
      }

      const isDirectoryOnly = pattern.endsWith('/');
      if (isDirectoryOnly) {
        pattern = pattern.slice(0, -1);
      }

      const isAnchored = pattern.startsWith('/');
      if (isAnchored) {
        pattern = pattern.slice(1);
      }

      const regex = this.globToRegex(pattern, isAnchored);
      this.rules.push({
        pattern,
        isNegation,
        isDirectoryOnly,
        isAnchored,
        regex,
      });
    }
  }

  /**
   * Alias for parsing gitignore content.
   */
  loadGitignoreContent(content: string): void {
    this.parse(content);
  }

  /**
   * Determines if a given relative path should be ignored.
   */
  isIgnored(relativePath: string, isDirectory: boolean): boolean {
    const normalized = relativePath.split(path.sep).join('/');
    const segments = normalized.split('/').filter(Boolean);

    // Check top-level or any directory component against default ignored directories
    for (const seg of segments) {
      if (this.customIgnoredDirs.has(seg)) {
        return true;
      }
    }

    if (this.rules.length === 0) {
      return false;
    }

    // Build list of directory paths that this path is within
    const parentDirs: string[] = [];
    let accum = '';
    for (let i = 0; i < (isDirectory ? segments.length : segments.length - 1); i++) {
      accum = accum ? `${accum}/${segments[i]}` : segments[i]!;
      parentDirs.push(accum);
    }

    let ignored = false;

    for (const rule of this.rules) {
      if (rule.isDirectoryOnly && !isDirectory) {
        const parentMatches = parentDirs.some((parentDir) =>
          rule.isAnchored
            ? rule.regex.test(parentDir)
            : rule.regex.test(parentDir) || parentDir.split('/').some((seg) => rule.regex.test(seg)),
        );
        if (parentMatches) {
          ignored = !rule.isNegation;
        }
        continue;
      }

      const matches = rule.isAnchored
        ? rule.regex.test(normalized)
        : rule.regex.test(normalized) || segments.some((seg) => rule.regex.test(seg));

      if (matches) {
        ignored = !rule.isNegation;
      }
    }

    return ignored;
  }

  private globToRegex(glob: string, isAnchored: boolean): RegExp {
    const clean = glob;

    // Escape regex special chars except * and ?
    let regexStr = clean
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');

    if (isAnchored) {
      regexStr = `^${regexStr}(?:/.*)?$`;
    } else {
      regexStr = `(?:^|/)${regexStr}(?:/.*)?$`;
    }

    return new RegExp(regexStr);
  }
}
