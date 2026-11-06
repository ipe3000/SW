import { defineConfig, devices } from '@playwright/test';
const publicCloud = process.env.SW_PUBLIC === '1';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 45000,
  testMatch: publicCloud ? 'public.spec.ts' : 'online.spec.ts',
  outputDir: publicCloud ? 'test-results/public-cloud' : 'test-results/local',
  use: { baseURL: publicCloud ? 'http://127.0.0.1:4175' : 'http://127.0.0.1:4174', trace: 'retain-on-failure', screenshot: 'only-on-failure', acceptDownloads: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: publicCloud ? [
    { command: 'npm run dev -- --port 4175 --strictPort', url: 'http://127.0.0.1:4175', reuseExistingServer: false }
  ] : [
    { command: 'node scripts/test-peer-server.mjs', url: 'http://127.0.0.1:9001/wizardry', reuseExistingServer: false },
    { command: 'npm run dev -- --port 4174 --strictPort --mode test', url: 'http://127.0.0.1:4174', reuseExistingServer: false }
  ]
});
