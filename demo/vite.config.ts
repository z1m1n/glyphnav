import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import react from '@vitejs/plugin-react';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

const APPS = ['vanilla', 'vue-router', 'react-router', 'tanstack-router', 'angular-router'];

/**
 * Vite's default SPA fallback serves the root index.html for every unknown
 * path, so reloading a deep link like /react-router/docs would land on the
 * demo picker. Route each app's sub-paths to that app's index.html instead.
 */
function demoFallback(): Plugin {
  return {
    name: 'demo-spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = (req.url ?? '').split('?')[0];
        const app = APPS.find((name) => url.startsWith(`/${name}/`));
        if (app && !url.includes('.')) {
          req.url = `/${app}/index.html`;
        }
        next();
      });
    },
  };
}

/**
 * Playground for the vanilla, Vue Router, React Router, TanStack Router and
 * Angular Router integrations. `glyphnav` is aliased to the live `src/` so the
 * demos always reflect the working tree.
 *
 * The Angular demo runs in JIT mode (`@angular/compiler` in the browser), so
 * it needs no Angular build plugin — only the legacy-decorator transpilation
 * enabled by `demo/angular-router/tsconfig.json`. The React plugin is scoped
 * to the React demos so its Babel pass never sees Angular's decorators.
 */
export default defineConfig({
  root: r('.'),
  resolve: {
    alias: [
      { find: 'glyphnav/core', replacement: r('../src/core/index.ts') },
      { find: 'glyphnav/vue-router', replacement: r('../src/vue-router/index.ts') },
      { find: 'glyphnav/react-router', replacement: r('../src/react-router/index.tsx') },
      { find: 'glyphnav/tanstack-react-router', replacement: r('../src/tanstack-react-router/index.tsx') },
      { find: 'glyphnav/angular-router', replacement: r('../src/angular-router/index.ts') },
      { find: 'glyphnav', replacement: r('../src/index.ts') },
    ],
  },
  plugins: [
    vue(),
    react({ include: /demo\/(react-router|tanstack-router)\/.*\.tsx?$/ }),
    demoFallback(),
  ],
  build: {
    outDir: r('dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: r('index.html'),
        vanilla: r('vanilla/index.html'),
        'vue-router': r('vue-router/index.html'),
        'react-router': r('react-router/index.html'),
        'tanstack-router': r('tanstack-router/index.html'),
        'angular-router': r('angular-router/index.html'),
      },
    },
  },
});
