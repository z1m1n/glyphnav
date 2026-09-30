/** Result of a playback run. */
export type PlayResult = 'completed' | 'cancelled';

/**
 * The frame-clock primitives the player needs. Injectable so tests can drive it
 * deterministically and SSR code can supply no-ops.
 *
 * The default is backed by `requestAnimationFrame` + `performance.now`, so the
 * animation aligns to the display's refresh, never writes more than once per
 * painted frame, and — crucially — **pauses entirely while the tab is hidden**
 * (`requestAnimationFrame` does not fire in a background tab) instead of dribbling
 * `replaceState` calls into a page nobody is looking at.
 */
export interface Scheduler {
  /** Current time in milliseconds, on the same timebase as {@link requestFrame}'s argument. */
  now: () => number;
  /** Run `callback` before the next repaint, passing the frame timestamp. Returns a cancel handle. */
  requestFrame: (callback: (now: number) => void) => unknown;
  /** Cancel a pending {@link requestFrame}. */
  cancelFrame: (handle: unknown) => void;
}

/** True only in an environment that actually has `requestAnimationFrame`. */
const hasRaf = typeof requestAnimationFrame === 'function';

/**
 * A scheduler backed by `requestAnimationFrame` (vsync-aligned, background-paused)
 * where available, falling back to a ~60 fps timer in non-visual environments
 * (SSR / older test runners) so the engine still runs there.
 */
export const defaultScheduler: Scheduler = {
  now: () =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now(),
  requestFrame: (callback) =>
    hasRaf
      ? // Use our own clock for both timestamps. Environments that expose a
        // window's RAF alongside another performance object need this too.
        requestAnimationFrame(() => callback(defaultScheduler.now()))
      : setTimeout(() => callback(defaultScheduler.now()), 16),
  cancelFrame: (handle) =>
    hasRaf
      ? cancelAnimationFrame(handle as number)
      : clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Drives a fixed number of "ticks" spaced `stepDuration` ms apart. Calling
 * {@link Player.play} again, or {@link Player.cancel}, settles any in-flight run
 * as `'cancelled'` before starting/stopping — so only one run is ever live at a
 * time.
 */
export interface Player {
  /** True while a run is in flight. */
  readonly running: boolean;
  /**
   * Schedule `tick(0..count-1)` for `index * stepDuration` ms after the run
   * starts (the first fires on the next animation frame).
   * Timing is keyed off the run's start, not the previous tick, so the run never
   * drifts slow. Each repaint renders only the latest due tick, coalescing
   * states missed during a stall while always preserving the final tick.
   *
   * @param count - Number of ticks to fire.
   * @param stepDuration - Target milliseconds between ticks.
   * @param tick - Called with the zero-based index of each rendered tick.
   * @returns `'completed'` after the last tick, or `'cancelled'` if interrupted.
   */
  play(count: number, stepDuration: number, tick: (index: number) => void): Promise<PlayResult>;
  /** Stop the current run (if any), resolving its promise with `'cancelled'`. */
  cancel(): void;
}

/**
 * Create a {@link Player} backed by `scheduler`.
 *
 * @param scheduler - Frame-clock primitives to drive ticks. Defaults to
 * {@link defaultScheduler}.
 * @returns A player that runs one timed sequence of ticks at a time.
 */
export const createPlayer = (scheduler: Scheduler = defaultScheduler): Player => {
  interface Playback {
    frame: unknown;
    resolve: (result: PlayResult) => void;
    reject: (error: unknown) => void;
  }
  let active: Playback | null = null;

  const finish = (run: Playback, result: PlayResult): void => {
    if (active !== run) return;
    active = null;
    if (run.frame != null) scheduler.cancelFrame(run.frame);
    run.resolve(result);
  };

  const fail = (run: Playback, error: unknown): void => {
    if (active !== run) return;
    active = null;
    if (run.frame != null) scheduler.cancelFrame(run.frame);
    run.reject(error);
  };

  return {
    get running(): boolean {
      return active != null;
    },

    play(count, stepDuration, tick): Promise<PlayResult> {
      // A new run supersedes any in-flight one.
      if (active) finish(active, 'cancelled');

      return new Promise<PlayResult>((resolve, reject) => {
        const run: Playback = { frame: null, resolve, reject };
        active = run;
        if (count <= 0) {
          finish(run, 'completed');
          return;
        }
        try {
          let next = 0;
          const start = scheduler.now();
          const loop = (now: number): void => {
            if (active !== run) return;
            run.frame = null;
            try {
              const due =
                stepDuration <= 0
                  ? count - 1
                  : Math.min(count - 1, Math.floor((now - start) / stepDuration));
              if (due >= next) {
                tick(due);
                // A tick can cancel or replace playback. Never let this
                // callback finish or schedule frames for its successor.
                if (active !== run) return;
                next = due + 1;
              }
              if (next >= count) {
                finish(run, 'completed');
                return;
              }
              run.frame = scheduler.requestFrame(loop);
            } catch (error) {
              fail(run, error);
            }
          };
          run.frame = scheduler.requestFrame(loop);
        } catch (error) {
          fail(run, error);
        }
      });
    },

    cancel(): void {
      if (active) finish(active, 'cancelled');
    },
  };
};
