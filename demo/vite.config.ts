import { writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import react from '@vitejs/plugin-react';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

const APPS = ['vanilla', 'vue-router', 'react-router', 'tanstack-router', 'angular-router'];

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
 * GitHub Pages serves `<base>/404.html` for any path without a matching file.
 * Send a deep-link reload (e.g. /glyphnav/react-router/docs) back to that app's
 * index so its client router can take over; unknown paths fall back to the
 * picker. Only the exact sub-route is lost on a cold reload — in-app clicks
 * (the demo's main flow) never hit this.
 */
function spaFallback404(): Plugin {
  return {
    name: 'demo-spa-fallback-404',
    apply: 'build',
    closeBundle() {
      const html = `<!doctype html>
<meta charset="utf-8" />
<title>glyphnav</title>
<script>
  (function () {
    var base = ${JSON.stringify(base)};
    var apps = ${JSON.stringify(APPS)};
    var path = location.pathname;
    var rest = path.indexOf(base) === 0 ? path.slice(base.length) : '';
    var app = rest.split('/')[0];
    location.replace(apps.indexOf(app) !== -1 ? base + app + '/' : base);
  })();
</script>
`;
      writeFileSync(r('dist/404.html'), html);
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
      { find: 'glyphnav/angular-router', replacement: r('../src/angular-router/index.ts') },
      { find: 'glyphnav', replacement: r('../src/index.ts') },
    ],
  },
  plugins: [
    vue(),
    react({ include: /demo\/(react-router|tanstack-router)\/.*\.tsx?$/ }),
    demoFallback(),
    baseAwareLinks(),
    spaFallback404(),
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
