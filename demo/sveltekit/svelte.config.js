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
    paths: { base },
    prerender: {
      // The breadcrumb links out of the app to the picker, which isn't a route —
      // warn (don't fail the prerender) on that expected miss.
      handleHttpError: 'warn',
      // The `?query+#hash` deep link points at `#results` to show off hash
      // animation, not to scroll to a real anchor — don't fail on the missing id.
      handleMissingId: 'warn',
    },
  },
};
