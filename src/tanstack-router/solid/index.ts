/**
 * Adapter for TanStack Router on **Solid** (`@tanstack/solid-router`).
 *
 *  - `<GlyphnavProvider>` shares a single controller across the tree (optional).
 *  - `useGlyphnavNavigate()` mirrors `useNavigate()` but animates first.
 *  - `<GlyphnavLink>` renders an `<a>` that animates on click.
 *
 * The router half is identical to the React adapter — TanStack's `buildLocation`
 * and `navigate` come from its framework-agnostic core — so only the bindings
 * differ. Like the React adapter, this file uses no JSX (`createComponent` +
 * `Dynamic`), so the library build needs no Solid compiler. Nothing is patched
 * globally: only navigations made through these entry points animate.
 */
import { createComponent, createMemo, mergeProps, splitProps } from 'solid-js';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useRouter } from '@tanstack/solid-router';
import type { NavigateOptions } from '@tanstack/solid-router';
import type { GlyphnavOptions, RunResult } from '../../core';
import { createSolidControllerContext, runSolidLinkClick } from '../../internal/solid';
import type { GlyphnavProviderProps } from '../../internal/solid';

export type { GlyphnavProviderProps };

/** Imperative navigate function returned by {@link useGlyphnavNavigate}. */
export type GlyphnavNavigateFn = (opts: NavigateOptions) => Promise<RunResult>;

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
 * the navigation to TanStack Router.
 *
 * @param options - Base animation options for navigations made through the
 * returned function.
 * @returns An imperative navigate function that animates, then navigates.
 */
export function useGlyphnavNavigate(options?: GlyphnavOptions): GlyphnavNavigateFn {
  const router = useRouter();
  const controller = useGlyphnavController(options);

  return (opts) => {
    // `buildLocation` yields the basepath-aware href that will really end up in
    // the address bar.
    const target = router.buildLocation(opts).href;
    return controller.run(target, () => router.navigate(opts) as Promise<void>);
  };
}

export interface GlyphnavLinkProps
  // `state` is also omitted: if `@solidjs/router` is present it augments the
  // anchor's `state` to `string`, which would clash with the one picked from
  // TanStack's `NavigateOptions` (a no-op omit otherwise).
  extends
    Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'state'>,
    Pick<NavigateOptions, 'to' | 'params' | 'search' | 'hash' | 'state' | 'replace'> {
  /** Per-link option overrides. */
  glyphOptions?: GlyphnavOptions;
}

/**
 * An anchor that animates, then navigates via TanStack Router. Modified clicks
 * (new tab, etc.) fall through to the browser as usual. For fully type-safe
 * links wrap {@link useGlyphnavNavigate} in your own component instead.
 */
export function GlyphnavLink(props: GlyphnavLinkProps): JSX.Element {
  const router = useRouter();
  const controller = useGlyphnavController(props.glyphOptions);
  const [local, rest] = splitProps(props, [
    'to',
    'params',
    'search',
    'hash',
    'state',
    'replace',
    'glyphOptions',
    'onClick',
    'children',
  ]);

  const navOpts = (): NavigateOptions =>
    ({
      to: local.to,
      params: local.params,
      search: local.search,
      hash: local.hash,
      state: local.state,
      replace: local.replace,
    }) as NavigateOptions;

  const href = createMemo(() => router.buildLocation(navOpts()).href);

  const handleClick: JSX.EventHandler<HTMLAnchorElement, MouseEvent> = (event) =>
    runSolidLinkClick(
      event,
      local.onClick,
      controller,
      href(),
      () => router.navigate(navOpts()) as Promise<void>,
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
