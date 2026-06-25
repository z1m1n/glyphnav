/**
 * Framework-free integration.
 *
 *  - `navigate(to)` — animate, then perform the navigation.
 *  - `install()` — optionally hijack same-origin `<a>` clicks so links animate.
 *
 * Both share a single default controller so animations never overlap.
 */
import { GlyphnavController } from '../core';
import type { ControllerDeps, GlyphnavOptions, RunResult } from '../core';
import { eligibleAnchor } from '../internal/links';

export { eligibleAnchor } from '../internal/links';

export interface NavigateOptions extends GlyphnavOptions {
  /**
   * Hard-reload to the destination (classic multi-page sites).
   * @defaultValue `true`
   */
  reload?: boolean;
  /**
   * When not reloading, use `replaceState` instead of `pushState`.
   * @defaultValue `false`
   */
  replace?: boolean;
}

export interface InstallOptions extends GlyphnavOptions {
  /**
   * What to intercept. `'links'` hijacks same-origin anchor clicks; `'none'`
   * animates only programmatic `navigate()` calls.
   * @defaultValue `'links'`
   */
  intercept?: 'links' | 'none';
  /**
   * Element the click listener is attached to.
   * @defaultValue `document`
   */
  root?: Document | HTMLElement;
  /**
   * Reload on navigation (MPA) vs. push a history entry (SPA).
   * @defaultValue `true`
   */
  reload?: boolean;
  /**
   * Also animate browser back/forward (popstate) traversals. Defaults to `true`
   * when intercepting links — the install already animates every link click, so
   * history moves stay consistent — and `false` otherwise. Harmless in reload
   * (MPA) mode, where each entry is a fresh document, so it only does visible
   * work for SPA navigations (`reload: false`).
   * @defaultValue `intercept === 'links'`
   */
  animatePopState?: boolean;
  /** Final say on whether a given anchor should be animated. */
  shouldHandle?: (anchor: HTMLAnchorElement, event: MouseEvent) => boolean;
}

export interface GlyphnavHandle {
  /** The shared controller, e.g. to call `cancel()` or `update()`. */
  readonly controller: GlyphnavController;
  /** Animate then navigate programmatically. */
  navigate: (to: string, options?: NavigateOptions) => Promise<RunResult>;
  /** Remove all listeners added by this install. */
  uninstall: () => void;
}

let defaultController: GlyphnavController | null = null;
const installCleanups: Array<() => void> = [];

const getController = (options?: GlyphnavOptions, deps?: ControllerDeps): GlyphnavController => {
  if (!defaultController) {
    defaultController = new GlyphnavController(options, deps);
  } else if (options) {
    defaultController.update(options);
  }

  return defaultController;
};

/** Replace the shared controller (mainly for tests). */
export const resetController = (): void => {
  defaultController?.cancel();
  defaultController = null;
};

/**
 * Resolve `to` against the current location. Returns `null` for cross-origin
 * destinations, which cannot be animated in the address bar.
 */
const targetPath = (to: string): string | null => {
  if (typeof window === 'undefined') return to;

  const url = new URL(to, window.location.href);
  if (url.origin !== window.location.origin) return null;

  return url.pathname + url.search + url.hash;
};

const dispatchNavigation = (to: string): void => {
  if (typeof window === 'undefined') return;

  // Let popstate-based vanilla routers react to a pushState navigation.
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  window.dispatchEvent(new CustomEvent('glyphnav:navigate', { detail: { to } }));
};

const commit = (path: string, reload: boolean, replace: boolean): void => {
  if (typeof window === 'undefined') return;

  if (reload) {
    window.location.assign(path);
    return;
  }

  if (replace) {
    window.history.replaceState(null, '', path);
  } else {
    window.history.pushState(null, '', path);
  }

  dispatchNavigation(path);
};

/**
 * Animate the address bar to `to`, then perform the navigation. Resolves once
 * the navigation has been committed (or skipped, e.g. under reduced motion or
 * for cross-origin destinations).
 *
 * @param to - Destination path or URL. Cross-origin targets are not animated.
 * @param options - Per-call navigation and animation options.
 * @returns The outcome of the run (`completed`, `cancelled`, or `skipped`).
 */
export const navigate = (to: string, options: NavigateOptions = {}): Promise<RunResult> => {
  const { reload = true, replace = false, ...glyph } = options;
  const controller = getController(glyph);
  const path = targetPath(to);
  if (path == null) {
    if (typeof window !== 'undefined') window.location.assign(to);
    return Promise.resolve<RunResult>('skipped');
  }

  // A hard reload unloads the page, leaving nothing to animate on top of —
  // navigate-first silently falls back to the classic animate-then-commit.
  const perCall: GlyphnavOptions = reload ? { ...glyph, commit: 'after' } : glyph;
  return controller.run(path, () => commit(path, reload, replace), perCall);
};

/**
 * Set up the shared controller and (by default) hijack same-origin link clicks
 * so every navigation plays the glyph animation. Pass `intercept: 'none'` to
 * leave links alone and animate only programmatic `navigate()` calls.
 *
 * @param options - Interception and animation options.
 * @returns A handle exposing the controller, `navigate`, and `uninstall`.
 */
export const install = (options: InstallOptions = {}): GlyphnavHandle => {
  const {
    intercept = 'links',
    root = typeof document !== 'undefined' ? document : undefined,
    reload = true,
    animatePopState = intercept === 'links',
    shouldHandle,
    ...glyph
  } = options;

  const controller = getController(glyph);

  if (animatePopState) {
    installCleanups.push(controller.enableHistoryAnimation());
  }

  if (intercept === 'links' && root) {
    const handler = (event: Event): void => {
      const anchor = eligibleAnchor(event as MouseEvent);
      if (!anchor) return;
      if (shouldHandle && !shouldHandle(anchor, event as MouseEvent)) return;

      const url = new URL(anchor.href, window.location.href);
      const to = url.pathname + url.search + url.hash;
      event.preventDefault();
      // Reload mode unloads the page — force the classic order (see navigate()).
      void controller.run(
        to,
        () => commit(to, reload, false),
        reload ? { commit: 'after' } : undefined,
      );
    };
    root.addEventListener('click', handler);
    installCleanups.push(() => root.removeEventListener('click', handler));
  }

  return {
    controller,
    navigate,
    uninstall,
  };
};

/** Detach every listener added by {@link install}. */
export const uninstall = (): void => {
  while (installCleanups.length) installCleanups.pop()!();
  defaultController?.cancel();
};
