import path from 'node:path';

const IMPORTANT_EXACT_NAMES = new Set([
  'package.json',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'cargo.toml',
  'go.mod',
  'pyproject.toml',
  'requirements.txt',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'pubspec.yaml',
  'cmakelists.txt',
  'makefile',
  'dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'readme.md',
  'readme',
  'readme.rst',
  'contributing.md',
  'architecture.md',
  '.env.example',
]);

export function isManifestFile(filePath: string): boolean {
  const filename = path.basename(filePath).toLowerCase();
  const manifests = new Set([
    'package.json',
    'pnpm-workspace.yaml',
    'cargo.toml',
    'go.mod',
    'pyproject.toml',
    'requirements.txt',
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
    'pubspec.yaml',
  ]);
  return manifests.has(filename);
}

export function isImportantFile(filePath: string): boolean {
  const filename = path.basename(filePath).toLowerCase();

  if (IMPORTANT_EXACT_NAMES.has(filename)) {
    return true;
  }

  return (
    isConfigFile(filePath) ||
    isDocFile(filePath) ||
    isEntryPointFile(filePath) ||
    filename.startsWith('vite.config.') ||
    filename.startsWith('vitest.config.') ||
    filename.startsWith('next.config.') ||
    filename.startsWith('webpack.config.') ||
    filename.startsWith('eslint.config.') ||
    filename.startsWith('.eslintrc') ||
    filename.startsWith('.prettierrc') ||
    filename.startsWith('tsconfig.') ||
    filename.startsWith('docker-compose') ||
    filename.startsWith('dockerfile')
  );
}

export interface CategorizedImportantFiles {
  readonly manifests: readonly string[];
  readonly configs: readonly string[];
  readonly docs: readonly string[];
  readonly entrypoints: readonly string[];
}

export function classifyImportantFiles(files: readonly { path: string }[]): CategorizedImportantFiles {
  const manifests: string[] = [];
  const configs: string[] = [];
  const docs: string[] = [];
  const entrypoints: string[] = [];

  for (const file of files) {
    if (isManifestFile(file.path)) {
      manifests.push(file.path);
    } else if (isConfigFile(file.path)) {
      configs.push(file.path);
    }

    if (isDocFile(file.path)) {
      docs.push(file.path);
    }
    if (isEntryPointFile(file.path)) {
      entrypoints.push(file.path);
    }
  }

  return { manifests, configs, docs, entrypoints };
}

export function isConfigFile(filePath: string): boolean {
  const filename = path.basename(filePath).toLowerCase();
  if (
    filename === 'tsconfig.json' ||
    filename === 'package.json' ||
    filename === 'pnpm-workspace.yaml' ||
    filename === '.env.example' ||
    filename.startsWith('vite.config.') ||
    filename.startsWith('vitest.config.') ||
    filename.startsWith('next.config.') ||
    filename.startsWith('eslint.config.') ||
    filename.startsWith('.eslintrc') ||
    filename.startsWith('.prettierrc') ||
    filename.startsWith('tsconfig.') ||
    filename.startsWith('docker-compose')
  ) {
    return true;
  }
  return false;
}

export function isTestFile(filePath: string): boolean {
  const normalized = filePath.split(path.sep).join('/').toLowerCase();
  const filename = path.basename(filePath).toLowerCase();

  if (
    filename.includes('.test.') ||
    filename.includes('.spec.') ||
    filename.endsWith('_test.go') ||
    filename.endsWith('_test.py') ||
    filename.startsWith('test_')
  ) {
    return true;
  }

  const segments = normalized.split('/');
  return segments.some(
    (seg) => seg === 'tests' || seg === 'test' || seg === '__tests__',
  );
}

export function isDocFile(filePath: string): boolean {
  const normalized = filePath.split(path.sep).join('/').toLowerCase();
  const filename = path.basename(filePath).toLowerCase();

  if (
    filename.startsWith('readme') ||
    filename === 'contributing.md' ||
    filename === 'architecture.md' ||
    filename === 'changelog.md' ||
    filename === 'license'
  ) {
    return true;
  }

  const segments = normalized.split('/');
  return segments.some((seg) => seg === 'docs' || seg === 'doc');
}

export function isEntryPointFile(filePath: string): boolean {
  const normalized = filePath.split(path.sep).join('/').toLowerCase();
  const filename = path.basename(filePath).toLowerCase();

  const baseWithoutExt = filename.split('.')[0] ?? '';
  const entryNames = new Set(['index', 'main', 'app', 'cli', 'server', 'bootstrap']);

  if (entryNames.has(baseWithoutExt)) {
    // Top-level or direct src/ child
    const depth = normalized.split('/').length;
    if (depth <= 3) {
      return true;
    }
  }

  return false;
}
