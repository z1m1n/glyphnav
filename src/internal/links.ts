/**
 * Framework-agnostic helpers shared by the link/navigation adapters. Not part
 * of the public API — imported directly by the adapters so the same logic is
 * not re-implemented per framework.
 */

/** The mouse-event fields needed to decide whether a click is a plain click. */
export interface ClickModifiers {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Whether a click should be left to the browser instead of being turned into an
 * animated navigation: already-handled clicks, non-primary buttons, and
 * modified clicks (new tab/window, etc.). Structurally typed so it accepts DOM,
 * React-synthetic and Solid mouse events alike.
 *
 * @param event - The (possibly synthetic) mouse event to inspect.
 * @returns `true` when the click must pass through untouched.
 */
export const isModifiedClick = (event: ClickModifiers): boolean =>
  event.defaultPrevented ||
  event.button !== 0 ||
  event.metaKey ||
  event.ctrlKey ||
  event.shiftKey ||
  event.altKey;

/** A location-like object with the parts that make up a path string. */
export interface LocationParts {
  pathname?: string | null;
  search?: string | null;
  hash?: string | null;
}

/**
 * Reduce a router `to`/`href` value to a plain path string. Strings pass
 * through; objects are joined as `pathname + search + hash` (missing parts
 * treated as empty).
 *
 * @param value - A path string or a `{ pathname, search, hash }`-shaped object.
 * @returns The combined `pathname + search + hash` string.
 */
export const toPath = (value: string | LocationParts): string =>
  typeof value === 'string'
    ? value
    : (value.pathname ?? '') + (value.search ?? '') + (value.hash ?? '');

/**
 * The current address-bar path (`pathname + search + hash`). Safe to call in
 * non-browser environments (SSR), where it returns `'/'`.
 *
 * @returns The current path, or `'/'` when there is no `window.location`.
 */
export const currentPath = (): string => {
  if (typeof window === 'undefined' || !window.location) return '/';

  const { pathname, search, hash } = window.location;
  return pathname + search + hash;
};

/**
 * Run `navigate`, then resolve only once the address-bar path actually changes
 * (or a short budget elapses). Some routers commit navigations asynchronously —
 * `navigate()` returns *before* `window.location` updates (Next's App Router,
 * Solid Router) — so with the default `commit: 'before'` the core would read the
 * old path back and skip the on-top animation. Awaiting the settle lets it
 * animate to the landed path, the same as a synchronous router. A no-op
 * navigation never changes the URL and falls through after the budget. Safe in
 * non-browser environments (runs `navigate` and returns).
 *
 * @param navigate - Performs the real navigation; may resolve before the URL updates.
 * @param timeoutMs - How long to wait for the URL to change before giving up.
 * @returns A promise that settles once the URL changes or the budget elapses,
 * or `void` when there is no `window` to observe.
 */
export const settleAfter = (navigate: () => void, timeoutMs: number): void | Promise<void> => {
  if (typeof window === 'undefined' || !window.location) {
    navigate();
    return;
  }
  const before = currentPath();
  navigate();

  return new Promise<void>((resolve) => {
    const start = Date.now();
    const tick = (): void => {
      if (currentPath() !== before || Date.now() - start >= timeoutMs) {
        resolve();
        return;
      }
      setTimeout(tick, 16);
    };
    tick();
  });
};

/**
 * Decide whether a click should be turned into an animated navigation, and
 * return the eligible anchor (or `null`). Skips modified clicks, new-tab and
 * download links, cross-origin links, `rel="external"` links and
 * `data-glyphnav="off"` links — the same rules a good SPA link interceptor uses.
 * Shared by the vanilla `install()` and the SvelteKit adapter so the safety
 * rails are defined once.
 *
 * @param event - The click event to evaluate.
 * @returns The anchor to animate, or `null` if the click should pass through.
 */
export const eligibleAnchor = (event: MouseEvent): HTMLAnchorElement | null => {
  if (isModifiedClick(event)) return null;

  const target = event.target as Element | null;
  const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
  if (!anchor || !anchor.getAttribute('href')) return null;
  if (anchor.target && anchor.target !== '_self') return null;
  if (anchor.hasAttribute('download')) return null;
  if (anchor.dataset.glyphnav === 'off') return null;

  const rel = anchor.getAttribute('rel');
  if (rel && rel.split(/\s+/).includes('external')) return null;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;

  return anchor;
};
