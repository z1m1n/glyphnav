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
