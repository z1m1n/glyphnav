/**
 * Adapter for Preact with `preact-iso` — Preact's official isomorphic router.
 *
 *  - `<GlyphnavProvider>` shares a single controller across the tree (optional).
 *  - `useGlyphnavRoute()` mirrors `useLocation().route()` but animates first.
 *  - `<GlyphnavLink>` is a drop-in for `<a>` that animates on click.
 *  - `useGlyphnavLinks()` (or `<GlyphnavProvider interceptLinks>`) animates the
 *    plain `<a>` clicks `preact-iso` already handles, without swapping them out.
 *
 * Like the React adapter this file uses `createElement` (no JSX), so the library
 * build needs no Preact compiler. `preact-iso` navigates synchronously (its
 * `route()` calls `history.pushState` inside the reducer), so the default
 * `commit: 'before'` lands before the animation with no settle wait.
 *
 * `preact-iso`'s `LocationProvider` installs a global `window` click handler that
 * navigates *every* same-origin `<a>` and ignores `defaultPrevented`. To stay out
 * of its way our entry points `stopPropagation()` (not just `preventDefault()`),
 * so a click is never handled twice.
 */
import { createContext, createElement } from 'preact';
import type { ComponentChildren, JSX } from 'preact';
import { useCallback, useContext, useEffect, useRef } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { GlyphnavController } from '../core';
import type { GlyphnavOptions, RunResult } from '../core';
import { eligibleAnchor, isModifiedClick } from '../internal/links';

/** `preact-iso`'s imperative navigate, from `useLocation().route`. */
type RouteFn = (url: string, replace?: boolean) => void;

/** Imperative navigate function returned by {@link useGlyphnavRoute}. */
export type GlyphnavRouteFn = (url: string, replace?: boolean) => Promise<RunResult>;

const GlyphnavContext = createContext<GlyphnavController | null>(null);

/**
 * The controller behind a `<GlyphnavProvider>`: created once and re-`update()`d
 * with the latest base options on every render, so option changes take effect
 * without tearing down the controller.
 */
const useSharedController = (options: GlyphnavOptions): GlyphnavController => {
  const ref = useRef<GlyphnavController | null>(null);
  if (ref.current) ref.current.update(options);
  else ref.current = new GlyphnavController(options);

  return ref.current;
};

/**
 * A stable per-component controller, built only when `enabled` (i.e. no provider
 * is in scope). Returns `null` when disabled so callers can prefer the context
 * controller via `??` without ever constructing a throwaway one.
 */
const useFallbackController = (
  enabled: boolean,
  options?: GlyphnavOptions,
): GlyphnavController | null => {
  const ref = useRef<GlyphnavController | null>(null);
  if (enabled && !ref.current) ref.current = new GlyphnavController(options);

  return ref.current;
};

/**
 * Intercept same-origin `<a>` clicks and play the animation before handing the
 * navigation to `preact-iso`. The listener sits on `document` (bubble), so it
 * runs before `preact-iso`'s own `window` listener; `stopPropagation` then keeps
 * that handler from navigating a second time. A no-op outside the browser.
 *
 * @param controller - Controller that plays the animation and commits.
 * @param route - `preact-iso`'s `route()` that performs the real navigation.
 * @returns A cleanup that detaches the click listener.
 */
const attachLinkInterceptor = (controller: GlyphnavController, route: RouteFn): (() => void) => {
  if (typeof document === 'undefined') return () => {};

  const handler = (event: Event): void => {
    const anchor = eligibleAnchor(event as MouseEvent);
    if (!anchor) return;

    const url = new URL(anchor.href, window.location.href);
    const to = url.pathname + url.search + url.hash;
    event.preventDefault();
    event.stopPropagation();
    void controller.run(to, () => route(to));
  };

  document.addEventListener('click', handler);
  return () => document.removeEventListener('click', handler);
};

export interface GlyphnavProviderProps extends GlyphnavOptions {
  children?: ComponentChildren;
  /**
   * Also animate browser back/forward (popstate) traversals for the subtree.
   * @defaultValue `false`
   */
  animatePopState?: boolean;
  /**
   * Animate the plain `<a>` clicks `preact-iso` already intercepts, without
   * swapping them for `<GlyphnavLink>`. Must be inside a `<LocationProvider>`.
   * @defaultValue `false`
   */
  interceptLinks?: boolean;
}

/**
 * Provide a shared controller (and base options) to the subtree. Optional — the
 * hooks work without it, each creating their own controller. Place it inside
 * `preact-iso`'s `<LocationProvider>` so it can read `route`.
 *
 * @param props - Base options plus `children`, `animatePopState`, `interceptLinks`.
 * @returns The provider element wrapping `children`.
 */
export const GlyphnavProvider = ({
  children,
  animatePopState = false,
  interceptLinks = false,
  ...options
}: GlyphnavProviderProps): JSX.Element => {
  const controller = useSharedController(options);
  const { route } = useLocation();

  useEffect(() => {
    if (animatePopState) return controller.enableHistoryAnimation();
  }, [controller, animatePopState]);

  useEffect(() => {
    if (interceptLinks) return attachLinkInterceptor(controller, route);
  }, [controller, interceptLinks, route]);

  return createElement(GlyphnavContext.Provider, { value: controller }, children);
};

/**
 * Get the controller from context, or a stable per-component fallback.
 *
 * @param options - Base options for the fallback controller (ignored when a
 * provider is present).
 * @returns The shared or per-component {@link GlyphnavController}.
 */
export const useGlyphnavController = (options?: GlyphnavOptions): GlyphnavController => {
  const fromContext = useContext(GlyphnavContext);
  const fallback = useFallbackController(!fromContext, options);

  return fromContext ?? (fallback as GlyphnavController);
};

/**
 * A `useLocation().route` replacement that plays the glyph animation before
 * navigating.
 *
 * @param options - Base animation options for navigations made through the
 * returned function.
 * @returns An imperative navigate function that animates, then navigates.
 * @example
 * ```tsx
 * const route = useGlyphnavRoute();
 * await route('/dashboard');
 * ```
 */
export const useGlyphnavRoute = (options?: GlyphnavOptions): GlyphnavRouteFn => {
  const controller = useGlyphnavController(options);
  const { route } = useLocation();

  return useCallback<GlyphnavRouteFn>(
    (url, replace) => controller.run(url, () => route(url, replace)),
    [controller, route],
  );
};

/**
 * Install the global link interceptor for the calling component's lifetime — the
 * hook form of `<GlyphnavProvider interceptLinks>`, for apps that keep plain
 * `<a>` links and don't use the provider. Must run inside a `<LocationProvider>`.
 *
 * @param options - Base animation options for the intercepted navigations.
 */
export const useGlyphnavLinks = (options?: GlyphnavOptions): void => {
  const controller = useGlyphnavController(options);
  const { route } = useLocation();

  useEffect(() => attachLinkInterceptor(controller, route), [controller, route]);
};

export interface GlyphnavLinkProps extends Omit<JSX.HTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** Destination path, like `preact-iso`'s plain `<a href>`. */
  href: string;
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean;
  /** Per-link option overrides. */
  glyphOptions?: GlyphnavOptions;
}

/**
 * Drop-in replacement for a plain `<a>` that animates on click, then hands the
 * navigation to `preact-iso`. Modified clicks (new tab, etc.) fall through to the
 * browser. `stopPropagation` keeps `preact-iso`'s global handler from navigating
 * a second time.
 *
 * @param props - Anchor attributes plus `href`, `replace`, `glyphOptions`.
 * @returns The rendered anchor element.
 */
export const GlyphnavLink = ({
  href,
  replace,
  onClick,
  glyphOptions,
  ...rest
}: GlyphnavLinkProps): JSX.Element => {
  const controller = useGlyphnavController(glyphOptions);
  const { route } = useLocation();

  const handleClick = useCallback(
    (event: JSX.TargetedMouseEvent<HTMLAnchorElement>): void => {
      onClick?.(event);
      if (isModifiedClick(event)) return; // let the browser handle modified clicks

      event.preventDefault();
      event.stopPropagation();
      void controller.run(href, () => route(href, replace));
    },
    [onClick, controller, route, href, replace],
  );

  return createElement('a', { href, onClick: handleClick, ...rest });
};
