import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eligibleAnchor, install, navigate, resetController, uninstall } from '../src/vanilla';

function setLocation(path = '/'): void {
  window.history.replaceState(null, '', path);
}

function makeAnchor(attrs: Record<string, string>): HTMLAnchorElement {
  const a = document.createElement('a');
  for (const [key, value] of Object.entries(attrs)) a.setAttribute(key, value);
  document.body.appendChild(a);
  return a;
}

/** Dispatch a click on `a` and capture what eligibleAnchor decides. */
function clickResult(a: HTMLAnchorElement, init: MouseEventInit = {}): HTMLAnchorElement | null {
  let result: HTMLAnchorElement | null = null;
  const handler = (e: Event): void => {
    result = eligibleAnchor(e as MouseEvent);
    // Inspection is done; cancel the default so jsdom doesn't attempt (and warn
    // about) a real document navigation. This runs after eligibleAnchor, so its
    // `defaultPrevented` check still sees the real value.
    e.preventDefault();
  };
  document.addEventListener('click', handler);
  a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, ...init }));
  document.removeEventListener('click', handler);
  return result;
}

describe('eligibleAnchor', () => {
  beforeEach(() => {
    setLocation('/');
    document.body.innerHTML = '';
  });

  it('accepts a plain same-origin link', () => {
    const a = makeAnchor({ href: '/page' });
    expect(clickResult(a)).toBe(a);
  });

  it('ignores modified clicks', () => {
    const a = makeAnchor({ href: '/page' });
    expect(clickResult(a, { metaKey: true })).toBeNull();
    expect(clickResult(a, { ctrlKey: true })).toBeNull();
    expect(clickResult(a, { shiftKey: true })).toBeNull();
    expect(clickResult(a, { button: 1 })).toBeNull();
  });

  it('ignores new-tab, download, external and cross-origin links', () => {
    expect(clickResult(makeAnchor({ href: '/p', target: '_blank' }))).toBeNull();
    expect(clickResult(makeAnchor({ href: '/p', download: '' }))).toBeNull();
    expect(clickResult(makeAnchor({ href: '/p', rel: 'external' }))).toBeNull();
    expect(clickResult(makeAnchor({ href: 'https://example.com/p' }))).toBeNull();
  });

  it('honours data-glyphnav="off"', () => {
    expect(clickResult(makeAnchor({ href: '/p', 'data-glyphnav': 'off' }))).toBeNull();
  });

  it('ignores anchors without an href', () => {
    expect(clickResult(makeAnchor({}))).toBeNull();
  });
});

describe('navigate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setLocation('/');
  });
  afterEach(() => {
    vi.useRealTimers();
    resetController();
  });

  it('animates the address bar then pushes (reload: false)', async () => {
    const frames: string[] = [];
    const run = navigate('/dashboard', {
      reload: false,
      charset: 'q',
      rng: () => 0,
      stepDuration: 5,
      hooks: { onFrame: (f) => frames.push(f.path) },
    });

    await vi.advanceTimersByTimeAsync(200);
    await expect(run).resolves.toBe('completed');
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.at(-1)).toBe('/dashboard');
    expect(window.location.pathname).toBe('/dashboard');
  });

  it("pushes first and animates on top with commit: 'before'", async () => {
    const order: string[] = [];
    const run = navigate('/dashboard', {
      reload: false,
      commit: 'before',
      charset: 'q',
      rng: () => 0,
      stepDuration: 5,
      hooks: {
        onFrame: (f) => order.push(f.path),
        onCommit: () => order.push('commit'),
      },
    });

    await vi.advanceTimersByTimeAsync(200);
    await expect(run).resolves.toBe('completed');
    expect(order[0]).toBe('commit'); // navigation went out before any frame
    expect(order.at(-1)).toBe('/dashboard');
    expect(window.location.pathname).toBe('/dashboard');
  });

  it("forces the classic order when commit: 'before' meets a hard reload", async () => {
    const frames: string[] = [];
    const onCommit = vi.fn();
    const run = navigate('/away-we-go', {
      reload: true,
      commit: 'before',
      charset: 'q',
      rng: () => 0,
      stepDuration: 5,
      hooks: { onFrame: (f) => frames.push(f.path), onCommit },
    });

    await vi.advanceTimersByTimeAsync(20); // a few frames into the animation
    // The animation is running and nothing has been committed — i.e. the
    // navigate-first request fell back to animate-first.
    expect(frames.length).toBeGreaterThan(0);
    expect(onCommit).not.toHaveBeenCalled();

    // Cancel before the run would hard-reload (jsdom cannot navigate).
    resetController();
    await expect(run).resolves.toBe('cancelled');
  });
});

describe('install', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setLocation('/');
    document.body.innerHTML = '';
  });
  afterEach(() => {
    uninstall();
    resetController();
    vi.useRealTimers();
  });

  it('animates and commits same-origin link clicks', async () => {
    const frames: string[] = [];
    install({
      reload: false,
      charset: 'q',
      rng: () => 0,
      stepDuration: 5,
      hooks: { onFrame: (f) => frames.push(f.path) },
    });

    const anchor = makeAnchor({ href: '/about' });
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

    await vi.advanceTimersByTimeAsync(200);
    expect(frames.length).toBeGreaterThan(0);
    expect(window.location.pathname).toBe('/about');
  });

  it('stops intercepting after uninstall', async () => {
    const onFrame = vi.fn();
    install({ reload: false, stepDuration: 5, hooks: { onFrame } });
    uninstall();

    // href="#" so jsdom treats the (now un-intercepted) click as a hash change
    // rather than logging an unimplemented full navigation.
    const anchor = makeAnchor({ href: '#' });
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    await vi.advanceTimersByTimeAsync(200);

    expect(onFrame).not.toHaveBeenCalled();
  });
});
