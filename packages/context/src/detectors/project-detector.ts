import type { RepositoryFile } from '../types/context.types.js';

export interface ProjectTypeDetector {
  readonly name: string;
  detect(filenames: Set<string>, files: readonly RepositoryFile[]): string | undefined;
}

export const DEFAULT_PROJECT_DETECTORS: readonly ProjectTypeDetector[] = [
  {
    name: 'Node.js',
    detect: (filenames) => (filenames.has('package.json') ? 'Node.js' : undefined),
  },
  {
    name: 'TypeScript',
    detect: (filenames, files) => {
      if (
        filenames.has('tsconfig.json') ||
        files.some((f) => f.extension === '.ts' || f.extension === '.tsx')
      ) {
        return 'TypeScript';
      }
      return undefined;
    },
  },
  {
    name: 'Python',
    detect: (filenames) => {
      if (
        filenames.has('pyproject.toml') ||
        filenames.has('requirements.txt') ||
        filenames.has('setup.py') ||
        filenames.has('pipfile')
      ) {
        return 'Python';
      }
      return undefined;
    },
  },
  {
    name: 'Rust',
    detect: (filenames) => (filenames.has('cargo.toml') ? 'Rust' : undefined),
  },
  {
    name: 'Go',
    detect: (filenames) => (filenames.has('go.mod') ? 'Go' : undefined),
  },
  {
    name: 'Flutter / Dart',
    detect: (filenames) => (filenames.has('pubspec.yaml') ? 'Flutter/Dart' : undefined),
  },
  {
    name: 'Java (Maven)',
    detect: (filenames) => (filenames.has('pom.xml') ? 'Java (Maven)' : undefined),
  },
  {
    name: 'Gradle',
    detect: (filenames) => {
      if (filenames.has('build.gradle') || filenames.has('build.gradle.kts')) {
        return 'Gradle';
      }
      return undefined;
    },
  },
  {
    name: 'C/C++',
    detect: (filenames) => (filenames.has('cmakelists.txt') ? 'C/C++' : undefined),
  },
  {
    name: 'Make',
    detect: (filenames) => (filenames.has('makefile') ? 'Make' : undefined),
  },
];

export function detectProjectTypes(
  files: readonly RepositoryFile[],
  detectors: readonly ProjectTypeDetector[] = DEFAULT_PROJECT_DETECTORS,
): string[] {
  const filenames = new Set(files.map((f) => f.name.toLowerCase()));
  const detected: string[] = [];

  for (const detector of detectors) {
    const res = detector.detect(filenames, files);
    if (res && !detected.includes(res)) {
      detected.push(res);
    }
  }

  return detected;
}
