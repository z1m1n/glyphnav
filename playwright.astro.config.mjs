import { defineConfig } from '@playwright/test';

// Exercise the real ClientRouter with the same prefix as the Pages deploy.
export default defineConfig({
  testDir: './test/browser',
  testMatch: '**/astro-router.spec.mjs',
  workers: 1,
  reporter: 'list',
  use: { browserName: 'chromium', baseURL: 'http://localhost:5188', trace: 'retain-on-failure' },
  webServer: [
    {
      command:
        'node node_modules/astro/bin/astro.mjs dev --ignore-lock --config ../../test/browser/astro-dev.config.mjs',
      cwd: './demo/astro',
      url: 'http://localhost:5188/glyphnav/astro/',
      env: { DEMO_BASE: '/glyphnav/', GLYPHNAV_PORT_ASTRO: '5188', ASTRO_TELEMETRY_DISABLED: '1' },
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        'node node_modules/vite/bin/vite.js --config test/browser/astro-picker.config.mjs --open false',
      url: 'http://localhost:5189/glyphnav/',
      env: { DEMO_BASE: '/glyphnav/', GLYPHNAV_PORT_VITE: '5189', GLYPHNAV_PORT_ASTRO: '5188' },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
