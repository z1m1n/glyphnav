import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlayer, defaultScheduler } from '../src/core/player';
import { manualScheduler } from './core-scheduler';

describe('createPlayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires every tick in order and resolves "completed"', async () => {
    const player = createPlayer();
    const ticks: number[] = [];
    const done = player.play(3, 20, (i) => ticks.push(i));

    await vi.advanceTimersByTimeAsync(50);
    await expect(done).resolves.toBe('completed');
    expect(ticks).toEqual([0, 1, 2]);
    expect(player.running).toBe(false);
  });

  it('resolves "completed" immediately for a zero-length run', async () => {
    const player = createPlayer();
    const tick = vi.fn();
    const done = player.play(0, 10, tick);
    await expect(done).resolves.toBe('completed');
    expect(tick).not.toHaveBeenCalled();
  });

  it('stops on cancel and resolves "cancelled"', async () => {
    const player = createPlayer();
    const ticks: number[] = [];
    const done = player.play(10, 10, (i) => ticks.push(i));

    await vi.advanceTimersByTimeAsync(25); // ~3 ticks in
    player.cancel();
    await expect(done).resolves.toBe('cancelled');

    const seen = ticks.length;
    await vi.advanceTimersByTimeAsync(200);
    expect(ticks.length).toBe(seen); // no further ticks after cancel
    expect(player.running).toBe(false);
  });

  it('supersedes an in-flight run when play is called again', async () => {
    const player = createPlayer();
    const first = player.play(10, 10, () => {});
    const second = player.play(2, 10, () => {});

    await expect(first).resolves.toBe('cancelled');
    await vi.advanceTimersByTimeAsync(50);
    await expect(second).resolves.toBe('completed');
  });

  it('renders only the latest due frame after a stalled repaint', async () => {
    const scheduler = manualScheduler();
    const player = createPlayer(scheduler);
    const ticks: number[] = [];
    const done = player.play(120, 10, (index) => ticks.push(index));

    scheduler.step(1190);

    await expect(done).resolves.toBe('completed');
    expect(ticks).toEqual([119]);
    expect(scheduler.pending()).toBe(0);
  });

  it('rejects a throwing tick and removes the pending playback', async () => {
    const scheduler = manualScheduler();
    const player = createPlayer(scheduler);
    const error = new Error('frame failed');
    let outcome: unknown = 'pending';
    void player
      .play(3, 10, () => {
        throw error;
      })
      .catch((reason: unknown) => {
        outcome = reason;
      });

    // Older players leak the error out of the scheduler and never settle.
    try {
      scheduler.step(0);
    } catch {
      /* assertion below captures the leak */
    }
    await Promise.resolve();

    expect(outcome).toBe(error);
    expect(player.running).toBe(false);
    expect(scheduler.pending()).toBe(0);
  });

  it('does not let a tick that starts another playback finish its successor', async () => {
    const scheduler = manualScheduler();
    const player = createPlayer(scheduler);
    const ticks: number[] = [];
    let second: Promise<unknown> | undefined;
    const first = player.play(1, 0, () => {
      second = player.play(2, 10, (index) => ticks.push(index));
    });
    scheduler.step(0);

    await expect(first).resolves.toBe('cancelled');
    expect(player.running).toBe(true);
    scheduler.step(10);
    await expect(second).resolves.toBe('completed');
    expect(ticks).toEqual([1]);
  });

  it('uses the same clock for now and frame callbacks even when RAF timestamps differ', () => {
    let callback!: FrameRequestCallback;
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((next) => {
      callback = next;
      return 1;
    });
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    try {
      const tick = vi.fn();
      defaultScheduler.requestFrame(tick);
      callback(100);
      expect(tick).toHaveBeenCalledWith(defaultScheduler.now());
    } finally {
      raf.mockRestore();
      now.mockRestore();
    }
  });
});
