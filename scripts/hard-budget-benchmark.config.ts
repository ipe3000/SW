import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['scripts/hard-budget-benchmark.test.ts'],fileParallelism:false,maxWorkers:1,testTimeout:300000}});
