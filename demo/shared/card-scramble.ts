/**
 * Scramble a picker card's name on hover — glyphnav dogfooding itself once more.
 * Every `.card` on the landing page carries a `.card-name` (the adapter name);
 * pointing into a card decodes that name through the same core engine that
 * animates the address bar (see glyph-text.ts), then settles back to the real
 * name. It's the header wordmark's on-load scramble (wordmark.ts), re-aimed at
 * the grid and triggered by the pointer instead of page load.
 *
 * Landing-page only — the picker grid lives in demo/index.html — so it's wired
 * from demo/main.ts rather than the shared header init. Idempotent: binding is
 * one listener per card, and a new run supersedes any in-flight one.
 */

import { LOWER_ALPHA } from 'glyphnav/core';
import { createGlyphText } from './glyph-text';
import type { TextEffectOptions } from './glyph-text';

/**
 * A quick `scramble` over the lowercase pool — short enough to resolve almost as
 * fast as the pointer lands, roughly in step with the card's own 0.22s hover
 * transitions. `scramble` (not `decode`) because it bursts to full length from
 * the first frame, so the name never grows and reflows its card mid-run.
 * Lowercase-only since every adapter name already is (`vue-router`,
 * `tanstack-router/react`), so the noise reads as that alphabet settling in.
 */
const CARD_EFFECT: TextEffectOptions = {
  charset: LOWER_ALPHA,
  duration: 260,
  effect: 'scramble',
};

/**
 * Wire the hover-scramble onto every picker card. No-op when the DOM isn't
 * available (e.g. during SSR) or a card has no `.card-name`.
 *
 * @param selector - The cards to animate. Defaults to the landing-page picker
 * cards.
 */
export function initCardScramble(selector = '.card'): void {
  if (typeof document === 'undefined') return;

  for (const card of document.querySelectorAll<HTMLElement>(selector)) {
    const name = card.querySelector<HTMLElement>('.card-name');
    if (!name) continue;

    // The real name is static markup; capture it once so every run resolves back
    // to it, no matter which frame a previous run left on screen.
    const target = (name.textContent ?? '').trim();
    if (!target) continue;

    // One animator per card: createGlyphText reuses a single Player, so a fresh
    // run() on re-entry cleanly cancels the previous one — rapid in/out never
    // overlaps writes, and leaving mid-run still lands on the real name.
    const glyph = createGlyphText(name);
    card.addEventListener('pointerenter', () => {
      void glyph.run(target, CARD_EFFECT);
    });
  }
}
