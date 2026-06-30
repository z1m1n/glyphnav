// Static export so the App Router demo can be copied into the combined demo/dist
// and served from GitHub Pages alongside the Vite-built demos.
//
// `DEMO_BASE` is threaded through `pnpm demo:build` (the GitHub Pages workflow sets
// it to `/glyphnav/`). The app lives one level under that base, at `<base>next`, so its
// basePath is derived from it — the same source runs at `/next` locally or
// `/glyphnav/next` on the project page. `trailingSlash` makes export emit a real
// folder per route (about/index.html, …) so deep-link reloads serve a real file.
import { createRequire } from 'node:module';
import { glyphnavVersion } from '@glyphnav-demo/shared/internal/version';

const base = process.env.DEMO_BASE ?? '/';
const basePath = (base === '/' ? '' : base.replace(/\/$/, '')) + '/next';

// The framework + view library this demo runs, shown muted in the footer. Read
// from the installed package.json so the label tracks the actual dependency.
const require = createRequire(import.meta.url);
const ver = (name) => require(`${name}/package.json`).version;
const stack = `next ${ver('next')} · react ${ver('react')}`;

// Tooltip for the footer's `.stack` span — spells out the exact versions above
// alongside the glyphnav version, since the footer text alone doesn't repeat it.
const stackTip = `This page runs ${stack}, paired with glyphnav v${glyphnavVersion}.`;

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  // The shared demo helpers ship as TypeScript source, so Next must transpile them.
  transpilePackages: ['@glyphnav-demo/shared'],
  // Exposed to the client so the glyphnav adapter can prefix the base path for
  // `commit: 'after'` (the default `commit: 'before'` reads it back from the URL).
  env: { NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_STACK: stack, NEXT_PUBLIC_STACK_TIP: stackTip },
};

export default config;
