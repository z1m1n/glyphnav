import type { Rng } from './rng';
import type { AnimationPhase } from './types';

/** A single scrambled string plus the phase that produced it. */
export interface ScrambleFrame {
  text: string;
  phase: AnimationPhase;
}

/** Inputs controlling how scramble frames are generated. */
export interface ScrambleConfig {
  charset: string;
  rng: Rng;
  growStep: number;
  resolveStep: number;
  maxFrames: number;
}

/**
 * Pick one random glyph from `charset`.
 *
 * @param charset - Pool of characters to choose from.
 * @param rng - Random source returning floats in `[0, 1)`.
 * @returns A single character from `charset`.
 */
export const randomGlyph = (charset: string, rng: Rng): string =>
  charset.charAt(Math.floor(rng() * charset.length));

/**
 * Build a string of `length` random glyphs.
 *
 * @param length - How many glyphs to generate.
 * @param charset - Pool of characters to choose from.
 * @param rng - Random source returning floats in `[0, 1)`.
 * @returns A string of `length` random glyphs from `charset`.
 */
export const randomString = (length: number, charset: string, rng: Rng): string => {
  let out = '';
  for (let i = 0; i < length; i++) out += randomGlyph(charset, rng);

  return out;
};

/**
 * The smallest step that keeps a phase of `n` characters within `budget` frames.
 */
const fitStep = (n: number, configuredStep: number, budget: number): number => {
  const minStep = Math.max(1, Math.ceil(n / Math.max(1, budget)));

  return Math.max(configuredStep, minStep);
};

/**
 * Produce the sequence of scrambled strings that morph an empty slot into
 * `target`. Pure: given the same `rng` it is fully deterministic.
 *
 * Two phases (`""` → `x` → `xy` → `xyz` → `xyzw` → `tyzw` → `tezw` → `tesw` → `test`):
 *
 * 1. **grow** — append random glyphs until the string reaches the target's
 *    length; the final grow frame is the random "base".
 * 2. **resolve** — lock in the real characters left-to-right, leaving the
 *    not-yet-resolved tail at its `base` values.
 *
 * The list never includes the starting (empty) state but always ends with
 * `target` itself.
 *
 * @param target - The final string the frames resolve to.
 * @param config - Charset, RNG, and step/frame budget.
 * @returns The ordered frames, ending with `target` (the empty start omitted).
 */
export const scrambleFrames = (target: string, config: ScrambleConfig): ScrambleFrame[] => {
  const n = target.length;
  if (n === 0) return [];

  const budget = Math.max(1, Math.floor(config.maxFrames / 2));
  const growStep = fitStep(n, config.growStep, budget);
  const resolveStep = fitStep(n, config.resolveStep, budget);

  const base = randomString(n, config.charset, config.rng);
  const frames: ScrambleFrame[] = [];

  // grow: 1, 1+step, ... up to the full-length random base
  for (let len = growStep; len < n; len += growStep) {
    frames.push({ text: base.slice(0, len), phase: 'grow' });
  }
  frames.push({ text: base, phase: 'grow' });

  // resolve: lock target[0..k] while the tail keeps the base glyphs
  for (let k = resolveStep; k < n; k += resolveStep) {
    frames.push({ text: target.slice(0, k) + base.slice(k), phase: 'resolve' });
  }
  frames.push({ text: target, phase: 'resolve' });

  return frames;
};

/**
 * A uniformly shuffled list of the indices `0 .. n-1` (Fisher–Yates).
 *
 * @param n - How many indices to produce.
 * @param rng - Random source returning floats in `[0, 1)`.
 * @returns A new array of `0 .. n-1` in random order.
 */
export const shuffledIndices = (n: number, rng: Rng): number[] => {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return order;
};

/**
 * Produce the frame sequence for the `scramble` effect. Pure: given the same
 * `rng` it is fully deterministic.
 *
 * One burst, then a random resolve (`""` → `qqqq` → `qeqq` → `qesq` → `qest` → `test`):
 *
 * 1. **grow** — a single frame: a random string of the target's full length.
 * 2. **resolve** — the real characters lock in at random positions
 *    (`resolveStep` per frame) while every unresolved slot keeps flickering
 *    with fresh glyphs, until the final frame, which is `target` itself.
 *
 * @param target - The final string the frames resolve to.
 * @param config - Charset, RNG, and step/frame budget.
 * @returns The ordered frames, ending with `target`.
 */
export const scrambleBurst = (target: string, config: ScrambleConfig): ScrambleFrame[] => {
  const n = target.length;
  if (n === 0) return [];

  const resolveStep = fitStep(n, config.resolveStep, Math.max(1, config.maxFrames - 1));
  const order = shuffledIndices(n, config.rng);
  const locked = Array.from({ length: n }, () => false);

  const flicker = (): string => {
    let out = '';
    for (let i = 0; i < n; i++) {
      out += locked[i] ? target[i] : randomGlyph(config.charset, config.rng);
    }
    return out;
  };

  // The burst: full-length noise, nothing resolved yet.
  const frames: ScrambleFrame[] = [{ text: flicker(), phase: 'grow' }];

  for (let k = resolveStep; k < n; k += resolveStep) {
    for (let j = k - resolveStep; j < k; j++) locked[order[j]] = true;
    frames.push({ text: flicker(), phase: 'resolve' });
  }
  frames.push({ text: target, phase: 'resolve' });

  return frames;
};
