import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser',
  testMatch: '**/*.spec.mjs',
  testIgnore: ['**/next-link.spec.mjs', '**/astro-router.spec.mjs'],
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { browserName: 'chromium', baseURL: 'http://localhost:4179', trace: 'retain-on-failure' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --config test/browser/vite.config.mjs',
    url: 'http://localhost:4179',
    reuseExistingServer: !process.env.CI,
  },
});
