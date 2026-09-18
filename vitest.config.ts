import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'packages/*/tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@sora/core': path.resolve(__dirname, './packages/core/src/index.ts'),
      '@sora/config': path.resolve(__dirname, './packages/config/src/index.ts'),
      '@sora/logger': path.resolve(__dirname, './packages/logger/src/index.ts'),
      '@sora/shared': path.resolve(__dirname, './packages/shared/src/index.ts'),
      '@sora/tools': path.resolve(__dirname, './packages/tools/src/index.ts'),
      '@sora/filesystem': path.resolve(__dirname, './packages/filesystem/src/index.ts'),
      '@sora/shell': path.resolve(__dirname, './packages/shell/src/index.ts'),
      '@sora/llm': path.resolve(__dirname, './packages/llm/src/index.ts'),
      '@sora/agent': path.resolve(__dirname, './packages/agent/src/index.ts'),
    },
  },
});
