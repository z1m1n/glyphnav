import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachGlyphnav } from '../src/sveltekit';
import type { Goto, SvelteKitGlyphnavInstance, SvelteKitGlyphnavOptions } from '../src/sveltekit';

function setLocation(path = '/'): void {
  window.history.replaceState(null, '', path);
}

function makeAnchor(attrs: Record<string, string>): HTMLAnchorElement {
  const a = document.createElement('a');
  for (const [key, value] of Object.entries(attrs)) a.setAttribute(key, value);
  document.body.appendChild(a);
  return a;
}

/** A `goto` that lands the navigation by updating the address bar, like SvelteKit. */
function fakeGoto(): Goto {
  return vi.fn(async (to: string | URL) => {
    window.history.pushState({}, '', String(to));
  });
}

function plainClick(): MouseEvent {
  return new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
}

/** Instances to tear down so a global listener never leaks into the next test. */
const live: SvelteKitGlyphnavInstance[] = [];
function attach(goto: Goto, options?: SvelteKitGlyphnavOptions): SvelteKitGlyphnavInstance {
  const instance = attachGlyphnav(goto, options);
  live.push(instance);
  return instance;
}

describe('sveltekit adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setLocation('/');
    document.body.innerHTML = '';
  });
  afterEach(() => {
    while (live.length) live.pop()!.detach();
    vi.useRealTimers();
  });

  it('navigate animates the bar, then hands off to goto', async () => {
    const goto = fakeGoto();
    const frames: string[] = [];
    const instance = attach(goto, {
      intercept: 'none',
      charset: 'q',
      rng: () => 0,
      stepDuration: 5,
      commit: 'after',
      hooks: { onFrame: (f) => frames.push(f.path) },
    });

    const nav = instance.navigate('/test');
    await vi.advanceTimersByTimeAsync(200);
    await nav;

    expect(frames.length).toBeGreaterThan(0);
    expect(frames.at(-1)).toBe('/test');
    expect(goto).toHaveBeenCalledTimes(1);
    expect((goto as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('/test');
  });

  it("commit: 'before' navigates first, then decodes the landed path on top", async () => {
    const goto = fakeGoto();
    const order: string[] = [];
    const instance = attach(goto, {
      intercept: 'none',
      commit: 'before',
      charset: 'q',
      rng: () => 0,
      stepDuration: 5,
      hooks: { onFrame: (f) => order.push(f.path), onCommit: () => order.push('commit') },
    });

    const nav = instance.navigate('/dashboard');
    await vi.advanceTimersByTimeAsync(200);
    await nav;

    expect(order[0]).toBe('commit'); // goto went out before any frame
    expect(order.at(-1)).toBe('/dashboard');
    expect(goto).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/dashboard');
  });

  it("intercept: 'links' animates an <a> click and lets goto navigate (once)", async () => {
    const goto = fakeGoto();
    const frames: string[] = [];
    attach(goto, {
      charset: 'q',
      rng: () => 0,
      stepDuration: 5,
      commit: 'after',
      hooks: { onFrame: (f) => frames.push(f.path) },
    });

    const anchor = makeAnchor({ href: '/about' });
    const event = plainClick();
    anchor.dispatchEvent(event);

    // glyphnav claimed the click in the capture phase, so SvelteKit's own
    // bubble-phase handler will bail and only `goto` performs the navigation.
    expect(event.defaultPrevented).toBe(true);
    await vi.advanceTimersByTimeAsync(200);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.at(-1)).toBe('/about');
    expect(goto).toHaveBeenCalledTimes(1);
    expect((goto as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('/about');
  });

  it("intercept: 'none' installs no global listener, so link clicks fall through to SvelteKit", async () => {
    const goto = fakeGoto();
    const onFrame = vi.fn();
    attach(goto, { intercept: 'none', stepDuration: 5, hooks: { onFrame } });

    // `#x` so jsdom treats the un-intercepted click as a hash change, not a warned navigation.
    const anchor = makeAnchor({ href: '#x' });
    const event = plainClick();
    anchor.dispatchEvent(event);
    await vi.advanceTimersByTimeAsync(200);

    expect(event.defaultPrevented).toBe(false); // glyphnav did not claim the click
    expect(goto).not.toHaveBeenCalled();
    expect(onFrame).not.toHaveBeenCalled();
    // The instance's own navigate() still animates — see the first test, which
    // exercises exactly that under intercept: 'none'.
  });

  it('stops intercepting after detach', async () => {
    const goto = fakeGoto();
    const onFrame = vi.fn();
    const instance = attachGlyphnav(goto, { stepDuration: 5, hooks: { onFrame } });
    instance.detach();

    const anchor = makeAnchor({ href: '#x' });
    const event = plainClick();
    anchor.dispatchEvent(event);
    await vi.advanceTimersByTimeAsync(200);

    expect(event.defaultPrevented).toBe(false);
    expect(goto).not.toHaveBeenCalled();
    expect(onFrame).not.toHaveBeenCalled();
  });

  it('use:link animates an opt-in link, and destroy() detaches it', async () => {
    const goto = fakeGoto();
    const frames: string[] = [];
    const instance = attach(goto, {
      intercept: 'none',
      charset: 'q',
      rng: () => 0,
      stepDuration: 5,
      commit: 'after',
      hooks: { onFrame: (f) => frames.push(f.path) },
    });

    const anchor = makeAnchor({ href: '/posts' });
    const action = instance.link(anchor);
    const event = plainClick();
    anchor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    await vi.advanceTimersByTimeAsync(200);
    expect(frames.at(-1)).toBe('/posts');
    expect(goto).toHaveBeenCalledTimes(1);

    action.destroy();
    (goto as ReturnType<typeof vi.fn>).mockClear();
    anchor.setAttribute('href', '#gone');
    const after = plainClick();
    anchor.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
    expect(goto).not.toHaveBeenCalled();
  });

  it('forwards replace and the other goto options', async () => {
    const goto = fakeGoto();
    const instance = attach(goto, {
      intercept: 'none',
      charset: 'q',
      rng: () => 0,
      stepDuration: 5,
      commit: 'after',
    });

    const nav = instance.navigate('/x', {
      replace: true,
      noScroll: true,
      keepFocus: true,
      invalidateAll: true,
      state: { a: 1 },
    });
    await vi.advanceTimersByTimeAsync(200);
    await nav;

    expect(goto).toHaveBeenCalledWith('/x', {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
      invalidateAll: true,
      state: { a: 1 },
    });
  });

  it('opts into animating browser back/forward with animatePopState', async () => {
    setLocation('/start');
    const goto = fakeGoto();
    const frames: string[] = [];
    const instance = attach(goto, {
      animatePopState: true,
      intercept: 'none',
      commit: 'before',
      charset: 'q',
      rng: () => 0,
      stepDuration: 5,
      hooks: { onFrame: (f) => frames.push(f.path) },
    });

    // A forward SPA navigation to /elsewhere updates the tracked path.
    const fwd = instance.navigate('/elsewhere');
    await vi.advanceTimersByTimeAsync(200);
    await fwd;

    // The back button: the browser restores /start itself, then fires popstate.
    frames.length = 0;
    window.history.replaceState(null, '', '/start');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.advanceTimersByTimeAsync(200);

    expect(frames.length).toBeGreaterThan(0);
    expect(frames.at(-1)).toBe('/start');
  });
});
