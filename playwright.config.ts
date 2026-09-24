import { defineConfig, devices } from '@playwright/test';

const port = 5173;

// In environments that ship their own Chromium (this repo's cloud container does), point
// Playwright at it instead of downloading a build: PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: `npm run dev:emulator -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Phone-width journeys run in Chromium too: only Chromium is installed here and in CI.
    { name: 'phone', use: { ...devices['iPhone 14'], browserName: 'chromium' } },
  ],
});
