import { defineConfig, devices } from '@playwright/test';

// Playwright config — runs end-to-end tests against the already-running
// frontend at http://localhost:3000 (the frontend nginx container).
//
// Prereqs:
//   make up          # backend + frontend stack is running
//   make seed        # users, products, and orders are loaded
//
// Run:
//   make test-e2e-install   # one-time: install chromium (~150 MB)
//   make test-e2e           # run the suite

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});