import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { stackTip } from '@glyphnav-demo/shared/internal/version';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { ports } from '../ports';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));
const nodeRequire = createRequire(import.meta.url);

/** An installed dependency's version, read from its package.json (exports-safe). */
const ver = (name: string): string => {
  try {
    return (nodeRequire(`${name}/package.json`) as { version: string }).version;
  } catch {
    let dir = dirname(nodeRequire.resolve(name));
    for (;;) {
      const file = join(dir, 'package.json');
      if (existsSync(file)) {
        const { version } = JSON.parse(readFileSync(file, 'utf8')) as { version?: string };
        if (version) return version;
      }
      const parent = dirname(dir);
      if (parent === dir) return '';
      dir = parent;
    }
  }
};

// The framework + view library this demo runs, shown muted in the footer.
const stack = `sveltekit ${ver('@sveltejs/kit')} · svelte ${ver('svelte')}`;

export default defineConfig({
  plugins: [sveltekit()],
  // Surfaced to the client so the footer can show which stack this demo runs and
  // explain it in a tooltip — the versions above, each in a `<code>` chip
  // alongside the glyphnav version (see stackTip).
  define: {
    GLYPHNAV_STACK: JSON.stringify(stack),
    GLYPHNAV_STACK_TIP: JSON.stringify(stackTip(stack)),
  },
  // Port read from demo/.env via demo/ports.ts, so it and the picker proxy
  // (`/sveltekit`) always point at the same place.
  server: { port: ports.sveltekit, strictPort: true, open: false },
  preview: { port: ports.sveltekit, open: false },
  // Alias the glyphnav entry points to the live src (like the Vite playground),
  // so the demo reflects the working tree rather than the published dist.
  resolve: {
    alias: [
      { find: 'glyphnav/sveltekit', replacement: r('../../src/sveltekit/index.ts') },
      { find: 'glyphnav/core', replacement: r('../../src/core/index.ts') },
      { find: 'glyphnav', replacement: r('../../src/index.ts') },
    ],
  },
  // The shared helpers and aliased glyphnav are TypeScript source, so bundle
  // (don't externalize) them for SSR/prerender — otherwise Node would try to
  // import the raw `.ts` during the static export.
  ssr: { noExternal: ['@glyphnav-demo/shared', 'glyphnav', 'glyphnav/core', 'glyphnav/sveltekit'] },
});
