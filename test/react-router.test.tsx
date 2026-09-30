import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import {
  createBrowserRouter,
  MemoryRouter,
  Outlet,
  redirect,
  Route,
  RouterProvider,
  Routes,
  useBlocker,
  useLocation,
} from 'react-router';
import { GlyphnavLink, GlyphnavProvider, useGlyphnavNavigate } from '../src/react-router';
import { GlyphnavController } from '../src/core';

const fast = { charset: 'q', rng: () => 0, stepDuration: 5 } as const;

function LocationLabel() {
  const location = useLocation();
  return <div data-testid="loc">{location.pathname}</div>;
}

function NavButton() {
  const navigate = useGlyphnavNavigate(fast);
  return (
    <button type="button" onClick={() => void navigate('/test')}>
      go
    </button>
  );
}

function App() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <NavButton />
      <GlyphnavLink to="/other" glyphOptions={fast}>
        other
      </GlyphnavLink>
      <LocationLabel />
      <Routes>
        <Route path="/" element={<div>home page</div>} />
        <Route path="/test" element={<div>test page</div>} />
        <Route path="/other" element={<div>other page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('react adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '/');
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('useGlyphnavNavigate animates then navigates', async () => {
    render(<App />);
    expect(screen.getByTestId('loc').textContent).toBe('/');

    fireEvent.click(screen.getByText('go'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(screen.getByTestId('loc').textContent).toBe('/test');
    expect(screen.getByText('test page')).toBeTruthy();
  });

  it('GlyphnavLink animates then navigates on click', async () => {
    render(<App />);

    fireEvent.click(screen.getByText('other'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(screen.getByTestId('loc').textContent).toBe('/other');
    expect(screen.getByText('other page')).toBeTruthy();
  });

  it('GlyphnavLink lets modified clicks fall through (no SPA navigation)', async () => {
    render(<App />);

    // Cancel the browser's default navigation for this one click so jsdom does
    // not log an unimplemented full navigation. GlyphnavLink bails on modified
    // clicks regardless, so the route must stay put.
    document.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
    fireEvent.click(screen.getByText('other'), { metaKey: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    // modified click is not hijacked -> route stays put
    expect(screen.getByTestId('loc').textContent).toBe('/');
  });

  it.each([
    { target: '_blank' },
    { target: '_parent' },
    { download: '' },
    { rel: 'external' },
    { to: 'https://example.com/outside' },
  ])('leaves browser-owned anchor behavior intact: %j', async (props) => {
    const click = vi.fn();
    render(
      <MemoryRouter>
        <GlyphnavLink to="/other" {...props} onClick={click}>
          other
        </GlyphnavLink>
        <LocationLabel />
      </MemoryRouter>,
    );
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(screen.getByText('other'), event);
    expect(event.defaultPrevented).toBe(false);
    expect(click).toHaveBeenCalledOnce();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(screen.getByTestId('loc').textContent).toBe('/');
  });

  it('honors caller cancellation', async () => {
    const start = vi.fn();
    render(
      <MemoryRouter>
        <GlyphnavProvider {...fast} hooks={{ onStart: start }}>
          <GlyphnavLink to="/other" onClick={(event) => event.preventDefault()}>
            other
          </GlyphnavLink>
          <LocationLabel />
        </GlyphnavProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('other'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(start).not.toHaveBeenCalled();
    expect(screen.getByTestId('loc').textContent).toBe('/');
  });

  it('awaits a data-router loader and redirect, then animates after the source unmounts', async () => {
    const frames: string[] = [];
    let navigate!: ReturnType<typeof useGlyphnavNavigate>;
    function Source() {
      const value = useGlyphnavNavigate({
        ...fast,
        hooks: { onFrame: (frame) => frames.push(frame.path) },
      });
      useEffect(() => {
        navigate = value;
      }, [value]);
      return <div>source</div>;
    }
    const router = createBrowserRouter([
      { path: '/', Component: Source },
      {
        path: '/delayed',
        loader: async () => {
          await new Promise((resolve) => setTimeout(resolve, 80));
          return redirect('/landed');
        },
        element: <div>unused</div>,
      },
      { path: '/landed', element: <div>landed</div> },
    ]);
    try {
      render(<RouterProvider router={router} />);
      let result!: ReturnType<typeof navigate>;
      await act(async () => {
        result = navigate('/delayed');
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(frames).toEqual([]);
      expect(screen.getByText('source')).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      await expect(result).resolves.toBe('completed');
      expect(screen.getByText('landed')).toBeTruthy();
      expect(frames.length).toBeGreaterThan(1);
      expect(frames.at(-1)).toBe('/landed');
      expect(window.location.pathname).toBe('/landed');
    } finally {
      router.dispose();
    }
  });

  it('uses per-link overrides under a provider and preserves basename and query', async () => {
    window.history.replaceState(null, '', '/app/');
    const frames: string[] = [];
    const router = createBrowserRouter(
      [
        {
          path: '/',
          element: (
            <GlyphnavProvider {...fast} commit="after">
              <GlyphnavLink
                to={{ pathname: '/other', search: '?q=glyphnav', hash: '#result' }}
                glyphOptions={{ hooks: { onFrame: (frame) => frames.push(frame.path) } }}
              >
                other
              </GlyphnavLink>
              <Outlet />
            </GlyphnavProvider>
          ),
          children: [
            { index: true, element: <div>home</div> },
            { path: 'other', element: <div>landed</div> },
          ],
        },
      ],
      { basename: '/app' },
    );
    try {
      render(<RouterProvider router={router} />);
      expect(screen.getByText('other').getAttribute('href')).toBe('/app/other?q=glyphnav#result');
      fireEvent.click(screen.getByText('other'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(screen.getByText('landed')).toBeTruthy();
      expect(frames.length).toBeGreaterThan(1);
      expect(frames.at(-1)).toBe('/app/other?q=glyphnav#result');
      expect(window.location.href).toContain('/app/other?q=glyphnav#result');
    } finally {
      router.dispose();
    }
  });

  it('does not animate a navigation blocked by the router', async () => {
    const frames: string[] = [];
    let navigate!: ReturnType<typeof useGlyphnavNavigate>;
    function Source() {
      useBlocker(true);
      const value = useGlyphnavNavigate({
        ...fast,
        hooks: { onFrame: (frame) => frames.push(frame.path) },
      });
      useEffect(() => {
        navigate = value;
      }, [value]);
      return <div>source</div>;
    }
    const router = createBrowserRouter([
      { path: '/', Component: Source },
      { path: '/test', element: <div>landed</div> },
    ]);
    try {
      render(<RouterProvider router={router} />);
      let result!: ReturnType<typeof navigate>;
      await act(async () => {
        result = navigate('/test');
      });
      await expect(result).resolves.toBe('skipped');
      expect(frames).toEqual([]);
      expect(window.location.pathname).toBe('/');
    } finally {
      router.dispose();
    }
  });

  it.each(['/other?q=1#top', { pathname: '/other', search: 'q=1', hash: 'top' }])(
    'animates rooted imperative destinations with basename: %j',
    async (to) => {
      window.history.replaceState(null, '', '/app/');
      const frames: string[] = [];
      let navigate!: ReturnType<typeof useGlyphnavNavigate>;
      function Source() {
        const value = useGlyphnavNavigate({
          ...fast,
          commit: 'after',
          maxFrames: 2,
          hooks: { onFrame: (frame) => frames.push(frame.path) },
        });
        useEffect(() => {
          navigate = value;
        }, [value]);
        return <div>source</div>;
      }
      const router = createBrowserRouter(
        [
          { path: '/', Component: Source },
          { path: '/other', element: <div>landed</div> },
        ],
        { basename: '/app' },
      );
      try {
        render(<RouterProvider router={router} />);
        let done!: ReturnType<typeof navigate>;
        await act(async () => {
          done = navigate(to);
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(100);
        });
        await expect(done).resolves.toBe('completed');
        expect(frames.at(-1)).toBe('/app/other?q=1#top');
        expect(window.location.pathname + window.location.search + window.location.hash).toBe(
          '/app/other?q=1#top',
        );
        expect(screen.getByText('landed')).toBeTruthy();
      } finally {
        router.dispose();
      }
    },
  );

  it('preserves link path-relative resolution and router navigation options', async () => {
    window.history.replaceState(null, '', '/app/parent/child/grandchild');
    const state = { from: 'glyphnav' };
    const router = createBrowserRouter(
      [
        {
          path: '/parent/child/grandchild',
          element: (
            <GlyphnavLink
              to=".."
              relative="path"
              replace
              state={state}
              preventScrollReset
              viewTransition
              glyphOptions={{ ...fast, commit: 'after', maxFrames: 2 }}
            >
              parent
            </GlyphnavLink>
          ),
        },
        { path: '/parent/child', element: <div>landed</div> },
      ],
      { basename: '/app' },
    );
    const navigate = vi.spyOn(router, 'navigate');
    try {
      render(<RouterProvider router={router} />);
      expect(screen.getByText('parent').getAttribute('href')).toBe('/app/parent/child');
      fireEvent.click(screen.getByText('parent'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(navigate).toHaveBeenCalledWith(
        '..',
        expect.objectContaining({
          relative: 'path',
          replace: true,
          state,
          preventScrollReset: true,
          viewTransition: true,
        }),
      );
      expect(router.state.location.pathname).toBe('/app/parent/child');
      expect(router.state.location.state).toEqual(state);
    } finally {
      router.dispose();
    }
  });

  it.each([false, true])(
    'preserves reloadDocument link behavior (caller cancelled: %s)',
    (cancelled) => {
      const run = vi.spyOn(GlyphnavController.prototype, 'run');
      const onClick = vi.fn((event: { preventDefault: () => void }) => {
        if (cancelled) event.preventDefault();
      });
      try {
        render(
          <MemoryRouter>
            <GlyphnavLink to="/other" reloadDocument onClick={onClick}>
              reload
            </GlyphnavLink>
          </MemoryRouter>,
        );
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        fireEvent(screen.getByText('reload'), event);
        expect(event.defaultPrevented).toBe(cancelled);
        expect(onClick).toHaveBeenCalledOnce();
        expect(run).not.toHaveBeenCalled();
      } finally {
        run.mockRestore();
      }
    },
  );
});
