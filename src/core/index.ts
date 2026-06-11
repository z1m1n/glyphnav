/**
 * glyphnav core — the framework-agnostic engine. It turns "navigate from A to
 * B" into a glyph-scramble animation on the address bar, then calls a commit
 * callback. Router adapters build on top of this.
 */

export type {
  AnimateScope,
  AnimationPhase,
  GlyphEffect,
  CommitTiming,
  RunResult,
  GlyphnavOptions,
  AnimationContext,
  FrameInfo,
  GlyphnavHooks,
} from './types';
export { createRng, defaultRng } from './rng';
export type { Rng } from './rng';
export {
  URL_SAFE,
  ALPHANUMERIC,
  LOWER_ALPHA,
  HEX,
  SYMBOLS,
  MATRIX,
  BINARY,
  DEFAULT_CHARSET,
} from './charset';
export {
  randomGlyph,
  randomString,
  scrambleFrames,
  scrambleBurst,
  shuffledIndices,
} from './scramble';
export type { ScrambleFrame, ScrambleConfig } from './scramble';
export { generateFrames, MIN_FRAME_MS } from './frames';
export { splitTarget, commonPrefixLength, resolvePath } from './path';
export type { PathParts, SplitOptions } from './path';
export { prefersReducedMotion } from './reduced-motion';
export { createPlayer, defaultScheduler } from './player';
export type { Player, PlayResult, Scheduler } from './player';
export { DEFAULT_OPTIONS, resolveOptions } from './options';
export type { ResolvedOptions } from './options';
export { GlyphnavController, createGlyphnav } from './controller';
export type { CommitFn, ControllerDeps } from './controller';
