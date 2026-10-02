import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_INTEGRATION_BASE_URL ?? 'http://127.0.0.1:3200';

/**
 * Deliberately separate from playwright.config.ts: this suite proves the real
 * Auth.js/database path and must never inherit smoke data or CSP bypasses.
 */
export default defineConfig({
  testDir: './tests/browser',
  testMatch: ['portfolio-*.spec.ts', 'shared-portfolios.spec.ts'],
  globalSetup: './tests/browser/integration-global-setup.ts',
  globalTeardown: './tests/browser/integration-global-teardown.ts',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    storageState: '.playwright-integration/session.json',
    bypassCSP: false,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_INTEGRATION_BASE_URL
    ? undefined
    : {
        command: 'node scripts/start-playwright-integration-server.mjs',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 180_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
