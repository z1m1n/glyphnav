import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { cloneElement, createElement, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactElement } from 'react';

// Hoisted so the (hoisted) vi.mock factories below can reference them.
const m = vi.hoisted(() => {
  const listeners = new Map<string, Set<(...args: never[]) => void>>();
  const events = {
    on: (name: string, callback: (...args: never[]) => void) => {
      const callbacks = listeners.get(name) ?? new Set();
      callbacks.add(callback);
      listeners.set(name, callbacks);
    },
    off: (name: string, callback: (...args: never[]) => void) =>
      listeners.get(name)?.delete(callback),
    emit: (name: string, ...args: unknown[]) => {
      for (const callback of listeners.get(name) ?? []) callback(...(args as never[]));
    },
  };
  const pagesRouter = { push: vi.fn(), replace: vi.fn(), events };
  return {
    push: vi.fn(),
    replace: vi.fn(),
    pagesPush: pagesRouter.push,
    pagesReplace: pagesRouter.replace,
    pagesRouter,
    nativePagesEvents: true,
    nativeDispatch: vi.fn(),
    nativePending: false,
    routerMode: 'app',
    listeners,
    events,
  };
});

// Model Next's native Link handler, including caller cancellation, legacy child
// callbacks, native dispatch identity/pending state and Pages completion events.
vi.mock('next/link', async () => {
  const { formatUrl } = await import('next/dist/shared/lib/router/utils/format-url');
  return {
    __esModule: true,
    default: ({
      href,
      as,
      onClick,
      children,
      replace,
      scroll,
      shallow,
      locale,
      onNavigate,
      transitionTypes,
      legacyBehavior,
      ...rest
    }: Record<string, unknown>) => {
      const destination = as ?? href;
      const hrefString =
        typeof destination === 'string' ? destination : formatUrl(destination as never);
      const child = children as ReactElement<{
        onClick?: (event: ReactMouseEvent<HTMLAnchorElement>) => void;
      }>;
      const handleClick = (event: ReactMouseEvent<HTMLAnchorElement>): void => {
        const caller = legacyBehavior
          ? child.props.onClick
          : (onClick as typeof child.props.onClick);
        caller?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          (event.currentTarget.target && event.currentTarget.target !== '_self') ||
          event.currentTarget.hasAttribute('download') ||
          new URL(event.currentTarget.href).origin !== window.location.origin
        )
          return;
        event.preventDefault();
        let cancelled = false;
        (onNavigate as ((event: { preventDefault: () => void }) => void) | undefined)?.({
          preventDefault: () => {
            cancelled = true;
          },
        });
        if (cancelled) return;
        m.nativePending = true;
        m.nativeDispatch({
          href,
          as,
          replace,
          scroll,
          shallow,
          locale,
          transitionTypes,
          hrefString,
        });
        if (m.routerMode === 'pages') {
          const hashOnly = hrefString.startsWith('#');
          const name = hashOnly ? 'hashChange' : 'routeChange';
          if (m.nativePagesEvents) m.events.emit(`${name}Start`, hrefString);
          const navigate = replace ? m.pagesRouter.replace : m.pagesRouter.push;
          Promise.resolve(navigate(href, as, { scroll: scroll ?? true, shallow, locale })).then(
            () => {
              m.nativePending = false;
              if (m.nativePagesEvents) m.events.emit(`${name}Complete`, hrefString);
              return undefined;
            },
            (error: unknown) => {
              m.nativePending = false;
              if (m.nativePagesEvents) m.events.emit('routeChangeError', error, hrefString);
              return undefined;
            },
          );
        } else {
          (replace ? m.replace : m.push)(hrefString, { scroll, transitionTypes });
        }
      };
      const props = { href: hrefString, onClick: handleClick, ...rest };
      return legacyBehavior
        ? cloneElement(child, props)
        : createElement('a', props, children as never);
    },
  };
});
vi.mock('next/navigation', () => ({
  useRouter: () => {
    m.routerMode = 'app';
    return { push: m.push, replace: m.replace };
  },
}));
vi.mock('next/compat/router', () => ({
  useRouter: () => {
    m.routerMode = 'pages';
    return m.pagesRouter;
  },
}));

import {
  GlyphnavLink,
  GlyphnavProvider,
  useGlyphnavController,
  useGlyphnavNavigate,
} from '../src/next';
import type { GlyphnavController, RunResult } from '../src/core';

// commit: 'after' so the animation plays to completion (memory/jsdom has no real
// landed URL for navigate-first); deterministic, fast frames.
const fast = { charset: 'q', rng: () => 0, stepDuration: 5, commit: 'after' } as const;

function NavButton({ mode }: { mode?: 'app' | 'pages' }) {
  const navigate = useGlyphnavNavigate({ ...fast, routerMode: mode });
  return (
    <button type="button" onClick={() => void navigate('/test')}>
      go
    </button>
  );
}

// Navigate-first (commit: 'before') with a captured per-frame hook.
function NavFirstButton({ onFrame }: { onFrame: (path: string) => void }) {
  const navigate = useGlyphnavNavigate({
    charset: 'q',
    rng: () => 0,
    stepDuration: 5,
    commit: 'before',
    hooks: { onFrame: (f) => onFrame(f.path) },
  });
  return (
    <button type="button" onClick={() => void navigate('/test')}>
      go
    </button>
  );
}

describe('next adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '/');
    m.routerMode = 'app';
    m.nativePending = false;
    m.nativePagesEvents = true;
    m.listeners.clear();
  });
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('useGlyphnavNavigate animates then pushes via the App Router', async () => {
    render(<NavButton />);

    fireEvent.click(screen.getByText('go'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(m.push).toHaveBeenCalledWith('/test', undefined);
    expect(m.pagesPush).not.toHaveBeenCalled();
  });

  it('navigate first animates to the landed path once the App Router URL settles', async () => {
    // The App Router updates the URL asynchronously, after push returns — so the
    // bar must not be read back until it settles, or the animation is skipped.
    window.history.replaceState(null, '', '/');
    m.push.mockImplementationOnce((href: string) => {
      setTimeout(() => window.history.pushState(null, '', String(href)), 30);
    });

    const frames: string[] = [];
    render(<NavFirstButton onFrame={(p) => frames.push(p)} />);

    fireEvent.click(screen.getByText('go'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(m.push).toHaveBeenCalledWith('/test', undefined);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.at(-1)).toBe('/test');
    expect(window.location.pathname).toBe('/test');
  });

  it("routerMode: 'pages' routes navigation through next/compat/router", async () => {
    render(<NavButton mode="pages" />);

    fireEvent.click(screen.getByText('go'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(m.pagesPush).toHaveBeenCalledWith('/test', undefined, undefined);
    expect(m.push).not.toHaveBeenCalled();
  });

  it('GlyphnavLink animates then navigates on click', async () => {
    render(
      <GlyphnavProvider {...fast}>
        <GlyphnavLink href="/other">other</GlyphnavLink>
      </GlyphnavProvider>,
    );

    fireEvent.click(screen.getByText('other'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(m.push).toHaveBeenCalledWith('/other', expect.anything());
  });

  it('GlyphnavLink lets modified clicks fall through (no SPA navigation)', async () => {
    render(
      <GlyphnavProvider {...fast}>
        <GlyphnavLink href="/other">other</GlyphnavLink>
      </GlyphnavProvider>,
    );

    document.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
    fireEvent.click(screen.getByText('other'), { metaKey: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(m.push).not.toHaveBeenCalled();
  });

  it.each([{ target: '_blank' }, { download: '' }, { href: 'https://example.com/outside' }])(
    'leaves browser-owned link behavior intact: %j',
    async (props) => {
      const click = vi.fn();
      render(
        <GlyphnavProvider {...fast}>
          <GlyphnavLink href="/other" {...props} onClick={click}>
            other
          </GlyphnavLink>
        </GlyphnavProvider>,
      );
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      fireEvent(screen.getByText('other'), event);
      expect(event.defaultPrevented).toBe(false);
      expect(click).toHaveBeenCalledOnce();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(m.push).not.toHaveBeenCalled();
    },
  );

  it('uses Next serialization for URL-object queries and per-link overrides under a provider', async () => {
    const frames: string[] = [];
    render(
      <GlyphnavProvider {...fast}>
        <GlyphnavLink
          href={{
            pathname: '/search',
            query: { q: 'glyph nav', tag: ['one', 'two'] },
            hash: 'results',
          }}
          glyphOptions={{ hooks: { onFrame: (frame) => frames.push(frame.path) } }}
        >
          search
        </GlyphnavLink>
      </GlyphnavProvider>,
    );
    expect(screen.getByText('search').getAttribute('href')).toBe(
      '/search?q=glyph+nav&tag=one&tag=two#results',
    );
    fireEvent.click(screen.getByText('search'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(frames.length).toBeGreaterThan(1);
    expect(frames.at(-1)).toBe('/search?q=glyph+nav&tag=one&tag=two#results');
    expect(m.push).toHaveBeenCalledWith('/search?q=glyph+nav&tag=one&tag=two#results', {
      scroll: undefined,
      transitionTypes: undefined,
    });
  });

  it('preserves Pages href/as, locale, shallow, scroll and replace options', async () => {
    const href = { pathname: '/post/[id]', query: { id: '42', q: 'glyphnav' } };
    const frames: string[] = [];
    render(
      <GlyphnavProvider {...fast} routerMode="pages">
        <GlyphnavLink
          href={href}
          as="/fr/post/42?q=glyphnav"
          replace
          shallow
          locale="fr"
          scroll={false}
          glyphOptions={{ hooks: { onFrame: (frame) => frames.push(frame.path) } }}
        >
          post
        </GlyphnavLink>
      </GlyphnavProvider>,
    );
    fireEvent.click(screen.getByText('post'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(frames.at(-1)).toBe('/fr/post/42?q=glyphnav');
    expect(m.pagesReplace).toHaveBeenCalledWith(href, '/fr/post/42?q=glyphnav', {
      scroll: false,
      shallow: true,
      locale: 'fr',
    });
    expect(m.push).not.toHaveBeenCalled();
  });

  it('delegates native Next dispatch and pending state without repeating caller or ancestor handlers', async () => {
    const click = vi.fn();
    const onNavigate = vi.fn();
    const parentClick = vi.fn();
    const parentCapture = vi.fn();
    const frames: string[] = [];
    m.push.mockImplementationOnce((href: string) => {
      setTimeout(() => {
        window.history.pushState(null, '', href);
        m.nativePending = false;
      }, 80);
    });
    render(
      <div onClick={parentClick} onClickCapture={parentCapture}>
        <GlyphnavProvider {...fast} commit="before">
          <GlyphnavLink
            href="/other"
            replace={false}
            scroll={false}
            transitionTypes={['slide']}
            onClick={click}
            onNavigate={onNavigate}
            glyphOptions={{ hooks: { onFrame: (frame) => frames.push(frame.path) } }}
          >
            other
          </GlyphnavLink>
        </GlyphnavProvider>
      </div>,
    );
    const anchor = screen.getByText('other') as HTMLAnchorElement;
    const replay = vi.spyOn(anchor, 'click');
    fireEvent.click(anchor);
    expect(m.nativeDispatch).toHaveBeenCalledOnce();
    expect(m.nativePending).toBe(true);
    expect(click).toHaveBeenCalledOnce();
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(parentClick).toHaveBeenCalledOnce();
    expect(parentCapture).toHaveBeenCalledOnce();
    expect(replay).not.toHaveBeenCalled();
    expect(m.push).toHaveBeenCalledWith('/other', { scroll: false, transitionTypes: ['slide'] });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(frames).toEqual([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(m.nativePending).toBe(false);
    expect(frames.length).toBeGreaterThan(1);
    expect(frames.at(-1)).toBe('/other');
  });

  it('preserves native Next behavior for rel external without animating it', () => {
    const start = vi.fn();
    render(
      <GlyphnavProvider {...fast} hooks={{ onStart: start }}>
        <GlyphnavLink href="/other" rel="external">
          other
        </GlyphnavLink>
      </GlyphnavProvider>,
    );
    fireEvent.click(screen.getByText('other'));
    expect(start).not.toHaveBeenCalled();
    expect(m.nativeDispatch).toHaveBeenCalledOnce();
  });

  it('animates legacy Link children and invokes their handler once', async () => {
    const childClick = vi.fn();
    const onNavigate = vi.fn();
    const frames: string[] = [];
    render(
      <GlyphnavProvider {...fast}>
        <GlyphnavLink
          href="/other"
          legacyBehavior
          onNavigate={onNavigate}
          glyphOptions={{ hooks: { onFrame: (frame) => frames.push(frame.path) } }}
        >
          <a onClick={childClick}>other</a>
        </GlyphnavLink>
      </GlyphnavProvider>,
    );
    fireEvent.click(screen.getByText('other'));
    expect(childClick).toHaveBeenCalledOnce();
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(m.nativeDispatch).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(childClick).toHaveBeenCalledOnce();
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(m.nativeDispatch).toHaveBeenCalledOnce();
    expect(frames.length).toBeGreaterThan(1);
    expect(frames.at(-1)).toBe('/other');
  });

  it('replays only animate-first links and documents their second capture event', async () => {
    const capture = vi.fn();
    const bubble = vi.fn();
    const caller = vi.fn();
    const onNavigate = vi.fn();
    render(
      <div onClickCapture={capture} onClick={bubble}>
        <GlyphnavProvider {...fast}>
          <GlyphnavLink href="/other" onClick={caller} onNavigate={onNavigate}>
            other
          </GlyphnavLink>
        </GlyphnavProvider>
      </div>,
    );
    const anchor = screen.getByText('other') as HTMLAnchorElement;
    const replay = vi.spyOn(anchor, 'click');
    fireEvent.click(anchor);
    expect(capture).toHaveBeenCalledOnce();
    expect(replay).not.toHaveBeenCalled();
    expect(m.nativeDispatch).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(replay).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledTimes(2);
    expect(bubble).toHaveBeenCalledOnce();
    expect(caller).toHaveBeenCalledOnce();
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(m.nativeDispatch).toHaveBeenCalledOnce();
  });

  it('lets an animate-first same-path skipped run use the original native click', async () => {
    const capture = vi.fn();
    render(
      <div onClickCapture={capture}>
        <GlyphnavProvider {...fast}>
          <GlyphnavLink href="/">same</GlyphnavLink>
        </GlyphnavProvider>
      </div>,
    );
    const anchor = screen.getByText('same') as HTMLAnchorElement;
    const replay = vi.spyOn(anchor, 'click');
    fireEvent.click(anchor);
    expect(capture).toHaveBeenCalledOnce();
    expect(replay).not.toHaveBeenCalled();
    expect(m.nativeDispatch).toHaveBeenCalledOnce();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });
  });

  it('awaits native Pages completion and rejects its errors without leaving event listeners', async () => {
    const failure = new Error('native route failed');
    const reportError = vi.fn();
    vi.stubGlobal('reportError', reportError);
    m.pagesPush.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(failure), 80);
        }),
    );
    const frames: string[] = [];
    render(
      <GlyphnavProvider {...fast} commit="before" routerMode="pages">
        <GlyphnavLink
          href="/other"
          glyphOptions={{ hooks: { onFrame: (frame) => frames.push(frame.path) } }}
        >
          other
        </GlyphnavLink>
      </GlyphnavProvider>,
    );
    fireEvent.click(screen.getByText('other'));
    expect(m.nativeDispatch).toHaveBeenCalledOnce();
    expect([...m.listeners.values()].some((callbacks) => callbacks.size > 0)).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(frames).toEqual([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(reportError).toHaveBeenCalledWith(failure);
    expect([...m.listeners.values()].every((callbacks) => callbacks.size === 0)).toBe(true);
    expect(window.location.pathname).toBe('/');
    vi.unstubAllGlobals();
  });

  it('handles native Pages hash navigation completion', async () => {
    m.pagesPush.mockImplementationOnce(() =>
      Promise.resolve().then(() => {
        window.history.pushState(null, '', '/#result');
        return true;
      }),
    );
    const frames: string[] = [];
    render(
      <GlyphnavProvider {...fast} commit="before" routerMode="pages">
        <GlyphnavLink
          href="#result"
          glyphOptions={{ hooks: { onFrame: (frame) => frames.push(frame.path) } }}
        >
          hash
        </GlyphnavLink>
      </GlyphnavProvider>,
    );
    fireEvent.click(screen.getByText('hash'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(frames.length).toBeGreaterThan(1);
    expect(frames.at(-1)).toBe('/#result');
    expect([...m.listeners.values()].every((callbacks) => callbacks.size === 0)).toBe(true);
  });

  it('removes native Pages navigation listeners when the provider unmounts', async () => {
    m.pagesPush.mockImplementationOnce(() => new Promise(() => {}));
    const done = vi.fn();
    const { unmount } = render(
      <GlyphnavProvider {...fast} commit="before" routerMode="pages" hooks={{ onComplete: done }}>
        <GlyphnavLink href="/other">other</GlyphnavLink>
      </GlyphnavProvider>,
    );
    fireEvent.click(screen.getByText('other'));
    expect([...m.listeners.values()].some((callbacks) => callbacks.size > 0)).toBe(true);
    unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(done).toHaveBeenCalledWith(expect.anything(), 'cancelled');
    expect([...m.listeners.values()].every((callbacks) => callbacks.size === 0)).toBe(true);
    expect(m.pagesRouter.push).toBe(m.pagesPush);
    expect(m.pagesRouter.replace).toBe(m.pagesReplace);
  });

  it('observes native Pages promise rejection before any routing event', async () => {
    const failure = new Error('missing dynamic parameter');
    const reportError = vi.fn();
    vi.stubGlobal('reportError', reportError);
    m.nativePagesEvents = false;
    m.pagesPush.mockRejectedValueOnce(failure);
    render(
      <GlyphnavProvider {...fast} commit="before" routerMode="pages">
        <GlyphnavLink href="/post/[id]">post</GlyphnavLink>
      </GlyphnavProvider>,
    );
    fireEvent.click(screen.getByText('post'));
    expect(m.pagesRouter.push).toBe(m.pagesPush);
    expect(m.pagesRouter.replace).toBe(m.pagesReplace);
    await act(async () => {
      await Promise.resolve();
    });
    expect(reportError).toHaveBeenCalledWith(failure);
    expect([...m.listeners.values()].every((callbacks) => callbacks.size === 0)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('settles a declined native Pages navigation without requiring router events', async () => {
    const done = vi.fn();
    const frames = vi.fn();
    m.nativePagesEvents = false;
    m.pagesPush.mockResolvedValueOnce(false);
    render(
      <GlyphnavProvider
        {...fast}
        commit="before"
        routerMode="pages"
        hooks={{ onComplete: done, onFrame: frames }}
      >
        <GlyphnavLink href="/blocked">blocked</GlyphnavLink>
      </GlyphnavProvider>,
    );
    fireEvent.click(screen.getByText('blocked'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(done).toHaveBeenCalledWith(expect.anything(), 'skipped');
    expect(frames).not.toHaveBeenCalled();
    expect(m.pagesRouter.push).toBe(m.pagesPush);
    expect(m.pagesRouter.replace).toBe(m.pagesReplace);
    expect([...m.listeners.values()].every((callbacks) => callbacks.size === 0)).toBe(true);
  });

  it('restores native Pages methods when anchor replay throws', async () => {
    const failure = new Error('click failed');
    const reportError = vi.fn();
    vi.stubGlobal('reportError', reportError);
    render(
      <GlyphnavProvider {...fast} routerMode="pages">
        <GlyphnavLink href="/other">other</GlyphnavLink>
      </GlyphnavProvider>,
    );
    const anchor = screen.getByText('other') as HTMLAnchorElement;
    vi.spyOn(anchor, 'click').mockImplementationOnce(() => {
      throw failure;
    });
    fireEvent.click(anchor);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(reportError).toHaveBeenCalledWith(failure);
    expect(m.pagesRouter.push).toBe(m.pagesPush);
    expect(m.pagesRouter.replace).toBe(m.pagesReplace);
    expect([...m.listeners.values()].every((callbacks) => callbacks.size === 0)).toBe(true);
  });

  it('fails promptly if native Pages dispatch supplies neither a promise nor route events', async () => {
    const reportError = vi.fn();
    vi.stubGlobal('reportError', reportError);
    m.nativePagesEvents = false;
    render(
      <GlyphnavProvider {...fast} commit="before" routerMode="pages">
        <GlyphnavLink href="/other">other</GlyphnavLink>
      </GlyphnavProvider>,
    );
    fireEvent.click(screen.getByText('other'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Next Link did not start a Pages Router navigation.' }),
    );
    expect([...m.listeners.values()].every((callbacks) => callbacks.size === 0)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    { href: '/app?q=1', expected: '/app?q=1' },
    { href: '/app#result', expected: '/app#result' },
    { href: '//example.com/path', expected: undefined },
  ])('does not duplicate basePath for %s', async ({ href, expected }) => {
    const frames: string[] = [];
    let navigate!: ReturnType<typeof useGlyphnavNavigate>;
    function Capture() {
      const value = useGlyphnavNavigate({
        ...fast,
        routerMode: 'pages',
        basePath: '/app',
        hooks: { onFrame: (frame) => frames.push(frame.path) },
      });
      useEffect(() => {
        navigate = value;
      }, [value]);
      return null;
    }
    render(<Capture />);
    const result = navigate(href);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    await result;
    expect(m.pagesPush).toHaveBeenCalledWith(href, undefined, undefined);
    expect(frames.at(-1)).toBe(expected);
  });

  it('honors onNavigate cancellation before starting an animation or router navigation', async () => {
    const start = vi.fn();
    const onNavigate = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <GlyphnavProvider {...fast} hooks={{ onStart: start }}>
        <GlyphnavLink href="/other" onNavigate={onNavigate}>
          other
        </GlyphnavLink>
      </GlyphnavProvider>,
    );
    fireEvent.click(screen.getByText('other'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
    expect(m.push).not.toHaveBeenCalled();
  });

  it('honors onClick cancellation before invoking onNavigate', async () => {
    const onNavigate = vi.fn();
    render(
      <GlyphnavProvider {...fast}>
        <GlyphnavLink
          href="/other"
          onClick={(event) => event.preventDefault()}
          onNavigate={onNavigate}
        >
          other
        </GlyphnavLink>
      </GlyphnavProvider>,
    );
    fireEvent.click(screen.getByText('other'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(onNavigate).not.toHaveBeenCalled();
    expect(m.push).not.toHaveBeenCalled();
  });

  it('waits for a delayed Pages redirect before animating the landed URL', async () => {
    const frames: string[] = [];
    m.pagesPush.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          setTimeout(() => {
            window.history.pushState(null, '', '/redirected');
            resolve(true);
          }, 80);
        }),
    );
    render(
      <GlyphnavProvider routerMode="pages">
        <GlyphnavLink
          href="/test"
          glyphOptions={{
            ...fast,
            commit: 'before',
            hooks: { onFrame: (frame) => frames.push(frame.path) },
          }}
        >
          other
        </GlyphnavLink>
      </GlyphnavProvider>,
    );
    fireEvent.click(screen.getByText('other'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(frames).toEqual([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(frames.length).toBeGreaterThan(1);
    expect(frames.at(-1)).toBe('/redirected');
  });

  it('propagates Pages navigation rejection', async () => {
    let navigate!: ReturnType<typeof useGlyphnavNavigate>;
    function Capture() {
      const value = useGlyphnavNavigate({ ...fast, commit: 'before', routerMode: 'pages' });
      useEffect(() => {
        navigate = value;
      }, [value]);
      return null;
    }
    const failure = new Error('route failed');
    m.pagesPush.mockRejectedValueOnce(failure);
    render(<Capture />);
    await expect(navigate('/test')).rejects.toBe(failure);
    expect(window.location.pathname).toBe('/');
  });

  it('skips animation when the Pages Router declines navigation', async () => {
    let navigate!: ReturnType<typeof useGlyphnavNavigate>;
    const frames: string[] = [];
    function Capture() {
      const value = useGlyphnavNavigate({
        ...fast,
        commit: 'before',
        routerMode: 'pages',
        hooks: { onFrame: (frame) => frames.push(frame.path) },
      });
      useEffect(() => {
        navigate = value;
      }, [value]);
      return null;
    }
    m.pagesPush.mockResolvedValueOnce(false);
    render(<Capture />);
    await expect(navigate('/blocked')).resolves.toBe('skipped');
    expect(frames).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    expect(window.location.pathname).toBe('/');
  });

  it('cancels App Router settlement polling when a newer run supersedes it', async () => {
    let navigate!: ReturnType<typeof useGlyphnavNavigate>;
    function Capture() {
      const value = useGlyphnavNavigate({ ...fast, commit: 'before' });
      useEffect(() => {
        navigate = value;
      }, [value]);
      return null;
    }
    m.push
      .mockImplementationOnce(() => {})
      .mockImplementationOnce((href: string) => {
        window.history.pushState(null, '', href);
      });
    render(<Capture />);
    const first = navigate('/pending');
    // Allow the async navigation callback to begin polling.
    await act(async () => {
      await Promise.resolve();
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    const second = navigate('/test');
    await expect(first).resolves.toBe('cancelled');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await expect(second).resolves.toBe('completed');
    expect(window.location.pathname).toBe('/test');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('destroys provider-owned controllers while letting fallback runs finish after unmount', async () => {
    let controller!: GlyphnavController;
    let navigate!: ReturnType<typeof useGlyphnavNavigate>;
    function Capture() {
      const owned = useGlyphnavController();
      const value = useGlyphnavNavigate(fast);
      useEffect(() => {
        controller = owned;
        navigate = value;
      }, [owned, value]);
      return null;
    }
    const { unmount } = render(
      <GlyphnavProvider {...fast}>
        <Capture />
      </GlyphnavProvider>,
    );
    const owned = controller.run('/owned', () => {});
    unmount();
    await expect(owned).resolves.toBe('cancelled');

    const fallback = render(<Capture />);
    const result: Promise<RunResult> = navigate('/test');
    fallback.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await expect(result).resolves.toBe('completed');
  });
});
