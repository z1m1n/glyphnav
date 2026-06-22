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
