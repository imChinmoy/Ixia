import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  IgnoreManager,
  isSensitiveFile,
  isImportantFile,
  classifyImportantFiles,
  FileDiscovery,
  StructureBuilder,
  type RepositoryFile,
} from '@ixia/context';

describe('Context Discovery & Structure (Phase 8)', () => {
  describe('IgnoreManager', () => {
    it('should ignore default directories', () => {
      const manager = new IgnoreManager();
      expect(manager.isIgnored('node_modules', true)).toBe(true);
      expect(manager.isIgnored('node_modules/foo/bar.js', false)).toBe(true);
      expect(manager.isIgnored('.git', true)).toBe(true);
      expect(manager.isIgnored('dist/bundle.js', false)).toBe(true);
      expect(manager.isIgnored('build/out.js', false)).toBe(true);
      expect(manager.isIgnored('.next/server.js', false)).toBe(true);
      expect(manager.isIgnored('src/index.ts', false)).toBe(false);
    });

    it('should parse and apply .gitignore wildcard rules', () => {
      const manager = new IgnoreManager();
      manager.loadGitignoreContent(`
# Comment line
*.log
temp/
coverage/
/root-only.txt
!important.log
`);

      expect(manager.isIgnored('app.log', false)).toBe(true);
      expect(manager.isIgnored('sub/nested.log', false)).toBe(true);
      expect(manager.isIgnored('important.log', false)).toBe(false);
      expect(manager.isIgnored('temp', true)).toBe(true);
      expect(manager.isIgnored('temp/cache.json', false)).toBe(true);
      expect(manager.isIgnored('coverage', true)).toBe(true);
      expect(manager.isIgnored('root-only.txt', false)).toBe(true);
      expect(manager.isIgnored('nested/root-only.txt', false)).toBe(false);
      expect(manager.isIgnored('src/main.ts', false)).toBe(false);
    });
  });

  describe('Sensitive File Classifier', () => {
    it('should identify sensitive files', () => {
      expect(isSensitiveFile('.env')).toBe(true);
      expect(isSensitiveFile('.env.production')).toBe(true);
      expect(isSensitiveFile('.env.local')).toBe(true);
      expect(isSensitiveFile('secrets.json')).toBe(true);
      expect(isSensitiveFile('secrets.yaml')).toBe(true);
      expect(isSensitiveFile('credentials.json')).toBe(true);
      expect(isSensitiveFile('id_rsa')).toBe(true);
      expect(isSensitiveFile('server.key')).toBe(true);
      expect(isSensitiveFile('cert.pem')).toBe(true);
    });

    it('should NOT flag benign template or example files', () => {
      expect(isSensitiveFile('.env.example')).toBe(false);
      expect(isSensitiveFile('.env.sample')).toBe(false);
      expect(isSensitiveFile('.env.template')).toBe(false);
      expect(isSensitiveFile('package.json')).toBe(false);
      expect(isSensitiveFile('src/auth.service.ts')).toBe(false);
    });
  });

  describe('Important File Classification', () => {
    it('should classify manifests, configs, docs, and entry points', () => {
      expect(isImportantFile('package.json')).toBe(true);
      expect(isImportantFile('tsconfig.json')).toBe(true);
      expect(isImportantFile('README.md')).toBe(true);
      expect(isImportantFile('src/index.ts')).toBe(true);
      expect(isImportantFile('src/main.py')).toBe(true);
      expect(isImportantFile('src/random_helper.ts')).toBe(false);
    });

    it('should partition files into important categories', () => {
      const files: RepositoryFile[] = [
        { name: 'package.json', path: 'package.json', size: 100, isDirectory: false },
        { name: 'tsconfig.json', path: 'tsconfig.json', size: 100, isDirectory: false },
        { name: 'README.md', path: 'README.md', size: 100, isDirectory: false },
        { name: 'index.ts', path: 'src/index.ts', size: 100, isDirectory: false },
        { name: 'helper.ts', path: 'src/helper.ts', size: 100, isDirectory: false },
      ];

      const categorized = classifyImportantFiles(files);
      expect(categorized.manifests).toContain('package.json');
      expect(categorized.configs).toContain('tsconfig.json');
      expect(categorized.docs).toContain('README.md');
      expect(categorized.entrypoints).toContain('src/index.ts');
      expect(categorized.manifests).not.toContain('src/helper.ts');
    });
  });

  describe('FileDiscovery', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ixia-discovery-test-'));
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'node_modules', 'foo'), { recursive: true });
      await fs.mkdir(path.join(tempDir, '.git'), { recursive: true });

      await fs.writeFile(path.join(tempDir, 'package.json'), '{"name": "test"}');
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'console.log("hello");');
      await fs.writeFile(path.join(tempDir, 'src', 'app.ts'), 'export const app = 1;');
      await fs.writeFile(path.join(tempDir, 'node_modules', 'foo', 'index.js'), 'module.exports = {};');
      await fs.writeFile(path.join(tempDir, '.git', 'HEAD'), 'ref: refs/heads/main');
      await fs.writeFile(path.join(tempDir, '.env'), 'SECRET_KEY=12345');
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should discover workspace files while ignoring default dirs', async () => {
      const discovery = new FileDiscovery({ maxDepth: 4, maxFiles: 50 });
      const result = await discovery.discover(tempDir);

      const paths = result.files.map((f) => f.path);
      expect(paths).toContain('package.json');
      expect(paths).toContain('README.md');
      expect(paths).toContain('src/index.ts');
      expect(paths).toContain('src/app.ts');

      // node_modules and .git should NOT be traversed
      expect(paths.some((p) => p.includes('node_modules'))).toBe(false);
      expect(paths.some((p) => p.includes('.git'))).toBe(false);

      // Sensitive file .env should be discovered but tracked in sensitiveFilesFound
      expect(result.sensitiveFilesFound).toContain('.env');
    });

    it('should respect .gitignore file inside workspace', async () => {
      await fs.writeFile(path.join(tempDir, '.gitignore'), 'src/app.ts\n*.tmp\n');
      await fs.writeFile(path.join(tempDir, 'temp.tmp'), 'data');

      const discovery = new FileDiscovery();
      const result = await discovery.discover(tempDir);

      const paths = result.files.map((f) => f.path);
      expect(paths).toContain('src/index.ts');
      expect(paths).not.toContain('src/app.ts');
      expect(paths).not.toContain('temp.tmp');
    });

    it('should respect maxFiles limit', async () => {
      const discovery = new FileDiscovery({ maxFiles: 2 });
      const result = await discovery.discover(tempDir);

      expect(result.files.length).toBeLessThanOrEqual(2);
      expect(result.truncated).toBe(true);
    });
  });

  describe('StructureBuilder', () => {
    it('should format a clean ASCII directory tree', () => {
      const files: RepositoryFile[] = [
        { name: 'package.json', path: 'package.json', size: 100, isDirectory: false },
        { name: 'README.md', path: 'README.md', size: 200, isDirectory: false },
        { name: 'src', path: 'src', size: 0, isDirectory: true },
        { name: 'index.ts', path: 'src/index.ts', size: 300, isDirectory: false },
        { name: 'app.ts', path: 'src/app.ts', size: 400, isDirectory: false },
      ];

      const builder = new StructureBuilder({ maxDepth: 3, maxEntriesPerDir: 10 });
      const tree = builder.buildTree(files);

      expect(tree).toContain('package.json');
      expect(tree).toContain('README.md');
      expect(tree).toContain('src/');
      expect(tree).toContain('index.ts');
      expect(tree).toContain('app.ts');
    });

    it('should truncate deep levels and indicate with ...', () => {
      const files: RepositoryFile[] = [
        { name: 'src', path: 'src', size: 0, isDirectory: true },
        { name: 'nested', path: 'src/nested', size: 0, isDirectory: true },
        { name: 'deep', path: 'src/nested/deep', size: 0, isDirectory: true },
        { name: 'file.ts', path: 'src/nested/deep/file.ts', size: 100, isDirectory: false },
      ];

      const builder = new StructureBuilder({ maxDepth: 1 });
      const tree = builder.buildTree(files);

      expect(tree).toContain('src/');
      expect(tree).toContain('...');
    });
  });
});
