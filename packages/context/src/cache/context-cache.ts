import path from 'node:path';
import type { DiscoveryResult } from '../discovery/file-discovery.js';
import type { ProjectInfo } from '../types/project.types.js';
import type { RepositoryStructure } from '../types/context.types.js';

export interface CachedWorkspaceData {
  readonly discovery: DiscoveryResult;
  readonly project: ProjectInfo;
  readonly structure: RepositoryStructure;
  readonly cachedAt: number;
}

export interface CacheOptions {
  ttlMs?: number;
}

export class ContextCache {
  private readonly cache = new Map<string, CachedWorkspaceData>();
  private readonly ttlMs: number;

  constructor(options?: CacheOptions | number) {
    if (typeof options === 'number') {
      this.ttlMs = options;
    } else {
      this.ttlMs = options?.ttlMs ?? 60_000; // 60 seconds default TTL
    }
  }

  get(workspaceRoot: string): CachedWorkspaceData | undefined {
    const key = this.normalizeKey(workspaceRoot);
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    const age = Date.now() - entry.cachedAt;
    if (age > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    return entry;
  }

  set(
    workspaceRoot: string,
    data: Omit<CachedWorkspaceData, 'cachedAt'> & { cachedAt?: number },
  ): void {
    const key = this.normalizeKey(workspaceRoot);
    this.cache.set(key, {
      ...data,
      cachedAt: data.cachedAt ?? Date.now(),
    });
  }

  invalidate(workspaceRoot: string): boolean {
    const key = this.normalizeKey(workspaceRoot);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private normalizeKey(rawPath: string): string {
    return path.resolve(rawPath);
  }
}
