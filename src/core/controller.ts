import { generateFrames } from './frames';
import { resolveOptions } from './options';
import type { ResolvedOptions } from './options';
import { createPlayer, defaultScheduler } from './player';
import type { Player, Scheduler } from './player';
import { resolvePath } from './path';
import { prefersReducedMotion as defaultPrefersReducedMotion } from './reduced-motion';
import type { AnimationContext, FrameInfo, GlyphnavOptions, RunResult } from './types';

/** A function that performs the *real* navigation once the animation finishes. */
export type CommitFn = () => void | Promise<void>;

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

  /** Monotonic id so a newer run cleanly supersedes an older one. */
  private runId = 0;
  /** The path the bar is put back to if the in-flight run is abandoned. */
  private activeFrom: string | null = null;
  /**
   * The current path as observed right after our last frame write. If the
   * browser reports something else, the URL was moved externally (back/forward
   * button, another script) and we must not touch the bar again.
   */
  private observedPath: string | null = null;
  /**
   * The path the bar last settled on (after a navigation or a popstate replay).
   * Read only by {@link enableHistoryAnimation} to know the path to animate
   * *from* when the browser traverses history, since popstate only reports the
   * destination. `null` until the first navigation or until seeded on enable.
   */
  private lastPath: string | null = null;
  /**
   * True while a {@link run} is committing/animating. The popstate listener uses
   * it to ignore the synthetic `popstate` some adapters dispatch right after
   * their own `pushState` (e.g. the vanilla adapter notifying popstate routers),
   * which would otherwise look like a user back/forward traversal.
   */
  private navigating = false;

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
   * @param commit - Performs the real navigation; may be async.
   * @param perCall - Options that override the base options for this run only.
   * @returns Whether the run `completed`, was `cancelled`, or was `skipped`.
   */
  async run(to: string, commit: CommitFn, perCall?: GlyphnavOptions): Promise<RunResult> {
    const myId = ++this.runId;
    // Abandon any in-flight run and put the real path back first, so the
    // starting point read below is never a half-scrambled string.
    this.stopActive();

    const opts = resolveOptions(perCall ? { ...this.options, ...perCall } : this.options);
    const hooks = opts.hooks;
    const from = this.deps.getCurrentPath();
    const target = resolvePath(to, from);
    const ctx: AnimationContext = { from, to: target };

    const reduceMotion = opts.respectReducedMotion && this.deps.prefersReducedMotion();
    // Only animate rooted same-origin paths — anything else (cross-origin,
    // protocol-relative, unresolvable) would corrupt the URL when written.
    const animatable = !reduceMotion && this.deps.history != null && isRootedPath(target);

    // Mark the navigation in-flight so the popstate listener ignores any
    // synthetic `popstate` our own commit dispatches. Cleared only by the run
    // that is still current, so a superseded run never unmarks its successor.
    this.navigating = true;
    try {
      if (animatable && opts.commit === 'before') {
        return await this.runNavigateFirst(myId, ctx, commit, opts);
      }

      const frames = animatable ? generateFrames(from, target, opts) : [];

      if (frames.length === 0) {
        await commit();
        this.lastPath = this.deps.getCurrentPath();
        hooks.onComplete?.(ctx, 'skipped');
        return 'skipped';
      }

      const outcome = await this.playFrames(myId, ctx, frames, opts, from);
      if (outcome === 'cancelled') return 'cancelled';

      hooks.onCommit?.(ctx);
      await commit();
      hooks.onComplete?.(ctx, 'completed');
      return 'completed';
    } finally {
      if (this.runId === myId) this.navigating = false;
    }
  }

  /** Cancel the current animation (if any) and restore the address bar. */
  cancel(): void {
    this.runId += 1;
    this.stopActive();
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
    const myId = ++this.runId;
    this.stopActive();

    const opts = resolveOptions(perCall ? { ...this.options, ...perCall } : this.options);
    const hooks = opts.hooks;
    const ctx: AnimationContext = { from, to };

    const reduceMotion = opts.respectReducedMotion && this.deps.prefersReducedMotion();
    const animatable =
      !reduceMotion && this.deps.history != null && isRootedPath(from) && isRootedPath(to);
    const frames = animatable && from !== to ? generateFrames(from, to, opts) : [];

    if (frames.length === 0) {
      this.lastPath = to;
      hooks.onComplete?.(ctx, 'skipped');
      return 'skipped';
    }

    const outcome = await this.playFrames(myId, ctx, frames, opts, to);
    if (outcome === 'cancelled') return 'cancelled';

    hooks.onComplete?.(ctx, 'completed');
    return 'completed';
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
      if (this.navigating) return;
      const to = this.deps.getCurrentPath();
      const from = this.lastPath ?? to;
      // The browser is already at `to`; record it now so a rapid follow-up
      // traversal animates from here even if this run is superseded mid-flight.
      this.lastPath = to;
      if (from === to) return;
      void this.replay(from, to, perCall);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }

  /**
   * `commit: 'before'`: the real navigation goes out immediately — the page
   * never waits for the animation — and the bar then replays the decode from
   * the old path to wherever the navigation actually landed (so redirects
   * animate to their true destination).
   */
  private async runNavigateFirst(
    myId: number,
    ctx: AnimationContext,
    commit: CommitFn,
    opts: ResolvedOptions,
  ): Promise<RunResult> {
    const hooks = opts.hooks;
    hooks.onCommit?.(ctx);
    await commit();
    if (this.runId !== myId) {
      hooks.onCancel?.(ctx);
      hooks.onComplete?.(ctx, 'cancelled');
      return 'cancelled';
    }

    // An unchanged URL means the navigation was a no-op (or a router guard
    // blocked it) — animating would advertise a navigation that never happened.
    const landed = this.deps.getCurrentPath();
    const frames =
      landed !== ctx.from && isRootedPath(landed) ? generateFrames(ctx.from, landed, opts) : [];

    if (frames.length === 0) {
      this.lastPath = landed;
      hooks.onComplete?.(ctx, 'skipped');
      return 'skipped';
    }

    const outcome = await this.playFrames(myId, ctx, frames, opts, landed);
    if (outcome === 'cancelled') return 'cancelled';

    hooks.onComplete?.(ctx, 'completed');
    return 'completed';
  }

  /**
   * Write `frames` to the bar one by one, guarding against superseding runs
   * and external URL changes. When the run ends (or is abandoned) the bar is
   * restored to `restoreTo`. Cancel hooks have already fired on a
   * `'cancelled'` outcome.
   */
  private async playFrames(
    myId: number,
    ctx: AnimationContext,
    frames: FrameInfo[],
    opts: ResolvedOptions,
    restoreTo: string,
  ): Promise<'completed' | 'cancelled'> {
    const hooks = opts.hooks;
    this.activeFrom = restoreTo;
    this.observedPath = this.deps.getCurrentPath();
    hooks.onStart?.(ctx);

    let movedExternally = false;
    const result = await this.player.play(
      frames.length,
      frameDelay(opts, frames.length),
      (index) => {
        if (this.observedPath != null && this.deps.getCurrentPath() !== this.observedPath) {
          movedExternally = true;
          this.player.cancel();
          return;
        }
        const frame = frames[index];
        this.writePath(frame.path);
        this.observedPath = this.deps.getCurrentPath();
        hooks.onFrame?.(frame, ctx);
      },
    );

    // A newer run already restored the bar — stay out of its way.
    if (this.runId !== myId) {
      hooks.onCancel?.(ctx);
      hooks.onComplete?.(ctx, 'cancelled');
      return 'cancelled';
    }

    if (movedExternally) {
      // The user navigated away (e.g. back button) mid-animation: the URL now
      // belongs to that navigation, so neither restore nor commit.
      this.activeFrom = null;
      this.observedPath = null;
      hooks.onCancel?.(ctx);
      hooks.onComplete?.(ctx, 'cancelled');
      return 'cancelled';
    }

    this.writePath(restoreTo);
    this.activeFrom = null;
    this.observedPath = null;
    this.lastPath = restoreTo;

    if (result === 'cancelled') {
      hooks.onCancel?.(ctx);
      hooks.onComplete?.(ctx, 'cancelled');
      return 'cancelled';
    }
    return 'completed';
  }

  private stopActive(): void {
    if (this.activeFrom == null) return;
    this.player.cancel();
    // Restore only if the bar still shows our frame; if the URL was moved
    // externally it belongs to that navigation now.
    if (this.observedPath == null || this.deps.getCurrentPath() === this.observedPath) {
      this.writePath(this.activeFrom);
    }
    this.activeFrom = null;
    this.observedPath = null;
  }

  private writePath(path: string): void {
    const history = this.deps.history;
    const replace = this.replaceState;
    if (!history || !replace) return;
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
