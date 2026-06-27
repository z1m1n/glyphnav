import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const demoRoot = fileURLToPath(new URL('..', import.meta.url));

/**
 * Resolve a path against the demo root (`demo/`) — the directory that hosts the
 * Vite playground and every demo entry. A `..`-prefixed path reaches the repo.
 *
 * @param path - Path relative to `demo/`.
 * @returns The absolute filesystem path.
 */
export const fromDemoRoot = (path: string): string => join(demoRoot, path);

/**
 * Deploy base for the demo, `/` in dev. The GitHub Pages workflow sets
 * `DEMO_BASE=/glyphnav/` for the project page; every app threads this through its
 * router basename and `import.meta.env.BASE_URL`, so one source runs at either base.
 */
export const base = process.env.DEMO_BASE ?? '/';
