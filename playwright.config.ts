import { defineConfig, devices } from '@playwright/test';

// Journeys run against the production build served under /trunk/, like a
// GitHub Pages project site. WebKit runs only where its browser is installed
// (set PW_WEBKIT=1); this container ships Chromium only.
const projects = [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }];
if (process.env.PW_WEBKIT) projects.push({ name: 'webkit', use: { ...devices['Desktop Safari'] } });

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4174/trunk/',
    trace: 'retain-on-failure',
  },
  projects,
  webServer: {
    command: 'node e2e/serve.mjs',
    url: 'http://localhost:4174/trunk/',
    reuseExistingServer: !process.env.CI,
  },
});
