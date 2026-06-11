import type { Rng } from './rng';

/**
 * How the portion of the URL that gets scrambled is chosen.
 *
 * - `full` — animate the whole path after the leading slash (matches the
 *   canonical `/` → `/test` demo). This is the default.
 * - `tail` — keep the longest common prefix between the current and target
 *   path, and only animate the part that differs. Nicer for SPAs that move
 *   between sibling routes, e.g. `/users/1` → `/users/2` only scrambles `2`.
 */
export type AnimateScope = 'full' | 'tail';

/** The two phases of the scramble effect. */
export type AnimationPhase = 'grow' | 'resolve';

/**
 * Which glyph animation to play.
 *
 * - `decode` — the path grows one random glyph at a time, then the real
 *   characters resolve left-to-right. This is the default.
 * - `scramble` — a random string of the target's full length appears
 *   immediately, then the real characters lock in at random positions while
 *   the unresolved ones keep flickering.
 */
export type GlyphEffect = 'decode' | 'scramble';

/**
 * When the real navigation happens relative to the animation.
 *
 * - `before` — commit immediately (the page responds with zero delay), then
 *   play the animation on top, ending at the URL the navigation landed on.
 *   This is the default. Hard reloads cannot use this (the page unloads) and
 *   fall back to `after`.
 * - `after` — classic order: play the animation, then commit. The page
 *   changes only once the bar has fully decoded.
 */
export type CommitTiming = 'after' | 'before';

/** Outcome of a single navigation run. */
export type RunResult = 'completed' | 'cancelled' | 'skipped';

/**
 * Configuration shared by the core controller and every framework adapter.
 * Every field is optional; sensible defaults are applied via `resolveOptions`.
 */
export interface GlyphnavOptions {
  /** Pool of random glyphs used for the "noise" characters. Default {@link DEFAULT_CHARSET}. */
  charset?: string;
  /** Random source, injectable for reproducibility/tests. Default {@link Math.random}. */
  rng?: Rng;
  /** Milliseconds each frame stays on screen. Default `40`. */
  stepDuration?: number;
  /**
   * Total animation time in milliseconds for the whole run. When set it takes
   * precedence over `stepDuration`: the per-frame delay becomes
   * `duration / (frameCount - 1)`, and the per-frame steps auto-scale so no
   * frame would stay on screen for less than ~15 ms. Default `null`
   * (per-frame `stepDuration` timing).
   */
  duration?: number | null;
  /** The animation style. Default `'decode'`. See {@link GlyphEffect}. */
  effect?: GlyphEffect;
  /**
   * `'before'` commits immediately and animates on top of the landed URL, so
   * the page never waits for the animation; `'after'` animates first and
   * commits the real navigation at the end. Default `'before'`.
   */
  commit?: CommitTiming;
  /** How many characters are appended per frame during the grow phase. Default `1`. */
  growStep?: number;
  /** How many characters are locked per frame during the resolve phase. Default `1`. */
  resolveStep?: number;
  /**
   * Hard cap on the number of frames. If a path is long enough that the grow +
   * resolve phases would exceed this, the per-frame steps are scaled up so the
   * animation never runs longer than `maxFrames * stepDuration`. Default `120`.
   */
  maxFrames?: number;
  /** Which part of the path to animate. Default `'full'`. */
  scope?: AnimateScope;
  /** Keep the leading `/` fixed (only relevant for `scope: 'full'`). Default `true`. */
  preserveLeadingSlash?: boolean;
  /** Skip the animation when the user prefers reduced motion. Default `true`. */
  respectReducedMotion?: boolean;
  /** Lifecycle callbacks. */
  hooks?: GlyphnavHooks;
}

/** Context describing a single navigation. */
export interface AnimationContext {
  /** The path the address bar started at. */
  from: string;
  /** The path being navigated to. */
  to: string;
}

/** Information about a single rendered frame. */
export interface FrameInfo {
  /** The full path currently shown in the address bar (prefix + animated text). */
  path: string;
  /** Just the animated text portion (without the preserved prefix). */
  text: string;
  /** Zero-based index of this frame. */
  index: number;
  /** Total number of frames in this run. */
  total: number;
  /** Which phase this frame belongs to. */
  phase: AnimationPhase;
}

/** Lifecycle hooks fired during a navigation run. */
export interface GlyphnavHooks {
  /** Fired once before the first frame (skipped runs do not fire this). */
  onStart?: (ctx: AnimationContext) => void;
  /** Fired for every frame written to the address bar. */
  onFrame?: (frame: FrameInfo, ctx: AnimationContext) => void;
  /**
   * Fired right before the real navigation is committed — after the last
   * frame with `commit: 'after'`, before the first frame with `commit: 'before'`.
   */
  onCommit?: (ctx: AnimationContext) => void;
  /** Fired if the run is cancelled (e.g. a newer navigation superseded it). */
  onCancel?: (ctx: AnimationContext) => void;
  /** Fired once the run settles, regardless of outcome. */
  onComplete?: (ctx: AnimationContext, result: RunResult) => void;
}
