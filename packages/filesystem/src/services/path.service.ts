import fs from 'node:fs/promises';
import path from 'node:path';
import { InvalidPathError, WorkspaceViolationError } from '../errors/filesystem.errors.js';

export class PathService {
  /**
   * Validates that the input is a valid path string without forbidden characters (e.g. null bytes).
   */
  validatePathString(inputPath: unknown): string {
    if (typeof inputPath !== 'string') {
      throw new InvalidPathError(String(inputPath), 'Path must be a string');
    }

    if (inputPath.includes('\0')) {
      throw new InvalidPathError(inputPath, 'Path contains null bytes');
    }

    const trimmed = inputPath.trim();
    return trimmed === '' ? '.' : trimmed;
  }

  /**
   * Checks whether a target path is logically within the workspace root.
   */
  isWithinWorkspace(targetPath: string, workspaceRoot: string): boolean {
    const normalizedTarget = path.resolve(targetPath);
    const normalizedWorkspace = path.resolve(workspaceRoot);

    return (
      normalizedTarget === normalizedWorkspace ||
      normalizedTarget.startsWith(normalizedWorkspace + path.sep)
    );
  }

  /**
   * Resolves a user-provided path against the workspace root, protecting against
   * path traversal attacks and escaping symlinks.
   */
  async resolveSafePath(userPath: string, workspaceRoot: string): Promise<string> {
    const cleanPath = this.validatePathString(userPath);
    const normalizedWorkspace = path.resolve(workspaceRoot);

    // 1. Logical resolution check
    const logicalPath = path.isAbsolute(cleanPath)
      ? path.resolve(cleanPath)
      : path.resolve(normalizedWorkspace, cleanPath);

    if (!this.isWithinWorkspace(logicalPath, normalizedWorkspace)) {
      throw new WorkspaceViolationError(cleanPath, normalizedWorkspace);
    }

    // 2. Canonical realpath resolution to prevent symlink traversal outside workspace
    let realWorkspace: string;
    try {
      realWorkspace = await fs.realpath(normalizedWorkspace);
    } catch {
      realWorkspace = normalizedWorkspace;
    }

    try {
      const realTarget = await fs.realpath(logicalPath);
      if (
        !this.isWithinWorkspace(realTarget, realWorkspace) &&
        !this.isWithinWorkspace(realTarget, normalizedWorkspace)
      ) {
        throw new WorkspaceViolationError(cleanPath, normalizedWorkspace);
      }
      return realTarget;
    } catch (err: unknown) {
      if (err instanceof WorkspaceViolationError) {
        throw err;
      }

      // If file does not exist (ENOENT), inspect nearest existing parent to check for symlinks
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        let currentDir = path.dirname(logicalPath);
        while (
          currentDir !== normalizedWorkspace &&
          this.isWithinWorkspace(currentDir, normalizedWorkspace)
        ) {
          try {
            const realParent = await fs.realpath(currentDir);
            if (
              !this.isWithinWorkspace(realParent, realWorkspace) &&
              !this.isWithinWorkspace(realParent, normalizedWorkspace)
            ) {
              throw new WorkspaceViolationError(cleanPath, normalizedWorkspace);
            }
            break;
          } catch (parentErr) {
            if ((parentErr as NodeJS.ErrnoException).code === 'ENOENT') {
              currentDir = path.dirname(currentDir);
            } else {
              break;
            }
          }
        }
        return logicalPath;
      }

      return logicalPath;
    }
  }

  /**
   * Computes a normalized relative path from the workspace root.
   */
  getRelativePath(targetPath: string, workspaceRoot: string): string {
    const rel = path.relative(workspaceRoot, targetPath);
    if (!rel || rel === '') {
      return '.';
    }
    // Normalize path separators to POSIX forward slashes
    return rel.split(path.sep).join('/');
  }
}
