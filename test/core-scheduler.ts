import type { Scheduler } from '../src/core/player';

/** A display clock that lets tests deliver exactly one repaint at a time. */
export function manualScheduler(): Scheduler & {
  step: (time: number) => void;
  pending: () => number;
} {
  let time = 0;
  let id = 0;
  const callbacks = new Map<number, (now: number) => void>();
  return {
    now: () => time,
    requestFrame: (callback) => {
      callbacks.set(++id, callback);
      return id;
    },
    cancelFrame: (handle) => callbacks.delete(handle as number),
    step: (next) => {
      time = next;
      const nextFrame = [...callbacks.values()];
      callbacks.clear();
      for (const callback of nextFrame) callback(time);
    },
    pending: () => callbacks.size,
  };
}
