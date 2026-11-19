import { defineConfig } from 'vitest/config';
// AI decisions have wall-clock budgets: parallel test files compete for that budget
// and change the searched lines. Keep these regressions on a serial workload.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], testTimeout: 10000, fileParallelism: false, maxWorkers: 1 } });
