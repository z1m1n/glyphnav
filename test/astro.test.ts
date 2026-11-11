import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachGlyphnav } from '../src/astro';
import type { AstroGlyphnavInstance, AstroGlyphnavOptions, AstroNavigate } from '../src/astro';

const live: AstroGlyphnavInstance[] = [];
function attach(
  navigate: AstroNavigate,
  options: AstroGlyphnavOptions = {},
): AstroGlyphnavInstance {
  const instance = attachGlyphnav(navigate, { duration: 50, ...options });
  live.push(instance);
  return instance;
}

const fakeNavigate = (): AstroNavigate =>
  vi.fn(async (href, options) => {
    if (options?.history === 'replace') window.history.replaceState(options.state, '', href);
    else window.history.pushState(options?.state, '', href);
  });

function anchor(href: string, attrs: Record<string, string> = {}): HTMLAnchorElement {
  const node = document.createElement('a');
  node.href = href;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  document.body.append(node);
  return node;
}

const click = (init: MouseEventInit = {}): MouseEvent =>
  new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });

describe('astro adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '/glyphnav/astro/');
    document.body.innerHTML = '';
  });
  afterEach(() => {
    while (live.length) live.pop()!.detach();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(['before', 'after'] as const)('navigates and animates with commit:%s', async (commit) => {
    const order: string[] = [];
    const native = vi.fn(async (href: string) => {
      order.push('navigate');
      window.history.pushState({}, '', href);
    });
    const glyph = attach(native, {
      commit,
      hooks: { onFrame: (frame) => order.push(frame.path) },
    });
    const run = glyph.navigate('/glyphnav/astro/about/?q=test#results');
    await vi.runAllTimersAsync();
    expect(await run).toBe('completed');
    expect(native).toHaveBeenCalledOnce();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/glyphnav/astro/about/?q=test#results',
    );
    expect(order.length).toBeGreaterThan(2);
    expect(commit === 'before' ? order[0] : order.at(-1)).toBe('navigate');
  });

  it('waits for asynchronous navigation and animates the actual redirect destination', async () => {
    const frames: string[] = [];
    const native: AstroNavigate = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      window.history.pushState({}, '', '/glyphnav/astro/redirected/');
    });
    const glyph = attach(native, { hooks: { onFrame: (frame) => frames.push(frame.path) } });
    const run = glyph.navigate('/glyphnav/astro/about/');
    await vi.advanceTimersByTimeAsync(50);
    expect(frames).toEqual([]);
    await vi.runAllTimersAsync();
    expect(await run).toBe('completed');
    expect(frames.at(-1)).toBe('/glyphnav/astro/redirected/');
  });

  it('forwards all native navigation options unchanged', async () => {
    const native = fakeNavigate();
    const glyph = attach(native);
    const extras = {
      history: 'replace' as const,
      info: { reason: 'test' },
      state: { key: 123 },
      formData: new FormData(),
      sourceElement: document.createElement('form'),
    };
    const run = glyph.navigate('/glyphnav/astro/about/', extras);
    await vi.runAllTimersAsync();
    await run;
    expect(native).toHaveBeenCalledWith('/glyphnav/astro/about/', extras);
    expect(window.history.state).toEqual(extras.state);
  });

  it.each(['relative', 'absolute'])(
    'resolves a %s same-origin target with the deployment base',
    async (kind) => {
      const target =
        kind === 'relative'
          ? 'about/?q=1#results'
          : `${window.location.origin}/glyphnav/astro/about/?q=1#results`;
      const native = fakeNavigate();
      const frames: string[] = [];
      const glyph = attach(native, { hooks: { onFrame: (frame) => frames.push(frame.path) } });
      const run = glyph.navigate(target);
      await vi.runAllTimersAsync();
      await run;
      expect(frames.at(-1)).toBe('/glyphnav/astro/about/?q=1#results');
    },
  );

  it('resolves relative links against the landed page when superseding animation', async () => {
    const native = fakeNavigate();
    const glyph = attach(native, { duration: 500 });
    const first = glyph.navigate('/glyphnav/astro/docs/');
    await vi.advanceTimersByTimeAsync(20);
    expect(glyph.controller.animating).toBe(true);
    anchor('../about/').dispatchEvent(click());
    await vi.runAllTimersAsync();
    expect(await first).toBe('cancelled');
    expect(window.location.pathname).toBe('/glyphnav/astro/about/');
    expect(native).toHaveBeenLastCalledWith(
      `${window.location.origin}/glyphnav/astro/about/`,
      expect.objectContaining({ history: 'auto' }),
    );
  });

  it('accepts URL objects', async () => {
    const native = fakeNavigate();
    const target = new URL('/glyphnav/astro/about/', window.location.href);
    const run = attach(native).navigate(target);
    await vi.runAllTimersAsync();
    await run;
    expect(native).toHaveBeenCalledWith(target.href, undefined);
  });

  it('skips animation for cross-origin destinations', async () => {
    const native = vi.fn(async () => {});
    const onFrame = vi.fn();
    const glyph = attach(native, { hooks: { onFrame } });
    expect(await glyph.navigate('https://example.com/about/')).toBe('skipped');
    expect(native).toHaveBeenCalledWith('https://example.com/about/', undefined);
    expect(onFrame).not.toHaveBeenCalled();
  });

  it('captures a nested anchor click once and forwards history/sourceElement', async () => {
    const native = fakeNavigate();
    const glyph = attach(native);
    const node = anchor('/glyphnav/astro/about/', { 'data-astro-history': 'replace' });
    const child = document.createElement('span');
    node.append(child);
    const stop = glyph.link(node);
    const event = click();
    child.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await vi.runAllTimersAsync();
    expect(native).toHaveBeenCalledOnce();
    expect(native).toHaveBeenCalledWith(node.href, { history: 'replace', sourceElement: node });
    stop();
  });

  it.each([
    { 'data-astro-reload': '' },
    { 'data-glyphnav': 'off' },
    { target: '_blank' },
    { download: '' },
    { rel: 'external' },
  ] as Array<Record<string, string>>)('preserves browser behavior for %j', async (attrs) => {
    const native = fakeNavigate();
    attach(native);
    const event = click();
    anchor('/glyphnav/astro/about/', attrs).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    await vi.runAllTimersAsync();
    expect(native).not.toHaveBeenCalled();
  });

  it.each([
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
  ])('preserves modified clicks %j', async (init) => {
    const native = fakeNavigate();
    attach(native);
    const event = click(init);
    anchor('/glyphnav/astro/about/').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    await vi.runAllTimersAsync();
    expect(native).not.toHaveBeenCalled();
  });

  it('ignores cancelled and cross-origin clicks', async () => {
    const native = fakeNavigate();
    attach(native);
    const cancelled = click();
    cancelled.preventDefault();
    anchor('/glyphnav/astro/about/').dispatchEvent(cancelled);
    anchor('https://example.com/').dispatchEvent(click());
    await vi.runAllTimersAsync();
    expect(native).not.toHaveBeenCalled();
  });

  it('supports opt-in links and removes them on detach', async () => {
    const native = fakeNavigate();
    const glyph = attach(native, { intercept: 'none' });
    const node = anchor('/glyphnav/astro/about/');
    node.dispatchEvent(click());
    expect(native).not.toHaveBeenCalled();
    glyph.link(node);
    const event = click();
    node.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await vi.runAllTimersAsync();
    expect(native).toHaveBeenCalledOnce();
    glyph.detach();
    const after = click();
    node.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it('limits interception to the configured root, including newly inserted links', async () => {
    const root = document.createElement('section');
    document.body.append(root);
    const native = fakeNavigate();
    attach(native, { root });
    const outside = click();
    anchor('/glyphnav/astro/about/').dispatchEvent(outside);
    expect(outside.defaultPrevented).toBe(false);
    const inside = anchor('/glyphnav/astro/docs/');
    root.append(inside);
    const event = click();
    inside.dispatchEvent(event);
    await vi.runAllTimersAsync();
    expect(event.defaultPrevented).toBe(true);
    expect(native).toHaveBeenCalledOnce();
  });

  it('detaches the global listener and cancels an animation before committing', async () => {
    const native = fakeNavigate();
    const glyph = attach(native, { commit: 'after', duration: 500 });
    const run = glyph.navigate('/glyphnav/astro/about/');
    await vi.advanceTimersByTimeAsync(20);
    glyph.detach();
    expect(await run).toBe('cancelled');
    expect(window.location.pathname).toBe('/glyphnav/astro/');
    const event = click();
    anchor('/glyphnav/astro/docs/').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(native).not.toHaveBeenCalled();
  });

  it('propagates navigation rejection and reports click failures', async () => {
    const error = new Error('Astro failed');
    const native = vi.fn(async () => {
      throw error;
    });
    const glyph = attach(native);
    await expect(glyph.navigate('/glyphnav/astro/about/')).rejects.toThrow(error);
    const reportError = vi.fn();
    vi.stubGlobal('reportError', reportError);
    anchor('/glyphnav/astro/docs/').dispatchEvent(click());
    await vi.runAllTimersAsync();
    expect(reportError).toHaveBeenCalledWith(error);
    expect(glyph.controller.animating).toBe(false);
    expect(window.location.pathname).toBe('/glyphnav/astro/');
  });

  it('supersedes pending navigation without stale animation', async () => {
    let resolve!: () => void;
    const native = vi.fn((href: string) => {
      if (href.endsWith('/about/'))
        return new Promise<void>((done) => {
          resolve = done;
        });
      window.history.pushState({}, '', href);
      return Promise.resolve();
    });
    const glyph = attach(native);
    const first = glyph.navigate('/glyphnav/astro/about/');
    const second = glyph.navigate('/glyphnav/astro/docs/');
    await vi.runAllTimersAsync();
    expect(await first).toBe('cancelled');
    expect(await second).toBe('completed');
    resolve();
    await vi.runAllTimersAsync();
    expect(window.location.pathname).toBe('/glyphnav/astro/docs/');
  });

  it('makes server-side attachment safe', async () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
    const native = vi.fn(async () => {});
    const glyph = attach(native, { animatePopState: true });
    expect(await glyph.navigate('/about/')).toBe('skipped');
    glyph.detach();
    expect(native).toHaveBeenCalledOnce();
  });

  it('animates history traversals only when opted in and removes the listener', async () => {
    const onFrame = vi.fn();
    const native = fakeNavigate();
    const glyph = attach(native, { animatePopState: true, hooks: { onFrame } });
    window.history.replaceState({}, '', '/glyphnav/astro/about/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.runAllTimersAsync();
    expect(onFrame).toHaveBeenCalled();
    expect(native).not.toHaveBeenCalled();
    onFrame.mockClear();
    glyph.detach();
    window.history.replaceState({}, '', '/glyphnav/astro/docs/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.runAllTimersAsync();
    expect(onFrame).not.toHaveBeenCalled();
  });
});
