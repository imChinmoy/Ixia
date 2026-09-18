import { describe, it, expect } from 'vitest';
import {
  detectProjectTypes,
  detectLanguages,
  detectPackageManager,
  detectProjectAreas,
  type RepositoryFile,
} from '@ixia/context';

function makeFile(name: string, ext?: string, path = name): RepositoryFile {
  return {
    name,
    path,
    extension: ext ?? (name.includes('.') ? `.${name.split('.').pop()}` : undefined),
    size: 100,
    isDirectory: false,
  };
}

describe('Repository Context Detectors (Phase 8)', () => {
  describe('Project Type Detection', () => {
    it('should detect Node.js and TypeScript when package.json and tsconfig.json exist', () => {
      const files = [
        makeFile('package.json'),
        makeFile('tsconfig.json'),
        makeFile('index.ts', '.ts', 'src/index.ts'),
      ];
      const types = detectProjectTypes(files);

      expect(types).toContain('Node.js');
      expect(types).toContain('TypeScript');
    });

    it('should detect Python from pyproject.toml or requirements.txt', () => {
      const files = [makeFile('pyproject.toml'), makeFile('main.py', '.py')];
      const types = detectProjectTypes(files);

      expect(types).toContain('Python');
      expect(types).not.toContain('Node.js');
    });

    it('should detect Rust from Cargo.toml', () => {
      const files = [makeFile('Cargo.toml'), makeFile('main.rs', '.rs')];
      const types = detectProjectTypes(files);

      expect(types).toContain('Rust');
    });

    it('should detect Go from go.mod', () => {
      const files = [makeFile('go.mod'), makeFile('main.go', '.go')];
      const types = detectProjectTypes(files);

      expect(types).toContain('Go');
    });

    it('should detect Flutter/Dart from pubspec.yaml', () => {
      const files = [makeFile('pubspec.yaml'), makeFile('main.dart', '.dart')];
      const types = detectProjectTypes(files);

      expect(types).toContain('Flutter/Dart');
    });

    it('should detect Java (Maven) and Gradle', () => {
      const mavenFiles = [makeFile('pom.xml')];
      expect(detectProjectTypes(mavenFiles)).toContain('Java (Maven)');

      const gradleFiles = [makeFile('build.gradle.kts')];
      expect(detectProjectTypes(gradleFiles)).toContain('Gradle');
    });

    it('should detect C/C++ and Make projects', () => {
      const cFiles = [makeFile('CMakeLists.txt'), makeFile('main.cpp', '.cpp')];
      expect(detectProjectTypes(cFiles)).toContain('C/C++');

      const makeFiles = [makeFile('Makefile')];
      expect(detectProjectTypes(makeFiles)).toContain('Make');
    });

    it('should return empty list when no recognized project files exist', () => {
      const files = [makeFile('notes.txt', '.txt')];
      expect(detectProjectTypes(files)).toHaveLength(0);
    });
  });

  describe('Language Detection', () => {
    it('should detect TypeScript as primary language when it dominates the file count', () => {
      const files = [
        makeFile('a.ts', '.ts'),
        makeFile('b.ts', '.ts'),
        makeFile('c.tsx', '.tsx'),
        makeFile('script.js', '.js'),
      ];

      const res = detectLanguages(files);

      expect(res.primaryLanguage).toBe('TypeScript');
      expect(res.languages).toEqual(['TypeScript', 'JavaScript']);
      expect(res.counts['TypeScript']).toBe(3);
      expect(res.counts['JavaScript']).toBe(1);
    });

    it('should identify multiple languages in a polyglot project', () => {
      const files = [
        makeFile('server.py', '.py'),
        makeFile('client.ts', '.ts'),
        makeFile('build.rs', '.rs'),
      ];

      const res = detectLanguages(files);

      expect(res.languages).toContain('Python');
      expect(res.languages).toContain('TypeScript');
      expect(res.languages).toContain('Rust');
    });

    it('should handle unknown extensions gracefully', () => {
      const files = [makeFile('data.xyz', '.xyz'), makeFile('custom.foo', '.foo')];
      const res = detectLanguages(files);

      expect(res.primaryLanguage).toBeUndefined();
      expect(res.languages).toHaveLength(0);
    });
  });

  describe('Package Manager Detection', () => {
    it('should detect pnpm from pnpm-lock.yaml', () => {
      const files = [makeFile('package.json'), makeFile('pnpm-lock.yaml')];
      const res = detectPackageManager(files);

      expect(res.packageManager).toBe('pnpm');
      expect(res.packageManagersFound).toEqual(['pnpm']);
    });

    it('should detect npm from package-lock.json', () => {
      const files = [makeFile('package.json'), makeFile('package-lock.json')];
      const res = detectPackageManager(files);

      expect(res.packageManager).toBe('npm');
      expect(res.packageManagersFound).toEqual(['npm']);
    });

    it('should detect yarn from yarn.lock', () => {
      const files = [makeFile('package.json'), makeFile('yarn.lock')];
      const res = detectPackageManager(files);

      expect(res.packageManager).toBe('yarn');
      expect(res.packageManagersFound).toEqual(['yarn']);
    });

    it('should detect bun from bun.lock', () => {
      const files = [makeFile('package.json'), makeFile('bun.lock')];
      const res = detectPackageManager(files);

      expect(res.packageManager).toBe('bun');
      expect(res.packageManagersFound).toEqual(['bun']);
    });

    it('should report multiple and list all when multiple lockfiles exist', () => {
      const files = [
        makeFile('package.json'),
        makeFile('pnpm-lock.yaml'),
        makeFile('package-lock.json'),
      ];
      const res = detectPackageManager(files);

      expect(res.packageManager).toBe('multiple');
      expect(res.packageManagersFound).toContain('pnpm');
      expect(res.packageManagersFound).toContain('npm');
    });

    it('should return undefined when no lockfile exists', () => {
      const files = [makeFile('package.json')];
      const res = detectPackageManager(files);

      expect(res.packageManager).toBeUndefined();
      expect(res.packageManagersFound).toHaveLength(0);
    });
  });

  describe('Project Area & Monorepo Detection', () => {
    it('should detect monorepo and distinct areas in apps/ and packages/', () => {
      const files = [makeFile('pnpm-workspace.yaml')];
      const dirs = [
        'apps',
        'apps/cli',
        'apps/web',
        'packages',
        'packages/core',
        'packages/tools',
      ];

      const res = detectProjectAreas(files, dirs);

      expect(res.isMonorepo).toBe(true);
      expect(res.areas).toEqual([
        'apps/cli',
        'apps/web',
        'packages/core',
        'packages/tools',
      ]);
    });

    it('should detect single-project repository without areas', () => {
      const files = [makeFile('package.json')];
      const dirs = ['src', 'src/components', 'tests'];

      const res = detectProjectAreas(files, dirs);

      expect(res.isMonorepo).toBe(false);
      expect(res.areas).toHaveLength(0);
    });
  });
});
