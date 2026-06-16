/**
 * Adapter for Nuxt (Nuxt 3+). Nuxt runs on Vue Router, so the engine is the
 * same as the Vue Router adapter — only the wiring is Nuxt-idiomatic.
 *
 * By default it wraps `router.push`/`router.replace`, so every `<NuxtLink>`
 * click and every `navigateTo()` call animates first (both ultimately go
 * through Vue Router). With `intercept: 'none'` the router is left untouched and
 * only the animated `push`/`replace`/`navigate` exposed by the instance animate.
 *
 * The `historyMode` option keeps the animated address-bar target correct whether
 * the app uses history mode (default) or hash mode (`createWebHashHistory`), so
 * the adapter works with either of Nuxt's router configurations.
 */
import type { Router, RouteLocationRaw } from 'vue-router';
import { GlyphnavController } from '../core';
import type { GlyphnavOptions, RunResult } from '../core';
import { wrapRouterMethod } from '../internal/vue-router';

/** Which Vue Router history mode Nuxt is configured with. */
export type NuxtHistoryMode = 'history' | 'hash';

export interface NuxtGlyphnavOptions extends GlyphnavOptions {
  /**
   * `'router'` patches `router.push`/`router.replace` so all navigations
   * (including `<NuxtLink>` clicks and `navigateTo()`) animate. `'none'` patches
   * nothing — only navigations made through the animated `push`/`replace`/
   * `navigate` of {@link NuxtGlyphnavInstance} animate.
   * @defaultValue `'router'`
   */
  intercept?: 'router' | 'none';
  /**
   * The Vue Router history mode Nuxt uses. In `'hash'` mode the route lives in
   * the URL fragment (`/#/about`), so the animated target is normalised to the
   * rooted path the address bar actually shows. `'history'` (the default,
   * `createWebHistory`) is fully base-aware via Vue Router's `resolve()`.
   * @defaultValue `'history'`
   */
  historyMode?: NuxtHistoryMode;
}

export interface NuxtGlyphnavInstance {
  /** The controller driving the animation. */
  controller: GlyphnavController;
  /** Animated `router.push`. */
  push: Router['push'];
  /** Animated `router.replace`. */
  replace: Router['replace'];
  /**
   * Animated, `navigateTo`-style navigation. Animates even when
   * `intercept: 'none'` left the router untouched.
   */
  navigate: (to: RouteLocationRaw, options?: { replace?: boolean }) => Promise<RunResult>;
  /** Restore the router's original methods and cancel any animation. */
  detach: () => void;
}

/**
 * The path the address bar actually shows for `to`. `resolve().href` is
 * base-aware; in hash mode it lives in the fragment, so root it (`#/x` →
 * `/#/x`) to match `location.pathname + hash` — what the controller reads.
 */
const resolveTarget = (router: Router, to: RouteLocationRaw, mode: NuxtHistoryMode): string => {
  const href = router.resolve(to).href;
  if (mode === 'hash' && href.startsWith('#')) return '/' + href;

  return href;
};

const samePathForm = (a: string, b: string): boolean =>
  a.replace(/\/(?=$|[?#])/, '') === b.replace(/\/(?=$|[?#])/, '');

/**
 * Attach glyphnav to a Nuxt app's Vue Router instance.
 *
 * @param router - The Vue Router instance Nuxt exposes (`useRouter()` /
 * `nuxtApp.$router`).
 * @param options - Adapter and animation options.
 * @returns The controller, the animated `push`/`replace`/`navigate`, and a
 * `detach()` that restores the router.
 */
export const attachGlyphnav = (
  router: Router,
  options: NuxtGlyphnavOptions = {},
): NuxtGlyphnavInstance => {
  const { intercept = 'router', historyMode = 'history', ...glyph } = options;
  const controller = new GlyphnavController(glyph);
  const originalPush = router.push.bind(router) as Router['push'];
  const originalReplace = router.replace.bind(router) as Router['push'];
  const resolveHref = (to: RouteLocationRaw): string => resolveTarget(router, to, historyMode);
  // Skip the animation when navigating to the path already on screen.
  const shouldSkip = (target: string): boolean =>
    samePathForm(resolveTarget(router, router.currentRoute.value.fullPath, historyMode), target);
  const push = wrapRouterMethod(controller, router, originalPush, { resolveHref, shouldSkip });
  const replace = wrapRouterMethod(controller, router, originalReplace, { resolveHref, shouldSkip });

  if (intercept === 'router') {
    router.push = push;
    router.replace = replace;
  }

  return {
    controller,
    push,
    replace,
    navigate(to, navOptions) {
      const original = navOptions?.replace ? originalReplace : originalPush;
      return controller.run(resolveTarget(router, to, historyMode), async () => {
        await original.call(router, to);
      });
    },
    detach() {
      if (intercept === 'router') {
        router.push = originalPush;
        router.replace = originalReplace;
      }
      controller.cancel();
    },
  };
};

/** Minimal shape of the Nuxt app object {@link installGlyphnav} needs. */
export interface NuxtAppLike {
  /** The Vue Router instance Nuxt provides. */
  $router: Router;
  /** Nuxt's helper for exposing values as `$name` on `useNuxtApp()`. */
  provide: (name: string, value: unknown) => void;
}

/**
 * Convenience for a Nuxt plugin: attach glyphnav and expose the instance as
 * `useNuxtApp().$glyphnav`.
 *
 * @param nuxtApp - The object passed to a Nuxt plugin (`defineNuxtPlugin`).
 * @param options - Adapter and animation options.
 * @returns The {@link NuxtGlyphnavInstance} (also provided as `$glyphnav`).
 *
 * @example
 * ```ts
 * // plugins/glyphnav.client.ts
 * export default defineNuxtPlugin((nuxtApp) => {
 *   installGlyphnav(nuxtApp, { duration: 250, commit: 'before' });
 * });
 * ```
 */
export const installGlyphnav = (
  nuxtApp: NuxtAppLike,
  options: NuxtGlyphnavOptions = {},
): NuxtGlyphnavInstance => {
  const instance = attachGlyphnav(nuxtApp.$router, options);
  nuxtApp.provide('glyphnav', instance);

  return instance;
};
