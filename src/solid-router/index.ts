/**
 * Adapter for Solid Router — the official `@solidjs/router`.
 *
 *  - `<GlyphnavProvider>` shares a single controller across the tree (optional).
 *  - `useGlyphnavNavigate()` mirrors `useNavigate()` but animates first.
 *  - `<GlyphnavLink>` is a drop-in for `<A>` that animates on click.
 *
 * Like the React and TanStack-Solid adapters, this file uses no JSX
 * (`createComponent` + `Dynamic`), so the library build needs no Solid
 * compiler. Nothing is patched globally: `<Router>` already installs its own
 * delegated click handler, and `GlyphnavLink` simply `preventDefault()`s before
 * it runs (Solid Router registers `delegateEvents(['click'])` *before* its own
 * listener, so our `onClick` fires first and its `preventDefault` makes the
 * router's handler bail). Only navigations made through these entry points
 * animate.
 */
import { createComponent, mergeProps, splitProps } from 'solid-js';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useHref, useNavigate, useResolvedPath } from '@solidjs/router';
import type { NavigateOptions } from '@solidjs/router';
import type { GlyphnavOptions, RunResult } from '../core';
import { settleAfter } from '../internal/links';
import { createSolidControllerContext, runSolidLinkClick } from '../internal/solid';
import type { GlyphnavProviderProps } from '../internal/solid';

export type { GlyphnavProviderProps };

/** Imperative navigate function returned by {@link useGlyphnavNavigate}. */
export type GlyphnavNavigateFn = (
  to: string | number,
  options?: Partial<NavigateOptions>,
) => Promise<RunResult>;

/**
 * How long to wait for a Solid Router navigation to land before giving up.
 * Solid Router commits navigations through a reactive effect, so `navigate()`
 * returns before `window.location` updates; see {@link settleAfter}.
 */
const SETTLE_TIMEOUT_MS = 1000;

const context = createSolidControllerContext();

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
 * A `useNavigate()` replacement that plays the glyph animation before handing
 * the navigation to Solid Router. A numeric `to` (history delta) is passed
 * straight through without animating.
 *
 * @param options - Base animation options for navigations made through the
 * returned function.
 * @returns An imperative navigate function that animates, then navigates.
 */
export function useGlyphnavNavigate(options?: GlyphnavOptions): GlyphnavNavigateFn {
  const navigate = useNavigate();
  const controller = useGlyphnavController(options);

  return (to, navOptions) => {
    if (typeof to === 'number') {
      navigate(to);
      return Promise.resolve<RunResult>('skipped');
    }

    return controller.run(to, () =>
      settleAfter(() => navigate(to, navOptions), SETTLE_TIMEOUT_MS),
    );
  };
}

export interface GlyphnavLinkProps
  // `@solidjs/router` augments the anchor's `state` to `string`; take ours from
  // `NavigateOptions` instead (exactly how Solid Router's own `AnchorProps` does).
  extends
    Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, 'state'>,
    Pick<Partial<NavigateOptions>, 'replace' | 'resolve' | 'scroll' | 'state'> {
  /** Destination, like Solid Router's `<A href>`. */
  href: string;
  /** Per-link option overrides. */
  glyphOptions?: GlyphnavOptions;
}

/**
 * A drop-in for Solid Router's `<A>` that animates, then navigates. Like `<A>`,
 * the destination is base-aware and resolved relative to the current route
 * (`useResolvedPath` + `useHref`); the rendered `href` is what lands in the
 * address bar. Modified clicks (new tab, etc.) fall through to the browser.
 */
export function GlyphnavLink(props: GlyphnavLinkProps): JSX.Element {
  const controller = useGlyphnavController(props.glyphOptions);
  const navigate = useNavigate();
  const [local, rest] = splitProps(props, [
    'href',
    'replace',
    'resolve',
    'scroll',
    'state',
    'glyphOptions',
    'onClick',
    'children',
  ]);

  // Mirror `<A>`: resolve relative to the current route (base-less), then render
  // the base-aware href that is shown in the bar and used for navigation.
  const resolved = useResolvedPath(() => local.href);
  const rendered = useHref(resolved);
  const href = (): string => rendered() ?? local.href;

  const handleClick: JSX.EventHandler<HTMLAnchorElement, MouseEvent> = (event) =>
    runSolidLinkClick(event, local.onClick, controller, href(), () =>
      // Navigate the already-resolved (base-less) path with `resolve: false`,
      // exactly as Solid Router's own anchor handler does.
      settleAfter(
        () =>
          navigate(resolved() ?? local.href, {
            resolve: false,
            replace: local.replace,
            scroll: local.scroll,
            state: local.state,
          }),
        SETTLE_TIMEOUT_MS,
      ),
    );

  return createComponent(
    Dynamic,
    mergeProps(rest, {
      component: 'a',
      get href() {
        return href();
      },
      onClick: handleClick,
      get children() {
        return local.children;
      },
    }),
  );
}
