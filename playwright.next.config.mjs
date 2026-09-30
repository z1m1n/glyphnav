import { defineConfig } from '@playwright/test';

// Kept separate from the fast fixture suite because Next starts its own app.
export default defineConfig({
  testDir: './test/browser',
  testMatch: '**/next-link.spec.mjs',
  workers: 1,
  reporter: 'list',
  use: { browserName: 'chromium', baseURL: 'http://localhost:5174', trace: 'retain-on-failure' },
  webServer: {
    command: 'node ../../node_modules/next/dist/bin/next dev --port 5174',
    cwd: './demo/next',
    url: 'http://localhost:5174/next/',
    env: { DEMO_BASE: '/', NEXT_TELEMETRY_DISABLED: '1' },
    reuseExistingServer: !process.env.CI,
  },
});
