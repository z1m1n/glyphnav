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
