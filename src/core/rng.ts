/**
 * Random number source. Must return a float in the half-open range [0, 1),
 * exactly like {@link Math.random}.
 */
export type Rng = () => number;

/**
 * Create a deterministic, seedable PRNG (mulberry32).
 *
 * Handy for reproducible animations and, above all, for tests: given the same
 * seed you always get the same glyph sequence.
 *
 * @param seed - Any 32-bit-ish integer seed.
 */
export const createRng = (seed: number): Rng => {
  let a = seed >>> 0;

  return (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** The default random source used when none is supplied. */
export const defaultRng: Rng = Math.random;
