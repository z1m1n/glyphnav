/**
 * Test helpers shared across suites.
 */

/**
 * A deterministic RNG that yields the given values in order, cycling when it
 * runs out. With `charset` of length L, a value of `i / L` selects index `i`,
 * so `seqRng([0, 0.25, 0.5, 0.75])` over the charset `'xyzw'` produces
 * `x, y, z, w` — the canonical demo base.
 */
export function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

/** RNG that always returns 0 — i.e. always picks the first charset glyph. */
export const zeroRng = (): number => 0;
