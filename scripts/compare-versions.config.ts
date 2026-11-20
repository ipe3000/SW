import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['scripts/compare-versions.test.ts'], fileParallelism: false, maxWorkers: 1 } });
