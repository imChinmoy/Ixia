import type { RepositoryFile } from '../types/context.types.js';

export interface PackageManagerResult {
  readonly packageManager?: string;
  readonly packageManagersFound: readonly string[];
}

const LOCKFILE_TO_PACKAGE_MANAGER: Record<string, string> = {
  'pnpm-lock.yaml': 'pnpm',
  'yarn.lock': 'yarn',
  'package-lock.json': 'npm',
  'bun.lock': 'bun',
  'bun.lockb': 'bun',
  'cargo.lock': 'cargo',
  'poetry.lock': 'poetry',
  'pipfile.lock': 'pipenv',
  'composer.lock': 'composer',
};

export function detectPackageManager(files: readonly RepositoryFile[]): PackageManagerResult {
  const filenames = new Set(files.map((f) => f.name.toLowerCase()));
  const found: string[] = [];

  for (const [lockfile, pm] of Object.entries(LOCKFILE_TO_PACKAGE_MANAGER)) {
    if (filenames.has(lockfile) && !found.includes(pm)) {
      found.push(pm);
    }
  }

  let packageManager: string | undefined;

  if (found.length === 1) {
    packageManager = found[0];
  } else if (found.length > 1) {
    // If multiple lockfiles exist (e.g. pnpm + npm), indicate "multiple"
    packageManager = 'multiple';
  }

  return {
    packageManager,
    packageManagersFound: found,
  };
}
