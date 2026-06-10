import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlayer } from '../src/core/player';

describe('createPlayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires every tick in order and resolves "completed"', async () => {
    const player = createPlayer();
    const ticks: number[] = [];
    const done = player.play(3, 10, (i) => ticks.push(i));

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
});
