import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  reporter: 'list',
  testDir: './tests/pwa',
  timeout: 30_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:8081',
    serviceWorkers: 'allow',
  },
  webServer: {
    command: 'pnpm build:web && pnpm serve:web',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://127.0.0.1:8081',
  },
});
