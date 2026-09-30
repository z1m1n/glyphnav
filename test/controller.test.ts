import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlyphnavController, createGlyphnav } from '../src/core/controller';
import { seqRng } from './helpers';
import { manualScheduler } from './core-scheduler';

function resetLocation(): void {
  window.history.replaceState(null, '', '/');
}

describe('GlyphnavController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetLocation();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('scrambles the address bar, then commits the real navigation', async () => {
    const frames: string[] = [];
    let started = 0;
    let committed = 0;
    const controller = new GlyphnavController({
      charset: 'xyzw',
      rng: seqRng([0, 0.25, 0.5, 0.75]),
      stepDuration: 20,
      hooks: {
        onStart: () => (started += 1),
        onFrame: (f) => frames.push(f.path),
        onCommit: () => (committed += 1),
      },
    });
    const commit = vi.fn(() => {
      window.history.pushState(null, '', '/test');
    });

    const run = controller.run('/test', commit);
    await vi.advanceTimersByTimeAsync(200);
    const result = await run;

    expect(result).toBe('completed');
    expect(frames).toEqual(['/x', '/xy', '/xyz', '/xyzw', '/tyzw', '/tezw', '/tesw', '/test']);
    expect(started).toBe(1);
    expect(committed).toBe(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/test');
    expect(controller.animating).toBe(false);
  });

  it('skips the animation when reduced motion is preferred', async () => {
    const onFrame = vi.fn();
    const controller = new GlyphnavController(
      { stepDuration: 10, hooks: { onFrame } },
      { prefersReducedMotion: () => true },
    );
    const commit = vi.fn();

    const result = await controller.run('/anywhere', commit);

    expect(result).toBe('skipped');
    expect(onFrame).not.toHaveBeenCalled();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('skips the animation when there is no history object', async () => {
    const controller = new GlyphnavController({}, { history: null });
    const commit = vi.fn();
    const result = await controller.run('/x', commit);
    expect(result).toBe('skipped');
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('skips (but still commits) when there is nothing to animate', async () => {
    const controller = createGlyphnav();
    const commit = vi.fn();
    const result = await controller.run('/', commit); // root => empty text
    expect(result).toBe('skipped');
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('lets a newer navigation supersede an in-flight one', async () => {
    // Classic order: the superseded run is cancelled before it commits.
    const controller = new GlyphnavController({
      charset: 'q',
      rng: () => 0,
      stepDuration: 10,
      commit: 'after',
    });
    const commitA = vi.fn(() => window.history.pushState(null, '', '/aaaa'));
    const commitB = vi.fn(() => window.history.pushState(null, '', '/bbbb'));

    const runA = controller.run('/aaaa', commitA);
    await vi.advanceTimersByTimeAsync(15); // a couple of A's frames
    const runB = controller.run('/bbbb', commitB);
    await vi.advanceTimersByTimeAsync(300);

    const [rA, rB] = await Promise.all([runA, runB]);
    expect(rA).toBe('cancelled');
    expect(rB).toBe('completed');
    expect(commitA).not.toHaveBeenCalled();
    expect(commitB).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/bbbb');
  });

  it('cancel() aborts the run, restores the bar and does not commit', async () => {
    // Classic order: with navigate-first the commit would already have fired.
    const controller = new GlyphnavController({
      charset: 'q',
      rng: () => 0,
      stepDuration: 10,
      commit: 'after',
    });
    const commit = vi.fn();

    const run = controller.run('/abcdef', commit);
    await vi.advanceTimersByTimeAsync(15);
    controller.cancel();
    const result = await run;

    expect(result).toBe('cancelled');
    expect(commit).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/');
    expect(controller.animating).toBe(false);
  });

  it('normalizes relative targets so every frame is written as a rooted path', async () => {
    window.history.replaceState(null, '', '/vue/features');
    const frames: string[] = [];
    let ctxTo = '';
    const controller = new GlyphnavController({
      charset: 'q',
      rng: () => 0,
      stepDuration: 10,
      // Classic order so the bar restores to the start before the (no-op) commit.
      commit: 'after',
      hooks: {
        onStart: (ctx) => (ctxTo = ctx.to),
        onFrame: (f) => frames.push(f.path),
      },
    });
    const commit = vi.fn();

    const run = controller.run('pricing', commit);
    await vi.advanceTimersByTimeAsync(500);
    const result = await run;

    expect(result).toBe('completed');
    expect(ctxTo).toBe('/vue/pricing');
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((p) => p.startsWith('/'))).toBe(true);
    expect(frames.at(-1)).toBe('/vue/pricing');
    // The bar is restored to the starting path before the commit runs.
    expect(window.location.pathname).toBe('/vue/features');
  });

  it('repeated relative navigations never stack the written URL', async () => {
    window.history.replaceState(null, '', '/vue/features/');
    const controller = new GlyphnavController({ charset: 'q', rng: () => 0, stepDuration: 5 });

    for (let i = 0; i < 3; i++) {
      const run = controller.run('vue/features/', () => {
        window.history.pushState(null, '', '/vue/features/');
      });
      await vi.advanceTimersByTimeAsync(500);
      await run;
    }

    expect(window.location.pathname).toBe('/vue/features/');
  });

  it('does not animate cross-origin or protocol-relative targets', async () => {
    const onFrame = vi.fn();
    const controller = new GlyphnavController({ stepDuration: 5, hooks: { onFrame } });

    const commitA = vi.fn();
    expect(await controller.run('https://other.example/x', commitA)).toBe('skipped');
    const commitB = vi.fn();
    expect(await controller.run('//other.example/x', commitB)).toBe('skipped');

    expect(onFrame).not.toHaveBeenCalled();
    expect(commitA).toHaveBeenCalledTimes(1);
    expect(commitB).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/');
  });

  it('bails out without restoring or committing when the URL moves externally', async () => {
    const onCancel = vi.fn();
    const controller = new GlyphnavController({
      charset: 'q',
      rng: () => 0,
      stepDuration: 10,
      // Classic order: with navigate-first the commit would fire before the
      // external move and the assertions below would not hold.
      commit: 'after',
      hooks: { onCancel },
    });
    const commit = vi.fn();

    const run = controller.run('/abcdefgh', commit);
    await vi.advanceTimersByTimeAsync(25);
    // Simulate the user hitting the back button mid-animation.
    window.history.replaceState(null, '', '/somewhere-else');
    await vi.advanceTimersByTimeAsync(500);
    const result = await run;

    expect(result).toBe('cancelled');
    expect(commit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    // The externally set URL is left alone — not overwritten back to '/'.
    expect(window.location.pathname).toBe('/somewhere-else');
  });

  it('spreads a total duration across all frames', async () => {
    const frames: string[] = [];
    const controller = new GlyphnavController({
      charset: 'q',
      rng: () => 0,
      duration: 140, // '/test' yields 8 frames → 20 ms apart
      commit: 'after', // frame-timing test drives the animate-then-commit path
      hooks: { onFrame: (f) => frames.push(f.path) },
    });

    const run = controller.run('/test', vi.fn());
    await vi.advanceTimersByTimeAsync(16);
    expect(frames.length).toBe(1); // first frame lands on the next animation frame
    await vi.advanceTimersByTimeAsync(64); // ~80 ms elapsed — past the halfway point
    expect(frames.length).toBeGreaterThanOrEqual(3); // frames are spread across the duration…
    expect(frames.length).toBeLessThan(8); // …not dumped all at once
    await vi.advanceTimersByTimeAsync(80); // past the full 140 ms duration
    expect(frames.length).toBe(8); // every frame has landed
    await expect(run).resolves.toBe('completed');
  });

  it('compresses long paths to fit a short duration', async () => {
    const frames: string[] = [];
    const controller = new GlyphnavController({
      charset: 'q',
      rng: () => 0,
      duration: 45, // → 3-frame budget at ≥15 ms per frame
      commit: 'after', // frame-timing test drives the animate-then-commit path
      hooks: { onFrame: (f) => frames.push(f.path) },
    });

    const run = controller.run('/abcdefghijklmnopqrstuvwxyz', vi.fn());
    await vi.advanceTimersByTimeAsync(200);
    await expect(run).resolves.toBe('completed');

    expect(frames.length).toBeLessThanOrEqual(3);
    expect(frames.at(-1)).toBe('/abcdefghijklmnopqrstuvwxyz');
  });

  it("commit: 'before' navigates immediately, then animates on top", async () => {
    const order: string[] = [];
    const controller = new GlyphnavController({
      charset: 'xyzw',
      rng: seqRng([0, 0.25, 0.5, 0.75]),
      stepDuration: 20,
      commit: 'before',
      hooks: {
        onStart: () => order.push('start'),
        onFrame: (f) => order.push(f.path),
        onCommit: () => order.push('commit-hook'),
      },
    });
    const commit = vi.fn(() => {
      order.push('commit');
      window.history.pushState(null, '', '/test');
    });

    const run = controller.run('/test', commit);
    await vi.advanceTimersByTimeAsync(200);
    await expect(run).resolves.toBe('completed');

    // The real navigation fires before any frame is drawn.
    expect(order.slice(0, 3)).toEqual(['commit-hook', 'commit', 'start']);
    expect(order.slice(3)).toEqual([
      '/x',
      '/xy',
      '/xyz',
      '/xyzw',
      '/tyzw',
      '/tezw',
      '/tesw',
      '/test',
    ]);
    // The bar ends at the landed URL — no restore back to the start.
    expect(window.location.pathname).toBe('/test');
  });

  it("commit: 'before' animates to the URL the navigation actually landed on", async () => {
    const frames: string[] = [];
    const controller = new GlyphnavController({
      charset: 'q',
      rng: () => 0,
      stepDuration: 5,
      commit: 'before',
      hooks: { onFrame: (f) => frames.push(f.path) },
    });
    // The "router" redirects /dashboard to /login.
    const commit = vi.fn(() => window.history.pushState(null, '', '/login'));

    const run = controller.run('/dashboard', commit);
    await vi.advanceTimersByTimeAsync(500);
    await expect(run).resolves.toBe('completed');

    expect(frames.at(-1)).toBe('/login');
    expect(window.location.pathname).toBe('/login');
  });

  it("commit: 'before' skips the animation when the URL does not change", async () => {
    const onFrame = vi.fn();
    const controller = new GlyphnavController({
      stepDuration: 5,
      commit: 'before',
      hooks: { onFrame },
    });
    const commit = vi.fn(); // a guard blocked the navigation — URL untouched

    await expect(controller.run('/blocked', commit)).resolves.toBe('skipped');

    expect(commit).toHaveBeenCalledTimes(1);
    expect(onFrame).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/');
  });

  it("cancel() during a commit: 'before' run restores the landed URL", async () => {
    const controller = new GlyphnavController({
      charset: 'q',
      rng: () => 0,
      stepDuration: 10,
      commit: 'before',
    });
    const commit = vi.fn(() => window.history.pushState(null, '', '/test'));

    const run = controller.run('/test', commit);
    await vi.advanceTimersByTimeAsync(15); // a couple of frames in
    controller.cancel();
    await expect(run).resolves.toBe('cancelled');

    // The navigation itself already happened; only the animation was cancelled.
    expect(commit).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/test');
  });

  it("a newer run supersedes an in-flight commit: 'before' animation", async () => {
    const controller = new GlyphnavController({
      charset: 'q',
      rng: () => 0,
      stepDuration: 10,
      commit: 'before',
    });
    const commitA = vi.fn(() => window.history.pushState(null, '', '/aaaa'));
    const commitB = vi.fn(() => window.history.pushState(null, '', '/bbbb'));

    const runA = controller.run('/aaaa', commitA);
    await vi.advanceTimersByTimeAsync(15);
    const runB = controller.run('/bbbb', commitB);
    await vi.advanceTimersByTimeAsync(300);

    expect(await runA).toBe('cancelled');
    expect(await runB).toBe('completed');
    expect(commitA).toHaveBeenCalledTimes(1); // its navigation still happened
    expect(commitB).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/bbbb');
  });

  it("commit: 'before' leaves the bar alone when the URL moves externally", async () => {
    const controller = new GlyphnavController({
      charset: 'q',
      rng: () => 0,
      stepDuration: 10,
      commit: 'before',
    });
    const commit = vi.fn(() => window.history.pushState(null, '', '/abcdefgh'));

    const run = controller.run('/abcdefgh', commit);
    await vi.advanceTimersByTimeAsync(25);
    // Simulate the user hitting the back button mid-animation.
    window.history.replaceState(null, '', '/somewhere-else');
    await vi.advanceTimersByTimeAsync(500);
    await expect(run).resolves.toBe('cancelled');

    expect(window.location.pathname).toBe('/somewhere-else');
  });

  it("commit: 'before' under reduced motion just commits once", async () => {
    const controller = new GlyphnavController(
      { commit: 'before' },
      { prefersReducedMotion: () => true },
    );
    const commit = vi.fn();
    await expect(controller.run('/anywhere', commit)).resolves.toBe('skipped');
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('replay() animates between two known paths without committing', async () => {
    // The browser has already moved the bar to /test (popstate); replay only
    // decodes on top — no commit callback at all.
    window.history.replaceState(null, '', '/test');
    const frames: string[] = [];
    const controller = new GlyphnavController({
      charset: 'xyzw',
      rng: seqRng([0, 0.25, 0.5, 0.75]),
      stepDuration: 20,
      hooks: { onFrame: (f) => frames.push(f.path) },
    });

    const run = controller.replay('/', '/test');
    await vi.advanceTimersByTimeAsync(200);

    await expect(run).resolves.toBe('completed');
    expect(frames).toEqual(['/x', '/xy', '/xyz', '/xyzw', '/tyzw', '/tezw', '/tesw', '/test']);
    expect(window.location.pathname).toBe('/test');
  });

  it('replay() skips a no-op (from === to) and under reduced motion', async () => {
    const onFrame = vi.fn();
    const a = new GlyphnavController({ stepDuration: 5, hooks: { onFrame } });
    await expect(a.replay('/x', '/x')).resolves.toBe('skipped');

    const b = new GlyphnavController(
      { stepDuration: 5, hooks: { onFrame } },
      { prefersReducedMotion: () => true },
    );
    await expect(b.replay('/', '/test')).resolves.toBe('skipped');
    expect(onFrame).not.toHaveBeenCalled();
  });

  it('enableHistoryAnimation animates a back/forward traversal, tracking the from-path', async () => {
    window.history.replaceState(null, '', '/users/1');
    const frames: string[] = [];
    const controller = new GlyphnavController({
      charset: 'q',
      rng: () => 0,
      stepDuration: 20,
      scope: 'tail', // only the differing tail animates → proves `from` is tracked
      hooks: { onFrame: (f) => frames.push(f.path) },
    });
    const stop = controller.enableHistoryAnimation();

    // Forward navigation updates the tracked path to /users/2.
    const fwd = controller.run('/users/2', () => window.history.pushState(null, '', '/users/2'));
    await vi.advanceTimersByTimeAsync(200);
    await fwd;

    // The browser handles the back button: it moves the URL itself, then fires
    // popstate. We replay from the previously shown /users/2 to /users/1, so the
    // tail scope only scrambles the final character.
    frames.length = 0;
    window.history.replaceState(null, '', '/users/1');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.advanceTimersByTimeAsync(200);

    expect(frames).toEqual(['/users/q', '/users/1']);
    expect(window.location.pathname).toBe('/users/1');

    // After teardown a traversal no longer animates.
    stop();
    frames.length = 0;
    window.history.replaceState(null, '', '/users/2');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.advanceTimersByTimeAsync(200);
    expect(frames).toEqual([]);
  });

  it('supports async commit functions', async () => {
    const controller = new GlyphnavController({ charset: 'q', rng: () => 0, stepDuration: 5 });
    const order: string[] = [];
    const commit = vi.fn(async () => {
      order.push('commit-start');
      await Promise.resolve();
      order.push('commit-end');
    });

    const run = controller.run('/ab', commit, {
      hooks: { onComplete: () => order.push('complete') },
    });
    await vi.advanceTimersByTimeAsync(100);
    await run;

    expect(order).toEqual(['commit-start', 'commit-end', 'complete']);
  });

  it('does not start playback after cancellation inside onStart', async () => {
    const onFrame = vi.fn();
    const commit = vi.fn();
    const onComplete = vi.fn();
    const controller = new GlyphnavController({
      commit: 'after',
      hooks: { onStart: () => controller.cancel(), onFrame, onComplete },
    });
    const done = controller.run('/destination', commit);
    await vi.advanceTimersByTimeAsync(2000);

    await expect(done).resolves.toBe('cancelled');
    expect(onFrame).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe('/');
  });

  it('settles a throwing onFrame and restores the real URL', async () => {
    const scheduler = manualScheduler();
    const error = new Error('onFrame failed');
    const commit = vi.fn();
    const controller = new GlyphnavController(
      {
        commit: 'after',
        hooks: {
          onFrame: () => {
            throw error;
          },
        },
      },
      { scheduler },
    );
    let outcome: unknown = 'pending';
    void controller.run('/destination', commit).catch((reason: unknown) => {
      outcome = reason;
    });
    try {
      scheduler.step(0);
    } catch {
      /* regression: a throwing hook escaped the scheduler */
    }
    await vi.advanceTimersByTimeAsync(0);

    expect(outcome).toBe(error);
    expect(window.location.pathname).toBe('/');
    expect(controller.animating).toBe(false);
    expect(commit).not.toHaveBeenCalled();
  });

  it('keeps history animation enabled after a cancelled navigation', async () => {
    window.history.replaceState(null, '', '/users/1');
    const frames: string[] = [];
    const controller = new GlyphnavController({
      commit: 'after',
      stepDuration: 40,
      charset: 'q',
      scope: 'tail',
      hooks: { onFrame: (frame) => frames.push(frame.path) },
    });
    const stop = controller.enableHistoryAnimation();
    try {
      const done = controller.run('/users/2', vi.fn());
      await vi.advanceTimersByTimeAsync(16);
      controller.cancel();
      await done;
      frames.length = 0;
      window.history.replaceState(null, '', '/users/3');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await vi.advanceTimersByTimeAsync(100);
      expect(frames).toEqual(['/users/q', '/users/3']);
    } finally {
      stop();
    }
  });

  it('records the landed path after commit-after for the next history traversal', async () => {
    window.history.replaceState(null, '', '/users/1');
    const frames: string[] = [];
    const controller = new GlyphnavController({
      commit: 'after',
      stepDuration: 40,
      charset: 'q',
      scope: 'tail',
      hooks: { onFrame: (frame) => frames.push(frame.path) },
    });
    const stop = controller.enableHistoryAnimation();
    try {
      const done = controller.run('/users/2', () => window.history.pushState(null, '', '/users/2'));
      await vi.advanceTimersByTimeAsync(100);
      await done;
      frames.length = 0;
      window.history.replaceState(null, '', '/users/1');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await vi.advanceTimersByTimeAsync(100);
      expect(frames).toEqual(['/users/q', '/users/1']);
    } finally {
      stop();
    }
  });

  it.each([false, true])(
    'settles cancellation while navigation is pending (reduced motion: %s)',
    async (reduceMotion) => {
      let settleCommit!: () => void;
      const commit = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            settleCommit = resolve;
          }),
      );
      const onComplete = vi.fn();
      const controller = new GlyphnavController(
        { hooks: { onComplete } },
        { prefersReducedMotion: () => reduceMotion },
      );
      let outcome: unknown = 'pending';
      void controller.run('/pending', commit).then((result) => {
        outcome = result;
        return result;
      });
      controller.cancel();
      await vi.advanceTimersByTimeAsync(0);
      expect(outcome).toBe('cancelled');
      expect(onComplete).toHaveBeenCalledWith({ from: '/', to: '/pending' }, 'cancelled');
      settleCommit();
      await vi.advanceTimersByTimeAsync(0);
      expect(onComplete).toHaveBeenCalledOnce();
    },
  );

  it('does not rewrite the landed URL redundantly after the final frame', async () => {
    const scheduler = manualScheduler();
    let path = '/';
    const replaceState = vi.fn((_state: unknown, _title: string, next: string) => {
      path = next;
    });
    const controller = new GlyphnavController(
      { maxFrames: 2, charset: 'q', stepDuration: 10 },
      {
        history: { state: { key: 'route' }, replaceState } as unknown as History,
        getCurrentPath: () => path,
        scheduler,
      },
    );
    const done = controller.run('/destination', () => {
      path = '/destination';
    });
    await vi.advanceTimersByTimeAsync(0);
    scheduler.step(0);
    scheduler.step(10);
    await expect(done).resolves.toBe('completed');
    expect(replaceState).toHaveBeenCalledTimes(2);
    expect(replaceState).toHaveBeenLastCalledWith({ key: 'route' }, '', '/destination');
  });

  it('aborts superseded router settlement without allowing it to affect its successor', async () => {
    let firstSignal: AbortSignal | undefined;
    let rejectFirst!: (error: Error) => void;
    const firstComplete = vi.fn();
    const controller = new GlyphnavController({ stepDuration: 40, charset: 'q' });
    const first = controller.run(
      '/first',
      (signal) => {
        firstSignal = signal;
        return new Promise<void>((_resolve, reject) => {
          rejectFirst = reject;
        });
      },
      { hooks: { onComplete: firstComplete } },
    );
    const frames: string[] = [];
    const second = controller.run('/second', () => window.history.pushState(null, '', '/second'), {
      hooks: { onFrame: (frame) => frames.push(frame.path) },
    });

    await expect(first).resolves.toBe('cancelled');
    expect(firstSignal?.aborted).toBe(true);
    rejectFirst(new Error('late router rejection'));
    await vi.advanceTimersByTimeAsync(1000);
    await expect(second).resolves.toBe('completed');
    expect(firstComplete).toHaveBeenCalledOnce();
    expect(frames.at(-1)).toBe('/second');
    expect(window.location.pathname).toBe('/second');
  });

  it.each(['onStart', 'onCommit', 'onComplete'] as const)(
    'cleans up a throwing %s hook and allows later navigation',
    async (hook) => {
      const error = new Error(`${hook} failed`);
      const controller = new GlyphnavController({ commit: 'after', maxFrames: 1 });
      const failure = controller
        .run('/bad', vi.fn(), {
          hooks: {
            [hook]: () => {
              throw error;
            },
          },
        })
        .catch((reason: unknown) => reason);
      await vi.advanceTimersByTimeAsync(100);
      await expect(failure).resolves.toBe(error);
      expect(controller.animating).toBe(false);
      expect(window.location.pathname).toBe('/');

      const next = controller.run('/good', () => window.history.pushState(null, '', '/good'));
      await vi.advanceTimersByTimeAsync(100);
      await expect(next).resolves.toBe('completed');
      expect(window.location.pathname).toBe('/good');
    },
  );

  it('finishes cancellation hooks once even when onCancel throws', async () => {
    const error = new Error('onCancel failed');
    const onComplete = vi.fn();
    const controller = new GlyphnavController({
      commit: 'after',
      hooks: {
        onCancel: () => {
          throw error;
        },
        onComplete,
      },
    });
    const failure = controller.run('/bad', vi.fn());
    controller.cancel();
    await expect(failure).rejects.toBe(error);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledWith({ from: '/', to: '/bad' }, 'cancelled');
    expect(controller.animating).toBe(false);
    expect(window.location.pathname).toBe('/');
  });

  it('rejects failed async navigation without starting animation', async () => {
    const error = new Error('router failed');
    const onFrame = vi.fn();
    const controller = new GlyphnavController({ hooks: { onFrame } });
    await expect(controller.run('/bad', () => Promise.reject(error))).rejects.toBe(error);
    expect(onFrame).not.toHaveBeenCalled();
    expect(controller.animating).toBe(false);
    expect(window.location.pathname).toBe('/');
  });

  it('destroy cancels active work and detaches all history listeners, allowing reuse', async () => {
    const onFrame = vi.fn();
    const controller = new GlyphnavController({
      stepDuration: 40,
      charset: 'q',
      hooks: { onFrame },
    });
    controller.enableHistoryAnimation();
    controller.enableHistoryAnimation();
    const active = controller.run('/active', () => window.history.pushState(null, '', '/active'));
    await vi.advanceTimersByTimeAsync(16);
    controller.destroy();
    await expect(active).resolves.toBe('cancelled');
    onFrame.mockClear();
    window.history.replaceState(null, '', '/external');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(onFrame).not.toHaveBeenCalled();

    const stop = controller.enableHistoryAnimation();
    try {
      window.history.replaceState(null, '', '/next');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await vi.advanceTimersByTimeAsync(1000);
      expect(onFrame).toHaveBeenCalled();
      expect(window.location.pathname).toBe('/next');
    } finally {
      stop();
    }
  });
});
