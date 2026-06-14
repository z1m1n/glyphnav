import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { Router } from 'vue-router';
import { attachGlyphnav, installGlyphnav } from '../src/nuxt';

const routes = [
  { path: '/', component: { template: '<div>home</div>' } },
  { path: '/test', component: { template: '<div>test</div>' } },
  { path: '/other', component: { template: '<div>other</div>' } },
];

/** A router with its initial route resolved (no app mount needed). */
async function makeRouter(): Promise<Router> {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push('/');
  return router;
}

describe('nuxt adapter', () => {
  afterEach(() => vi.useRealTimers());

  it('wraps router.push so navigations animate then commit', async () => {
    const router = await makeRouter();
    const frames: string[] = [];
    attachGlyphnav(router, {
      charset: 'q',
      rng: () => 0,
      stepDuration: 5,
      // Memory history never touches window.location, so navigate-first has no
      // landed URL to animate to; pin the classic order.
      commit: 'after',
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

  it("intercept: 'none' leaves the router untouched but still offers animated navigate", async () => {
    const router = await makeRouter();
    const originalPush = router.push;
    const onFrame = vi.fn();
    const instance = attachGlyphnav(router, {
      intercept: 'none',
      charset: 'q',
      rng: () => 0,
      stepDuration: 5,
      commit: 'after',
      hooks: { onFrame },
    });

    // Plain router.push is not patched and does not animate.
    expect(router.push).toBe(originalPush);
    await router.push('/other');
    expect(onFrame).not.toHaveBeenCalled();

    // The adapter's own navigate animates.
    vi.useFakeTimers();
    const navigation = instance.navigate('/test');
    await vi.advanceTimersByTimeAsync(200);
    await navigation;
    expect(onFrame).toHaveBeenCalled();
    expect(router.currentRoute.value.fullPath).toBe('/test');
  });

  it('installGlyphnav provides the instance as $glyphnav', async () => {
    const router = await makeRouter();
    const provided: Record<string, unknown> = {};
    const instance = installGlyphnav(
      { $router: router, provide: (name, value) => (provided[name] = value) },
      { stepDuration: 5 },
    );

    expect(provided.glyphnav).toBe(instance);
    expect(instance.controller).toBeTruthy();
  });
});
