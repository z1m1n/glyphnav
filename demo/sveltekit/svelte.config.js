import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Served under `<DEMO_BASE>sveltekit/` so the static export sits alongside the
// other demos in the combined deploy. `DEMO_BASE` is threaded through by
// `pnpm demo:build` (the GitHub Pages workflow sets it to `/glyphnav/`), so the
// same source runs at `/sveltekit/` locally or `/glyphnav/sveltekit/` on Pages.
const demoBase = process.env.DEMO_BASE ?? '/';
const base = (demoBase === '/' ? '' : demoBase.replace(/\/$/, '')) + '/sveltekit';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // Static export: every route is prerendered to a real file (see
    // src/routes/+layout.ts), with a 404.html SPA fallback so any uncrawled
    // deep-link reload still boots on GitHub Pages' static host.
    adapter: adapter({ fallback: '404.html' }),
    // Keep links absolute under this configured deployment prefix, including
    // breadcrumb links out of the app during prerender.
    paths: { base, relative: false },
    alias: {
      'glyphnav/sveltekit': '../../src/sveltekit/index.ts',
      'glyphnav/core': '../../src/core/index.ts',
      glyphnav: '../../src/index.ts',
    },
    prerender: {
      // Ignore only the known links to the surrounding site's pages. Missing
      // routes inside this app (and every other HTTP failure) fail the build.
      handleHttpError: ({ status, path, message }) => {
        if (status === 404 && [demoBase, `${demoBase}changelog/`].includes(path)) return;
        throw new Error(message);
      },
      // This one demo link intentionally shows hash animation without a target.
      handleMissingId: ({ path, id, message }) => {
        if (path === `${base}/about/` && id === 'results') return;
        throw new Error(message);
      },
    },
  },
};
