import { defineConfig, devices } from '@playwright/test';

process.env.PLAYWRIGHT_SMOKE = process.env.PLAYWRIGHT_SMOKE ?? '1';
process.env.NEXT_PUBLIC_PLAYWRIGHT_SMOKE = process.env.NEXT_PUBLIC_PLAYWRIGHT_SMOKE ?? '1';

export default defineConfig({
  testDir: './tests/browser',
  globalTeardown: './tests/browser/global-teardown.ts',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100',
    bypassCSP: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/start-playwright-server.mjs',
    url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'firefox-csp',
      use: { ...devices['Desktop Firefox'], bypassCSP: false },
    },
    {
      name: 'chromium-csp',
      use: { ...devices['Desktop Chrome'], bypassCSP: false },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'webkit-csp',
      use: { ...devices['Desktop Safari'], bypassCSP: false },
    },
  ],
});
