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
 * inside a SvelteKit app — the adapter never imports SvelteKit itself.
 *
 * Call it once on the client (e.g. in the root `+layout.svelte`'s `onMount`):
 * glyphnav rewrites the address bar via `history.replaceState`, so it must not
 * run during prerender/SSR.
 */
import { GlyphnavController } from '../core';
import type { GlyphnavOptions, RunResult } from '../core';
import { eligibleAnchor, settleAfter } from '../internal/links';

/**
 * SvelteKit's `goto` from `$app/navigation`, typed structurally so the adapter
 * needs no `@sveltejs/kit` import.
 */
export type Goto = (url: string | URL, opts?: GotoOptions) => Promise<void>;

/**
 * How long to wait for a `goto` navigation to land before giving up. `goto`
 * resolves a tick before `window.location` settles, so with the default
 * `commit: 'before'` the bar is animated to the *settled* path rather than the
 * old one read back too early; see {@link settleAfter}. A no-op navigation never
 * changes the URL and falls through after this budget.
 */
const SETTLE_MS = 1000;

/** The subset of SvelteKit `goto` options {@link SvelteKitGlyphnavInstance.navigate} forwards. */
export interface GotoOptions {
  /** Replace the current history entry instead of pushing a new one. */
  replaceState?: boolean;
  /** Keep the current scroll position after navigating. */
  noScroll?: boolean;
  /** Keep focus on the currently focused element after navigating. */
  keepFocus?: boolean;
  /** Re-run all `load` functions for the new page. */
  invalidateAll?: boolean;
  /**
   * State to associate with the new history entry (`page.state`). Typed `object`
   * — assignable to SvelteKit's app-augmented `App.PageState` — so the real
   * `goto` stays assignable to {@link Goto} without the adapter importing
   * `@sveltejs/kit`.
   */
  state?: object;
}

/** Per-navigation overrides forwarded to SvelteKit's `goto`. */
export interface SvelteKitNavigateExtras {
  /** Use `replaceState` (no new history entry). */
  replace?: boolean;
  /** Forwarded to `goto` as `noScroll`. */
  noScroll?: boolean;
  /** Forwarded to `goto` as `keepFocus`. */
  keepFocus?: boolean;
  /** Forwarded to `goto` as `invalidateAll`. */
  invalidateAll?: boolean;
  /** Forwarded to `goto` as `state` (SvelteKit's `App.PageState`). */
  state?: object;
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

export interface SvelteKitGlyphnavInstance {
  /** The controller driving the animation. */
  controller: GlyphnavController;
  /**
   * Animated, `goto`-style navigation. Animates even when `intercept: 'none'`
   * installed no global listener. Pass `{ replace: true }` for `replaceState`.
   */
  navigate: (to: string | URL, extras?: SvelteKitNavigateExtras) => Promise<RunResult>;
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
const gotoOptions = (extras?: SvelteKitNavigateExtras): GotoOptions => ({
  replaceState: extras?.replace,
  noScroll: extras?.noScroll,
  keepFocus: extras?.keepFocus,
  invalidateAll: extras?.invalidateAll,
  state: extras?.state,
});

/** The address-bar path (`pathname + search + hash`) for a `goto` target. */
const targetPath = (to: string | URL): string =>
  typeof to === 'string' ? to : to.pathname + to.search + to.hash;

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
 *   // Every <a> click and goto() now animates first.
 *   onMount(() => attachGlyphnav(goto, { duration: 250, commit: 'before' }).detach);
 * </script>
 * ```
 */
export const attachGlyphnav = (
  goto: Goto,
  options: SvelteKitGlyphnavOptions = {},
): SvelteKitGlyphnavInstance => {
  const {
    intercept = 'links',
    animatePopState = false,
    root = typeof document !== 'undefined' ? document : undefined,
    ...glyph
  } = options;
  const controller = new GlyphnavController(glyph);

  // Fire `goto` and resolve once the address bar actually settles. `goto`'s
  // promise resolves a tick early, so awaiting it directly would let the core
  // read the old path back and skip the on-top decode (the default
  // `commit: 'before'`); polling the URL via `settleAfter` animates to the path
  // that really landed, redirects included.
  const commitGoto = (to: string | URL, opts?: GotoOptions): void | Promise<void> =>
    settleAfter(() => void goto(to, opts).catch(() => {}), SETTLE_MS);

  // The target shown in the bar is exactly the path handed to `goto`: SvelteKit
  // resolves `goto` against the live URL and never auto-prefixes `paths.base`
  // (root-relative hrefs already include it), so no base bookkeeping is needed.
  const navigate = (to: string | URL, extras?: SvelteKitNavigateExtras): Promise<RunResult> =>
    controller.run(targetPath(to), () => commitGoto(to, gotoOptions(extras)));

  // Turn an eligible anchor click into an animated `goto`. Shared by the global
  // interceptor and the per-link action; both run through `eligibleAnchor`,
  // whose `defaultPrevented` check is what makes the action stand down once the
  // capture-phase global handler has already claimed (and preventDefaulted) the
  // click — so the navigation fires exactly once either way.
  const handleClick = (event: MouseEvent): void => {
    const anchor = eligibleAnchor(event);
    if (!anchor) return;
    const url = new URL(anchor.href, window.location.href);
    const to = url.pathname + url.search + url.hash;
    event.preventDefault();
    void controller.run(to, () => commitGoto(to));
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
