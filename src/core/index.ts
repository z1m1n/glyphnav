/**
 * glyphnav core — the framework-agnostic engine. It turns "navigate from A to
 * B" into a glyph-scramble animation on the address bar, then calls a commit
 * callback. Router adapters build on top of this.
 */

export * from './types';
export * from './rng';
export * from './charset';
export {
  randomGlyph,
  randomString,
  scrambleFrames,
  scrambleBurst,
  shuffledIndices,
  type ScrambleFrame,
  type ScrambleConfig,
} from './scramble';
export { generateFrames, MIN_FRAME_MS } from './frames';
export {
  splitTarget,
  commonPrefixLength,
  resolvePath,
  type PathParts,
  type SplitOptions,
} from './path';
export { prefersReducedMotion } from './reduced-motion';
export {
  createPlayer,
  defaultScheduler,
  type Player,
  type PlayResult,
  type Scheduler,
} from './player';
export {
  DEFAULT_OPTIONS,
  resolveOptions,
  type ResolvedOptions,
} from './options';
export {
  GlyphnavController,
  createGlyphnav,
  type CommitFn,
  type ControllerDeps,
} from './controller';
