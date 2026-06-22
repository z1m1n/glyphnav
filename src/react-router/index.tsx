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
import { createContext, createElement, useCallback, useContext, useRef } from 'react';
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useHref, useNavigate } from 'react-router';
import type { NavigateOptions, To } from 'react-router';
import { GlyphnavController } from '../core';
import type { GlyphnavOptions, RunResult } from '../core';
import { isModifiedClick, toPath } from '../internal/links';

/** Imperative navigate function returned by {@link useGlyphnavNavigate}. */
export type GlyphnavNavigateFn = (to: To | number, options?: NavigateOptions) => Promise<RunResult>;

const GlyphnavContext = createContext<GlyphnavController | null>(null);

export interface GlyphnavProviderProps extends GlyphnavOptions {
  children: ReactNode;
}

/**
 * Provide a shared controller (and base options) to the subtree. Optional —
 * the hooks work without it, each creating their own controller.
 */
export const GlyphnavProvider = ({ children, ...options }: GlyphnavProviderProps) => {
  const ref = useRef<GlyphnavController | null>(null);
  if (!ref.current) ref.current = new GlyphnavController(options);
  else ref.current.update(options);

  return createElement(GlyphnavContext.Provider, { value: ref.current }, children);
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
  const ref = useRef<GlyphnavController | null>(null);
  if (fromContext) return fromContext;
  if (!ref.current) ref.current = new GlyphnavController(options);

  return ref.current;
};

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

  return useCallback<GlyphnavNavigateFn>(
    (to, navOptions) => {
      if (typeof to === 'number') {
        navigate(to);
        return Promise.resolve<RunResult>('skipped');
      }

      const target = toPath(to);
      return controller.run(target, () => {
        navigate(to, navOptions);
      });
    },
    [navigate, controller],
  );
};

export interface GlyphnavLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** Destination, like React Router's `<Link to>`. */
  to: To;
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean;
  /** History state to associate with the new location. */
  state?: unknown;
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
  glyphOptions,
  ...rest
}: GlyphnavLinkProps) => {
  const navigate = useNavigate();
  const controller = useGlyphnavController(glyphOptions);
  // `useHref` resolves `to` to a basename-aware path, so the rendered href and
  // the animated bar both match what React Router actually navigates to.
  const href = useHref(to);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (isModifiedClick(event)) return; // let the browser handle modified clicks

      event.preventDefault();
      void controller.run(href, () => {
        navigate(to, { replace, state });
      });
    },
    [onClick, controller, navigate, href, to, replace, state],
  );

  return createElement('a', { href, onClick: handleClick, ...rest });
};
