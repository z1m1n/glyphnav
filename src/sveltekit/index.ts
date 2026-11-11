/**
 * Adapter for SvelteKit — Svelte's official application framework and router.
 *
 * SvelteKit exposes no patchable router object: programmatic navigation goes
 * through `goto` (from `$app/navigation`) and internal `<a>` clicks are handled
 * by SvelteKit's own global click listener. So by default this adapter installs
 * a *capture-phase* click listener that `preventDefault()`s eligible same-origin
 * links — which makes SvelteKit's handler stand down (it bails on an
 * already-defaulted click) — and drives the real navigation through `goto`
 * itself, with the glyph animation around it. Every internal link therefore
 * animates with no per-link wiring, mirroring the Nuxt adapter.
 *
 * With `intercept: 'none'` nothing global is installed and only the instance's
 * own `navigate()` (or the `use:link` action) animates. `goto` is passed in by
 * the caller because `$app/navigation` is a virtual module only resolvable
 * inside a SvelteKit app. Only the installed Kit version is needed here.
 *
 * Call it once on the client (e.g. in the root `+layout.svelte`'s `onMount`):
 * glyphnav rewrites the address bar via `history.replaceState`, so it must not
 * run during prerender/SSR.
 */
import { GlyphnavController } from '../core';
import type { GlyphnavOptions, RunResult } from '../core';
import { eligibleAnchor, reportNavigationError } from '../internal/links';

/**
 * Structural type shared by both versions of `$app/navigation.goto`.
 */
export type Goto<State extends object = object> = (
  url: string | URL,
  opts?: GotoOptions<State>,
) => Promise<void>;

/** The subset of SvelteKit `goto` options {@link SvelteKitGlyphnavInstance.navigate} forwards. */
export interface GotoOptions<State extends object = object> extends SvelteKitNavigateExtras<State> {
  /** Replace the current history entry (SvelteKit 2). */
  replaceState?: boolean;
}

/** Per-navigation overrides for {@link SvelteKitGlyphnavInstance.navigate}. */
export interface SvelteKitNavigateExtras<State extends object = object> {
  /** Replace the current history entry. */
  replace?: boolean;
  /** Reset scroll and focus together (SvelteKit 3). */
  reset?: boolean;
  /** Keep the current scroll position after navigating. */
  noScroll?: boolean;
  /** Keep focus on the currently focused element after navigating. */
  keepFocus?: boolean;
  /** Re-run all `load` functions for the new page. */
  invalidateAll?: boolean;
  /** Rerun load functions and queries (SvelteKit 3). */
  refreshAll?: boolean;
  /** Dependencies to invalidate during navigation. */
  invalidate?: Array<string | URL | ((url: URL) => boolean)>;
  /** Update the URL and page state without loading the route (SvelteKit 3). */
  shallow?: boolean;
  /** Restore the shallow entry's state after reloading (SvelteKit 3). */
  persistState?: boolean;
  /** State to associate with the new history entry (`page.state`). */
  state?: State;
}

export interface SvelteKitGlyphnavOptions extends GlyphnavOptions {
  /**
   * `'links'` installs a capture-phase click listener so every internal `<a>`
   * click animates: glyphnav `preventDefault()`s the click (SvelteKit's own
   * handler then stands down) and drives `goto`. `'none'` installs nothing
   * global — only the instance's `navigate()` and the `use:link` action animate.
   * @defaultValue `'links'`
   */
  intercept?: 'links' | 'none';
  /**
   * Also animate browser back/forward (popstate) traversals. Off by default so
   * the adapter stays a per-navigation wrapper; opt in to decode the bar on
   * history moves too. SvelteKit owns popstate, so the decode plays on top of
   * the entry it restores — the URL itself is never rewritten by the replay.
   * `detach()` removes the listener.
   * @defaultValue `false`
   */
  animatePopState?: boolean;
  /**
   * Element the capture-phase click listener attaches to when
   * `intercept: 'links'`. Ignored on the server and when `intercept: 'none'`.
   * @defaultValue `document`
   */
  root?: Document | HTMLElement;
}

/**
 * A Svelte action (`use:link`) that animates the navigation triggered by the
 * `<a>` it is applied to; the element's own `href` (base-resolved by SvelteKit)
 * is the destination.
 */
export type GlyphnavLinkAction = (node: HTMLAnchorElement) => { destroy(): void };

export interface SvelteKitGlyphnavInstance<State extends object = object> {
  /** The controller driving the animation. */
  controller: GlyphnavController;
  /**
   * Animated, `goto`-style navigation. Animates even when `intercept: 'none'`
   * installed no global listener. Pass `{ replace: true }` for `replaceState`.
   */
  navigate: (to: string | URL, extras?: SvelteKitNavigateExtras<State>) => Promise<RunResult>;
  /**
   * Svelte action for opt-in per-link animation (`<a href use:link>`), for use
   * with `intercept: 'none'`. Under `intercept: 'links'` the global listener
   * has already claimed the click (the anchor reads as `defaultPrevented`), so
   * the action stands down and the navigation still happens exactly once.
   */
  link: GlyphnavLinkAction;
  /** Remove the global listener (if any), stop popstate, and cancel any animation. */
  detach: () => void;
}

/** Map the adapter's per-call extras onto SvelteKit `goto` options. */
function gotoOptions<State extends object>(
  version: string,
  extras: SvelteKitNavigateExtras<State>,
): GotoOptions<State> {
  const {
    replace,
    reset,
    refreshAll,
    noScroll,
    keepFocus,
    invalidateAll,
    shallow,
    persistState,
    ...shared
  } = extras;
  if (version.startsWith('2.')) {
    if (shallow || persistState) throw new Error('Shallow goto navigation requires SvelteKit 3.');
    return {
      ...shared,
      replaceState: replace,
      noScroll: reset === undefined ? noScroll : !reset,
      keepFocus: reset === undefined ? keepFocus : !reset,
      invalidateAll: refreshAll ?? invalidateAll,
    };
  }
  return {
    ...shared,
    replace,
    shallow,
    persistState,
    reset: reset ?? (noScroll || keepFocus ? false : undefined),
    refreshAll: refreshAll ?? invalidateAll,
  };
}

/** The address-bar path (`pathname + search + hash`) for a `goto` target. */
const targetPath = (to: string | URL): string =>
  typeof to === 'string' ? to : to.pathname + to.search + to.hash;

/** Kit link options are inherited. A nearer explicit false overrides an ancestor. */
function linkOption(anchor: HTMLAnchorElement, name: string): boolean | undefined {
  const attribute = `data-sveltekit-${name}`;
  const value = anchor.closest(`[${attribute}]`)?.getAttribute(attribute);
  if (value === '' || value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/**
 * Attach glyphnav to a SvelteKit app.
 *
 * @param goto - SvelteKit's `goto` from `$app/navigation`.
 * @param options - Adapter and animation options.
 * @returns The controller, the animated `navigate`, the `use:link` action, and
 * a `detach()` that removes everything it installed.
 *
 * @example
 * ```svelte
 * <script>
 *   import { onMount } from 'svelte';
 *   import { goto } from '$app/navigation';
 *   import { attachGlyphnav } from 'glyphnav/sveltekit';
 *
 *   // Eligible <a> clicks navigate, then animate the landed URL.
 *   onMount(() => attachGlyphnav(goto, { duration: 250, commit: 'before' }).detach);
 * </script>
 * ```
 */
export const attachGlyphnav = <State extends object = object>(
  goto: Goto<State>,
  options: SvelteKitGlyphnavOptions = {},
): SvelteKitGlyphnavInstance<State> => {
  const {
    intercept = 'links',
    animatePopState = false,
    root = typeof document !== 'undefined' ? document : undefined,
    ...glyph
  } = options;
  const controller = new GlyphnavController(glyph);

  // The target shown in the bar is exactly the path handed to `goto`: SvelteKit
  // resolves `goto` against the live URL and never auto-prefixes `paths.base`
  // (root-relative hrefs already include it), so no base bookkeeping is needed.
  const navigate = (
    to: string | URL,
    extras?: SvelteKitNavigateExtras<State>,
  ): Promise<RunResult> =>
    controller.run(targetPath(to), async (signal) => {
      if (!extras) return goto(to);
      // Kit exports VERSION in both majors. Load it only for imperative options,
      // so SSR, ordinary clicks and package imports don't load the framework.
      const { VERSION } = await import('@sveltejs/kit');
      if (!signal.aborted) await goto(to, gotoOptions(VERSION, extras));
    });

  // Turn an eligible anchor click into an animated `goto`. Shared by the global
  // interceptor and the per-link action; both run through `eligibleAnchor`,
  // whose `defaultPrevented` check is what makes the action stand down once the
  // capture-phase global handler has already claimed (and preventDefaulted) the
  // click — so the navigation fires exactly once either way.
  const handleClick = (event: MouseEvent): void => {
    const anchor = eligibleAnchor(event);
    if (!anchor || linkOption(anchor, 'reload')) return;
    controller.cancel();
    const url = new URL(anchor.href, window.location.href);
    const to = url.pathname + url.search + url.hash;
    const replace = linkOption(anchor, 'replacestate');
    const reset = linkOption(anchor, 'reset');
    const noScroll = linkOption(anchor, 'noscroll');
    const keepFocus = linkOption(anchor, 'keepfocus');
    const hasOptions =
      replace !== undefined ||
      reset !== undefined ||
      noScroll !== undefined ||
      keepFocus !== undefined;
    event.preventDefault();
    void navigate(to, hasOptions ? { replace, reset, noScroll, keepFocus } : undefined).catch(
      reportNavigationError,
    );
  };
  const onClick = handleClick as EventListener;

  // `true` = capture phase: glyphnav runs before SvelteKit's bubble-phase click
  // handler, and the `preventDefault()` above makes SvelteKit bail, so the real
  // navigation happens once, through `goto`.
  if (intercept === 'links' && root) {
    root.addEventListener('click', onClick, true);
  }

  const stopPopState = animatePopState ? controller.enableHistoryAnimation() : (): void => {};

  const link: GlyphnavLinkAction = (node) => {
    node.addEventListener('click', onClick);

    return { destroy: () => node.removeEventListener('click', onClick) };
  };

  return {
    controller,
    navigate,
    link,
    detach() {
      if (intercept === 'links' && root) {
        root.removeEventListener('click', onClick, true);
      }
      stopPopState();
      controller.cancel();
    },
  };
};
