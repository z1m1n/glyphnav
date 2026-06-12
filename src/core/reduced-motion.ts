/**
 * Whether the current environment asks for reduced motion. Safe to call in
 * non-browser environments (SSR, tests) where it simply returns `false`.
 *
 * @returns `true` when the user has requested reduced motion, else `false`.
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};
