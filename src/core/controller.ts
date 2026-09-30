import { generateFrames } from './frames';
import { resolveOptions } from './options';
import type { ResolvedOptions } from './options';
import { createPlayer, defaultScheduler } from './player';
import type { Player, Scheduler } from './player';
import { resolvePath } from './path';
import { prefersReducedMotion as defaultPrefersReducedMotion } from './reduced-motion';
import type { AnimationContext, FrameInfo, GlyphnavOptions, RunResult } from './types';

/**
 * Performs the real navigation. The signal aborts when the run is cancelled or
 * superseded, allowing adapters to stop waiting for router settlement.
 */
export type CommitFn = (signal: AbortSignal) => void | Promise<void>;

interface ActiveRun {
  abort: AbortController;
  ctx: AnimationContext;
  opts: ResolvedOptions;
  navigating: boolean;
  /** Real path to restore while this run owns the address bar. */
  restoreTo: string | null;
  /** Path observed after our last write; another path belongs to external navigation. */
  observedPath: string | null;
}

/** Environment hooks, all injectable for testing and SSR. */
export interface ControllerDeps {
  /** History object used to rewrite the address bar. Defaults to `window.history`. */
  history?: History | null;
  /** Reads the current path. Defaults to `location.pathname + search + hash`. */
  getCurrentPath?: () => string;
  /** Timer source for the frame player. Defaults to global timers. */
  scheduler?: Scheduler;
  /** Reduced-motion probe. Defaults to a `matchMedia` check. */
  prefersReducedMotion?: () => boolean;
}

const resolveHistory = (provided: History | null | undefined): History | null => {
  if (provided !== undefined) return provided;

  return typeof window !== 'undefined' && window.history ? window.history : null;
};

const defaultGetCurrentPath = (): string => {
  if (typeof window === 'undefined' || !window.location) return '/';

  const { pathname, search, hash } = window.location;
  return pathname + search + hash;
};

/** Only rooted same-origin paths may be written to the address bar. */
const isRootedPath = (path: string): boolean => path.startsWith('/') && !path.startsWith('//');

/** Per-frame delay: an explicit total `duration` is spread over the frames. */
const frameDelay = (opts: ResolvedOptions, count: number): number => {
  if (opts.duration == null) return opts.stepDuration;

  return opts.duration / Math.max(1, count - 1);
};

/**
 * The framework-agnostic engine. By default (`commit: 'before'`) it commits
 * the real navigation first and then plays the glyph-scramble on top of the
 * landed URL; with `commit: 'after'` it animates the address bar from the
 * current path to the target and commits at the end. Adapters are thin
 * wrappers that supply the right `commit` callback for their router.
 *
 * Browser back/forward (popstate) traversals are *not* animated by `run`: the
 * browser changes the URL itself, so there is nothing to commit. Opt into
 * animating them with {@link GlyphnavController.enableHistoryAnimation}, which
 * replays the decode on top of the landed entry via {@link GlyphnavController.replay}.
 */
export class GlyphnavController {
  private options: GlyphnavOptions;
  private readonly deps: Required<Omit<ControllerDeps, 'history'>> & { history: History | null };
  private readonly player: Player;
  /**
   * `history.replaceState` resolved and bound once, so every animation frame
   * skips the `instanceof History` probe + prototype lookup. We go through the
   * prototype (not the instance method) so routers that monkey-patch the instance
   * (e.g. TanStack Router's history wrapper) do not observe each frame as a real
   * navigation. `null` when there is no history to write to.
   */
  private readonly replaceState: ((data: unknown, unused: string, url: string) => void) | null;

  /** State belongs to a single run, so an older callback cannot clean up its successor. */
  private activeRun: ActiveRun | null = null;
  private readonly historyCleanups = new Set<() => void>();
  /**
   * The path the bar last settled on (after a navigation or a popstate replay).
   * Read only by {@link enableHistoryAnimation} to know the path to animate
   * *from* when the browser traverses history, since popstate only reports the
   * destination. `null` until the first navigation or until seeded on enable.
   */
  private lastPath: string | null = null;

  constructor(options: GlyphnavOptions = {}, deps: ControllerDeps = {}) {
    this.options = options;
    this.deps = {
      history: resolveHistory(deps.history),
      getCurrentPath: deps.getCurrentPath ?? defaultGetCurrentPath,
      scheduler: deps.scheduler ?? defaultScheduler,
      prefersReducedMotion: deps.prefersReducedMotion ?? defaultPrefersReducedMotion,
    };
    this.player = createPlayer(this.deps.scheduler);

    const history = this.deps.history;
    this.replaceState =
      history == null
        ? null
        : (typeof History !== 'undefined' && history instanceof History
            ? History.prototype.replaceState
            : history.replaceState
          ).bind(history);
  }

  /** True while an animation is on screen. */
  get animating(): boolean {
    return this.player.running;
  }

  /**
   * Merge new base options over the existing ones.
   *
   * @param options - Options to shallow-merge over the current base options.
   */
  update(options: GlyphnavOptions): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Navigate to `to` (via `commit`) and play the glyph animation. By default
   * (`commit: 'before'`) the navigation goes out first and the bar animates on
   * top; with `commit: 'after'` the animation plays first and `commit` runs at
   * the end. `perCall` options override the controller's base options for this
   * run only.
   *
   * @param to - Destination path, resolved against the current path.
   * @param commit - Performs the real navigation; may be async and receives a cancellation signal.
   * @param perCall - Options that override the base options for this run only.
   * @returns Whether the run `completed`, was `cancelled`, or was `skipped`. Hook and navigation
   * failures reject after restoring the bar and releasing the run.
   */
  async run(to: string, commit: CommitFn, perCall?: GlyphnavOptions): Promise<RunResult> {
    this.cancel();
    const opts = resolveOptions(perCall ? { ...this.options, ...perCall } : this.options);
    const from = this.deps.getCurrentPath();
    const target = resolvePath(to, from);
    const state = this.beginRun({ from, to: target }, opts, true);

    try {
      const reduceMotion = opts.respectReducedMotion && this.deps.prefersReducedMotion();
      const animatable = !reduceMotion && this.deps.history != null && isRootedPath(target);
      let outcome: RunResult;
      if (animatable && opts.commit === 'before') {
        outcome = await this.runNavigateFirst(state, commit);
      } else {
        const frames = animatable ? generateFrames(from, target, opts) : [];
        if (frames.length === 0) {
          outcome = (await this.commitRun(state, commit)) ? 'skipped' : 'cancelled';
        } else {
          outcome = await this.playFrames(state, frames, from);
          if (outcome !== 'cancelled' && !(await this.commitRun(state, commit))) {
            outcome = 'cancelled';
          }
        }
      }
      return this.completeRun(state, outcome);
    } finally {
      this.finishRun(state);
    }
  }

  /** Cancel the current animation or pending navigation and restore the address bar. */
  cancel(): void {
    const state = this.activeRun;
    if (!state) return;
    this.activeRun = null;
    this.player.cancel();
    this.restoreRun(state);
    state.abort.abort();
  }

  /** Cancel work and detach owned history listeners. The controller may be reused. */
  destroy(): void {
    this.cancel();
    for (const cleanup of this.historyCleanups) cleanup();
  }

  /**
   * Replay the glyph animation between two already-known paths *without*
   * committing any navigation — for browser back/forward (popstate), where the
   * URL has already been moved to `to` and only the decode needs to play on
   * top. Same frame machinery, supersede and external-move guards as
   * {@link run}; `from` matters only for `scope: 'tail'` (the common-prefix
   * split). A no-op (`from === to`), reduced motion, or a non-rooted endpoint
   * skips cleanly.
   *
   * @param from - The path the bar should appear to animate *from*.
   * @param to - The path the bar must end on (already the live URL).
   * @param perCall - Options that override the base options for this run only.
   * @returns Whether the run `completed`, was `cancelled`, or was `skipped`.
   */
  async replay(from: string, to: string, perCall?: GlyphnavOptions): Promise<RunResult> {
    this.cancel();
    const opts = resolveOptions(perCall ? { ...this.options, ...perCall } : this.options);
    const state = this.beginRun({ from, to }, opts, false);
    try {
      const reduceMotion = opts.respectReducedMotion && this.deps.prefersReducedMotion();
      const animatable =
        !reduceMotion && this.deps.history != null && isRootedPath(from) && isRootedPath(to);
      const frames = animatable && from !== to ? generateFrames(from, to, opts) : [];
      const outcome = frames.length > 0 ? await this.playFrames(state, frames, to) : 'skipped';
      if (outcome === 'skipped') this.lastPath = to;
      return this.completeRun(state, outcome);
    } finally {
      this.finishRun(state);
    }
  }

  /**
   * Animate browser back/forward (popstate) traversals too. The browser changes
   * the URL itself on a history move, so there is nothing to commit — this
   * replays the decode from the previously shown path to the one the browser
   * landed on (see {@link replay}). The path to animate *from* is tracked across
   * navigations, so it stays correct after link clicks and earlier traversals.
   *
   * Safe in non-browser environments (returns a no-op). Adapters wire the
   * returned cleanup into their own teardown so the listener is removed
   * alongside everything else.
   *
   * @param perCall - Options that override the base options for popstate runs only.
   * @returns A cleanup function that detaches the `popstate` listener.
   */
  enableHistoryAnimation(perCall?: GlyphnavOptions): () => void {
    if (typeof window === 'undefined' || !window.addEventListener) return () => {};

    this.lastPath ??= this.deps.getCurrentPath();
    const onPopState = (): void => {
      // Ignore the synthetic popstate our own navigation dispatches; a real
      // traversal only happens while we are idle.
      if (this.activeRun?.navigating) return;
      const to = this.deps.getCurrentPath();
      const from = this.lastPath ?? to;
      // The browser is already at `to`; record it now so a rapid follow-up
      // traversal animates from here even if this run is superseded mid-flight.
      this.lastPath = to;
      if (from === to) return;
      // Event handlers have no caller to receive a rejection; restoration is
      // handled by replay even if a user hook fails.
      void this.replay(from, to, perCall).catch(() => {});
    };

    window.addEventListener('popstate', onPopState);
    const cleanup = (): void => {
      window.removeEventListener('popstate', onPopState);
      this.historyCleanups.delete(cleanup);
    };
    this.historyCleanups.add(cleanup);
    return cleanup;
  }

  /**
   * `commit: 'before'`: the real navigation goes out immediately — the page
   * never waits for the animation — and the bar then replays the decode from
   * the old path to wherever the navigation actually landed (so redirects
   * animate to their true destination).
   */
  private async runNavigateFirst(state: ActiveRun, commit: CommitFn): Promise<RunResult> {
    if (!(await this.commitRun(state, commit))) return 'cancelled';

    // Redirects animate to their landed path; blocked navigation skips.
    const landed = this.deps.getCurrentPath();
    const frames =
      landed !== state.ctx.from && isRootedPath(landed)
        ? generateFrames(state.ctx.from, landed, state.opts)
        : [];
    return frames.length > 0 ? this.playFrames(state, frames, landed) : 'skipped';
  }

  private beginRun(ctx: AnimationContext, opts: ResolvedOptions, navigating: boolean): ActiveRun {
    const state: ActiveRun = {
      abort: new AbortController(),
      ctx,
      opts,
      navigating,
      restoreTo: null,
      observedPath: null,
    };
    this.activeRun = state;
    return state;
  }

  private isCurrent(state: ActiveRun): boolean {
    return this.activeRun === state && !state.abort.signal.aborted;
  }

  /** Await router completion, but let cancellation settle even an uncooperative router. */
  private async commitRun(state: ActiveRun, commit: CommitFn): Promise<boolean> {
    if (!this.isCurrent(state)) return false;
    state.opts.hooks.onCommit?.(state.ctx);
    if (!this.isCurrent(state)) return false;

    const signal = state.abort.signal;
    let onAbort!: () => void;
    const cancelled = new Promise<boolean>((resolve) => {
      onAbort = () => resolve(false);
      signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
      const committed = Promise.resolve(commit(signal)).then(() => true);
      const completed = await Promise.race([committed, cancelled]);
      if (!completed || !this.isCurrent(state)) return false;
      this.lastPath = this.deps.getCurrentPath();
      return true;
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }

  private completeRun(state: ActiveRun, outcome: RunResult): RunResult {
    const hooks = state.opts.hooks;
    if (outcome === 'cancelled') {
      // onComplete still fires if a cancellation hook throws; finally cleanup
      // also protects against a throwing completion hook.
      try {
        hooks.onCancel?.(state.ctx);
      } finally {
        hooks.onComplete?.(state.ctx, outcome);
      }
    } else {
      hooks.onComplete?.(state.ctx, outcome);
    }
    return outcome;
  }

  /** Write one visible frame per repaint, restoring only while this run owns the bar. */
  private async playFrames(
    state: ActiveRun,
    frames: FrameInfo[],
    restoreTo: string,
  ): Promise<'completed' | 'cancelled'> {
    if (!this.isCurrent(state)) return 'cancelled';
    state.restoreTo = restoreTo;
    state.observedPath = this.deps.getCurrentPath();
    try {
      state.opts.hooks.onStart?.(state.ctx);
      if (!this.isCurrent(state)) return 'cancelled';
      const outcome = await this.player.play(
        frames.length,
        frameDelay(state.opts, frames.length),
        (index) => {
          if (!this.isCurrent(state)) return;
          if (this.deps.getCurrentPath() !== state.observedPath) {
            // The new location belongs to external navigation; do not restore.
            state.restoreTo = null;
            this.cancel();
            return;
          }
          const frame = frames[index];
          this.writePath(frame.path);
          state.observedPath = this.deps.getCurrentPath();
          state.opts.hooks.onFrame?.(frame, state.ctx);
        },
      );
      return this.isCurrent(state) ? outcome : 'cancelled';
    } finally {
      if (this.activeRun === state) this.restoreRun(state);
    }
  }

  private restoreRun(state: ActiveRun): void {
    if (state.restoreTo != null && this.deps.getCurrentPath() === state.observedPath) {
      this.writePath(state.restoreTo);
    }
    state.restoreTo = null;
    state.observedPath = null;
    this.lastPath = this.deps.getCurrentPath();
  }

  private finishRun(state: ActiveRun): void {
    if (this.activeRun !== state) return;
    this.restoreRun(state);
    this.activeRun = null;
  }

  private writePath(path: string): void {
    const history = this.deps.history;
    const replace = this.replaceState;
    if (!history || !replace || this.deps.getCurrentPath() === path) return;
    try {
      replace(history.state, '', path);
    } catch {
      /* cross-origin / unsupported environments */
    }
  }
}

/**
 * Convenience factory mirroring `new GlyphnavController(...)`.
 *
 * @param options - Base options for the controller.
 * @param deps - Environment hooks (history, timers, …), injectable for tests/SSR.
 * @returns A new {@link GlyphnavController}.
 */
export const createGlyphnav = (
  options?: GlyphnavOptions,
  deps?: ControllerDeps,
): GlyphnavController => {
  return new GlyphnavController(options, deps);
};
