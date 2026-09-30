import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState,
} from '@tanstack/react-router';
import { GlyphnavLink, GlyphnavProvider, useGlyphnavNavigate } from '../src/tanstack-router/react';

const fast = { charset: 'q', rng: () => 0, stepDuration: 5 } as const;

function LocationLabel() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return <div data-testid="loc">{pathname}</div>;
}

function NavButton() {
  const navigate = useGlyphnavNavigate(fast);
  return (
    <button type="button" onClick={() => void navigate({ to: '/test' })}>
      go
    </button>
  );
}

const rootRoute = createRootRoute({
  component: () => (
    <>
      <NavButton />
      <GlyphnavLink to="/other" glyphOptions={fast}>
        other
      </GlyphnavLink>
      <LocationLabel />
      <Outlet />
    </>
  ),
});

const routeTree = rootRoute.addChildren([
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <div>home page</div>,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/test',
    component: () => <div>test page</div>,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/other',
    component: () => <div>other page</div>,
  }),
]);

async function renderApp() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(<RouterProvider router={router} />);
  // Let the router finish its initial load.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  return router;
}

describe('tanstack react router adapter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('useGlyphnavNavigate animates then navigates', async () => {
    await renderApp();
    expect(screen.getByTestId('loc').textContent).toBe('/');

    fireEvent.click(screen.getByText('go'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByTestId('loc').textContent).toBe('/test');
    expect(screen.getByText('test page')).toBeTruthy();
  });

  it('GlyphnavLink renders a real href and animates then navigates on click', async () => {
    await renderApp();
    const link = screen.getByText('other') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/other');

    fireEvent.click(link);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByTestId('loc').textContent).toBe('/other');
    expect(screen.getByText('other page')).toBeTruthy();
  });

  it('GlyphnavLink lets modified clicks fall through (no SPA navigation)', async () => {
    await renderApp();

    // Cancel the browser's default navigation for this one click so jsdom does
    // not attempt a real page load. GlyphnavLink bails on modified clicks
    // regardless, so the route must stay put.
    document.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
    fireEvent.click(screen.getByText('other'), { metaKey: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByTestId('loc').textContent).toBe('/');
  });

  it.each([{ target: '_blank' }, { download: '' }, { rel: 'external' }])(
    'leaves browser-owned link behavior intact: %j',
    async (props) => {
      const click = vi.fn();
      const testRoot = createRootRoute({
        component: () => (
          <>
            <GlyphnavLink to="/other" {...props} onClick={click}>
              link
            </GlyphnavLink>
            <LocationLabel />
            <Outlet />
          </>
        ),
      });
      const testTree = testRoot.addChildren([
        createRoute({ getParentRoute: () => testRoot, path: '/' }),
        createRoute({ getParentRoute: () => testRoot, path: '/other' }),
      ]);
      const router = createRouter({
        routeTree: testTree,
        history: createMemoryHistory({ initialEntries: ['/'] }),
      });
      render(<RouterProvider router={router} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      fireEvent(screen.getByText('link'), event);
      expect(event.defaultPrevented).toBe(false);
      expect(click).toHaveBeenCalledOnce();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(screen.getByTestId('loc').textContent).toBe('/');
    },
  );

  it('applies per-link options under a provider and actually writes animation frames', async () => {
    window.history.replaceState(null, '', '/');
    const frames: string[] = [];
    const testRoot = createRootRoute({
      component: () => (
        <GlyphnavProvider {...fast} commit="after">
          <GlyphnavLink
            to="/other"
            glyphOptions={{ hooks: { onFrame: (frame) => frames.push(frame.path) } }}
          >
            link
          </GlyphnavLink>
          <LocationLabel />
          <Outlet />
        </GlyphnavProvider>
      ),
    });
    const testTree = testRoot.addChildren([
      createRoute({ getParentRoute: () => testRoot, path: '/' }),
      createRoute({ getParentRoute: () => testRoot, path: '/other' }),
    ]);
    const router = createRouter({ routeTree: testTree, history: createBrowserHistory() });
    render(<RouterProvider router={router} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    fireEvent.click(screen.getByText('link'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(frames.length).toBeGreaterThan(1);
    expect(frames.at(-1)).toBe('/other');
    expect(window.location.pathname).toBe('/other');
    expect(screen.getByTestId('loc').textContent).toBe('/other');
  });
});
