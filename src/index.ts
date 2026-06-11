/**
 * glyphnav — animate navigation as a glyph-scramble right in the address bar.
 *
 * The default entry bundles the framework-agnostic core with the vanilla
 * helpers (`install`, `navigate`). Router adapters live behind subpath
 * imports: `glyphnav/vue-router`, `glyphnav/react-router`,
 * `glyphnav/tanstack-react-router`, `glyphnav/angular-router`.
 */

export {
  createRng,
  defaultRng,
  URL_SAFE,
  ALPHANUMERIC,
  LOWER_ALPHA,
  HEX,
  SYMBOLS,
  MATRIX,
  BINARY,
  DEFAULT_CHARSET,
  randomGlyph,
  randomString,
  scrambleFrames,
  scrambleBurst,
  shuffledIndices,
  generateFrames,
  MIN_FRAME_MS,
  splitTarget,
  commonPrefixLength,
  resolvePath,
  prefersReducedMotion,
  createPlayer,
  defaultScheduler,
  DEFAULT_OPTIONS,
  resolveOptions,
  GlyphnavController,
  createGlyphnav,
} from './core';
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
  Rng,
  ScrambleFrame,
  ScrambleConfig,
  PathParts,
  SplitOptions,
  Player,
  PlayResult,
  Scheduler,
  ResolvedOptions,
  CommitFn,
  ControllerDeps,
} from './core';
export { resetController, navigate, eligibleAnchor, install, uninstall } from './vanilla';
export type { NavigateOptions, InstallOptions, GlyphnavHandle } from './vanilla';
