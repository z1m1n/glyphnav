/**
 * Drive a glyph-scramble on arbitrary text — the same core engine that animates
 * the address bar, pointed at a DOM node instead of `history`.
 *
 * glyphnav's URL animation is really just two core pieces: `generateFrames()`
 * turns "from → to" into the list of in-between strings, and a `Player` ticks
 * through them on a timer. The address-bar adapter writes each frame to
 * `history.replaceState`; here we write `frame.text` to `el.textContent`. Same
 * frames, same knobs (charset, effect, duration) — different sink.
 */

import { createPlayer, generateFrames, MIN_FRAME_MS, prefersReducedMotion } from 'glyphnav/core';
import type { GlyphEffect } from 'glyphnav/core';

/** Per-run options — the same three knobs the demo's controls expose. */
export interface TextEffectOptions {
  /** Glyph pool for the "noise" characters. */
  charset: string;
  /** Total animation time in ms, spread across the frames. */
  duration: number;
  /** `'decode'` grows + resolves; `'scramble'` bursts, then locks randomly. */
  effect: GlyphEffect;
}

/** A glyph-text animator bound to one element. */
export interface GlyphText {
  /** Scramble the element into `target`. A new call supersedes any in-flight run. */
  run(target: string, options: TextEffectOptions): Promise<void>;
  /** Stop the current run, leaving whatever frame is on screen. */
  cancel(): void;
}

/**
 * Bind a glyph-text animator to one element. Reuses a single {@link createPlayer}
 * Player, so each `run()` cleanly cancels the previous one (no overlapping
 * writes to the same node).
 *
 * @param el - The element whose `textContent` the frames are written to.
 * @returns A {@link GlyphText} controller for that element.
 */
export function createGlyphText(el: HTMLElement): GlyphText {
  const player = createPlayer();

  return {
    async run(target, { charset, duration, effect }): Promise<void> {
      // Same courtesy the address-bar controller extends: honour the OS
      // reduced-motion setting by snapping straight to the final text.
      if (prefersReducedMotion()) {
        player.cancel();
        el.textContent = target;
        return;
      }

      // `preserveLeadingSlash: false` + a non-path target means the *whole*
      // string scrambles: there is no URL prefix to hold fixed, so every
      // `frame.text` is a full in-between rendering of the target text.
      const frames = generateFrames('', target, {
        charset,
        duration,
        effect,
        preserveLeadingSlash: false,
      });
      if (frames.length === 0) {
        el.textContent = target;
        return;
      }

      // The exact per-frame delay the address-bar controller uses: the total
      // duration spread over the frames, never below MIN_FRAME_MS.
      const step = Math.max(MIN_FRAME_MS, duration / Math.max(1, frames.length - 1));
      await player.play(frames.length, step, (i) => {
        el.textContent = frames[i].text;
      });
    },

    cancel(): void {
      player.cancel();
    },
  };
}
