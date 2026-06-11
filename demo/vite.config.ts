import { writeFileSync } from 'node:fs';
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
 * GitHub Pages is static — there is no server-side rewrite rule to reach for, so
 * deep-link reloads (e.g. /glyphnav/react-router/docs) hit `<base>/404.html`.
 * This 404 page bounces the request to the matching app's index, encoding the
 * sub-route (and any `?query`/`#hash`) into the URL so the full path survives:
 * `/glyphnav/react-router/docs` → `/glyphnav/react-router/?/docs`. The restore
 * snippet injected by {@link deepLinkRestore} then rewrites the bar back to the
 * real path before the SPA boots, so a reload keeps the exact route instead of
 * resetting to the app's home. Unknown apps fall back to the picker.
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
    var loc = window.location;
    var rest = loc.pathname.indexOf(base) === 0 ? loc.pathname.slice(base.length) : '';
    var app = rest.split('/')[0];
    if (apps.indexOf(app) === -1) {
      loc.replace(base);
      return;
    }
    // "&" in the original query is escaped to ~and~ so it survives as a single
    // value; the restore snippet reverses it. The leading "?/" is the marker.
    var deep = rest.slice(app.length).replace(/^\\//, '').replace(/&/g, '~and~');
    var query = loc.search ? '&' + loc.search.slice(1).replace(/&/g, '~and~') : '';
    loc.replace(base + app + '/?/' + deep + query + loc.hash);
  })();
</script>
`;
      writeFileSync(r('dist/404.html'), html);
    },
  };
}

/**
 * Injected into every demo page. If GitHub Pages bounced a deep link through
 * {@link spaFallback404}, the URL arrives as `/base/app/?/route&query`; rewrite
 * the bar back to `/base/app/route?query` with `replaceState` before the SPA
 * router (or the vanilla view) reads `location`. A normal `?query` (one that
 * does not start with `?/`) is left untouched, so this is inert on direct loads
 * and in dev, where the fallback never fires.
 */
function deepLinkRestore(): Plugin {
  const restore =
    `(function(l){if(l.search[1]==='/'){` +
    `var d=l.search.slice(1).split('&').map(function(s){return s.replace(/~and~/g,'&')}).join('?');` +
    `history.replaceState(null,'',l.pathname.slice(0,-1)+d+l.hash)}})(window.location)`;
  return {
    name: 'demo-deep-link-restore',
    transformIndexHtml() {
      return [{ tag: 'script', children: restore, injectTo: 'head-prepend' }];
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
    deepLinkRestore(),
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
        'tanstack-solid-router': r('tanstack-solid-router/index.html'),
        'angular-router': r('angular-router/index.html'),
      },
    },
  },
});
