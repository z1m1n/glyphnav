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
      ? requestAnimationFrame(callback)
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
   * Fire `tick(0..count-1)` in order, scheduling each for `index * stepDuration`
   * ms after the run starts (the first fires on the next animation frame).
   * Timing is keyed off the run's start, not the previous tick, so the run never
   * drifts slow and a stalled or backgrounded frame simply catches up.
   *
   * @param count - Number of ticks to fire.
   * @param stepDuration - Target milliseconds between ticks.
   * @param tick - Called with the zero-based index of each tick.
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
  let frame: unknown = null;
  let running = false;
  let settle: ((result: PlayResult) => void) | null = null;

  const finish = (result: PlayResult): void => {
    running = false;
    if (frame != null) {
      scheduler.cancelFrame(frame);
      frame = null;
    }

    const resolve = settle;
    settle = null;
    if (resolve) resolve(result);
  };

  return {
    get running(): boolean {
      return running;
    },

    play(count, stepDuration, tick): Promise<PlayResult> {
      // A new run supersedes any in-flight one.
      if (running) finish('cancelled');

      return new Promise<PlayResult>((resolve) => {
        settle = resolve;
        if (count <= 0) {
          finish('completed');
          return;
        }
        running = true;
        let i = 0;
        const start = scheduler.now();

        const loop = (now: number): void => {
          frame = null;
          if (!running) return; // cancelled between frames
          const elapsed = now - start;
          // Fire every tick whose scheduled time has arrived, in order. After a
          // stall (or a backgrounded tab resuming) this catches up to "now" in a
          // single frame rather than replaying in slow motion.
          while (i < count && elapsed >= i * stepDuration) {
            tick(i);
            if (!running) return; // a tick cancelled the run (e.g. external nav)
            i += 1;
          }
          if (i >= count) {
            finish('completed');
            return;
          }
          frame = scheduler.requestFrame(loop);
        };

        frame = scheduler.requestFrame(loop);
      });
    },

    cancel(): void {
      if (running) finish('cancelled');
    },
  };
};
