import fs from 'node:fs/promises';
import path from 'node:path';
import { PathService } from '@ixia/filesystem';
import type { RepositoryFile } from '../types/context.types.js';
import { IgnoreManager } from './ignore-rules.js';
import { isSensitiveFile } from './sensitive-files.js';
import {
  isImportantFile,
  isConfigFile,
  isTestFile,
  isDocFile,
  isEntryPointFile,
} from './important-files.js';

export interface DiscoveryOptions {
  maxDepth?: number;
  maxFiles?: number;
  ignoreManager?: IgnoreManager;
}

export interface DiscoveryResult {
  readonly rootPath: string;
  readonly files: readonly RepositoryFile[];
  readonly directories: readonly string[];
  readonly sensitiveFiles: readonly string[];
  readonly sensitiveFilesFound: readonly string[];
  readonly truncated: boolean;
}

export class FileDiscovery {
  private readonly pathService: PathService;
  private readonly defaultOptions?: DiscoveryOptions;

  constructor(options?: DiscoveryOptions, pathService?: PathService);
  constructor(pathService?: PathService);
  constructor(
    optionsOrPathService?: DiscoveryOptions | PathService,
    pathService?: PathService,
  ) {
    if (optionsOrPathService && 'resolveSafePath' in optionsOrPathService) {
      this.pathService = optionsOrPathService as PathService;
      this.defaultOptions = {};
    } else {
      this.defaultOptions = optionsOrPathService as DiscoveryOptions | undefined;
      this.pathService = pathService ?? new PathService();
    }
  }

  async discover(
    workspaceRoot: string,
    options?: DiscoveryOptions,
  ): Promise<DiscoveryResult> {
    const maxDepth = options?.maxDepth ?? this.defaultOptions?.maxDepth ?? 5;
    const maxFiles = options?.maxFiles ?? this.defaultOptions?.maxFiles ?? 2000;

    const ignoreManager =
      options?.ignoreManager ?? this.defaultOptions?.ignoreManager ?? new IgnoreManager();
    await ignoreManager.loadGitignore(workspaceRoot);

    const files: RepositoryFile[] = [];
    const directories: string[] = [];
    const sensitiveFiles: string[] = [];
    let truncated = false;

    const traverse = async (currentDir: string, currentDepth: number): Promise<void> => {
      if (currentDepth > maxDepth || files.length >= maxFiles) {
        if (files.length >= maxFiles) {
          truncated = true;
        }
        return;
      }

      let entries;
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch {
        // Unreadable directory
        return;
      }

      // Deterministic alphabetical sort
      entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

      for (const entry of entries) {
        if (files.length >= maxFiles) {
          truncated = true;
          return;
        }

        const fullPath = path.join(currentDir, entry.name);
        const relPath = this.pathService.getRelativePath(fullPath, workspaceRoot);

        let isDir = entry.isDirectory();
        let isFile = entry.isFile();

        if (entry.isSymbolicLink()) {
          try {
            const realPath = await this.pathService.resolveSafePath(fullPath, workspaceRoot);
            const stats = await fs.stat(realPath);
            isDir = stats.isDirectory();
            isFile = stats.isFile();
          } catch {
            // Broken or outside-workspace symlink, skip safely
            continue;
          }
        }

        if (ignoreManager.isIgnored(relPath, isDir)) {
          continue;
        }

        if (isDir) {
          directories.push(relPath);
          await traverse(fullPath, currentDepth + 1);
        } else if (isFile) {
          const sensitive = isSensitiveFile(relPath);
          if (sensitive) {
            sensitiveFiles.push(relPath);
          }

          let size = 0;
          try {
            const stats = await fs.stat(fullPath);
            size = stats.size;
          } catch {
            // Unreadable stats
          }

          const ext = path.extname(entry.name).toLowerCase();

          files.push({
            path: relPath,
            name: entry.name,
            extension: ext || undefined,
            size,
            isDirectory: false,
            isImportant: isImportantFile(relPath),
            isSensitive: sensitive,
            isTest: isTestFile(relPath),
            isDoc: isDocFile(relPath),
            isEntryPoint: isEntryPointFile(relPath),
            isConfig: isConfigFile(relPath),
          });
        }
      }
    };

    await traverse(workspaceRoot, 1);

    return {
      rootPath: workspaceRoot,
      files,
      directories,
      sensitiveFiles,
      sensitiveFilesFound: sensitiveFiles,
      truncated,
    };
  }
}
