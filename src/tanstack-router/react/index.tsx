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
import { createContext, createElement, useCallback, useContext, useMemo } from 'react';
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useRouter } from '@tanstack/react-router';
import type { NavigateOptions } from '@tanstack/react-router';
import type { GlyphnavController, GlyphnavOptions, RunResult } from '../../core';
import {
  runLinkClick,
  useFallbackController,
  useHistoryAnimation,
  useSharedController,
} from '../../internal/react';

/** Imperative navigate function returned by {@link useGlyphnavNavigate}. */
export type GlyphnavNavigateFn = (opts: NavigateOptions) => Promise<RunResult>;

const GlyphnavContext = createContext<GlyphnavController | null>(null);

export interface GlyphnavProviderProps extends GlyphnavOptions {
  children: ReactNode;
  /**
   * Also animate browser back/forward (popstate) traversals for the subtree.
   * Off by design — the adapter patches nothing globally until you opt in here.
   * @defaultValue `false`
   */
  animatePopState?: boolean;
}

/**
 * Provide a shared controller (and base options) to the subtree. Optional —
 * the hooks work without it, each creating their own controller.
 */
export const GlyphnavProvider = ({
  children,
  animatePopState = false,
  ...options
}: GlyphnavProviderProps) => {
  const controller = useSharedController(options);
  useHistoryAnimation(controller, animatePopState);

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
 * A `useNavigate()` replacement that plays the glyph animation before handing
 * the navigation to TanStack Router.
 *
 * @param options - Base animation options for navigations made through the
 * returned function.
 * @returns An imperative navigate function that animates, then navigates.
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
    (event: MouseEvent<HTMLAnchorElement>) =>
      runLinkClick(
        event,
        onClick,
        controller,
        href,
        () => router.navigate(navOpts) as Promise<void>,
      ),
    [onClick, controller, router, href, navOpts],
  );

  return createElement('a', { href, onClick: handleClick, ...rest }, children);
};
