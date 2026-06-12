import { resolveOptions } from './options';
import { splitTarget } from './path';
import { scrambleBurst, scrambleFrames } from './scramble';
import type { FrameInfo, GlyphnavOptions } from './types';

/**
 * No frame may stay on screen for less than this. When a total `duration` is
 * set, the frame count is capped at `duration / MIN_FRAME_MS` (the per-frame
 * steps scale up to compensate), so short durations stay snappy instead of
 * flooding `replaceState` with invisible writes.
 */
export const MIN_FRAME_MS = 15;

/** The frame cap implied by a total `duration`, folded into `maxFrames`. */
const frameBudget = (duration: number | null, maxFrames: number): number => {
  if (duration == null) return maxFrames;

  return Math.max(2, Math.min(maxFrames, Math.floor(duration / MIN_FRAME_MS)));
};

/**
 * Generate the full list of address-bar frames for navigating from `from` to
 * `to` — pure and DOM-free. Each frame's `path` is a complete path string
 * (fixed prefix + scrambled text). The current path (`from`) is never emitted
 * as a frame — it is already on screen — and the list always ends with `to`.
 *
 * @param from - The path currently shown in the address bar.
 * @param to - The absolute target path to animate to.
 * @param options - Animation options; unset fields fall back to the defaults.
 * @returns The ordered frames to write to the bar, ending with `to`.
 */
export const generateFrames = (
  from: string,
  to: string,
  options: GlyphnavOptions = {},
): FrameInfo[] => {
  const opts = resolveOptions(options);
  const { prefix, text } = splitTarget(to, {
    scope: opts.scope,
    preserveLeadingSlash: opts.preserveLeadingSlash,
    from,
  });

  const config = {
    charset: opts.charset,
    rng: opts.rng,
    growStep: opts.growStep,
    resolveStep: opts.resolveStep,
    maxFrames: frameBudget(opts.duration, opts.maxFrames),
  };
  const scrambled =
    opts.effect === 'scramble' ? scrambleBurst(text, config) : scrambleFrames(text, config);

  const total = scrambled.length;
  return scrambled.map((frame, index) => ({
    path: prefix + frame.text,
    text: frame.text,
    index,
    total,
    phase: frame.phase,
  }));
};
