/**
 * Content and helpers shared by every framework demo.
 *
 * Each demo wires up a different router, but the data they display — the glyph
 * charsets, the address-bar readout, the inverted speed slider and the install
 * command — is identical. Keeping it here means a tweak (a new charset, a
 * different slider range) lands once instead of six times. Anything that
 * legitimately differs per framework (router-specific setup snippets, per-page
 * copy) stays in each demo.
 *
 * Imported from `glyphnav/core`, which the demo Vite/TS configs alias to the
 * live `src/` — same as the rest of the playground.
 */

import { HEX, MATRIX, SYMBOLS, URL_SAFE } from 'glyphnav/core';
import type { AnimateScope, CommitTiming, GlyphEffect } from 'glyphnav/core';

/** Glyph pools offered by the `charset` control, keyed by its option value. */
export const charsets: Record<string, string> = {
  url: URL_SAFE,
  hex: HEX,
  matrix: MATRIX,
  symbols: SYMBOLS,
};

/** The live path as it appears in the address bar: pathname + search + hash. */
export const currentUrl = (): string => location.pathname + location.search + location.hash;

// The speed slider runs backwards: dragging right (a larger value) means a
// shorter animation. Both ends sum to SLIDER_SUM, so each direction is one
// subtraction. SLIDER_SUM = slider min (20) + slider max (1000).
const SLIDER_SUM = 1020;

/** Slider position → animation duration in ms (the slider runs backwards). */
export const sliderToDuration = (value: number): number => SLIDER_SUM - value;

/** Animation duration in ms → slider position (inverse of {@link sliderToDuration}). */
export const durationToSlider = (duration: number): number => SLIDER_SUM - duration;

/** The install command shown at the top of every docs page. */
export const DOCS_INSTALL = `pnpm add glyphnav`;

/**
 * The persisted state of a demo's controls toolbar. `charset` is the option
 * *key* (`'url'`, `'hex'`, …), not the resolved glyph pool, so it round-trips
 * through the `<select>` and `localStorage` cleanly.
 */
export interface ToolbarState {
  charset: string;
  duration: number;
  effect: GlyphEffect;
  commit: CommitTiming;
  scope: AnimateScope;
  backForward: boolean;
}

/**
 * Control defaults, before any saved state is restored. `backForward` defaults
 * to `false` to mirror the library: back/forward animation is opt-in for the
 * router adapters (`animatePopState`). The vanilla demo overrides it to `true`,
 * since its `install({ intercept: 'links' })` turns it on by default.
 */
export const DEFAULT_TOOLBAR: ToolbarState = {
  charset: 'url',
  duration: 250,
  effect: 'decode',
  commit: 'before',
  scope: 'full',
  backForward: false,
};

const STORE_PREFIX = 'glyphnav-demo:';

/**
 * Restore a page's saved toolbar state, merged over `defaults`. Each page passes
 * its OWN `key` (its demo name), so the demos never share toolbar state. Safe in
 * SSR/prerender (no `localStorage`) and against malformed stored JSON.
 *
 * @param key - The per-page storage key (e.g. `'vue-router'`, `'core'`).
 * @param defaults - The values to fall back to, also defining the returned shape.
 * @returns The stored values merged over `defaults`.
 */
export function loadToolbar<T extends object>(key: string, defaults: T): T {
  if (typeof localStorage === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(STORE_PREFIX + key);
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<T>) } : defaults;
  } catch {
    return defaults;
  }
}

/**
 * Persist a page's toolbar state under its own `key`. A no-op where storage is
 * unavailable (SSR, private mode, quota), so it never breaks a demo.
 *
 * @param key - The per-page storage key, matching {@link loadToolbar}.
 * @param state - The serialisable control values to store.
 */
export function saveToolbar(key: string, state: object): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORE_PREFIX + key, JSON.stringify(state));
  } catch {
    /* private mode / quota exceeded — non-fatal for a demo */
  }
}

/**
 * Text describing what each toolbar control does. Demos set it as `data-tip`
 * on the control's `<label>`; {@link initTooltips} renders it as a styled
 * top-layer popover (see ./tooltip), replacing the unstyled native `title`.
 */
export const CONTROL_TOOLTIPS = {
  charset:
    'Pool of random glyphs used for the "noise" characters while the URL decodes. Non-URL-safe pools (matrix, symbols) get percent-encoded in the real address bar.',
  speed:
    'Total animation time in milliseconds, spread across every frame. The slider is inverted: drag right for a faster (shorter) animation.',
  effect:
    "'decode' grows the path one glyph at a time, then resolves the real characters left-to-right. 'scramble' bursts to full length immediately, then locks characters in random order.",
  commit:
    "'navigate first' changes the route instantly and decodes the bar on top; 'animate first' plays the animation, then performs the real navigation.",
  scope:
    "'full' animates the whole path; 'tail' keeps the prefix shared with the current path and animates only the part that differs.",
  backForward:
    'Also animate the browser Back/Forward buttons (history traversals), not just link clicks and programmatic navigation.',
} as const;
