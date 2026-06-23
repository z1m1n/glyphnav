import { createEffect, createSignal, onCleanup } from 'solid-js';
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
} from 'glyphnav/tanstack-router/solid';
import type { AnimateScope, CommitTiming, GlyphEffect } from 'glyphnav/core';
import { highlight } from '../../shared/highlight';
import logo from '../../shared/logo.svg';
import {
  charsets,
  CONTROL_TOOLTIPS,
  currentUrl,
  DEFAULT_TOOLBAR,
  DOCS_INSTALL,
  durationToSlider,
  loadToolbar,
  saveToolbar,
  sliderToDuration,
} from '../../shared/content';

/** This page's own localStorage key — not shared with the other demos. */
const STORE_KEY = 'tanstack-router/solid';

const DOCS_SETUP = `import { GlyphnavProvider, GlyphnavLink, useGlyphnavNavigate } from 'glyphnav/tanstack-router/solid';

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
  animatePopState       // also animate browser back/forward (opt-in)
>`;

function View(props: { title: string; body: string }): JSX.Element {
  return (
    <div class="view">
      <article>
        <header class="lead">
          <h2>{props.title}</h2>
          {props.body}
        </header>
      </article>
    </div>
  );
}

/** A code listing as a captioned <figure>. */
function Figure(props: { code: string; caption?: JSX.Element; captionId?: string }): JSX.Element {
  return (
    <figure>
      {props.caption ? <figcaption id={props.captionId}>{props.caption}</figcaption> : null}
      <pre>
        <code innerHTML={highlight(props.code)} />
      </pre>
    </figure>
  );
}

function Docs(): JSX.Element {
  return (
    <div class="view docs">
      <article>
        <header class="lead">
          <h2>docs</h2>
          Install the package — TanStack Router stays a peer dependency:
        </header>
        <Figure code={DOCS_INSTALL} />
        <Figure
          caption={
            <>
              The animated path is basepath-aware via <code>router.buildLocation()</code>; nothing
              is patched globally:
            </>
          }
          code={DOCS_SETUP}
        />
        <Figure
          captionId="options"
          caption="Every entry point accepts the same options object:"
          code={DOCS_OPTIONS}
        />
      </article>
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
  const saved = loadToolbar(STORE_KEY, DEFAULT_TOOLBAR);
  const [path, setPath] = createSignal(currentUrl());
  const [resolving, setResolving] = createSignal(false);
  const [charset, setCharset] = createSignal(saved.charset);
  const [duration, setDuration] = createSignal(saved.duration);
  const [effect, setEffect] = createSignal<GlyphEffect>(saved.effect);
  const [commit, setCommit] = createSignal<CommitTiming>(saved.commit);
  const [scope, setScope] = createSignal<AnimateScope>(saved.scope);
  const [backForward, setBackForward] = createSignal(saved.backForward);

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

  // Back/forward animation is opt-in; toggling the checkbox attaches/detaches
  // the popstate listener (onCleanup runs before each re-run and on disposal).
  createEffect(() => {
    if (backForward()) onCleanup(controller.enableHistoryAnimation());
  });

  // Persist this page's toolbar under its own key (no syncing between demos).
  createEffect(() => {
    saveToolbar(STORE_KEY, {
      charset: charset(),
      duration: duration(),
      effect: effect(),
      commit: commit(),
      scope: scope(),
      backForward: backForward(),
    });
  });

  return (
    <>
      <h1>
        <img class="glyph-mark" src={logo} alt="" />
        <a href={import.meta.env.BASE_URL}>glyphnav</a>
        <span class="sep">/</span>
        <span class="crumb">tanstack-router/solid</span>
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
        <label title={CONTROL_TOOLTIPS.charset}>
          charset
          <select value={charset()} onChange={(e) => setCharset(e.currentTarget.value)}>
            <option value="url">url-safe</option>
            <option value="hex">hex</option>
            <option value="matrix">matrix</option>
            <option value="symbols">symbols</option>
          </select>
        </label>
        <label title={CONTROL_TOOLTIPS.speed}>
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
        <label title={CONTROL_TOOLTIPS.effect}>
          effect
          <select
            value={effect()}
            onChange={(e) => setEffect(e.currentTarget.value as GlyphEffect)}
          >
            <option value="decode">decode</option>
            <option value="scramble">scramble</option>
          </select>
        </label>
        <label title={CONTROL_TOOLTIPS.commit}>
          commit
          <select
            value={commit()}
            onChange={(e) => setCommit(e.currentTarget.value as CommitTiming)}
          >
            <option value="before">navigate first</option>
            <option value="after">animate first</option>
          </select>
        </label>
        <label title={CONTROL_TOOLTIPS.scope}>
          scope
          <select value={scope()} onChange={(e) => setScope(e.currentTarget.value as AnimateScope)}>
            <option value="full">full</option>
            <option value="tail">tail</option>
          </select>
        </label>
        <label class="toggle" title={CONTROL_TOOLTIPS.backForward}>
          <input
            type="checkbox"
            checked={backForward()}
            onChange={(e) => setBackForward(e.currentTarget.checked)}
          />
          back/forward
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
  basepath: import.meta.env.BASE_URL + 'tanstack-router/solid',
});

render(
  () => (
    <GlyphnavProvider duration={250} commit="before">
      <RouterProvider router={router} />
    </GlyphnavProvider>
  ),
  document.getElementById('root')!,
);
