/**
 * Adapter for TanStack Router (`@tanstack/react-router`).
 *
 *  - `<GlyphnavProvider>` shares a single controller across the tree (optional).
 *  - `useGlyphnavNavigate()` mirrors `useNavigate()` but animates first.
 *  - `<GlyphnavLink>` renders an `<a>` that animates on click.
 *
 * Nothing is patched globally: only navigations made through these entry
 * points animate.
 */
import { createContext, createElement, useCallback, useContext, useMemo, useRef } from 'react';
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useRouter } from '@tanstack/react-router';
import type { NavigateOptions } from '@tanstack/react-router';
import { GlyphnavController } from '../core';
import type { GlyphnavOptions, RunResult } from '../core';

/** Imperative navigate function returned by {@link useGlyphnavNavigate}. */
export type GlyphnavNavigateFn = (opts: NavigateOptions) => Promise<RunResult>;

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

/** Get the controller from context, or a stable per-component fallback. */
export const useGlyphnavController = (options?: GlyphnavOptions): GlyphnavController => {
  const fromContext = useContext(GlyphnavContext);
  const ref = useRef<GlyphnavController | null>(null);
  if (fromContext) return fromContext;
  if (!ref.current) ref.current = new GlyphnavController(options);

  return ref.current;
};

/**
 * A `useNavigate()` replacement that plays the glyph animation before handing
 * the navigation to TanStack Router.
 */
export const useGlyphnavNavigate = (options?: GlyphnavOptions): GlyphnavNavigateFn => {
  const router = useRouter();
  const controller = useGlyphnavController(options);

  return useCallback<GlyphnavNavigateFn>(
    (opts) => {
      // `buildLocation` yields the basepath-aware href that will really end up
      // in the address bar.
      const target = router.buildLocation(opts).href;
      return controller.run(target, () => router.navigate(opts) as Promise<void>);
    },
    [router, controller],
  );
};

export interface GlyphnavLinkProps
  extends
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>,
    Pick<NavigateOptions, 'to' | 'params' | 'search' | 'hash' | 'state' | 'replace'> {
  /** Per-link option overrides. */
  glyphOptions?: GlyphnavOptions;
}

/**
 * An anchor that animates, then navigates via TanStack Router. Modified clicks
 * (new tab, etc.) fall through to the browser as usual. For fully type-safe
 * links wrap {@link useGlyphnavNavigate} in your own component instead.
 */
export const GlyphnavLink = ({
  to,
  params,
  search,
  hash,
  state,
  replace,
  glyphOptions,
  onClick,
  children,
  ...rest
}: GlyphnavLinkProps) => {
  const router = useRouter();
  const controller = useGlyphnavController(glyphOptions);
  const navOpts = useMemo(
    () => ({ to, params, search, hash, state, replace }) as NavigateOptions,
    [to, params, search, hash, state, replace],
  );
  const href = router.buildLocation(navOpts).href;

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);

      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return; // let the browser handle modified clicks
      }

      event.preventDefault();
      void controller.run(href, () => router.navigate(navOpts) as Promise<void>);
    },
    [onClick, controller, router, href, navOpts],
  );

  return createElement('a', { href, onClick: handleClick, ...rest }, children);
};
