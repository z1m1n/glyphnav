import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import react from '@vitejs/plugin-react';
import solid from 'vite-plugin-solid';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

const APPS = [
  'vanilla',
  'vue-router',
  'react-router',
  'tanstack-router',
  'tanstack-solid-router',
  'angular-router',
];

/**
 * Served at `/` in dev. The GitHub Pages workflow sets `DEMO_BASE=/glyphnav/`
 * for the project page; every app threads this through its router basename and
 * `import.meta.env.BASE_URL`, so the same source runs at either base.
 */
const base = process.env.DEMO_BASE ?? '/';

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
 * Vite rewrites asset references (`<script src>`, `<link href>`) for the base,
 * but leaves plain navigation anchors alone. Prefix the demo's root-absolute
 * links (`/vanilla/`, `/`) with the deploy base so the picker and the vanilla
 * MPA links work under a project subpath. No-op at the root base.
 */
function baseAwareLinks(): Plugin {
  return {
    name: 'demo-base-aware-links',
    // `order: 'pre'` runs before Vite resolves assets, so the only root-absolute
    // hrefs at this point are the navigation links — the `<link>`/`<script>`
    // asset refs are still relative and get the base from Vite afterwards.
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (base === '/') return html;
        // `href="/x"` → `href="<base>x"`; the negative lookahead skips `href="//"`.
        return html.replace(/href="\/(?!\/)/g, `href="${base}`);
      },
    },
  };
}

/**
 * GitHub Pages serves only static files: a cold reload of a client route such
 * as `/react-router/docs` has no matching file and would 404. Each demo has a
 * fixed, known set of routes, so after the bundle we copy every app's built
 * `index.html` into a real folder per sub-route (`react-router/docs/index.html`,
 * …). The reload then serves a real file, the SPA boots, and its router reads
 * `location` and renders the route — the ordinary SPA path, no redirect/restore
 * round-trip. `?query`/`#hash` are not part of the file path, so they survive
 * untouched. The vanilla demo is emitted the same way, so it just works via
 * real folders too.
 */
function staticRoutes(): Plugin {
  // Sub-routes per app; the "/" home is already the app's own index.html.
  const ROUTES: Record<string, string[]> = {
    vanilla: ['about', 'docs', 'contact'],
    'vue-router': ['about', 'features', 'docs'],
    'react-router': ['about', 'docs', 'blog'],
    'tanstack-router': ['about', 'posts', 'docs'],
    'tanstack-solid-router': ['about', 'posts', 'docs'],
    'angular-router': ['about', 'docs', 'blog'],
  };
  return {
    name: 'demo-static-routes',
    apply: 'build',
    closeBundle() {
      for (const [app, routes] of Object.entries(ROUTES)) {
        const html = readFileSync(r(`dist/${app}/index.html`), 'utf8');
        for (const route of routes) {
          const dir = r(`dist/${app}/${route}`);
          mkdirSync(dir, { recursive: true });
          writeFileSync(`${dir}/index.html`, html);
        }
      }
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
  base,
  resolve: {
    alias: [
      { find: 'glyphnav/core', replacement: r('../src/core/index.ts') },
      { find: 'glyphnav/vue-router', replacement: r('../src/vue-router/index.ts') },
      { find: 'glyphnav/react-router', replacement: r('../src/react-router/index.tsx') },
      {
        find: 'glyphnav/tanstack-react-router',
        replacement: r('../src/tanstack-react-router/index.tsx'),
      },
      {
        find: 'glyphnav/tanstack-solid-router',
        replacement: r('../src/tanstack-solid-router/index.ts'),
      },
      { find: 'glyphnav/angular-router', replacement: r('../src/angular-router/index.ts') },
      { find: 'glyphnav', replacement: r('../src/index.ts') },
    ],
  },
  // Don't pre-bundle the Solid router: its `solid`-condition entry is JSX source
  // that must go through vite-plugin-solid (above), not esbuild's pre-bundler.
  optimizeDeps: {
    exclude: ['@tanstack/solid-router'],
  },
  plugins: [
    vue(),
    react({ include: /demo\/(react-router|tanstack-router)\/.*\.tsx?$/ }),
    // Solid has its own JSX runtime, so scope its compiler to the Solid demo —
    // disjoint from the React `include` above (note `tanstack-solid-router` is
    // not matched by `tanstack-router`). The `solid` resolve condition the plugin
    // adds makes `@tanstack/solid-router` resolve to its *JSX source*, so that
    // package's `.jsx` files must be compiled here too (and excluded from
    // pre-bundling below, so they reach this transform instead of esbuild).
    solid({
      include: [/demo\/tanstack-solid-router\/.*\.[tj]sx$/, /@tanstack\/solid-router\/.*\.jsx$/],
    }),
    demoFallback(),
    baseAwareLinks(),
    staticRoutes(),
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
        'tanstack-solid-router': r('tanstack-solid-router/index.html'),
        'angular-router': r('angular-router/index.html'),
      },
    },
  },
});
