import { defineConfig } from 'vitest/config';

const shared = {
  environment: 'jsdom' as const,
  globals: false,
  setupFiles: ['./test/setup.ts'],
};

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/index.ts', 'src/**/index.tsx', '**/*.d.ts'],
    },
    projects: [
      {
        // Everything except the Solid adapter test — the existing esbuild
        // pipeline (React automatic JSX) is untouched.
        test: {
          ...shared,
          name: 'node',
          include: ['test/**/*.test.{ts,tsx}'],
          exclude: ['test/tanstack-solid-router.test.ts'],
        },
      },
      {
        // The Solid test is JSX-free and imports the *precompiled* builds:
        // `@tanstack/solid-router`'s `import` condition and `solid-js`'s
        // `browser` condition both ship ready-to-run solid-js/web calls, so no
        // Solid compiler is needed — only these resolve conditions. Inlining the
        // packages routes them through Vite's transform so the conditions apply
        // (externalized deps would resolve via Node's `node` condition → the
        // server build). Scoped to this project, so the React/Vue suites are
        // untouched.
        resolve: {
          conditions: ['browser', 'development', 'module', 'node', 'import', 'default'],
        },
        test: {
          ...shared,
          name: 'solid',
          include: ['test/tanstack-solid-router.test.ts'],
          server: {
            deps: { inline: [/solid-js/, /@tanstack\/solid-router/] },
          },
        },
      },
    ],
  },
});
