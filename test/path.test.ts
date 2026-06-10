import { describe, expect, it } from 'vitest';
import { commonPrefixLength, resolvePath, splitTarget } from '../src/core/path';

describe('resolvePath', () => {
  it('returns rooted paths unchanged', () => {
    expect(resolvePath('/test', '/anywhere')).toBe('/test');
    expect(resolvePath('/a/b?q=1#h', '/x')).toBe('/a/b?q=1#h');
  });

  it('resolves relative targets against the current path', () => {
    expect(resolvePath('pricing', '/vue/features')).toBe('/vue/pricing');
    expect(resolvePath('pricing', '/vue/features/')).toBe('/vue/features/pricing');
    expect(resolvePath('../up', '/a/b/c')).toBe('/a/up');
    expect(resolvePath('?q=1', '/a/b')).toBe('/a/b?q=1');
    expect(resolvePath('#frag', '/a/b')).toBe('/a/b#frag');
  });

  it('leaves cross-origin targets untouched', () => {
    expect(resolvePath('https://example.com/x', '/a')).toBe('https://example.com/x');
    expect(resolvePath('//example.com/x', '/a')).toBe('//example.com/x');
  });
});

describe('commonPrefixLength', () => {
  it('counts shared leading characters', () => {
    expect(commonPrefixLength('/users/1', '/users/2')).toBe(7);
    expect(commonPrefixLength('/a', '/a/b')).toBe(2);
    expect(commonPrefixLength('abc', 'xyz')).toBe(0);
    expect(commonPrefixLength('', 'abc')).toBe(0);
    expect(commonPrefixLength('same', 'same')).toBe(4);
  });
});

describe('splitTarget', () => {
  it('keeps the leading slash fixed in full scope', () => {
    expect(splitTarget('/test', { scope: 'full', preserveLeadingSlash: true })).toEqual({
      prefix: '/',
      text: 'test',
    });
  });

  it('animates the whole string when the leading slash is not preserved', () => {
    expect(splitTarget('/test', { scope: 'full', preserveLeadingSlash: false })).toEqual({
      prefix: '',
      text: '/test',
    });
  });

  it('keeps the common prefix fixed in tail scope', () => {
    expect(
      splitTarget('/users/2', { scope: 'tail', preserveLeadingSlash: true, from: '/users/1' }),
    ).toEqual({ prefix: '/users/', text: '2' });
  });

  it('handles tail scope where the target extends the current path', () => {
    expect(
      splitTarget('/a/b', { scope: 'tail', preserveLeadingSlash: true, from: '/a' }),
    ).toEqual({ prefix: '/a', text: '/b' });
  });

  it('falls back to full behaviour in tail scope when from is missing', () => {
    expect(splitTarget('/test', { scope: 'tail', preserveLeadingSlash: true })).toEqual({
      prefix: '/',
      text: 'test',
    });
  });
});
