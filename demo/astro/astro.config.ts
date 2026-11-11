import { defineConfig } from 'astro/config';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { stackTip } from '@glyphnav-demo/shared/internal/version';
import { ports } from '../ports';

const nodeRequire = createRequire(import.meta.url);
const stack = `astro ${nodeRequire('astro/package.json').version}`;
const source = (path: string): string => fileURLToPath(new URL(path, import.meta.url));
const demoBase = process.env.DEMO_BASE ?? '/';

export default defineConfig({
  site: 'https://z1m1n.github.io',
  base: `${demoBase.replace(/\/$/, '')}/astro`,
  output: 'static',
  trailingSlash: 'always',
  server: { port: ports.astro, host: 'localhost' },
  vite: {
    server: { strictPort: true },
    define: {
      GLYPHNAV_STACK: JSON.stringify(stack),
      GLYPHNAV_STACK_TIP: JSON.stringify(stackTip(stack)),
    },
    resolve: {
      alias: [
        { find: 'glyphnav/astro', replacement: source('../../src/astro/index.ts') },
        { find: 'glyphnav/core', replacement: source('../../src/core/index.ts') },
        { find: 'glyphnav', replacement: source('../../src/index.ts') },
      ],
    },
    ssr: { noExternal: ['@glyphnav-demo/shared', 'glyphnav'] },
  },
});
