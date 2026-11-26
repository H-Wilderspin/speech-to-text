import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/owner',
  outputDir: './.wrangler/owner-test-results',
  workers: 1,
  use: { baseURL: 'https://sync.example', trace: 'retain-on-failure', serviceWorkers: 'block' },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' } },
  ],
});
