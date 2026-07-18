/**
 * Scramble the brand wordmark in the page header once, on load — glyphnav
 * dogfooding itself. Every demo's `<h1>` carries a `.wordmark` (the "glyphnav"
 * link, or a bare span on the landing page); this scrambles it into place with
 * the same core engine that animates the address bar (see glyph-text.ts).
 *
 * Framework-agnostic and idempotent: call it once the header is in the DOM
 * (after mount / on DOMContentLoaded). A `data-` marker guards against a second
 * run, so React StrictMode's double-invoke, hot reloads and re-mounts never
 * re-trigger it — it fires exactly once per page load, as intended.
 */

import { LOWER_ALPHA } from 'glyphnav/core';
import { createGlyphText } from './glyph-text';
import type { TextEffectOptions } from './glyph-text';

/**
 * A fast `scramble`: the wordmark bursts to full length, then the real letters
 * lock in at random positions while the rest keep flickering over the lowercase
 * pool — so "glyphnav" reads as noise settling into place. Kept short so the
 * header resolves almost at once.
 */
const WORDMARK_EFFECT: TextEffectOptions = {
  charset: LOWER_ALPHA,
  duration: 350,
  effect: 'scramble',
};

/**
 * Run the one-shot wordmark scramble. No-op when there is no header wordmark or
 * it has already played (or when the DOM isn't available, e.g. during SSR).
 *
 * @param selector - The header wordmark element. Defaults to `.wordmark`.
 */
export function initWordmark(selector = '.wordmark'): void {
  if (typeof document === 'undefined') return;

  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;

  // Fire exactly once per element — the marker survives framework re-renders
  // (the wordmark text is static markup, so nothing overwrites it) and blocks
  // any repeat call.
  if (el.dataset.wordmarkDecoded != null) return;
  el.dataset.wordmarkDecoded = '';

  const target = (el.textContent ?? '').trim();
  if (!target) return;

  // Every frame is a full-length run of random glyphs, but their widths vary;
  // pin the wordmark to its rendered width for the run so the breadcrumb "/",
  // the demo crumb and the version tag beside it don't reflow as it flickers.
  const reserved = el.getBoundingClientRect().width;
  const prevMinWidth = el.style.minWidth;
  if (reserved > 0) el.style.minWidth = `${reserved}px`;

  void createGlyphText(el)
    .run(target, WORDMARK_EFFECT)
    .finally(() => {
      el.style.minWidth = prevMinWidth;
    });
}
