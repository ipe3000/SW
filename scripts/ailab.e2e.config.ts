import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const externalUrl = process.env.SW_AILAB_URL;
export default defineConfig({
  testDir: '../tests/e2e', testMatch: 'ailab.spec.ts', workers: 1, timeout: 45000,
  outputDir: '../test-results/ailab',
  use: { baseURL: externalUrl ?? 'http://127.0.0.1:4186', ...devices['Desktop Chrome'], channel: 'chrome', acceptDownloads: true, screenshot: 'only-on-failure' },
  webServer: externalUrl ? undefined : { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4186 --strictPort', cwd: fileURLToPath(new URL('..', import.meta.url)), url: 'http://127.0.0.1:4186', reuseExistingServer: false },
});
