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
      '@ixia/core': path.resolve(__dirname, './packages/core/src/index.ts'),
      '@ixia/config': path.resolve(__dirname, './packages/config/src/index.ts'),
      '@ixia/logger': path.resolve(__dirname, './packages/logger/src/index.ts'),
      '@ixia/shared': path.resolve(__dirname, './packages/shared/src/index.ts'),
      '@ixia/tools': path.resolve(__dirname, './packages/tools/src/index.ts'),
      '@ixia/filesystem': path.resolve(__dirname, './packages/filesystem/src/index.ts'),
      '@ixia/shell': path.resolve(__dirname, './packages/shell/src/index.ts'),
      '@ixia/llm': path.resolve(__dirname, './packages/llm/src/index.ts'),
      '@ixia/agent': path.resolve(__dirname, './packages/agent/src/index.ts'),
      '@ixia/context': path.resolve(__dirname, './packages/context/src/index.ts'),
      '@ixia/planner': path.resolve(__dirname, './packages/planner/src/index.ts'),
    },
  },
});
