import { createEffect, createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import { render } from 'solid-js/web';
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useMatchRoute,
} from '@tanstack/solid-router';
import {
  GlyphnavLink,
  GlyphnavProvider,
  useGlyphnavController,
} from 'glyphnav/tanstack-solid-router';
import type { AnimateScope, CommitTiming, GlyphEffect } from 'glyphnav/core';
import { highlight } from '../highlight';
import {
  charsets,
  currentUrl,
  DOCS_INSTALL,
  durationToSlider,
  sliderToDuration,
} from '../shared/content';

const DOCS_SETUP = `import { GlyphnavProvider, GlyphnavLink, useGlyphnavNavigate } from 'glyphnav/tanstack-solid-router';

<GlyphnavProvider duration={250} commit="before">
  <RouterProvider router={router} />
</GlyphnavProvider>;

// inside the router tree — same NavigateOptions as useNavigate():
<GlyphnavLink to="/posts" search={{ page: 2 }} hash="top">Posts</GlyphnavLink>;

const navigate = useGlyphnavNavigate();
await navigate({ to: '/posts' });`;

const DOCS_OPTIONS = `<GlyphnavProvider
  duration={250}        // total animation time (ms), spread over all frames
  effect="scramble"     // 'decode' grows + resolves; 'scramble' bursts, then locks randomly
  commit="before"       // navigate instantly, animate on top ('after' = classic order)
  charset={MATRIX}      // glyph pool — URL_SAFE stays readable in the bar
  scope="tail"          // animate only the part that differs from the current path
>`;

function View(props: { title: string; body: string }): JSX.Element {
  return (
    <div class="view">
      <h2>{props.title}</h2>
      <p>{props.body}</p>
    </div>
  );
}

/** A syntax-highlighted code block. */
function Code(props: { children: string }): JSX.Element {
  return (
    <pre>
      <code innerHTML={highlight(props.children)} />
    </pre>
  );
}

function Docs(): JSX.Element {
  return (
    <div class="view docs">
      <h2>docs</h2>
      <p>Install the package — TanStack Router stays a peer dependency:</p>
      <Code>{DOCS_INSTALL}</Code>
      <p>
        The animated path is basepath-aware via <code>router.buildLocation()</code>; nothing is
        patched globally:
      </p>
      <Code>{DOCS_SETUP}</Code>
      <p id="options">Every entry point accepts the same options object:</p>
      <Code>{DOCS_OPTIONS}</Code>
    </div>
  );
}

function NavItem(props: { to: string; children: JSX.Element }): JSX.Element {
  const matchRoute = useMatchRoute();
  const active = matchRoute({ to: props.to });
  return (
    <GlyphnavLink to={props.to} class={active() ? 'active' : undefined}>
      {props.children}
    </GlyphnavLink>
  );
}

function Layout(): JSX.Element {
  const controller = useGlyphnavController();
  const [path, setPath] = createSignal(currentUrl());
  const [resolving, setResolving] = createSignal(false);
  const [charset, setCharset] = createSignal('url');
  const [duration, setDuration] = createSignal(250);
  const [effect, setEffect] = createSignal<GlyphEffect>('decode');
  const [commit, setCommit] = createSignal<CommitTiming>('before');
  const [scope, setScope] = createSignal<AnimateScope>('full');

  createEffect(() => {
    controller.update({
      charset: charsets[charset()],
      duration: duration(),
      effect: effect(),
      commit: commit(),
      scope: scope(),
      hooks: {
        onFrame: (f) => {
          setPath(f.path);
          setResolving(f.phase === 'resolve');
        },
        onComplete: () => {
          setResolving(false);
          setPath(currentUrl());
        },
      },
    });
  });

  return (
    <>
      <h1>
        <a href={import.meta.env.BASE_URL}>glyphnav</a>{' '}
        <span class="crumb">/ tanstack-router (solid)</span>
      </h1>

      <p class={resolving() ? 'bar resolving' : 'bar'}>
        Watch the address bar. Current path: <span class="path">{path()}</span>
      </p>

      <nav>
        <NavItem to="/">home</NavItem>
        <NavItem to="/about">about</NavItem>
        <NavItem to="/posts">posts</NavItem>
        <NavItem to="/docs">docs</NavItem>
      </nav>

      <p class="deep">
        deep links:
        <GlyphnavLink to="/about" search={{ ref: 'deep', page: 2 }}>
          ?query
        </GlyphnavLink>
        <GlyphnavLink to="/docs" hash="options">
          #hash
        </GlyphnavLink>
        <GlyphnavLink to="/about" search={{ q: 'glyph' }} hash="results">
          ?query+#hash
        </GlyphnavLink>
      </p>

      <div class="controls">
        <label>
          charset
          <select value={charset()} onChange={(e) => setCharset(e.currentTarget.value)}>
            <option value="url">url-safe</option>
            <option value="hex">hex</option>
            <option value="matrix">matrix</option>
            <option value="symbols">symbols</option>
          </select>
        </label>
        <label>
          speed
          <input
            type="range"
            min={20}
            max={1000}
            step={10}
            value={durationToSlider(duration())}
            onInput={(e) => setDuration(sliderToDuration(Number(e.currentTarget.value)))}
          />
          <span class="ms">{duration()}ms</span>
        </label>
        <label>
          effect
          <select
            value={effect()}
            onChange={(e) => setEffect(e.currentTarget.value as GlyphEffect)}
          >
            <option value="decode">decode</option>
            <option value="scramble">scramble</option>
          </select>
        </label>
        <label>
          commit
          <select
            value={commit()}
            onChange={(e) => setCommit(e.currentTarget.value as CommitTiming)}
          >
            <option value="before">navigate first</option>
            <option value="after">animate first</option>
          </select>
        </label>
        <label>
          scope
          <select value={scope()} onChange={(e) => setScope(e.currentTarget.value as AnimateScope)}>
            <option value="full">full</option>
            <option value="tail">tail</option>
          </select>
        </label>
      </div>

      <Outlet />

      <p class="foot">
        TanStack Router on Solid: <code>GlyphnavLink</code> hands off to{' '}
        <code>router.navigate()</code>. The animated path is basepath-aware via{' '}
        <code>router.buildLocation()</code> — same engine as the React adapter, Solid bindings.
      </p>
    </>
  );
}

const rootRoute = createRootRoute({ component: Layout });

const routeTree = rootRoute.addChildren([
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => (
      <View
        title="home"
        body="TanStack Router on Solid. A GlyphnavProvider shares one controller; each GlyphnavLink decodes the URL. With commit: 'navigate first' the route swaps instantly and the bar animates on top."
      />
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/about',
    component: () => (
      <View
        title="about"
        body="useGlyphnavNavigate() mirrors useNavigate(); GlyphnavLink renders a plain anchor. Deep links with ?search and #hash animate too — they are just part of the path."
      />
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/posts',
    component: () => (
      <View
        title="posts"
        body="The animation rides on history.replaceState; TanStack Router performs the real navigation. Try scope: tail — only the part of the path that differs gets scrambled."
      />
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/docs',
    component: () => <Docs />,
  }),
]);

const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL + 'tanstack-solid-router',
});

render(
  () => (
    <GlyphnavProvider duration={250} commit="before">
      <RouterProvider router={router} />
    </GlyphnavProvider>
  ),
  document.getElementById('root')!,
);
