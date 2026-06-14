import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/dom';
import { createComponent, mergeProps } from 'solid-js';
import type { JSX } from 'solid-js';
import { Dynamic, delegateEvents, render } from 'solid-js/web';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState,
} from '@tanstack/solid-router';
import { GlyphnavLink, useGlyphnavNavigate } from '../src/tanstack-router/solid';

// Solid normally calls delegateEvents() from compiled templates; this test
// builds the tree at runtime (no compiler), so install the click delegate that
// GlyphnavLink's `onClick` relies on once, up front.
delegateEvents(['click']);

const fast = { charset: 'q', rng: () => 0, stepDuration: 5 } as const;

// Build elements without JSX (createComponent + Dynamic), matching the JSX-free
// adapter — so neither needs the Solid compiler. `mergeProps` (not object
// spread) keeps `children`/getter props reactive. `{ component: tag }` goes last
// so the typed tag wins: `props` is a `Record<string, unknown>` whose index
// signature would otherwise widen `component` to `unknown`, which Dynamic (it
// needs `component: ValidComponent`) rejects.
const el = (tag: string, props: Record<string, unknown>): JSX.Element =>
  createComponent(Dynamic, mergeProps(props, { component: tag }));

function LocationLabel(): JSX.Element {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return el('div', {
    'data-testid': 'loc',
    get children() {
      return pathname();
    },
  });
}

function NavButton(): JSX.Element {
  const navigate = useGlyphnavNavigate(fast);
  return el('button', {
    type: 'button',
    onClick: () => void navigate({ to: '/test' }),
    children: 'go',
  });
}

const rootRoute = createRootRoute({
  component: () => [
    createComponent(NavButton, {}),
    createComponent(GlyphnavLink, { to: '/other', glyphOptions: fast, children: 'other' }),
    createComponent(LocationLabel, {}),
    createComponent(Outlet, {}),
  ],
});

const routeTree = rootRoute.addChildren([
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => el('div', { children: 'home page' }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/test',
    component: () => el('div', { children: 'test page' }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/other',
    component: () => el('div', { children: 'other page' }),
  }),
]);

let dispose: (() => void) | undefined;

async function renderApp(): Promise<void> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  const host = document.createElement('div');
  document.body.appendChild(host);
  dispose = render(() => createComponent(RouterProvider, { router }), host);
  // Let the router finish its initial load.
  await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/'));
}

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = '';
});

// The `loc` label is driven by `useRouterState`, so it reflects the router's
// real location after a navigation — that is what the adapter is responsible
// for (animate, then hand off to `router.navigate`). Asserting on it keeps the
// test about glyphnav rather than TanStack's Outlet rendering.
describe('tanstack solid router adapter', () => {
  it('useGlyphnavNavigate animates then navigates', async () => {
    await renderApp();
    expect(screen.getByTestId('loc').textContent).toBe('/');

    fireEvent.click(screen.getByText('go'));
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/test'));
  });

  it('GlyphnavLink renders a real href and animates then navigates on click', async () => {
    await renderApp();
    const link = screen.getByText('other') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/other');

    fireEvent.click(link);
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/other'));
  });

  it('GlyphnavLink lets modified clicks fall through (no SPA navigation)', async () => {
    await renderApp();

    // Cancel the browser's default navigation for this one click so jsdom does
    // not attempt a real page load. GlyphnavLink bails on modified clicks
    // regardless, so the route must stay put.
    document.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
    fireEvent.click(screen.getByText('other'), { metaKey: true });
    // Give any (unexpected) navigation a chance to commit before asserting.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.getByTestId('loc').textContent).toBe('/');
  });
});
