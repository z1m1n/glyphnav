import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/dom';
import { createComponent, mergeProps } from 'solid-js';
import type { JSX } from 'solid-js';
import { Dynamic, delegateEvents, render } from 'solid-js/web';
import { HashRouter, MemoryRouter, Route, Router, useLocation } from '@solidjs/router';
import { GlyphnavLink, GlyphnavProvider, useGlyphnavNavigate } from '../src/solid-router';
import type { GlyphnavLinkProps, GlyphnavNavigateFn } from '../src/solid-router';
import type { NavigateOptions } from '@solidjs/router';
import { GlyphnavController } from '../src/core';

// Solid normally calls delegateEvents() from compiled templates; this test
// builds the tree at runtime (no compiler), so install the click delegate that
// GlyphnavLink's `onClick` relies on once, up front. (MemoryRouter also does
// this when it mounts; the call is idempotent.)
delegateEvents(['click']);

const frames: string[] = [];
const fast = {
  charset: 'q',
  rng: () => 0,
  stepDuration: 20,
  commit: 'after',
  hooks: { onFrame: (frame: { path: string }) => frames.push(frame.path) },
} as const;
let linkOptions: Partial<GlyphnavLinkProps> = {};

// Build elements without JSX (createComponent + Dynamic), matching the JSX-free
// adapter — so neither needs the Solid compiler. `mergeProps` (not object
// spread) keeps `children`/getter props reactive. `{ component: tag }` goes last
// so the typed tag wins: `props` is a `Record<string, unknown>` whose index
// signature would otherwise widen `component` to `unknown`, which Dynamic (it
// needs `component: ValidComponent`) rejects.
const el = (tag: string, props: Record<string, unknown>): JSX.Element =>
  createComponent(Dynamic, mergeProps(props, { component: tag }));

function LocationLabel(): JSX.Element {
  const location = useLocation();
  return el('div', {
    'data-testid': 'loc',
    get children() {
      return location.pathname;
    },
  });
}

function NavButton(): JSX.Element {
  const navigate = useGlyphnavNavigate(fast);
  return el('button', {
    type: 'button',
    onClick: () => void navigate('/test'),
    children: 'go',
  });
}

// The root layout — Solid Router passes the matched route as `props.children`,
// but the test asserts on the `useLocation`-driven label (what the adapter is
// responsible for), so the controls live here and the outlet is left unrendered.
function Layout(): JSX.Element {
  return [
    createComponent(NavButton, {}),
    createComponent(GlyphnavLink, {
      href: '/other',
      glyphOptions: fast,
      children: 'other',
      ...linkOptions,
    }),
    createComponent(LocationLabel, {}),
  ];
}

const route = (path: string, text: string): JSX.Element =>
  createComponent(Route, { path, component: () => el('div', { children: text }) });

let dispose: (() => void) | undefined;

async function renderApp(): Promise<void> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  dispose = render(
    () =>
      createComponent(MemoryRouter, {
        root: Layout,
        get children() {
          return [
            route('/', 'home page'),
            route('/test', 'test page'),
            route('/other', 'other page'),
          ];
        },
      }),
    host,
  );
  // Let the router finish its initial load.
  await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/'));
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  frames.length = 0;
  linkOptions = {};
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// The `loc` label is driven by `useLocation`, so it reflects the router's real
// location after a navigation — that is what the adapter is responsible for
// (animate, then hand off to `navigate`). Asserting on it keeps the test about
// glyphnav rather than Solid Router's outlet rendering.
describe('solid router adapter', () => {
  it('useGlyphnavNavigate animates then navigates', async () => {
    await renderApp();
    expect(screen.getByTestId('loc').textContent).toBe('/');

    fireEvent.click(screen.getByText('go'));
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/test'));
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.at(-1)).toBe('/test');
  });

  it('GlyphnavLink renders a real href and animates then navigates on click', async () => {
    await renderApp();
    const link = screen.getByText('other') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/other');

    fireEvent.click(link);
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/other'));
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.at(-1)).toBe('/other');
  });

  it('GlyphnavLink lets modified clicks fall through (no SPA navigation)', async () => {
    await renderApp();

    // Cancel the browser's default navigation for this one click so jsdom does
    // not attempt a real page load. GlyphnavLink bails on modified clicks
    // regardless (and Solid Router's own handler skips them too), so the route
    // must stay put.
    document.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
    fireEvent.click(screen.getByText('other'), { metaKey: true });
    // Give any (unexpected) navigation a chance to commit before asserting.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.getByTestId('loc').textContent).toBe('/');
  });

  it.each([
    { target: '_blank' },
    { download: '' },
    { rel: 'external' },
    { href: 'https://external.example/path' },
  ])('lets browser-owned links through: %j', async (attributes) => {
    linkOptions = attributes;
    const run = vi.spyOn(GlyphnavController.prototype, 'run');
    await renderApp();
    fireEvent.click(screen.getByText('other'));
    expect(run).not.toHaveBeenCalled();
    expect(frames).toHaveLength(0);
  });

  it('honors the caller onClick cancellation', async () => {
    linkOptions = { onClick: (event) => event.preventDefault() };
    const run = vi.spyOn(GlyphnavController.prototype, 'run');
    await renderApp();
    fireEvent.click(screen.getByText('other'));
    expect(run).not.toHaveBeenCalled();
    expect(frames).toHaveLength(0);
  });

  it('animates the landed browser URL with the default navigate-first timing', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const browserOptions = { ...fast, commit: 'before' } as const;
    dispose = render(
      () =>
        createComponent(GlyphnavProvider, {
          ...browserOptions,
          get children() {
            return createComponent(Router, {
              root: () => [
                createComponent(GlyphnavLink, { href: '/other?q=1#top', children: 'browser' }),
                createComponent(LocationLabel, {}),
              ],
              get children() {
                return [route('/', 'home'), route('/other', 'other')];
              },
            });
          },
        }),
      host,
    );
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/'));
    fireEvent.click(screen.getByText('browser'));
    await waitFor(() => expect(frames.at(-1)).toBe('/other?q=1#top'));
    expect(frames.length).toBeGreaterThan(1);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/other?q=1#top',
    );
    expect(screen.getByTestId('loc').textContent).toBe('/other');
  });

  it.each([
    { name: 'deployment base', to: '/other', expected: '/app/other' },
    { name: 'route-relative destination', to: 'sibling', expected: '/app/parent/sibling' },
    {
      name: 'unresolved relative destination',
      to: 'outside',
      resolve: false,
      expected: '/outside',
    },
    { name: 'query-only default', to: '?q=2', expected: '/app/parent/child/grandchild?q=2' },
    { name: 'route-relative query', to: '?q=2', resolve: true, expected: '/app/parent?q=2' },
    {
      name: 'empty destination clearing the query',
      to: '',
      expected: '/app/parent/child/grandchild',
    },
  ])('resolves imperative animation targets with $name', async ({ to, resolve, expected }) => {
    window.history.replaceState(null, '', '/app/parent/child/grandchild?old=1');
    let navigate!: GlyphnavNavigateFn;
    const host = document.createElement('div');
    document.body.appendChild(host);
    dispose = render(
      () =>
        createComponent(Router, {
          base: '/app',
          root: (props: { children?: JSX.Element }) => [
            createComponent(LocationLabel, {}),
            props.children,
          ],
          get children() {
            return [
              createComponent(Route, {
                path: '/parent',
                component: (props: { children?: JSX.Element }) => {
                  navigate = useGlyphnavNavigate({ ...fast, maxFrames: 2 });
                  return props.children;
                },
                get children() {
                  return [route('/child/*rest', 'child'), route('/sibling', 'sibling')];
                },
              }),
              route('/other', 'other'),
            ];
          },
        }),
      host,
    );
    // The root must render its outlet so useGlyphnavNavigate captures the
    // parent route's context, rather than the router's base route.
    await waitFor(() => expect(navigate).toBeTypeOf('function'));
    const options: Partial<NavigateOptions> | undefined =
      resolve === undefined ? undefined : { resolve };
    const done = navigate(to, options);
    await waitFor(() => expect(frames.at(-1)).toBe(expected));
    await expect(done).resolves.toBe('completed');
    expect(window.location.pathname + window.location.search).toBe(expected);
  });

  it('renders imperative HashRouter targets on the current document path and query', async () => {
    window.history.replaceState(null, '', '/document/?v=1#/app/parent');
    let navigate!: GlyphnavNavigateFn;
    const host = document.createElement('div');
    document.body.appendChild(host);
    dispose = render(
      () =>
        createComponent(HashRouter, {
          base: '/app',
          root: (props: { children?: JSX.Element }) => [
            createComponent(LocationLabel, {}),
            props.children,
          ],
          get children() {
            return [
              createComponent(Route, {
                path: '/parent',
                component: () => {
                  navigate = useGlyphnavNavigate({ ...fast, maxFrames: 2 });
                  return 'parent';
                },
              }),
              route('/other', 'other'),
            ];
          },
        }),
      host,
    );
    await waitFor(() => expect(navigate).toBeTypeOf('function'));
    const done = navigate('/other?q=2#top');
    const expected = '/document/?v=1#/app/other?q=2#top';
    await waitFor(() => expect(frames.at(-1)).toBe(expected));
    await expect(done).resolves.toBe('completed');
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(expected);
  });
});
