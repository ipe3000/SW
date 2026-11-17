import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['scripts/benchmark-ai.test.ts'], testTimeout: 1_800_000,
  maxWorkers: 1, fileParallelism: false } });
