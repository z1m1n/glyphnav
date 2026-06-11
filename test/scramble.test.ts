import { describe, expect, it } from 'vitest';
import {
  randomGlyph,
  randomString,
  scrambleBurst,
  scrambleFrames,
  shuffledIndices,
} from '../src/core/scramble';
import { createRng } from '../src/core/rng';
import { seqRng, zeroRng } from './helpers';

const base = { charset: 'xyzw', growStep: 1, resolveStep: 1, maxFrames: 120 };

describe('randomGlyph', () => {
  it('selects a glyph from the charset', () => {
    expect(randomGlyph('abc', zeroRng)).toBe('a');
    expect(randomGlyph('abc', () => 0.99)).toBe('c');
  });
});

describe('randomString', () => {
  it('produces a string of the requested length using only charset glyphs', () => {
    const s = randomString(10, 'ab', createRng(1));
    expect(s).toHaveLength(10);
    expect(/^[ab]+$/.test(s)).toBe(true);
  });

  it('returns an empty string for length 0', () => {
    expect(randomString(0, 'abc', zeroRng)).toBe('');
  });
});

describe('scrambleFrames', () => {
  it('reproduces the canonical "/" -> "/test" sequence', () => {
    // charset 'xyzw' + this rng makes the random base resolve to exactly "xyzw"
    const rng = seqRng([0, 0.25, 0.5, 0.75]);
    const frames = scrambleFrames('test', { ...base, rng });

    expect(frames.map((f) => f.text)).toEqual([
      'x',
      'xy',
      'xyz',
      'xyzw', // grow
      'tyzw',
      'tezw',
      'tesw',
      'test', // resolve
    ]);
    expect(frames.map((f) => f.phase)).toEqual([
      'grow',
      'grow',
      'grow',
      'grow',
      'resolve',
      'resolve',
      'resolve',
      'resolve',
    ]);
  });

  it('always ends exactly on the target', () => {
    const frames = scrambleFrames('hello-world', { ...base, charset: 'abc', rng: createRng(7) });
    expect(frames.at(-1)?.text).toBe('hello-world');
    expect(frames.at(-1)?.phase).toBe('resolve');
  });

  it('returns no frames for an empty target', () => {
    expect(scrambleFrames('', { ...base, rng: zeroRng })).toEqual([]);
  });

  it('handles a single-character target', () => {
    const frames = scrambleFrames('a', { ...base, charset: 'z', rng: zeroRng });
    expect(frames.map((f) => f.text)).toEqual(['z', 'a']);
  });

  it('respects growStep / resolveStep', () => {
    const frames = scrambleFrames('abcdef', {
      charset: 'q',
      rng: zeroRng,
      growStep: 2,
      resolveStep: 3,
      maxFrames: 120,
    });
    // grow by 2: qq, qqqq, then full base qqqqqq
    // resolve by 3: abcqqq, then full abcdef
    expect(frames.map((f) => f.text)).toEqual(['qq', 'qqqq', 'qqqqqq', 'abcqqq', 'abcdef']);
  });

  it('never exceeds maxFrames, scaling the steps up when needed', () => {
    const target = 'x'.repeat(500);
    const frames = scrambleFrames(target, {
      ...base,
      charset: 'ab',
      rng: createRng(3),
      maxFrames: 40,
    });
    expect(frames.length).toBeLessThanOrEqual(40);
    expect(frames.at(-1)?.text).toBe(target);
  });
});

describe('shuffledIndices', () => {
  it('returns a permutation of 0..n-1', () => {
    const order = shuffledIndices(8, createRng(42));
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('is deterministic for a given rng', () => {
    expect(shuffledIndices(5, createRng(7))).toEqual(shuffledIndices(5, createRng(7)));
    // zeroRng always swaps with index 0, rotating the list left by one.
    expect(shuffledIndices(4, zeroRng)).toEqual([1, 2, 3, 0]);
  });
});

describe('scrambleBurst', () => {
  it('bursts to the full target length immediately', () => {
    const frames = scrambleBurst('test', { ...base, rng: createRng(1) });
    expect(frames[0].text).toHaveLength(4);
    expect(frames[0].phase).toBe('grow');
    expect(frames.every((f) => f.text.length === 4)).toBe(true);
  });

  it('locks characters in a deterministic random order while the rest flicker', () => {
    // zeroRng: resolution order is [1, 2, 3, 0]; every noise glyph is 'q'.
    const frames = scrambleBurst('test', { ...base, charset: 'q', rng: zeroRng });
    expect(frames.map((f) => f.text)).toEqual([
      'qqqq', // burst
      'qeqq', // position 1 locked
      'qesq', // + position 2
      'qest', // + position 3
      'test', // final
    ]);
    expect(frames.map((f) => f.phase)).toEqual([
      'grow',
      'resolve',
      'resolve',
      'resolve',
      'resolve',
    ]);
  });

  it('always ends exactly on the target', () => {
    const frames = scrambleBurst('hello-world', { ...base, charset: 'abc', rng: createRng(7) });
    expect(frames.at(-1)?.text).toBe('hello-world');
    expect(frames.at(-1)?.phase).toBe('resolve');
  });

  it('returns no frames for an empty target', () => {
    expect(scrambleBurst('', { ...base, rng: zeroRng })).toEqual([]);
  });

  it('handles a single-character target', () => {
    const frames = scrambleBurst('a', { ...base, charset: 'z', rng: zeroRng });
    expect(frames.map((f) => f.text)).toEqual(['z', 'a']);
  });

  it('never exceeds maxFrames, scaling resolveStep up when needed', () => {
    const target = 'x'.repeat(500);
    const frames = scrambleBurst(target, {
      ...base,
      charset: 'ab',
      rng: createRng(3),
      maxFrames: 40,
    });
    expect(frames.length).toBeLessThanOrEqual(40);
    expect(frames.at(-1)?.text).toBe(target);
  });
});
