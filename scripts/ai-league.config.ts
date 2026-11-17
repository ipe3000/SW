import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['scripts/ai-league.test.ts'],testTimeout:7_200_000,maxWorkers:1}});
