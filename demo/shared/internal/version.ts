import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * glyphnav's own version, read once from the repo root manifest. Every build
 * pipeline (the combined Vite playground, SvelteKit, Next.js, Nuxt) imports
 * this instead of re-reading `package.json` itself, so the footer tooltip's
 * "paired with glyphnav vX" text can't drift between demos.
 *
 * Node-only (`node:fs`) and never imported by browser code — kept out of
 * `./index.ts`, the client-facing barrel, for that reason.
 */
export const glyphnavVersion = (
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8'),
  ) as { version: string }
).version;
