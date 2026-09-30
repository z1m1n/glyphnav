/**
 * Adapter for Next.js — works with **both** the App Router (`app/` folder) and
 * the Pages Router (`pages/` folder).
 *
 *  - `<GlyphnavProvider>` shares a single controller (and the router mode) across
 *    the tree (optional).
 *  - `useGlyphnavNavigate()` mirrors `useRouter().push` with address-bar animation.
 *  - `<GlyphnavLink>` is a drop-in for `next/link`'s `<Link>` that animates on click.
 *
 * Nothing is patched globally: only navigations made through these entry points
 * animate. The `routerMode` option selects which Next router API drives the real
 * navigation — `'app'` (default) uses `next/navigation`, `'pages'` uses
 * `next/compat/router` — so the same adapter works whichever folder convention,
 * `app/` or `pages/`, your routes live in.
 */
'use client';

import {
  Children,
  cloneElement,
  createContext,
  createElement,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';
import type { AnchorHTMLAttributes, MouseEvent, ReactElement, ReactNode } from 'react';
import NextLink from 'next/link';
import type { LinkProps } from 'next/link';
import { useRouter as useAppRouter } from 'next/navigation';
import { useRouter as usePagesRouter } from 'next/compat/router';
import type { GlyphnavController } from '../core';
import type { GlyphnavOptions, RunResult } from '../core';
import { eligibleAnchor, reportNavigationError, settleAfter } from '../internal/links';
import { useFallbackController, useHistoryAnimation, useSharedController } from '../internal/react';

// Native Node ESM imports Next's CommonJS wrapper, whereas bundlers commonly
// unwrap its default. Accept both without mistaking a forward-ref component
// (also an object) for a module namespace.
const Link = (NextLink as typeof NextLink & { default?: typeof NextLink }).default ?? NextLink;

/** Which Next.js routing system drives the real navigation. */
export type NextRouterMode = 'app' | 'pages';

/** Per-navigation overrides forwarded to the Next router's `push`/`replace`. */
export interface NextNavigateExtras {
  /** Use `replace` instead of `push` (no new history entry). */
  replace?: boolean;
  /** Forwarded to Next as the `scroll` option. */
  scroll?: boolean;
  /** Pages Router: update the route without rerunning data loaders. */
  shallow?: boolean;
  /** Pages Router: override the active locale. */
  locale?: string | false;
  /** App Router: transition types forwarded to Next's navigation API. */
  transitionTypes?: string[];
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

// The adapter-only options (`routerMode`, `basePath`) are passed straight to the
// controller: `resolveOptions` reads only the keys it knows about, so the extra
// fields are inert — no stripping needed before reaching the core.

/** Prefix the base path onto a rooted href (matters only for `commit: 'after'`). */
const withBasePath = (basePath: string, href: string): string => {
  if (!basePath || !href.startsWith('/') || href.startsWith('//')) return href;
  const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  const pathname = href.split(/[?#]/, 1)[0];
  return pathname === base || pathname?.startsWith(base + '/') ? href : base + href;
};

interface NextNav {
  push: (
    href: LinkProps['href'],
    extras?: NextNavigateExtras,
    as?: LinkProps['as'],
    signal?: AbortSignal,
  ) => Promise<void>;
  replace: NextNav['push'];
  link: (dispatch: () => void | Promise<void>, signal: AbortSignal) => Promise<void>;
  initialLink: (signal: AbortSignal) => Promise<void>;
}

/** Observe native Link's public router promise, with events as a deferred-dispatch fallback. */
const settlePagesLink = (
  router: NonNullable<ReturnType<typeof usePagesRouter>>,
  dispatch: () => void | Promise<void>,
  signal: AbortSignal,
  initialDispatch = false,
): Promise<void> =>
  new Promise((resolve, reject) => {
    let settled = false;
    let started: string | undefined;
    const originalPush = router.push;
    const originalReplace = router.replace;
    const restore = (): void => {
      router.push = originalPush;
      router.replace = originalReplace;
    };
    const finish = (error?: unknown, failed = false): void => {
      if (settled) return;
      settled = true;
      restore();
      router.events.off('routeChangeStart', start);
      router.events.off('hashChangeStart', start);
      router.events.off('routeChangeComplete', complete);
      router.events.off('hashChangeComplete', complete);
      router.events.off('routeChangeError', failure);
      signal.removeEventListener('abort', abort);
      if (failed) reject(error);
      else resolve();
    };
    const start = (url: string): void => {
      started = url;
    };
    const complete = (): void => {
      if (started !== undefined) finish();
    };
    const failure = (error: unknown, url: string): void => {
      // Starting a new route first cancels the previous one. Ignore that older
      // route's error while awaiting this link's own start/completion events.
      if (started === url) finish(error, true);
    };
    const abort = (): void => finish(new DOMException('Navigation cancelled', 'AbortError'), true);
    if (signal.aborted) {
      abort();
      return;
    }
    router.events.on('routeChangeStart', start);
    router.events.on('hashChangeStart', start);
    router.events.on('routeChangeComplete', complete);
    router.events.on('hashChangeComplete', complete);
    router.events.on('routeChangeError', failure);
    signal.addEventListener('abort', abort, { once: true });
    let navigation: Promise<boolean> | undefined;
    const observe = (pending: Promise<unknown>): void => {
      pending.then(
        () => finish(),
        (error: unknown) => finish(error, true),
      );
    };
    const capture =
      (method: typeof originalPush): typeof originalPush =>
      (...args) => {
        // The initial Link handler continues after our onClick returns. Restore
        // at its first router invocation, before the real method or ancestors
        // can initiate another navigation.
        restore();
        try {
          navigation = method.apply(router, args);
        } catch (error) {
          navigation = Promise.reject(error);
        }
        if (navigation) observe(navigation);
        return navigation;
      };
    try {
      // A detached source anchor has no React event listener. Its fallback
      // dispatch returns the router promise, which supplies completion directly.
      let pending: void | Promise<void>;
      try {
        // Next's native Pages Link calls these public methods synchronously.
        // Replays complete here; an initial click continues synchronously in
        // Next's handler after this observer has returned its pending promise.
        router.push = capture(originalPush);
        router.replace = capture(originalReplace);
        pending = dispatch();
      } finally {
        if (!initialDispatch) restore();
      }
      if (!navigation && pending) observe(pending);
      queueMicrotask(() => {
        restore();
        if (!settled && !navigation && !pending && started === undefined) {
          finish(new Error('Next Link did not start a Pages Router navigation.'), true);
        }
      });
    } catch (error) {
      finish(error, true);
    }
  });

/**
 * How long to wait for an App Router navigation to land before giving up. The
 * App Router commits navigations asynchronously — `router.push` returns before
 * `window.location` updates — so the bar is animated to the settled path; see
 * {@link settleAfter}.
 */
const APP_ROUTER_SETTLE_MS = 1200;

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
      push: async (href, extras, as) => {
        if (!router) throw new Error('Glyphnav requires a mounted Next Pages Router.');
        await router.push(href, as, extras);
      },
      replace: async (href, extras, as) => {
        if (!router) throw new Error('Glyphnav requires a mounted Next Pages Router.');
        await router.replace(href, as, extras);
      },
      link: (dispatch, signal) => {
        if (!router)
          return Promise.reject(new Error('Glyphnav requires a mounted Next Pages Router.'));
        return settlePagesLink(router, dispatch, signal);
      },
      initialLink: (signal) => {
        if (!router)
          return Promise.reject(new Error('Glyphnav requires a mounted Next Pages Router.'));
        return settlePagesLink(router, () => {}, signal, true);
      },
    };
  }
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const router = useAppRouter();
  return {
    push: (href, extras, _as, signal) =>
      settleAfter(() => router.push(href as string, extras), APP_ROUTER_SETTLE_MS, signal),
    replace: (href, extras, _as, signal) =>
      settleAfter(() => router.replace(href as string, extras), APP_ROUTER_SETTLE_MS, signal),
    link: (dispatch, signal) => settleAfter(dispatch, APP_ROUTER_SETTLE_MS, signal),
    initialLink: (signal) => settleAfter(() => {}, APP_ROUTER_SETTLE_MS, signal),
  };
};

/** Read the shared context, or build a stable per-component fallback. */
const useGlyphnavContext = (options?: NextGlyphnavOptions): GlyphnavContextValue => {
  const fromContext = useContext(GlyphnavContext);
  const fallback = useFallbackController(!fromContext, options);
  if (fromContext) return fromContext;

  return {
    controller: fallback as GlyphnavController,
    mode: options?.routerMode ?? 'app',
    basePath: options?.basePath ?? '',
  };
};

export interface GlyphnavProviderProps extends NextGlyphnavOptions {
  children: ReactNode;
  /**
   * Also animate browser back/forward (popstate) traversals for the subtree.
   * Off by design — the adapter patches nothing globally until you opt in here.
   * App Router note: it owns popstate, so the decode plays on top of the entry
   * it restores; the URL itself is never rewritten by the replay.
   * @defaultValue `false`
   */
  animatePopState?: boolean;
}

/**
 * Provide a shared controller (and the router mode / base path) to the subtree.
 * Optional — the hooks work without it, each creating their own controller.
 */
export const GlyphnavProvider = ({
  children,
  animatePopState = false,
  ...options
}: GlyphnavProviderProps) => {
  const controller = useSharedController(options);
  const mode = options.routerMode ?? 'app';
  const basePath = options.basePath ?? '';
  useHistoryAnimation(controller, animatePopState);
  const value = useMemo<GlyphnavContextValue>(
    () => ({ controller, mode, basePath }),
    [controller, mode, basePath],
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
 * A `useRouter().push` replacement that follows the configured commit timing:
 * navigation happens first by default, then the landed URL animates. Pass
 * `{ replace: true }` for `router.replace`.
 *
 * @param options - Base animation options for navigations made through the
 * returned function.
 * @returns An imperative navigate function with address-bar animation.
 */
export const useGlyphnavNavigate = (options?: NextGlyphnavOptions): GlyphnavNavigateFn => {
  const ctx = useGlyphnavContext(options);
  const nav = useNextNav(ctx.mode);

  return useCallback<GlyphnavNavigateFn>(
    (href, extras) => {
      const target = withBasePath(ctx.basePath, href);
      return ctx.controller.run(
        target,
        (signal) => {
          if (extras?.replace) return nav.replace(href, extras, undefined, signal);
          return nav.push(href, extras, undefined, signal);
        },
        options,
      );
    },
    [ctx, nav, options],
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
 * A `next/link` replacement that animates the landed URL after navigation by
 * default, or animates first with `commit: 'after'`. Native Next Link owns the
 * navigation and pending state; modified clicks fall through as usual.
 * Animate-first links replay a DOM click at commit time; ancestor capture
 * handlers observe that replay in addition to the original click.
 */
export const GlyphnavLink = ({
  href,
  as,
  replace,
  scroll,
  shallow,
  locale,
  transitionTypes,
  onClick,
  onNavigate,
  glyphOptions,
  legacyBehavior,
  children,
  ...rest
}: GlyphnavLinkProps) => {
  const ctx = useGlyphnavContext(glyphOptions);
  const nav = useNextNav(ctx.mode);
  const replaying = useRef(false);
  const checkedNavigation = useRef(false);
  const child =
    legacyBehavior && typeof children !== 'string' && typeof children !== 'number'
      ? (Children.only(children) as ReactElement<{ onClick?: GlyphnavLinkProps['onClick'] }>)
      : undefined;
  const callerClick = legacyBehavior ? child?.props.onClick : onClick;
  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    // The replay passes through Next's own Link handler, preserving its link
    // instance, pending state and router-specific navigation contract.
    if (replaying.current) {
      event.stopPropagation();
      return;
    }
    callerClick?.(event);
    if (!eligibleAnchor(event, event.currentTarget)) return;

    // Let Next serialize URL objects and resolve dynamic routes, locale and
    // deployment prefixes. The rendered anchor is the browser destination.
    const anchor = event.currentTarget;
    const destination = new URL(anchor.href, window.location.href);
    const target = destination.pathname + destination.search + destination.hash;
    // The App Router accepts a same-origin absolute URL, which also avoids
    // applying its configured basePath twice to the already-rendered href.
    const appHref = typeof (as ?? href) === 'string' ? (as ?? href) : anchor.href;
    let cancelled = false;
    onNavigate?.({
      preventDefault: () => {
        cancelled = true;
      },
    });
    if (cancelled) {
      event.preventDefault();
      return;
    }
    let handlingClick = true;
    let initialCommit = false;
    void ctx.controller
      .run(
        target,
        (signal) => {
          if (handlingClick) {
            initialCommit = true;
            return nav.initialLink(signal);
          }
          return nav.link(() => {
            if (anchor.isConnected) {
              replaying.current = true;
              try {
                anchor.click();
              } finally {
                replaying.current = false;
              }
              return;
            }
            const extras =
              ctx.mode === 'pages' ? { scroll, shallow, locale } : { scroll, transitionTypes };
            const navHref = ctx.mode === 'pages' ? href : (appHref as string);
            if (replace) return nav.replace(navHref, extras, as, signal);
            return nav.push(navHref, extras, as, signal);
          }, signal);
        },
        glyphOptions,
      )
      .catch(reportNavigationError);
    handlingClick = false;
    if (initialCommit) {
      checkedNavigation.current = true;
      // Next 14 has no onNavigate callback; never leave its once-only marker
      // behind for another click when native navigation bypasses that hook.
      queueMicrotask(() => {
        checkedNavigation.current = false;
      });
    } else event.preventDefault();
  };

  const handleNavigate = useCallback<NonNullable<LinkProps['onNavigate']>>(
    (event) => {
      if (checkedNavigation.current) {
        checkedNavigation.current = false;
        return;
      }
      if (!replaying.current) onNavigate?.(event);
    },
    [onNavigate],
  );
  // oxlint-disable react/refs -- These event-handler closures only access the replay ref when clicked; cloning/rendering them does not invoke them.
  const linkChildren = legacyBehavior
    ? isValidElement(child)
      ? cloneElement(child, { onClick: handleClick })
      : createElement('a', { onClick: handleClick }, children)
    : children;

  return createElement(
    Link,
    {
      href,
      as,
      replace,
      scroll,
      shallow,
      locale,
      transitionTypes,
      onNavigate: handleNavigate,
      onClick: legacyBehavior ? undefined : handleClick,
      legacyBehavior,
      ...rest,
    },
    linkChildren,
  );
  // oxlint-enable react/refs
};
