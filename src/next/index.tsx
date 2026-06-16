/**
 * Adapter for Next.js — works with **both** the App Router (`app/` folder) and
 * the Pages Router (`pages/` folder).
 *
 *  - `<GlyphnavProvider>` shares a single controller (and the router mode) across
 *    the tree (optional).
 *  - `useGlyphnavNavigate()` mirrors `useRouter().push` but animates first.
 *  - `<GlyphnavLink>` is a drop-in for `next/link`'s `<Link>` that animates on click.
 *
 * Nothing is patched globally: only navigations made through these entry points
 * animate. The `routerMode` option selects which Next router API drives the real
 * navigation — `'app'` (default) uses `next/navigation`, `'pages'` uses
 * `next/compat/router` — so the same adapter works whichever folder convention,
 * `app/` or `pages/`, your routes live in.
 */
'use client';

import { createContext, createElement, useCallback, useContext, useMemo, useRef } from 'react';
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import type { LinkProps } from 'next/link';
import { useRouter as useAppRouter } from 'next/navigation';
import { useRouter as usePagesRouter } from 'next/compat/router';
import { GlyphnavController } from '../core';
import type { GlyphnavOptions, RunResult } from '../core';
import { isModifiedClick, toPath } from '../internal/links';

/** Which Next.js routing system drives the real navigation. */
export type NextRouterMode = 'app' | 'pages';

/** Per-navigation overrides forwarded to the Next router's `push`/`replace`. */
export interface NextNavigateExtras {
  /** Use `replace` instead of `push` (no new history entry). */
  replace?: boolean;
  /** Forwarded to Next as the `scroll` option. */
  scroll?: boolean;
}

export interface NextGlyphnavOptions extends GlyphnavOptions {
  /**
   * Which Next.js router API performs the navigation.
   *
   * - `'app'` — the App Router (`app/` folder), via `next/navigation`.
   * - `'pages'` — the Pages Router (`pages/` folder), via `next/compat/router`.
   *
   * The animation is identical either way; this only changes which router the
   * adapter hands the real navigation to, so the same code animates under either
   * folder convention. Treat it as a static, app-wide choice (it must not change
   * between renders).
   * @defaultValue `'app'`
   */
  routerMode?: NextRouterMode;
  /**
   * The `basePath` the app is served under (Next's `basePath` config). It is
   * prefixed onto the animated target so the address bar matches the real URL
   * when `commit: 'after'`. With the default `commit: 'before'` the landed URL
   * is read back from the browser, so this is only needed for `commit: 'after'`.
   * @defaultValue `''`
   */
  basePath?: string;
}

/** Imperative navigate function returned by {@link useGlyphnavNavigate}. */
export type GlyphnavNavigateFn = (href: string, options?: NextNavigateExtras) => Promise<RunResult>;

interface GlyphnavContextValue {
  controller: GlyphnavController;
  mode: NextRouterMode;
  basePath: string;
}

const GlyphnavContext = createContext<GlyphnavContextValue | null>(null);

/** Strip the adapter-only options before they reach the framework-agnostic core. */
const toGlyphOptions = (options?: NextGlyphnavOptions): GlyphnavOptions => {
  if (!options) return {};
  const { routerMode: _mode, basePath: _base, ...glyph } = options;
  return glyph;
};

/** Prefix the base path onto a rooted href (matters only for `commit: 'after'`). */
const withBasePath = (basePath: string, href: string): string => {
  if (!basePath || !href.startsWith('/')) return href;
  const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;

  return href.startsWith(base + '/') || href === base ? href : base + href;
};

interface NextNav {
  push: (href: string, extras?: NextNavigateExtras) => void;
  replace: (href: string, extras?: NextNavigateExtras) => void;
}

/**
 * Resolve the active Next router's `push`/`replace`. `routerMode` is a static
 * App-vs-Pages choice that never changes between renders, so dispatching to
 * exactly one router hook is safe — but `next/navigation`'s `useRouter` throws
 * outside the App Router, which is why the branch (not an unconditional call of
 * both) is deliberate.
 */
const useNextNav = (mode: NextRouterMode): NextNav => {
  // oxlint-disable-next-line react-hooks/rules-of-hooks -- `mode` is render-stable; see above.
  if (mode === 'pages') {
    // `next/compat/router`'s `useRouter` is safe to call in both `app/` and
    // `pages/`, returning null in the App Router (where this branch never runs).
    // oxlint-disable-next-line react-hooks/rules-of-hooks
    const router = usePagesRouter();
    return {
      push: (href, extras) => void router?.push(href, undefined, extras),
      replace: (href, extras) => void router?.replace(href, undefined, extras),
    };
  }
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const router = useAppRouter();
  return {
    push: (href, extras) => router.push(href, extras),
    replace: (href, extras) => router.replace(href, extras),
  };
};

/** Read the shared context, or build a stable per-component fallback. */
const useGlyphnavContext = (options?: NextGlyphnavOptions): GlyphnavContextValue => {
  const fromContext = useContext(GlyphnavContext);
  const ref = useRef<GlyphnavController | null>(null);
  if (fromContext) return fromContext;
  if (!ref.current) ref.current = new GlyphnavController(toGlyphOptions(options));

  return {
    controller: ref.current,
    mode: options?.routerMode ?? 'app',
    basePath: options?.basePath ?? '',
  };
};

export interface GlyphnavProviderProps extends NextGlyphnavOptions {
  children: ReactNode;
}

/**
 * Provide a shared controller (and the router mode / base path) to the subtree.
 * Optional — the hooks work without it, each creating their own controller.
 */
export const GlyphnavProvider = ({ children, ...options }: GlyphnavProviderProps) => {
  const ref = useRef<GlyphnavController | null>(null);
  const glyph = toGlyphOptions(options);
  if (!ref.current) ref.current = new GlyphnavController(glyph);
  else ref.current.update(glyph);

  const mode = options.routerMode ?? 'app';
  const basePath = options.basePath ?? '';
  const value = useMemo<GlyphnavContextValue>(
    () => ({ controller: ref.current as GlyphnavController, mode, basePath }),
    [mode, basePath],
  );

  return createElement(GlyphnavContext.Provider, { value }, children);
};

/**
 * Get the controller from context, or a stable per-component fallback.
 *
 * @param options - Base options for the fallback controller (ignored when a
 * provider is present).
 * @returns The shared or per-component {@link GlyphnavController}.
 */
export const useGlyphnavController = (options?: NextGlyphnavOptions): GlyphnavController =>
  useGlyphnavContext(options).controller;

/**
 * A `useRouter().push` replacement that plays the glyph animation before handing
 * the navigation to Next.js. Pass `{ replace: true }` for `router.replace`.
 *
 * @param options - Base animation options for navigations made through the
 * returned function.
 * @returns An imperative navigate function that animates, then navigates.
 */
export const useGlyphnavNavigate = (options?: NextGlyphnavOptions): GlyphnavNavigateFn => {
  const ctx = useGlyphnavContext(options);
  const nav = useNextNav(ctx.mode);

  return useCallback<GlyphnavNavigateFn>(
    (href, extras) => {
      const target = withBasePath(ctx.basePath, href);
      return ctx.controller.run(target, () => {
        if (extras?.replace) nav.replace(href, extras);
        else nav.push(href, extras);
      });
    },
    [ctx, nav],
  );
};

export interface GlyphnavLinkProps
  extends
    Omit<LinkProps, 'onClick'>,
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps | 'onClick'> {
  children?: ReactNode;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Per-link option overrides. */
  glyphOptions?: NextGlyphnavOptions;
}

/**
 * Drop-in replacement for `next/link`'s `<Link>` that animates on click before
 * navigating via the Next router. Modified clicks (new tab, etc.) fall through
 * to the browser as usual. Prefetching still works — the underlying `<Link>` is
 * rendered untouched.
 */
export const GlyphnavLink = ({
  href,
  replace,
  scroll,
  onClick,
  glyphOptions,
  ...rest
}: GlyphnavLinkProps) => {
  const ctx = useGlyphnavContext(glyphOptions);
  const nav = useNextNav(ctx.mode);
  const hrefString = toPath(href);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (isModifiedClick(event)) return; // let the browser handle modified clicks

      event.preventDefault();
      const target = withBasePath(ctx.basePath, hrefString);
      void ctx.controller.run(target, () => {
        const extras = { scroll };
        if (replace) nav.replace(hrefString, extras);
        else nav.push(hrefString, extras);
      });
    },
    [onClick, ctx, nav, hrefString, replace, scroll],
  );

  return createElement(Link, { href, replace, scroll, onClick: handleClick, ...rest });
};
