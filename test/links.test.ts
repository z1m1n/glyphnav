import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eligibleAnchor, settleAfter } from '../src/internal/links';

describe('shared anchor eligibility', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    document.body.innerHTML = '';
  });
  afterEach(() => document.head.querySelector('base')?.remove());

  it.each([
    { target: '_blank' },
    { target: 'named-window' },
    { download: '' },
    { rel: 'noopener external' },
    { rel: 'EXTERNAL' },
    { 'data-glyphnav': 'off' },
    { href: 'https://external.example/test' },
    { href: 'mailto:test@example.com' },
    { href: 'http://[' },
  ])('leaves browser-owned anchors untouched: %j', (attrs) => {
    const anchor = document.createElement('a');
    anchor.href = '/destination';
    for (const [key, value] of Object.entries(attrs)) anchor.setAttribute(key, value);
    expect(eligibleAnchor(new MouseEvent('click', { button: 0 }), anchor)).toBeNull();
  });

  it('uses an explicit anchor for synthetic events and respects cancellation', () => {
    const anchor = document.createElement('a');
    anchor.href = '/destination?q=1#top';
    anchor.target = '_SELF';
    const event = new MouseEvent('click', { button: 0, cancelable: true });
    expect(eligibleAnchor(event, anchor)).toBe(anchor);
    event.preventDefault();
    expect(eligibleAnchor(event, anchor)).toBeNull();
  });

  it('finds anchors from text nodes and respects the document browsing target', () => {
    const anchor = document.createElement('a');
    anchor.href = '/destination';
    const text = document.createTextNode('go');
    anchor.appendChild(text);
    document.body.appendChild(anchor);
    let selected: HTMLAnchorElement | null = null;
    anchor.addEventListener('click', (event) => {
      selected = eligibleAnchor(event);
    });
    text.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    expect(selected).toBe(anchor);

    const base = document.createElement('base');
    base.target = '_blank';
    document.head.appendChild(base);
    expect(eligibleAnchor(new MouseEvent('click', { button: 0 }), anchor)).toBeNull();
  });
});

describe('navigation settlement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '/');
  });
  afterEach(() => vi.useRealTimers());

  it('waits for navigation completion even when the URL changes early', async () => {
    let complete!: () => void;
    let settled = false;
    const result = settleAfter(() => {
      window.history.pushState(null, '', '/destination');
      return new Promise<void>((resolve) => {
        complete = resolve;
      });
    }, 1000).then(() => {
      settled = true;
      return null;
    });
    await vi.advanceTimersByTimeAsync(1500);
    expect(settled).toBe(false);
    complete();
    await result;
    expect(settled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('propagates synchronous and asynchronous navigation failures', async () => {
    const error = new Error('navigation failed');
    await expect(
      settleAfter(() => {
        throw error;
      }, 1000),
    ).rejects.toBe(error);
    await expect(settleAfter(() => Promise.reject(error), 1000)).rejects.toBe(error);
    await expect(settleAfter(() => Promise.reject(undefined), 1000)).rejects.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears URL polling on cancellation', async () => {
    const controller = new AbortController();
    const result = settleAfter(() => {}, 1000, controller.signal);
    const outcome = result.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(32);
    expect(vi.getTimerCount()).toBe(1);
    controller.abort();
    expect(await outcome).toMatchObject({ name: 'AbortError' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not start polling when a cancelled navigation later resolves', async () => {
    const controller = new AbortController();
    let complete!: () => void;
    const result = settleAfter(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
      1000,
      controller.signal,
    );
    const outcome = result.catch((error: unknown) => error);
    controller.abort();
    expect(await outcome).toMatchObject({ name: 'AbortError' });
    complete();
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
