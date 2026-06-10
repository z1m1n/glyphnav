import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { attachGlyphnav, glyphnav } from '../src/vue-router';

const routes = [
  { path: '/', component: { template: '<div>home</div>' } },
  { path: '/test', component: { template: '<div>test</div>' } },
  { path: '/other', component: { template: '<div>other</div>' } },
];

/** A router with its initial route resolved (no app mount needed). */
async function makeRouter(): Promise<Router> {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push('/'); // kick off the initial navigation
  return router;
}

describe('vue adapter', () => {
  afterEach(() => vi.useRealTimers());

  it('animates the address bar then performs the real router.push', async () => {
    const router = await makeRouter();
    const frames: string[] = [];
    attachGlyphnav(router, {
      charset: 'q',
      rng: () => 0,
      stepDuration: 5,
      hooks: { onFrame: (f) => frames.push(f.path) },
    });

    vi.useFakeTimers();
    const push = router.push('/test');
    await vi.advanceTimersByTimeAsync(200);
    await push;

    expect(frames.length).toBeGreaterThan(0);
    expect(frames.at(-1)).toBe('/test');
    expect(router.currentRoute.value.fullPath).toBe('/test');
  });

  it('stops animating after detach', async () => {
    const router = await makeRouter();
    const onFrame = vi.fn();
    const instance = attachGlyphnav(router, { stepDuration: 5, hooks: { onFrame } });
    instance.detach();

    await router.push('/other');

    expect(onFrame).not.toHaveBeenCalled();
    expect(router.currentRoute.value.fullPath).toBe('/other');
  });

  it("intercept: 'none' leaves the router untouched but still offers animated push", async () => {
    const router = await makeRouter();
    const originalPush = router.push;
    const onFrame = vi.fn();
    const instance = attachGlyphnav(router, {
      intercept: 'none',
      charset: 'q',
      rng: () => 0,
      stepDuration: 5,
      hooks: { onFrame },
    });

    // Plain router.push is not patched and does not animate.
    expect(router.push).toBe(originalPush);
    await router.push('/other');
    expect(onFrame).not.toHaveBeenCalled();

    // The adapter's own push animates.
    vi.useFakeTimers();
    const push = instance.push('/test');
    await vi.advanceTimersByTimeAsync(200);
    await push;
    expect(onFrame).toHaveBeenCalled();
    expect(router.currentRoute.value.fullPath).toBe('/test');
  });

  it('the plugin requires a router option', () => {
    const app = createApp({ render: () => null });
    // @ts-expect-error intentionally missing router
    expect(() => app.use(glyphnav, {})).toThrow(/router/);
  });
});
