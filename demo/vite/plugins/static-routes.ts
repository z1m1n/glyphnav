import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { DEMO_ROUTES } from '../apps';
import { fromDemoRoot } from '../paths';

/**
 * Give every client route a real file for GitHub Pages. Pages serves only static
 * files, so a cold reload of a route like `/react-router/docs` has no matching
 * file and would 404. After the bundle, each app's built `index.html` is copied
 * into a real folder per sub-route ({@link DEMO_ROUTES}); the reload then serves a
 * real file, the SPA boots, and its router reads `location` and renders the route
 * — the ordinary SPA path, no redirect/restore round-trip. `?query`/`#hash` never
 * reach the filesystem, so they survive untouched.
 *
 * @returns The build-only plugin.
 */
export function staticRoutes(): Plugin {
  return {
    name: 'demo-static-routes',
    apply: 'build',
    closeBundle() {
      for (const [app, routes] of Object.entries(DEMO_ROUTES)) {
        const html = readFileSync(fromDemoRoot(`dist/${app}/index.html`), 'utf8');
        
        for (const route of routes) {
          const dir = fromDemoRoot(`dist/${app}/${route}`);

          mkdirSync(dir, { recursive: true });
          writeFileSync(`${dir}/index.html`, html);
        }
      }
    },
  };
}
