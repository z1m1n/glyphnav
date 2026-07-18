/**
 * Scramble the brand line in the page header once, on load — glyphnav
 * dogfooding itself. Every demo's `<h1>` carries a `.wordmark` (the "glyphnav"
 * link, or a bare span on the landing page); the inner demo pages also carry a
 * `.crumb` (the current demo's name, after the "/"). Both scramble into place
 * with the same core engine that animates the address bar (see glyph-text.ts).
 *
 * Framework-agnostic and idempotent: call it once the header is in the DOM
 * (after mount / on DOMContentLoaded) — and after `initFwMenu()`, which reads
 * the crumb's real text to build its menu before this rewrites it. A `data-`
 * marker guards each element against a second run, so React StrictMode's
 * double-invoke, hot reloads and re-mounts never re-trigger it — it fires
 * exactly once per page load, as intended.
 */

import { LOWER_ALPHA } from 'glyphnav/core';
import { createGlyphText } from './glyph-text';
import type { TextEffectOptions } from './glyph-text';

/**
 * A fast `scramble`: the text bursts to full length, then the real letters lock
 * in at random positions while the rest keep flickering over the lowercase pool
 * — so the wordmark and crumb read as noise settling into place. Kept short so
 * the header resolves almost at once.
 */
const WORDMARK_EFFECT: TextEffectOptions = {
  charset: LOWER_ALPHA,
  duration: 350,
  effect: 'scramble',
};

/**
 * Scramble every header brand element into place once. No-op for anything that
 * has already played (or when the DOM isn't available, e.g. during SSR).
 *
 * @param selector - The header elements to animate. Defaults to the wordmark and
 * the breadcrumb crumb; both run together with the same effect.
 */
export function initWordmark(selector = '.wordmark, .crumb'): void {
  if (typeof document === 'undefined') return;

  for (const el of document.querySelectorAll<HTMLElement>(selector)) scramble(el);
}

/**
 * Scramble one element into its own current text, once, without reflowing its
 * neighbours.
 *
 * @param el - The element whose text to scramble in place.
 */
function scramble(el: HTMLElement): void {
  // Fire exactly once per element — the marker survives framework re-renders
  // (the text is static markup, so nothing overwrites it) and blocks any repeat.
  if (el.dataset.glyphScrambled != null) return;
  el.dataset.glyphScrambled = '';

  const target = (el.textContent ?? '').trim();
  if (!target) return;

  // Every frame is a full-length run of random glyphs, but their widths vary;
  // pin the element to its rendered width for the run so its neighbours (the
  // breadcrumb "/", the switcher button, the version tag) don't reflow as it
  // flickers.
  const reserved = el.getBoundingClientRect().width;
  const prevMinWidth = el.style.minWidth;
  if (reserved > 0) el.style.minWidth = `${reserved}px`;

  void createGlyphText(el)
    .run(target, WORDMARK_EFFECT)
    .finally(() => {
      el.style.minWidth = prevMinWidth;
    });
}
