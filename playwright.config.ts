import { defineConfig, devices } from '@playwright/test';
const deployedUrl = process.env.SW_BASE_URL;
const publicCloud = process.env.SW_PUBLIC === '1' || Boolean(deployedUrl);
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 45000,
  testMatch: publicCloud ? ['sound.spec.ts', 'home.spec.ts', 'sidebar.spec.ts', 'ergonomics.spec.ts', 'public.spec.ts', 'full-online.spec.ts', 'game.spec.ts', 'computer.spec.ts', 'speed.spec.ts', 'presentation.spec.ts', 'movement.spec.ts', 'layout.spec.ts', 'battle-effects.spec.ts'] : ['sound.spec.ts', 'home.spec.ts', 'sidebar.spec.ts', 'ergonomics.spec.ts', 'online.spec.ts', 'full-online.spec.ts', 'game.spec.ts', 'computer.spec.ts', 'speed.spec.ts', 'presentation.spec.ts', 'movement.spec.ts', 'layout.spec.ts', 'battle-effects.spec.ts'],
  outputDir: publicCloud ? 'test-results/public-cloud' : 'test-results/local',
  use: { baseURL: deployedUrl ?? (publicCloud ? 'http://127.0.0.1:4175' : 'http://127.0.0.1:4174'), trace: 'retain-on-failure', screenshot: 'only-on-failure', acceptDownloads: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }, ...(process.env.SW_FIREFOX === '1' ? [{ name: 'firefox', use: { ...devices['Desktop Firefox'], ...(process.env.SW_FIREFOX_EXECUTABLE ? { launchOptions: { executablePath: process.env.SW_FIREFOX_EXECUTABLE } } : {}) } }] : [])],
  webServer: deployedUrl ? undefined : publicCloud ? [
    { command: 'npm run dev -- --port 4175 --strictPort', url: 'http://127.0.0.1:4175', reuseExistingServer: false }
  ] : [
    { command: 'node scripts/test-peer-server.mjs', url: 'http://127.0.0.1:9001/wizardry', reuseExistingServer: false },
    { command: 'npm run dev -- --port 4174 --strictPort --mode test', url: 'http://127.0.0.1:4174', reuseExistingServer: false }
  ]
});
