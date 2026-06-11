import { describe, expect, it } from 'vitest';
import { generateFrames } from '../src/core/frames';
import { seqRng, zeroRng } from './helpers';

describe('generateFrames', () => {
  it('produces full path strings for the canonical demo', () => {
    const frames = generateFrames('/', '/test', {
      charset: 'xyzw',
      rng: seqRng([0, 0.25, 0.5, 0.75]),
    });

    expect(frames.map((f) => f.path)).toEqual([
      '/x',
      '/xy',
      '/xyz',
      '/xyzw',
      '/tyzw',
      '/tezw',
      '/tesw',
      '/test',
    ]);
  });

  it('tags each frame with index, total and phase', () => {
    const frames = generateFrames('/', '/ab', { charset: 'q', rng: () => 0 });
    expect(frames).toEqual([
      { path: '/q', text: 'q', index: 0, total: 4, phase: 'grow' },
      { path: '/qq', text: 'qq', index: 1, total: 4, phase: 'grow' },
      { path: '/aq', text: 'aq', index: 2, total: 4, phase: 'resolve' },
      { path: '/ab', text: 'ab', index: 3, total: 4, phase: 'resolve' },
    ]);
  });

  it('ends exactly on the target path', () => {
    const frames = generateFrames('/home', '/settings/profile', { charset: 'abc' });
    expect(frames.at(-1)?.path).toBe('/settings/profile');
  });

  it('animates only the differing tail in tail scope', () => {
    const frames = generateFrames('/users/1', '/users/2', {
      scope: 'tail',
      charset: 'q',
      rng: () => 0,
    });
    expect(frames.map((f) => f.path)).toEqual(['/users/q', '/users/2']);
  });

  it('returns no frames when navigating to the root', () => {
    expect(generateFrames('/whatever', '/', {})).toEqual([]);
  });

  it('plays the scramble effect when requested', () => {
    // zeroRng: resolution order for two characters is [1, 0]; noise is 'q'.
    const frames = generateFrames('/', '/ab', { effect: 'scramble', charset: 'q', rng: zeroRng });
    expect(frames.map((f) => f.path)).toEqual(['/qq', '/qb', '/ab']);
    expect(frames.map((f) => f.phase)).toEqual(['grow', 'resolve', 'resolve']);
  });

  it('caps the frame count to fit a total duration', () => {
    const target = '/abcdefghijklmnopqrstuvwxyz';
    // 60 ms at ≥15 ms per frame leaves room for at most 4 frames.
    const frames = generateFrames('/', target, { duration: 60, charset: 'q', rng: zeroRng });
    expect(frames.length).toBeLessThanOrEqual(4);
    expect(frames.at(-1)?.path).toBe(target);
  });

  it('animates search and hash as part of the path', () => {
    const frames = generateFrames('/', '/about?q=1#x', { charset: 'q', rng: zeroRng });
    expect(frames.at(-1)?.path).toBe('/about?q=1#x');
    expect(frames.every((f) => f.path.startsWith('/'))).toBe(true);
  });
});
