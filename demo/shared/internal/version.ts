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

/**
 * The footer `.stack` tooltip copy — the exact package versions a page runs,
 * restated with each token wrapped in `<code>` so the tip highlights them just
 * like the inline-code chips in the demos' body text. The tip is rendered as
 * HTML (see demo/shared/tooltip.ts); `stack` is the footer's own ` · `-separated
 * label, so every segment becomes a chip and the glyphnav version its own. Kept
 * here, beside {@link glyphnavVersion}, so all four build pipelines (Vite, Next,
 * Nuxt, SvelteKit) format the tip identically and it can't drift between demos.
 *
 * @param stack - The footer label, e.g. `solid-js 1.9.13 · @solidjs/router 0.16.1`.
 * @returns The tooltip HTML.
 */
export const stackTip = (stack: string): string =>
  `This page runs ${stack
    .split(' · ')
    .map((part) => `<code>${part}</code>`)
    .join(' · ')}, paired with <code>glyphnav v${glyphnavVersion}</code>.`;
