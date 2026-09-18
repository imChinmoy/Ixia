import type { ProjectInfo } from './project.types.js';
import type { ContextBudget } from './budget.types.js';

export interface RepositoryFile {
  readonly path: string;
  readonly name: string;
  readonly extension?: string;
  readonly size: number;
  readonly isDirectory: boolean;
  readonly isImportant?: boolean;
  readonly isSensitive?: boolean;
  readonly isTest?: boolean;
  readonly isDoc?: boolean;
  readonly isEntryPoint?: boolean;
  readonly isConfig?: boolean;
}

export interface RepositoryStructure {
  readonly formattedTree: string;
  readonly totalDirectories: number;
  readonly totalFiles: number;
  readonly truncated: boolean;
}

export interface ScoredFile {
  readonly file: RepositoryFile;
  readonly score: number;
  readonly matchedSignals: readonly string[];
}

export interface RepositoryContextSnapshot {
  readonly rootPath: string;
  readonly project: ProjectInfo;
  readonly structure: RepositoryStructure;
  readonly importantFiles: readonly RepositoryFile[];
  readonly relevantFiles: readonly RepositoryFile[];
  readonly readmeSnippet?: string;
  readonly sensitiveFilesFound: readonly string[];
  readonly createdAt: Date;
  readonly formattedPromptContext: string;
}

export interface ContextBuildOptions {
  readonly rootPath?: string;
  readonly query?: string;
  readonly budget?: ContextBudget;
  readonly skipCache?: boolean;
}
