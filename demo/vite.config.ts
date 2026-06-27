import { defineConfig } from 'vite';
import { frameworkPlugins, SOLID_OPTIMIZE_EXCLUDE } from './vite/framework';
import { base, fromDemoRoot } from './vite/paths';
import {
  baseAwareLinks,
  demoFallback,
  injectThemeInit,
  injectVersions,
  inlineIcons,
  staticRoutes,
} from './vite/plugins';
import { crossServerProxy, previewProxy } from './vite/proxy';

/**
 * Playground for the vanilla, Vue Router, React Router, Solid Router, TanStack
 * Router and Angular Router integrations. `glyphnav` is aliased to the live
 * `src/` so the demos always reflect the working tree; Next, Nuxt and SvelteKit
 * have their own dev servers and are proxied in (see {@link crossServerProxy}).
 * The dev server is strict-port, so a stale instance fails loudly rather than
 * silently moving the picker to another port.
 */
export default defineConfig({
  root: fromDemoRoot('.'),
  base,
  resolve: {
    alias: [
      { find: 'glyphnav/core', replacement: fromDemoRoot('../src/core/index.ts') },
      { find: 'glyphnav/vue-router', replacement: fromDemoRoot('../src/vue-router/index.ts') },
      { find: 'glyphnav/react-router', replacement: fromDemoRoot('../src/react-router/index.tsx') },
      { find: 'glyphnav/solid-router', replacement: fromDemoRoot('../src/solid-router/index.ts') },
      {
        find: 'glyphnav/tanstack-router/react',
        replacement: fromDemoRoot('../src/tanstack-router/react/index.tsx'),
      },
      {
        find: 'glyphnav/tanstack-router/solid',
        replacement: fromDemoRoot('../src/tanstack-router/solid/index.ts'),
      },
      {
        find: 'glyphnav/angular-router',
        replacement: fromDemoRoot('../src/angular-router/index.ts'),
      },
      { find: 'glyphnav', replacement: fromDemoRoot('../src/index.ts') },
    ],
  },
  optimizeDeps: {
    exclude: SOLID_OPTIMIZE_EXCLUDE,
  },
  server: {
    port: 5173,
    strictPort: true,
    open: true,
    proxy: crossServerProxy,
  },
  preview: {
    open: true,
    proxy: previewProxy,
  },
  plugins: [
    ...frameworkPlugins(),
    demoFallback(),
    baseAwareLinks(),
    injectVersions(),
    inlineIcons(),
    injectThemeInit(),
    staticRoutes(),
  ],
  build: {
    outDir: fromDemoRoot('dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fromDemoRoot('index.html'),
        vanilla: fromDemoRoot('vanilla/index.html'),
        core: fromDemoRoot('core/index.html'),
        changelog: fromDemoRoot('changelog/index.html'),
        'vue-router': fromDemoRoot('vue-router/index.html'),
        'react-router': fromDemoRoot('react-router/index.html'),
        'solid-router': fromDemoRoot('solid-router/index.html'),
        'tanstack-router/react': fromDemoRoot('tanstack-router/react/index.html'),
        'tanstack-router/solid': fromDemoRoot('tanstack-router/solid/index.html'),
        'angular-router': fromDemoRoot('angular-router/index.html'),
      },
    },
  },
});
