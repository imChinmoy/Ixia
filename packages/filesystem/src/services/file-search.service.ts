import fs from 'node:fs/promises';
import path from 'node:path';
import type { PathService } from './path.service.js';
import type { SearchFilesOptions, SearchFilesResult, SearchMatch } from '../types/filesystem.js';

export const DEFAULT_SEARCH_IGNORED_DIRS = [
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  'target',
  '.cache',
  '.turbo',
];

export const DEFAULT_MAX_SEARCH_RESULTS = 50;
export const DEFAULT_MAX_FILES_SCANNED = 1000;
export const DEFAULT_MAX_SEARCH_FILE_SIZE = 512 * 1024; // 512 KB

export const KNOWN_BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.bmp',
  '.tiff',
  '.mp4',
  '.mkv',
  '.avi',
  '.mov',
  '.wmv',
  '.flv',
  '.webm',
  '.mp3',
  '.wav',
  '.flac',
  '.aac',
  '.ogg',
  '.m4a',
  '.zip',
  '.tar',
  '.gz',
  '.bz2',
  '.xz',
  '.7z',
  '.rar',
  '.pdf',
  '.epub',
  '.docx',
  '.xlsx',
  '.pptx',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.iso',
  '.dmg',
  '.class',
  '.pyc',
  '.pyo',
  '.wasm',
  '.jar',
]);

export function isBinaryBuffer(buffer: Buffer): boolean {
  const checkLength = Math.min(buffer.length, 512);
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
}

export class FileSearchService {
  private readonly pathService: PathService;

  constructor(pathService: PathService) {
    this.pathService = pathService;
  }

  /**
   * Recursively searches for query text inside files in the target directory.
   */
  async search(
    options: SearchFilesOptions,
    resolvedRoot: string,
    workspaceRoot: string,
  ): Promise<SearchFilesResult> {
    const query = options.query;
    if (!query) {
      return {
        query: '',
        matches: [],
        totalMatches: 0,
        filesScanned: 0,
        truncated: false,
      };
    }

    const maxResults = options.maxResults ?? DEFAULT_MAX_SEARCH_RESULTS;
    const maxFilesScanned = options.maxFilesScanned ?? DEFAULT_MAX_FILES_SCANNED;
    const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_SEARCH_FILE_SIZE;
    const caseSensitive = options.caseSensitive ?? false;

    const ignoredDirs = new Set(options.ignoredDirectories ?? DEFAULT_SEARCH_IGNORED_DIRS);

    const matches: SearchMatch[] = [];
    let filesScanned = 0;
    let truncated = false;
    let truncationReason: string | undefined;

    const normalizedQuery = caseSensitive ? query : query.toLowerCase();

    // Recursive directory traversal with bounding
    const scanDirectory = async (dirPath: string): Promise<void> => {
      if (truncated) return;

      let entries;
      try {
        entries = await fs.readdir(dirPath, { withFileTypes: true });
      } catch {
        // Skip unreadable directories
        return;
      }

      for (const entry of entries) {
        if (truncated) return;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (!ignoredDirs.has(entry.name)) {
            await scanDirectory(fullPath);
          }
        } else if (entry.isFile()) {
          filesScanned++;

          if (filesScanned > maxFilesScanned) {
            truncated = true;
            truncationReason = `maxFilesScanned limit of ${maxFilesScanned} reached`;
            return;
          }

          // Check for known binary extension
          const ext = path.extname(entry.name).toLowerCase();
          if (KNOWN_BINARY_EXTENSIONS.has(ext)) {
            continue;
          }

          // Check file size
          let stats;
          try {
            stats = await fs.stat(fullPath);
          } catch {
            continue;
          }

          if (stats.size > maxFileSize || stats.size === 0) {
            continue;
          }

          // Read file buffer to check for binary content and search lines
          let buffer: Buffer;
          try {
            buffer = await fs.readFile(fullPath);
          } catch {
            continue;
          }

          if (isBinaryBuffer(buffer)) {
            continue;
          }

          const content = buffer.toString('utf-8');
          const lines = content.split(/\r?\n/);
          const relativePath = this.pathService.getRelativePath(fullPath, workspaceRoot);

          for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx] ?? '';
            const testLine = caseSensitive ? line : line.toLowerCase();

            if (testLine.includes(normalizedQuery)) {
              matches.push({
                path: relativePath,
                line: lineIdx + 1,
                text: line.trim(),
              });

              if (matches.length >= maxResults) {
                truncated = true;
                truncationReason = `maxResults limit of ${maxResults} reached`;
                return;
              }
            }
          }
        }
      }
    };

    await scanDirectory(resolvedRoot);

    return {
      query,
      matches,
      totalMatches: matches.length,
      filesScanned,
      truncated,
      reason: truncationReason,
    };
  }
}
