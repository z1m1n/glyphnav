/**
 * Adapter for Vue Router.
 *
 * By default it wraps `router.push` / `router.replace` so every navigation
 * (including `<router-link>` clicks, which call `push` under the hood) plays
 * the glyph-scramble first, preserving the original return value so
 * `await router.push(...)` still works. With `intercept: 'none'` the router is
 * left untouched and only the animated `push`/`replace` exposed by the adapter
 * animate.
 */
import { inject } from 'vue';
import type { App, InjectionKey } from 'vue';
import type { Router, RouteLocationRaw } from 'vue-router';
import { GlyphnavController } from '../core';
import type { GlyphnavOptions } from '../core';

export interface VueGlyphnavOptions extends GlyphnavOptions {
  /**
   * `'router'` patches `router.push`/`router.replace` so all navigations
   * animate. `'none'` patches nothing — only navigations made through the
   * animated `push`/`replace` of {@link GlyphnavVueInstance} animate.
   * @defaultValue `'router'`
   */
  intercept?: 'router' | 'none';
}

export interface GlyphnavVueInstance {
  /** The controller driving the animation. */
  controller: GlyphnavController;
  /** Animated `router.push`. */
  push: Router['push'];
  /** Animated `router.replace`. */
  replace: Router['replace'];
  /** Restore the router's original methods and cancel any animation. */
  detach: () => void;
}

/** Injection key for the controller provided by the {@link glyphnav} plugin. */
export const GLYPHNAV_KEY: InjectionKey<GlyphnavController> = Symbol('glyphnav');

/** Injection key for the full adapter instance (animated push/replace). */
export const GLYPHNAV_ROUTER_KEY: InjectionKey<GlyphnavVueInstance> = Symbol('glyphnav-router');

type PushFn = Router['push'];

const wrap = (controller: GlyphnavController, router: Router, original: PushFn): PushFn => {
  return ((to: RouteLocationRaw) => {
    // `.href` is base-aware (matches the real address bar); `.fullPath` is not.
    const target = router.resolve(to).href;
    let result: ReturnType<PushFn> | undefined;
    return controller
      .run(target, async () => {
        result = original.call(router, to);
        await result;
      })
      .then(() => result);
  }) as PushFn;
};

/**
 * Attach glyphnav to an existing router instance.
 *
 * @param router - The Vue Router instance to wrap.
 * @param options - Adapter and animation options.
 * @returns The controller, the animated `push`/`replace`, and a `detach()`
 * that restores the router.
 */
export const attachGlyphnav = (
  router: Router,
  options: VueGlyphnavOptions = {},
): GlyphnavVueInstance => {
  const { intercept = 'router', ...glyph } = options;
  const controller = new GlyphnavController(glyph);
  const originalPush = router.push.bind(router) as PushFn;
  const originalReplace = router.replace.bind(router) as PushFn;
  const push = wrap(controller, router, originalPush);
  const replace = wrap(controller, router, originalReplace);

  if (intercept === 'router') {
    router.push = push;
    router.replace = replace;
  }

  return {
    controller,
    push,
    replace,
    detach() {
      if (intercept === 'router') {
        router.push = originalPush;
        router.replace = originalReplace;
      }
      controller.cancel();
    },
  };
};

/**
 * Vue plugin. Read the controller with {@link useGlyphnav}, or the animated
 * navigation functions with {@link useGlyphnavRouter}.
 *
 * @example
 * ```ts
 * app.use(glyphnav, { router, charset: MATRIX, stepDuration: 30 });
 * ```
 */
export const glyphnav = {
  install(app: App, options: VueGlyphnavOptions & { router: Router }): void {
    const { router, ...rest } = options;
    if (!router) {
      throw new Error('[glyphnav] the Vue plugin requires a `router` option.');
    }
    const instance = attachGlyphnav(router, rest);
    app.provide(GLYPHNAV_KEY, instance.controller);
    app.provide(GLYPHNAV_ROUTER_KEY, instance);
  },
};

/**
 * Composable to read the controller provided by the plugin.
 *
 * @remarks Throws if the plugin has not been installed.
 * @returns The controller provided by the {@link glyphnav} plugin.
 */
export const useGlyphnav = (): GlyphnavController => {
  const controller = inject(GLYPHNAV_KEY, null);
  if (!controller) {
    throw new Error(
      '[glyphnav] useGlyphnav() called without installing the plugin (app.use(glyphnav, { router })).',
    );
  }

  return controller;
};

/**
 * Composable to read the animated `push`/`replace`. The main entry point when
 * the plugin is installed with `intercept: 'none'`.
 *
 * @remarks Throws if the plugin has not been installed.
 * @returns The adapter instance exposing the animated `push`/`replace`.
 */
export const useGlyphnavRouter = (): GlyphnavVueInstance => {
  const instance = inject(GLYPHNAV_ROUTER_KEY, null);
  if (!instance) {
    throw new Error(
      '[glyphnav] useGlyphnavRouter() called without installing the plugin (app.use(glyphnav, { router })).',
    );
  }

  return instance;
};
