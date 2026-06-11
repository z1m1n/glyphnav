import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stub Angular so the suite stays fast and free of the Angular runtime. The
// adapter only needs `InjectionToken` (a value) and `Router` (used as a DI
// token in `deps`); everything else it touches is a plain method on the Router
// instance we pass in.
vi.mock('@angular/core', () => ({
  InjectionToken: class {
    constructor(public description: string) {}
  },
}));
vi.mock('@angular/router', () => ({
  Router: class {},
}));
vi.mock('@angular/common', () => ({
  Location: class {},
}));

import { GLYPHNAV, createGlyphnavNavigator, provideGlyphnav } from '../src/angular-router';

interface MockRouter {
  navigateByUrl: ReturnType<typeof vi.fn>;
  createUrlTree: ReturnType<typeof vi.fn>;
  serializeUrl: ReturnType<typeof vi.fn>;
}

function makeRouter(): MockRouter {
  return {
    navigateByUrl: vi.fn(() => Promise.resolve(true)),
    createUrlTree: vi.fn((commands: unknown[]) => ({ __tree: commands })),
    serializeUrl: vi.fn((tree: { __tree?: unknown[] } | string) =>
      typeof tree === 'string' ? tree : '/' + (tree.__tree ?? []).join('/'),
    ),
  };
}

describe('angular adapter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('navigateByUrl animates the bar then delegates to Router.navigateByUrl', async () => {
    const router = makeRouter();
    const frames: string[] = [];
    const nav = createGlyphnavNavigator(router as never, {
      charset: 'q',
      rng: () => 0,
      stepDuration: 5,
      // The mock Router never updates window.location, so navigate-first (the
      // default) would have no landed URL to animate; pin the classic order.
      commit: 'after',
      hooks: { onFrame: (f) => frames.push(f.path) },
    });

    const run = nav.navigateByUrl('/test');
    await vi.advanceTimersByTimeAsync(200);
    await run;

    expect(frames.length).toBeGreaterThan(0);
    expect(frames.at(-1)).toBe('/test');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/test', undefined);
  });

  it('navigate builds a UrlTree, animates, then delegates', async () => {
    const router = makeRouter();
    const nav = createGlyphnavNavigator(router as never, {
      charset: 'q',
      rng: () => 0,
      stepDuration: 5,
    });

    const run = nav.navigate(['users', 42]);
    await vi.advanceTimersByTimeAsync(200);
    await run;

    expect(router.createUrlTree).toHaveBeenCalledWith(['users', 42], undefined);
    expect(router.navigateByUrl).toHaveBeenCalledTimes(1);
  });

  it('animates the base-href-aware URL via prepareUrl', async () => {
    const router = makeRouter();
    const frames: string[] = [];
    const nav = createGlyphnavNavigator(
      router as never,
      {
        charset: 'q',
        rng: () => 0,
        stepDuration: 5,
        // Mock Router → no window.location update; pin the classic order.
        commit: 'after',
        hooks: { onFrame: (f) => frames.push(f.path) },
      },
      (url) => '/app' + url,
    );

    const run = nav.navigateByUrl('/test');
    await vi.advanceTimersByTimeAsync(500);
    await run;

    // The bar animates the real (base-prefixed) path…
    expect(frames.at(-1)).toBe('/app/test');
    // …while the Router still receives the router-internal URL.
    expect(router.navigateByUrl).toHaveBeenCalledWith('/test', undefined);
  });

  it('provideGlyphnav returns a useFactory provider bound to the GLYPHNAV token', () => {
    const providers = provideGlyphnav({ charset: 'q' });
    expect(providers).toHaveLength(1);

    const provider = providers[0] as {
      provide: unknown;
      deps: unknown[];
      useFactory: (
        router: MockRouter,
        location: { prepareExternalUrl: (url: string) => string },
      ) => { controller: unknown; navigateByUrl: unknown };
    };
    expect(provider.provide).toBe(GLYPHNAV);
    expect(provider.deps).toHaveLength(2); // Router + Location

    const location = { prepareExternalUrl: (url: string) => url };
    const nav = provider.useFactory(makeRouter(), location);
    expect(nav.controller).toBeDefined();
    expect(typeof nav.navigateByUrl).toBe('function');
  });
});
