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
import type { AnimateScope, CommitTiming, GlyphEffect, GlyphnavOptions } from 'glyphnav/core';

/** Glyph pools offered by the `charset` control, keyed by its option value. */
export const charsets: Record<string, string> = {
  url: URL_SAFE,
  hex: HEX,
  matrix: MATRIX,
  symbols: SYMBOLS,
};

/** The live path as it appears in the address bar: pathname + search + hash. */
export const currentUrl = (): string => location.pathname + location.search + location.hash;

/** The speed slider's range, shared by every demo's `<input type="range">`. */
export const SPEED_SLIDER = { min: 20, max: 1000, step: 10 } as const;

// The speed slider runs backwards: dragging right (a larger value) means a
// shorter animation. Both ends sum to SLIDER_SUM, so each direction is one
// subtraction.
const SLIDER_SUM = SPEED_SLIDER.min + SPEED_SLIDER.max;

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

/**
 * Build the `controller.update()` payload from a toolbar state: the resolved
 * glyph pool plus hooks that mirror the animation into a demo's address-bar
 * readout. Every demo hands the controller exactly this object; only the way
 * the readout is stored (React state, Vue ref, Angular signal, plain DOM)
 * differs, and that's what `showPath` abstracts.
 *
 * @param state - The toolbar values to apply (`charset` is the option key).
 * @param showPath - Called with the path to display and whether the run is in
 *   its resolve phase; `(currentUrl(), false)` once the run settles.
 * @param onSettled - Extra work after the settled `showPath` call (e.g. the
 *   Next demo re-reads `location.search + location.hash` for its tab state).
 * @returns The options object for `controller.update()`.
 */
export function glyphnavOptions(
  state: Omit<ToolbarState, 'backForward'>,
  showPath: (path: string, resolving: boolean) => void,
  onSettled?: () => void,
): GlyphnavOptions {
  return {
    charset: charsets[state.charset],
    duration: state.duration,
    effect: state.effect,
    commit: state.commit,
    scope: state.scope,
    hooks: {
      onFrame: (f) => showPath(f.path, f.phase === 'resolve'),
      onComplete: () => {
        showPath(currentUrl(), false);
        onSettled?.();
      },
    },
  };
}

/**
 * Bookkeeping for the opt-in back/forward animation: returns a setter that
 * attaches the popstate listener when flipped on and detaches it (via the
 * cleanup `enable` returned) when flipped off. Idempotent, so it can be driven
 * straight from a checkbox/watcher without tracking the listener yourself.
 *
 * @param enable - Attaches the listener and returns its cleanup — pass
 *   `() => controller.enableHistoryAnimation()`.
 * @returns A setter applying the desired on/off state.
 */
export function createHistoryToggle(enable: () => () => void): (on: boolean) => void {
  let stop: (() => void) | null = null;
  return (on) => {
    if (on && !stop) {
      stop = enable();
    } else if (!on && stop) {
      stop();
      stop = null;
    }
  };
}

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
 *
 * The copy may include `<code>` markup — the tip renders as HTML, so the option
 * values it names (`decode`, `tail`, …) get the same inline-code chip as the
 * demos' body text. Escape any literal `<`/`>` as entities, as in the demos.
 */
export const CONTROL_TOOLTIPS = {
  charset:
    'Pool of random glyphs used for the "noise" characters while the URL decodes. Non-URL-safe pools (<code>matrix</code>, <code>symbols</code>) get percent-encoded in the real address bar.',
  speed:
    'Total animation time in milliseconds, spread across every frame. The slider is inverted: drag right for a faster (shorter) animation.',
  effect:
    '<code>decode</code> grows the path one glyph at a time, then resolves the real characters left-to-right. <code>scramble</code> bursts to full length immediately, then locks characters in random order.',
  commit:
    '<code>navigate first</code> changes the route instantly and decodes the bar on top; <code>animate first</code> plays the animation, then performs the real navigation.',
  scope:
    '<code>full</code> animates the whole path; <code>tail</code> keeps the prefix shared with the current path and animates only the part that differs.',
  backForward:
    'Also animate the browser Back/Forward buttons (history traversals), not just link clicks and programmatic navigation.',
} as const;

/** A `<select>` option: the submitted value and its visible label. */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * The options of each toolbar `<select>`, shared so every demo offers the same
 * choices under the same labels. Each framework maps these into `<option>`
 * elements in its own template syntax. (The vanilla and /core demos keep
 * literal `<option>`s in their static HTML — no build step touches those.)
 */
export const TOOLBAR_SELECTS: Record<'charset' | 'effect' | 'commit' | 'scope', SelectOption[]> = {
  charset: [
    { value: 'url', label: 'url-safe' },
    { value: 'hex', label: 'hex' },
    { value: 'matrix', label: 'matrix' },
    { value: 'symbols', label: 'symbols' },
  ],
  effect: [
    { value: 'decode', label: 'decode' },
    { value: 'scramble', label: 'scramble' },
  ],
  commit: [
    { value: 'before', label: 'navigate first' },
    { value: 'after', label: 'animate first' },
  ],
  scope: [
    { value: 'full', label: 'full' },
    { value: 'tail', label: 'tail' },
  ],
};

/**
 * The `<GlyphnavProvider …options>` listing on the docs page of every
 * provider-based adapter demo (React Router, Solid Router, TanStack Router on
 * React and Solid). Those adapters accept the same options with the same
 * defaults, so the snippet is identical; adapters with extra options (Next's
 * `routerMode`, preact-iso's `interceptLinks`) keep their own variant.
 */
export const DOCS_PROVIDER_OPTIONS = `<GlyphnavProvider
  duration={250}        // total animation time (ms), spread over all frames
  effect="scramble"     // 'decode' grows + resolves; 'scramble' bursts, then locks randomly
  commit="before"       // navigate instantly, animate on top ('after' = classic order)
  charset={MATRIX}      // glyph pool — URL_SAFE stays readable in the bar
  scope="tail"          // animate only the part that differs from the current path
  animatePopState       // also animate browser back/forward (opt-in)
>`;
