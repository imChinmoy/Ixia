import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { PathService } from '@ixia/filesystem';
import { logger } from '@ixia/logger';
import type {
  ContextBuildOptions,
  RepositoryContextSnapshot,
  RepositoryFile,
  RepositoryStructure,
} from '../types/context.types.js';
import type { ProjectInfo } from '../types/project.types.js';
import { FileDiscovery } from '../discovery/file-discovery.js';
import { detectProjectTypes } from '../detectors/project-detector.js';
import { detectLanguages } from '../detectors/language-detector.js';
import { detectPackageManager } from '../detectors/package-manager-detector.js';
import { detectProjectAreas } from '../detectors/area-detector.js';
import { StructureBuilder } from '../structure/structure-builder.js';
import { RelevanceSelector } from '../relevance/relevance-selector.js';
import { BudgetEnforcer } from '../budget/context-budget.js';
import { ContextCache } from '../cache/context-cache.js';

export interface ContextBuilderOptions {
  defaultRoot?: string;
  cache?: ContextCache;
  pathService?: PathService;
  fileDiscovery?: FileDiscovery;
  structureBuilder?: StructureBuilder;
  relevanceSelector?: RelevanceSelector;
}

export class RepositoryContextBuilder {
  private readonly defaultRoot: string;
  private readonly cache: ContextCache;
  private readonly pathService: PathService;
  private readonly fileDiscovery: FileDiscovery;
  private readonly structureBuilder: StructureBuilder;
  private readonly relevanceSelector: RelevanceSelector;

  constructor(options?: ContextBuilderOptions) {
    this.defaultRoot = options?.defaultRoot ?? process.cwd();
    this.cache = options?.cache ?? new ContextCache();
    this.pathService = options?.pathService ?? new PathService();
    this.fileDiscovery = options?.fileDiscovery ?? new FileDiscovery(this.pathService);
    this.structureBuilder = options?.structureBuilder ?? new StructureBuilder();
    this.relevanceSelector = options?.relevanceSelector ?? new RelevanceSelector();
  }

  getCache(): ContextCache {
    return this.cache;
  }

  async build(options?: ContextBuildOptions): Promise<RepositoryContextSnapshot> {
    const rawRoot = options?.rootPath ?? this.defaultRoot;
    const workspaceRoot = path.resolve(rawRoot);
    const budgetEnforcer = new BudgetEnforcer(options?.budget);
    const budget = budgetEnforcer.getBudget();

    logger.debug(`[RepositoryContextBuilder] Building context for "${workspaceRoot}"`);

    // 1. Check cache for discovery & structure
    let cached = options?.skipCache ? undefined : this.cache.get(workspaceRoot);

    if (!cached) {
      logger.debug(`[RepositoryContextBuilder] Cache miss. Performing discovery on "${workspaceRoot}"`);

      const discovery = await this.fileDiscovery.discover(workspaceRoot, {
        maxDepth: budget.maxStructureDepth + 3,
        maxFiles: 3000,
      });

      const projectTypes = detectProjectTypes(discovery.files);
      const languageResult = detectLanguages(discovery.files);
      const pmResult = detectPackageManager(discovery.files);
      const areaResult = detectProjectAreas(discovery.files, discovery.directories);

      const entryPoints: string[] = discovery.files
        .filter((f) => f.isEntryPoint)
        .slice(0, 5)
        .map((f) => f.path);

      const project: ProjectInfo = {
        projectTypes,
        primaryLanguage: languageResult.primaryLanguage,
        languages: languageResult.languages,
        packageManager: pmResult.packageManager,
        packageManagersFound: pmResult.packageManagersFound,
        isMonorepo: areaResult.isMonorepo,
        areas: areaResult.areas,
        entryPoints,
      };

      const structure = this.structureBuilder.build(
        discovery.files,
        discovery.directories,
        {
          maxDepth: budget.maxStructureDepth,
          maxCharacters: budget.maxStructureCharacters,
        },
      );

      cached = {
        discovery,
        project,
        structure,
        cachedAt: Date.now(),
      };

      if (!options?.skipCache) {
        this.cache.set(workspaceRoot, cached);
      }
    }

    const { discovery, project, structure } = cached;

    // 2. Identify top important files
    const importantFiles: RepositoryFile[] = discovery.files
      .filter((f) => f.isImportant && !f.isSensitive)
      .slice(0, budget.maxFiles);

    // 3. Select candidate relevant files based on user query
    const relevantFiles: RepositoryFile[] = this.relevanceSelector.select(
      discovery.files,
      options?.query,
      { limit: budget.maxFiles },
    );

    // 4. Optional bounded README snippet (safe read)
    let readmeSnippet: string | undefined;
    const readmeFile = discovery.files.find(
      (f) =>
        !f.isSensitive &&
        (f.name.toLowerCase() === 'readme.md' || f.name.toLowerCase() === 'readme'),
    );

    if (readmeFile) {
      try {
        const fullReadmePath = path.join(workspaceRoot, readmeFile.path);
        const readmeContent = await fs.readFile(fullReadmePath, 'utf-8');
        readmeSnippet = budgetEnforcer.truncateReadme(readmeContent.trim());
      } catch {
        // Readme read error, omit safely
      }
    }

    // 5. Format prompt context block
    const formattedPromptContext = this.formatPromptContext(
      workspaceRoot,
      project,
      structure,
      importantFiles,
      relevantFiles,
      readmeSnippet,
      budgetEnforcer,
    );

    return {
      rootPath: workspaceRoot,
      project,
      structure,
      importantFiles,
      relevantFiles,
      readmeSnippet,
      sensitiveFilesFound: discovery.sensitiveFiles,
      createdAt: new Date(),
      formattedPromptContext,
    };
  }

  private formatPromptContext(
    rootPath: string,
    project: ProjectInfo,
    structure: RepositoryStructure,
    importantFiles: readonly RepositoryFile[],
    relevantFiles: readonly RepositoryFile[],
    readmeSnippet: string | undefined,
    budgetEnforcer: BudgetEnforcer,
  ): string {
    const lines: string[] = [];

    lines.push('[Repository Context]');
    lines.push(`Workspace: ${rootPath}`);

    if (project.projectTypes.length > 0) {
      const monorepoLabel = project.isMonorepo ? ' (Monorepo)' : '';
      lines.push(`Project: ${project.projectTypes.join(', ')}${monorepoLabel}`);
    }

    if (project.languages.length > 0) {
      lines.push(`Languages: ${project.languages.slice(0, 5).join(', ')}`);
    }

    if (project.packageManager) {
      const note =
        project.packageManager === 'multiple'
          ? `multiple (${project.packageManagersFound.join(', ')})`
          : project.packageManager;
      lines.push(`Package Manager: ${note}`);
    }

    if (project.areas.length > 0) {
      lines.push(`Areas: ${project.areas.join(', ')}`);
    }

    if (project.entryPoints.length > 0) {
      lines.push(`Entry Points: ${project.entryPoints.join(', ')}`);
    }

    lines.push('');
    lines.push('Structure:');
    lines.push(budgetEnforcer.truncateStructure(structure.formattedTree));

    if (importantFiles.length > 0) {
      lines.push('');
      lines.push('Key Files:');
      for (const file of importantFiles.slice(0, 8)) {
        lines.push(`- ${file.path}`);
      }
    }

    if (relevantFiles.length > 0) {
      lines.push('');
      lines.push('Likely Relevant Candidate Files:');
      for (const file of relevantFiles.slice(0, 10)) {
        lines.push(`- ${file.path}`);
      }
    }

    if (readmeSnippet) {
      lines.push('');
      lines.push('Project Overview (from README):');
      // Indent snippet slightly
      lines.push(readmeSnippet);
    }

    lines.push('');
    lines.push(
      'Notice: The above candidate files and structure are for orientation. Always use tools (read_file, search_files) to inspect and verify actual code before answering.',
    );

    const rawContext = lines.join('\n');
    return budgetEnforcer.enforceTotalBudget(rawContext);
  }
}
