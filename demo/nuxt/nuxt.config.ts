// Static site generation (`nuxi generate`) so the Nuxt demo can be copied into
// the combined demo/dist and served from GitHub Pages alongside the others.
//
// `DEMO_BASE` is threaded through `pnpm demo:build` (the GitHub Pages workflow sets
// it to `/glyphnav/`). The app lives one level under that base, at `<base>nuxt/`, so its
// `app.baseURL` is derived from it — the same source runs at `/nuxt/` locally or
// `/glyphnav/nuxt/` on the project page. Nuxt emits a real folder per route, so
// deep-link reloads serve a real file.
import { fileURLToPath } from 'node:url';

const base = process.env.DEMO_BASE ?? '/';
const baseURL = (base === '/' ? '/' : base) + 'nuxt/';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineNuxtConfig({
  ssr: true,
  app: { baseURL },
  css: ['@glyphnav-demo/shared/styles.css'],
  devtools: { enabled: false },
  // No phoning home from the demo.
  telemetry: false,
  // Pin the dev server to the port the picker proxies (`/nuxt` → :5176). Listhen
  // still silently falls back if 5176 is held by a stale instance — see the note
  // in the README about running a single `pnpm demo`.
  devServer: { port: 5176 },
  compatibilityDate: '2024-11-01',
  // This is a plain prerendered demo: no route rules and no client-side payload
  // cache, so the app manifest buys nothing. Disabling it removes the `#app-manifest`
  // virtual module, whose Vite pre-transform resolve fails (and can hang dev) when a
  // second Nuxt instance shares this project's `.nuxt` dir.
  experimental: { appManifest: false },
  // The shared demo helpers ship as TypeScript source, so Nuxt must transpile them.
  build: { transpile: ['@glyphnav-demo/shared'] },
  // Alias the glyphnav entry points to the live src (like the Vite playground),
  // so the demo reflects the working tree and Vite compiles the TS directly —
  // rather than re-bundling the published dist through the workspace symlink.
  alias: {
    'glyphnav/core': r('../../src/core/index.ts'),
    'glyphnav/nuxt': r('../../src/nuxt/index.ts'),
  },
  // Crawl from '/' so every NuxtLink-reachable route is prerendered to a file.
  // The breadcrumb links *out* of the app to the picker (e.g. /glyphnav/), which
  // is not a Nuxt route — `failOnError: false` keeps that expected 404 from
  // aborting the generate while every real page still prerenders.
  nitro: { prerender: { crawlLinks: true, routes: ['/'], failOnError: false } },
});
