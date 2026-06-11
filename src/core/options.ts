import { DEFAULT_CHARSET } from './charset';
import { defaultRng } from './rng';
import type { GlyphnavHooks, GlyphnavOptions } from './types';

/** Options with every field resolved to a concrete value. */
export type ResolvedOptions = Required<Omit<GlyphnavOptions, 'hooks'>> & {
  hooks: GlyphnavHooks;
};

/** The default option values. */
export const DEFAULT_OPTIONS: ResolvedOptions = {
  charset: DEFAULT_CHARSET,
  rng: defaultRng,
  stepDuration: 40,
  duration: null,
  effect: 'decode',
  commit: 'before',
  growStep: 1,
  resolveStep: 1,
  maxFrames: 120,
  scope: 'full',
  preserveLeadingSlash: true,
  respectReducedMotion: true,
  hooks: {},
};

const positiveInt = (value: number | undefined, fallback: number): number => {
  if (value == null || !Number.isFinite(value)) return fallback;

  const n = Math.floor(value);
  return n >= 1 ? n : fallback;
};

const nonNegative = (value: number | undefined, fallback: number): number => {
  if (value == null || !Number.isFinite(value) || value < 0) return fallback;

  return value;
};

const optionalNonNegative = (value: number | null | undefined): number | null => {
  if (value == null || !Number.isFinite(value) || value < 0) return null;

  return value;
};

/**
 * Merge user options over the defaults, validating numeric fields so a stray
 * `0` or `NaN` can never wedge the animation.
 */
export const resolveOptions = (options: GlyphnavOptions = {}): ResolvedOptions => {
  return {
    charset:
      options.charset && options.charset.length > 0 ? options.charset : DEFAULT_OPTIONS.charset,
    rng: options.rng ?? DEFAULT_OPTIONS.rng,
    stepDuration: nonNegative(options.stepDuration, DEFAULT_OPTIONS.stepDuration),
    duration: optionalNonNegative(options.duration),
    effect: options.effect === 'scramble' ? 'scramble' : 'decode',
    commit: options.commit === 'after' ? 'after' : 'before',
    growStep: positiveInt(options.growStep, DEFAULT_OPTIONS.growStep),
    resolveStep: positiveInt(options.resolveStep, DEFAULT_OPTIONS.resolveStep),
    maxFrames: positiveInt(options.maxFrames, DEFAULT_OPTIONS.maxFrames),
    scope: options.scope === 'tail' ? 'tail' : 'full',
    preserveLeadingSlash: options.preserveLeadingSlash ?? DEFAULT_OPTIONS.preserveLeadingSlash,
    respectReducedMotion: options.respectReducedMotion ?? DEFAULT_OPTIONS.respectReducedMotion,
    hooks: options.hooks ?? {},
  };
};
