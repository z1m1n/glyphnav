import type { AnimateScope } from './types';

/** The fixed prefix plus the scrambled remainder of a path. */
export interface PathParts {
  /** The leading portion that stays fixed throughout the animation. */
  prefix: string;
  /** The portion that gets scrambled. */
  text: string;
}

/** Length of the longest common (character-wise) prefix of two strings. */
export const commonPrefixLength = (a: string, b: string): number => {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a.charCodeAt(i) === b.charCodeAt(i)) i++;

  return i;
};

export interface SplitOptions {
  scope: AnimateScope;
  preserveLeadingSlash: boolean;
  /** Current path, required for `scope: 'tail'`. */
  from?: string;
}

/**
 * Resolve `to` against `from` the way a browser resolves relative URLs,
 * returning an absolute `pathname + search + hash`. Targets that point to a
 * different origin (full URLs) are returned untouched.
 *
 * Every path handed to `history.replaceState` must be absolute: a relative
 * path is resolved against the *current* URL, which compounds across
 * navigations into stacked garbage like `/vue/features/vue/features/…`.
 */
export const resolvePath = (to: string, from = '/'): string => {
  try {
    const base = new URL(from, 'http://glyphnav.invalid');
    const url = new URL(to, base);
    if (url.origin !== base.origin) return to;

    return url.pathname + url.search + url.hash;
  } catch {
    return to;
  }
};

/**
 * Split the target path into the fixed `prefix` and the scrambled `text`.
 *
 * - `scope: 'full'` keeps only the leading slash fixed (when enabled).
 * - `scope: 'tail'` keeps the longest common prefix with `from` fixed.
 */
export const splitTarget = (to: string, opts: SplitOptions): PathParts => {
  if (opts.scope === 'tail' && opts.from != null) {
    const len = commonPrefixLength(opts.from, to);
    return { prefix: to.slice(0, len), text: to.slice(len) };
  }

  if (opts.preserveLeadingSlash && to.charCodeAt(0) === 47 /* '/' */) {
    return { prefix: '/', text: to.slice(1) };
  }

  return { prefix: '', text: to };
};
