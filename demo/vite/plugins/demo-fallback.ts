import type { Plugin } from 'vite';
import { APP_NAMES } from '../apps';

/**
 * Route each demo's sub-paths to that demo's `index.html` in dev. Vite's default
 * SPA fallback serves the root `index.html` for every unknown path, so reloading
 * a deep link like `/react-router/docs` would otherwise land on the picker.
 *
 * @returns The dev-only fallback plugin.
 */
export function demoFallback(): Plugin {
  return {
    name: 'demo-spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = (req.url ?? '').split('?')[0];
        const app = APP_NAMES.find((name) => url.startsWith(`/${name}/`));

        if (app && !url.includes('.')) {
          req.url = `/${app}/index.html`;
        }
        
        next();
      });
    },
  };
}
