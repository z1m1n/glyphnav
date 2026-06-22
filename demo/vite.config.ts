import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin, ProxyOptions } from 'vite';
import vue from '@vitejs/plugin-vue';
import react from '@vitejs/plugin-react';
import solid from 'vite-plugin-solid';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

/**
 * Dev proxy for a demo that runs on its own server (Next, Nuxt). Forwards the
 * picker link to that server; if it isn't running, replies with a hint rather
 * than an opaque error or the silently-wrong SPA-fallback picker.
 */
function devProxy(target: string, name: string, command: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    ws: true,
    configure(proxy) {
      proxy.on('error', (_err, _req, res) => {
        if (!('writeHead' in res)) {
          res.destroy(); // a WebSocket upgrade (Socket), not an HTTP response
          return;
        }
        if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/html' });
        res.end(
          `<!doctype html><meta charset="utf-8">` +
            `<body style="font:15px ui-monospace,monospace;max-width:40rem;margin:3rem auto;padding:0 1.25rem">` +
            `<h2>/${name} isn't running</h2>` +
            `<p>This demo has its own dev server. Start it in another terminal:</p>` +
            `<pre style="background:#f2f2f2;padding:.6rem .9rem">${command}</pre>` +
            `<p>…then revisit this link, or start everything at once with ` +
            `<code>pnpm demo</code>. To preview the built site instead:</p>` +
            `<pre style="background:#f2f2f2;padding:.6rem .9rem">pnpm demo:build && pnpm demo:preview</pre>` +
            `<p><a href="/">← back to the picker</a></p>`,
        );
      });
    },
  };
}

const APPS = [
  'vanilla',
  'vue-router',
  'react-router',
  'tanstack-router/react',
  'tanstack-router/solid',
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
    vanilla: ['about', 'docs', 'contact', 'core'],
    'vue-router': ['about', 'features', 'docs'],
    'react-router': ['about', 'docs', 'blog'],
    'tanstack-router/react': ['about', 'posts', 'docs'],
    'tanstack-router/solid': ['about', 'posts', 'docs'],
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
        find: 'glyphnav/tanstack-router/react',
        replacement: r('../src/tanstack-router/react/index.tsx'),
      },
      {
        find: 'glyphnav/tanstack-router/solid',
        replacement: r('../src/tanstack-router/solid/index.ts'),
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
  // `pnpm demo` starts all eight demos at once (`run-p demo:vite demo:next
  // demo:nuxt`). This Vite server hosts the six Vite-based demos; Next and Nuxt
  // run on their own dev servers (5174, 5176) and are proxied here so the combined
  // picker works at one origin. `strictPort` makes a stale 5173 fail loudly rather
  // than silently moving the picker to another port. The `/next` and `/nuxt`
  // prefixes are unique to those apps (and their `_next`/`_nuxt` assets), so
  // nothing else is caught. `pnpm demo:vite` runs just this server.
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/next': devProxy('http://localhost:5174', 'next', 'pnpm demo:next'),
      '/nuxt': devProxy('http://localhost:5176', 'nuxt', 'pnpm demo:nuxt'),
    },
  },
  // `vite preview` serves the built demo/dist, which already contains the
  // statically-exported next/ and nuxt/ folders (copied in by `demo:build`).
  // But Vite defaults `preview.proxy` to `server.proxy`, so without this the
  // preview server would proxy /next and /nuxt to the dev servers on 5174/5176
  // — not running during a preview — and answer every link with the devProxy
  // "isn't running" 502 instead of the real static page. Override with an empty
  // proxy so those paths fall through to the static files.
  preview: {
    proxy: {},
  },
  plugins: [
    vue(),
    react({ include: /demo\/(react-router|tanstack-router\/react)\/.*\.tsx?$/ }),
    // Solid has its own JSX runtime, so scope its compiler to the Solid demo —
    // disjoint from the React `include` above (the React glob is scoped to
    // `tanstack-router/react`, so the sibling `tanstack-router/solid` is not
    // matched). The `solid` resolve condition the plugin adds makes
    // `@tanstack/solid-router` resolve to its *JSX source*, so that package's
    // `.jsx` files must be compiled here too (and excluded from pre-bundling
    // below, so they reach this transform instead of esbuild).
    solid({
      include: [/demo\/tanstack-router\/solid\/.*\.[tj]sx$/, /@tanstack\/solid-router\/.*\.jsx$/],
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
        'tanstack-router/react': r('tanstack-router/react/index.html'),
        'tanstack-router/solid': r('tanstack-router/solid/index.html'),
        'angular-router': r('angular-router/index.html'),
      },
    },
  },
});
