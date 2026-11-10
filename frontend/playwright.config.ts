import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const output = resolve(__dirname, '../storage/codex-local/e2e');
export default defineConfig({
  testDir: './e2e', testMatch: '**/*.e2e.ts', fullyParallel: false, workers: 1,
  timeout: 90000, expect: { timeout: 15000 }, retries: 0, forbidOnly: true, maxFailures: 3,
  outputDir: resolve(output, 'artifacts'),
  reporter: [['list'], ['json', { outputFile: resolve(output, 'playwright-results.json') }]],
  use: { baseURL: 'http://localhost:4500', locale: 'es-EC', serviceWorkers: 'block',
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 }, colorScheme: 'light' } },
    { name: 'movil', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, colorScheme: 'dark' } },
  ],
});
