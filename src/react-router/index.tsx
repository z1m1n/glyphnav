/**
 * Adapter for React Router (v6–v8).
 *
 * Imports only from `react-router` — the navigation hooks (`useNavigate`,
 * `useHref`) live in that package in every version, so the adapter works with or
 * without `react-router-dom`. v6 ships the DOM bindings (`<Link>`, …) separately
 * in `react-router-dom`; v8 dropped that package and exposes everything from
 * `react-router`. Rendering a plain `<a>` (instead of `<Link>`) keeps the import
 * surface to the one package common to all three majors.
 *
 *  - `<GlyphnavProvider>` shares a single controller across the tree (optional).
 *  - `useGlyphnavNavigate()` is a drop-in for `useNavigate()` that animates first.
 *  - `<GlyphnavLink>` is a drop-in for `<Link>` that animates on click.
 *
 * Nothing is patched globally: only navigations made through these entry
 * points animate.
 */
import { createElement, useCallback } from 'react';
import type { AnchorHTMLAttributes, MouseEvent, ReactElement } from 'react';
import { createPath, parsePath, resolvePath, useHref, useNavigate } from 'react-router';
import type { NavigateOptions, To } from 'react-router';
import type { GlyphnavOptions, RunResult } from '../core';
import { toPath } from '../internal/links';
import { createControllerContext, runLinkClick } from '../internal/react';
import type { GlyphnavProviderProps } from '../internal/react';

export type { GlyphnavProviderProps };

/** Imperative navigate function returned by {@link useGlyphnavNavigate}. */
export type GlyphnavNavigateFn = (to: To | number, options?: NavigateOptions) => Promise<RunResult>;

const context = createControllerContext();

/**
 * Provide a shared controller (and base options) to the subtree. Optional —
 * the hooks work without it, each creating their own controller.
 */
export const GlyphnavProvider = context.GlyphnavProvider;

/**
 * Get the controller from context, or a stable per-component fallback.
 *
 * @param options - Base options for the fallback controller (ignored when a
 * provider is present).
 * @returns The shared or per-component {@link GlyphnavController}.
 */
export const useGlyphnavController = context.useGlyphnavController;

/**
 * A `useNavigate()` replacement that plays the glyph animation before
 * navigating. A numeric `to` (history delta) is passed straight through.
 *
 * @param options - Base animation options for navigations made through the
 * returned function.
 * @returns An imperative navigate function that animates, then navigates.
 */
export const useGlyphnavNavigate = (options?: GlyphnavOptions): GlyphnavNavigateFn => {
  const navigate = useNavigate();
  const controller = useGlyphnavController(options);
  const rootHref = useHref('/');

  return useCallback<GlyphnavNavigateFn>(
    async (to, navOptions) => {
      if (typeof to === 'number') {
        await navigate(to);
        return 'skipped';
      }

      let target = toPath(to);
      const path = typeof to === 'string' ? parsePath(to) : to;
      if (path.pathname?.startsWith('/')) {
        const resolved = resolvePath(to);
        // The root href carries BrowserRouter's basename or HashRouter's
        // fragment prefix. Root navigation keeps its exact trailing-slash form.
        target =
          resolved.pathname === '/'
            ? rootHref + resolved.search + resolved.hash
            : rootHref.replace(/\/$/, '') + createPath(resolved);
      }
      return controller.run(target, () => navigate(to, navOptions), options);
    },
    [navigate, controller, options, rootHref],
  );
};

export interface GlyphnavLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** Destination, like React Router's `<Link to>`. */
  to: To;
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean;
  /** History state to associate with the new location. */
  state?: unknown;
  /** Resolve `..` against route boundaries (default) or URL path segments. */
  relative?: 'route' | 'path';
  /** Preserve scroll position when the router supplies scroll restoration. */
  preventScrollReset?: boolean;
  /** Ask the router to use the browser's view transition API. */
  viewTransition?: boolean;
  /** Leave navigation to the browser, like React Router's `<Link reloadDocument>`. */
  reloadDocument?: boolean;
  /** Per-link option overrides. */
  glyphOptions?: GlyphnavOptions;
}

/**
 * Drop-in replacement for React Router's `<Link>` that animates on click.
 * Modified clicks (new tab, etc.) fall through to the browser as usual.
 *
 * Renders a plain `<a>` whose `href` comes from `useHref`, then navigates
 * imperatively — so it needs only `react-router` (no `<Link>`/`react-router-dom`).
 */
export const GlyphnavLink = ({
  to,
  onClick,
  replace,
  state,
  relative,
  preventScrollReset,
  viewTransition,
  reloadDocument,
  glyphOptions,
  ...rest
}: GlyphnavLinkProps): ReactElement => {
  const navigate = useNavigate();
  const controller = useGlyphnavController(glyphOptions);
  // `useHref` resolves `to` to a basename-aware path, so the rendered href and
  // the animated bar both match what React Router actually navigates to.
  const resolvedHref = useHref(to, { relative });
  const rootHref = useHref('/');
  const absolute = typeof to === 'string' && /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(to);
  const href = absolute ? to : resolvedHref;

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (reloadDocument) {
        onClick?.(event);
        return;
      }
      let destination = to;
      if (absolute) {
        const url = new URL(href, window.location.href);
        const base = rootHref.replace(/\/$/, '');
        // React Router's Link leaves same-origin URLs outside its basename to
        // the browser, and removes the basename before an internal navigation.
        if (
          url.origin !== window.location.origin ||
          (base && url.pathname !== base && !url.pathname.startsWith(base + '/'))
        ) {
          onClick?.(event);
          return;
        }
        destination = (url.pathname.slice(base.length) || '/') + url.search + url.hash;
      }
      runLinkClick(
        event,
        onClick,
        controller,
        href,
        () =>
          navigate(destination, { replace, state, relative, preventScrollReset, viewTransition }),
        glyphOptions,
      );
    },
    [
      onClick,
      controller,
      navigate,
      href,
      to,
      replace,
      state,
      relative,
      preventScrollReset,
      viewTransition,
      reloadDocument,
      glyphOptions,
      absolute,
      rootHref,
    ],
  );

  return createElement('a', { href, onClick: handleClick, ...rest });
};
