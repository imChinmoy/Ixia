import type { RepositoryFile } from '../types/context.types.js';

export interface AreaDetectionResult {
  readonly isMonorepo: boolean;
  readonly areas: readonly string[];
}

const MONOREPO_ROOT_DIRECTORIES = new Set([
  'apps',
  'packages',
  'services',
  'modules',
  'libs',
]);

export function detectProjectAreas(
  files: readonly RepositoryFile[],
  directories: readonly string[],
): AreaDetectionResult {
  const filenames = new Set(files.map((f) => f.name.toLowerCase()));
  const hasWorkspaceManifest = filenames.has('pnpm-workspace.yaml');

  const areas: string[] = [];

  for (const dir of directories) {
    const parts = dir.split('/');
    if (parts.length === 2 && MONOREPO_ROOT_DIRECTORIES.has(parts[0]!)) {
      areas.push(dir);
    }
  }

  // Deterministic alphabetical sort
  areas.sort();

  const isMonorepo = hasWorkspaceManifest || areas.length > 0;

  return {
    isMonorepo,
    areas,
  };
}
