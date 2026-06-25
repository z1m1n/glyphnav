/**
 * Vue Router wiring shared by the Vue Router and Nuxt adapters (both drive Vue
 * Router under the hood). Not part of the public API.
 */
import type { Router, RouteLocationRaw } from 'vue-router';
import type { GlyphnavController } from '../core';

/** Vue Router's `push`/`replace` share one signature. */
export type RouterMethod = Router['push'];

/** How {@link wrapRouterMethod} resolves and optionally skips a navigation. */
export interface WrapOptions {
  /** The address-bar href to animate for `to` (base-/hash-aware per adapter). */
  resolveHref: (to: RouteLocationRaw) => string;
  /**
   * When it returns `true`, the animation is skipped and the call is delegated
   * straight to the original method (e.g. navigating to the current path).
   */
  shouldSkip?: (target: string, to: RouteLocationRaw) => boolean;
}

/**
 * Wrap a Vue Router `push`/`replace` so it plays the glyph animation first,
 * preserving the method's original return value so `await router.push(...)`
 * still resolves to Vue Router's own result.
 *
 * @param controller - The controller driving the animation.
 * @param router - The Vue Router instance the call delegates to.
 * @param original - The original `push`/`replace` to animate around.
 * @param options - How to resolve the animated href and when to skip.
 * @returns A drop-in replacement with the same signature as `original`.
 */
export const wrapRouterMethod = (
  controller: GlyphnavController,
  router: Router,
  original: RouterMethod,
  options: WrapOptions,
): RouterMethod => {
  return (async (to: RouteLocationRaw) => {
    const target = options.resolveHref(to);

    if (options.shouldSkip?.(target, to)) return original.call(router, to);

    let result: ReturnType<RouterMethod> | undefined;

    await controller.run(target, async () => {
      result = original.call(router, to);
      await result;
    });

    return result;
  }) as RouterMethod;
};

/** How {@link attachRouter} wraps a router and whether it patches it in place. */
export interface AttachConfig extends WrapOptions {
  /** Patch `router.push`/`router.replace` in place (vs. only exposing wrapped ones). */
  intercept: boolean;
  /** Also animate browser back/forward (popstate) traversals. */
  animatePopState: boolean;
}

/** The wrapped methods, the captured originals, and a teardown. */
export interface AttachedRouter {
  /** Animated `router.push`. */
  push: RouterMethod;
  /** Animated `router.replace`. */
  replace: RouterMethod;
  /** The router's original `push`, bound — for `navigateTo`-style helpers. */
  originalPush: RouterMethod;
  /** The router's original `replace`, bound. */
  originalReplace: RouterMethod;
  /** Restore the router's original methods, stop popstate, cancel any animation. */
  detach: () => void;
}

/**
 * Wire a controller to a Vue Router instance: build animated `push`/`replace`,
 * optionally patch them in place, optionally animate popstate, and return a
 * `detach()` that undoes all of it. Shared by the Vue Router and Nuxt adapters,
 * which differ only in how they resolve the animated href and whether they skip
 * same-path navigations.
 *
 * @param controller - The controller driving the animation.
 * @param router - The Vue Router instance to wrap.
 * @param config - How to resolve/skip, and whether to intercept and animate popstate.
 * @returns The animated methods, the captured originals, and `detach()`.
 */
export const attachRouter = (
  controller: GlyphnavController,
  router: Router,
  config: AttachConfig,
): AttachedRouter => {
  const originalPush = router.push.bind(router) as RouterMethod;
  const originalReplace = router.replace.bind(router) as RouterMethod;
  const wrap: WrapOptions = { resolveHref: config.resolveHref, shouldSkip: config.shouldSkip };
  const push = wrapRouterMethod(controller, router, originalPush, wrap);
  const replace = wrapRouterMethod(controller, router, originalReplace, wrap);

  if (config.intercept) {
    router.push = push;
    router.replace = replace;
  }

  const stopPopState = config.animatePopState
    ? controller.enableHistoryAnimation()
    : (): void => {};

  return {
    push,
    replace,
    originalPush,
    originalReplace,
    detach() {
      if (config.intercept) {
        router.push = originalPush;
        router.replace = originalReplace;
      }
      stopPopState();
      controller.cancel();
    },
  };
};
