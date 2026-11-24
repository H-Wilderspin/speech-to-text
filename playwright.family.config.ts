import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './.wrangler/family-test-results',
  testMatch: '**/family-connection.spec.ts',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4180', trace: 'retain-on-failure', serviceWorkers: 'block' },
  webServer: [{
    command: 'npm run build -- --outDir .wrangler/family-preview && npm run preview -- --outDir .wrangler/family-preview --host 127.0.0.1 --port 4180 --strictPort',
    env: { VITE_SYNC_SERVICE_URL: 'https://family.example' },
    url: 'http://127.0.0.1:4180', reuseExistingServer: false,
  }, {
    command: 'npm run preview -- --outDir .wrangler/family-preview --host 127.0.0.1 --port 4181 --strictPort --base=/speech-to-text/',
    url: 'http://127.0.0.1:4181/speech-to-text/', reuseExistingServer: false,
  }],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' } },
  ],
});
