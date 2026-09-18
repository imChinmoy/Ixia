import type { RepositoryFile, RepositoryStructure } from '../types/context.types.js';

export interface StructureOptions {
  maxDepth?: number;
  maxCharacters?: number;
}

interface InternalNode {
  name: string;
  isDirectory: boolean;
  children: Map<string, InternalNode>;
  hasDeeperChildren: boolean;
}

export class StructureBuilder {
  build(
    files: readonly RepositoryFile[],
    directories: readonly string[],
    options?: StructureOptions,
  ): RepositoryStructure {
    const maxDepth = options?.maxDepth ?? 3;
    const maxCharacters = options?.maxCharacters ?? 1500;

    const root: InternalNode = {
      name: '.',
      isDirectory: true,
      children: new Map(),
      hasDeeperChildren: false,
    };

    // 1. Insert directories
    for (const dir of directories) {
      const parts = dir.split('/').filter(Boolean);
      let curr = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!;
        const depth = i + 1;

        if (depth > maxDepth) {
          curr.hasDeeperChildren = true;
          break;
        }

        if (!curr.children.has(part)) {
          curr.children.set(part, {
            name: part,
            isDirectory: true,
            children: new Map(),
            hasDeeperChildren: false,
          });
        }
        curr = curr.children.get(part)!;
      }
    }

    // 2. Insert files
    for (const file of files) {
      const parts = file.path.split('/').filter(Boolean);
      let curr = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!;
        const isLast = i === parts.length - 1;
        const depth = i + 1;

        if (depth > maxDepth) {
          curr.hasDeeperChildren = true;
          break;
        }

        if (isLast) {
          if (!curr.children.has(part)) {
            curr.children.set(part, {
              name: part,
              isDirectory: false,
              children: new Map(),
              hasDeeperChildren: false,
            });
          }
        } else {
          if (!curr.children.has(part)) {
            curr.children.set(part, {
              name: part,
              isDirectory: true,
              children: new Map(),
              hasDeeperChildren: false,
            });
          }
          curr = curr.children.get(part)!;
        }
      }
    }

    // 3. Render tree
    const lines: string[] = ['.'];
    let truncated = false;

    const renderNode = (node: InternalNode, prefix: string, currentDepth: number): void => {
      const entries = Array.from(node.children.values()).sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

      for (let i = 0; i < entries.length; i++) {
        if (lines.join('\n').length >= maxCharacters) {
          truncated = true;
          return;
        }

        const child = entries[i]!;
        const isLast = i === entries.length - 1 && !node.hasDeeperChildren;
        const branch = isLast ? '└── ' : '├── ';
        const childPrefix = isLast ? '    ' : '│   ';

        const line = `${prefix}${branch}${child.name}${child.isDirectory ? '/' : ''}`;
        lines.push(line);

        if (child.isDirectory) {
          if (currentDepth < maxDepth) {
            renderNode(child, prefix + childPrefix, currentDepth + 1);
          } else if (child.hasDeeperChildren || child.children.size > 0) {
            lines.push(`${prefix}${childPrefix}└── ...`);
          }
        }
      }

      if (node.hasDeeperChildren && currentDepth < maxDepth && node.children.size === 0) {
        lines.push(`${prefix}└── ...`);
      }
    };

    renderNode(root, '', 1);

    let formattedTree = lines.join('\n');
    if (formattedTree.length > maxCharacters) {
      formattedTree = formattedTree.slice(0, maxCharacters).trimEnd() + '\n... [truncated]';
      truncated = true;
    }

    return {
      formattedTree,
      totalDirectories: directories.length,
      totalFiles: files.length,
      truncated,
    };
  }

  /**
   * Helper that builds and returns the tree formatted string directly.
   */
  buildTree(
    files: readonly RepositoryFile[],
    directories?: readonly string[],
    options?: StructureOptions,
  ): string {
    const dirs = directories ?? files.filter((f) => f.isDirectory).map((f) => f.path);
    return this.build(files, dirs, options).formattedTree;
  }
}
