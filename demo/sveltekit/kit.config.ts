import adapter from '@sveltejs/adapter-static';
import type { Config } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// One source runs at /sveltekit locally and /glyphnav/sveltekit on Pages.
const demoBase = process.env.DEMO_BASE ?? '/';
const base = `${demoBase.replace(/\/$/, '')}/sveltekit` as `/${string}`;

// SvelteKit 3 reads project options from the Vite plugin.
export const kitConfig = {
  preprocess: vitePreprocess(),
  adapter: adapter({ fallback: '404.html' }),
  paths: { base, relative: false },
  prerender: {
    // Only the surrounding site's known pages may sit outside this export.
    handleHttpError: ({ status, path, message }) => {
      if (status === 404 && [demoBase, `${demoBase}changelog/`].includes(path)) return;
      throw new Error(message);
    },
    // This demo link intentionally shows hash animation without a target.
    handleMissingId: ({ path, id, message }) => {
      if (path === `${base}/about/` && id === 'results') return;
      throw new Error(message);
    },
  },
} satisfies Config;
