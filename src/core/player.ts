/** Result of a playback run. */
export type PlayResult = 'completed' | 'cancelled';

/**
 * The timer primitives the player needs. Injectable so tests can drive it with
 * fake timers and SSR code can supply no-ops.
 */
export interface Scheduler {
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

/** A scheduler backed by the global timer functions. */
export const defaultScheduler: Scheduler = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Drives a fixed number of evenly-spaced "ticks". Calling {@link Player.play}
 * again, or {@link Player.cancel}, settles any in-flight run as `'cancelled'`
 * before starting/stopping — so only one run is ever live at a time.
 */
export interface Player {
  readonly running: boolean;
  /**
   * Fire `tick(0..count-1)`, one tick every `stepDuration` ms (the first fires
   * on the next macrotask). Resolves `'completed'` after the last tick or
   * `'cancelled'` if interrupted.
   */
  play(count: number, stepDuration: number, tick: (index: number) => void): Promise<PlayResult>;
  /** Stop the current run (if any), resolving its promise with `'cancelled'`. */
  cancel(): void;
}

export const createPlayer = (scheduler: Scheduler = defaultScheduler): Player => {
  let timer: unknown = null;
  let running = false;
  let settle: ((result: PlayResult) => void) | null = null;

  const finish = (result: PlayResult): void => {
    running = false;
    if (timer != null) {
      scheduler.clearTimeout(timer);
      timer = null;
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
        const step = (): void => {
          timer = null;
          if (!running) return; // cancelled between ticks
          tick(i);
          if (!running) return; // cancelled from within the tick
          i += 1;
          if (i >= count) {
            finish('completed');
            return;
          }
          timer = scheduler.setTimeout(step, stepDuration);
        };
        timer = scheduler.setTimeout(step, 0);
      });
    },

    cancel(): void {
      if (running) finish('cancelled');
    },
  };
};
