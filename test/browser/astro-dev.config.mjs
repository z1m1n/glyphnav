import astroConfig from '../../demo/astro/astro.config';

// The browser suite can run alongside `pnpm demo` without replacing its cache.
export default {
  ...astroConfig,
  vite: {
    ...astroConfig.vite,
    cacheDir: './node_modules/.vite-browser-astro',
  },
};
