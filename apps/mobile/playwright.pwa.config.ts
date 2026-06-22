import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.MOBILE_PWA_TEST_PORT ?? 8091);
const baseURL = `http://127.0.0.1:${String(port)}`;

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  reporter: 'list',
  testDir: './tests/pwa',
  timeout: 30_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    serviceWorkers: 'allow',
  },
  webServer: {
    command: 'pnpm build:web && pnpm serve:web',
    env: { MOBILE_PWA_PORT: String(port) },
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL,
  },
});
