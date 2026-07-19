import { createEffect, createSignal, For, onCleanup, onMount } from 'solid-js';
import type { JSX } from 'solid-js';
import { render } from 'solid-js/web';
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
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
  CONTROL_TOOLTIPS,
  currentUrl,
  DEFAULT_TOOLBAR,
  DOCS_INSTALL,
  DOCS_PROVIDER_OPTIONS,
  durationToSlider,
  glyphnavOptions,
  loadToolbar,
  saveToolbar,
  sliderToDuration,
  SPEED_SLIDER,
  TOOLBAR_SELECTS,
} from '../../shared/content';
import { initActiveNav } from '../../shared/active-nav';
import { initCodeBlocks } from '../../shared/code-blocks';
import { initFwMenu } from '../../shared/fw-menu';
import { initTheme } from '../../shared/theme';
import { initTooltips } from '../../shared/tooltip';
import { initWordmark } from '../../shared/wordmark';

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

function View(props: { title: string; body: string }): JSX.Element {
  return (
    <div class="view">
      <article>
        <header class="lead">
          <h2>{props.title}</h2>
          <span innerHTML={props.body} />
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
          <h2>Docs</h2>
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
          code={DOCS_PROVIDER_OPTIONS}
        />
      </article>
    </div>
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
    controller.update(
      glyphnavOptions(
        {
          charset: charset(),
          duration: duration(),
          effect: effect(),
          commit: commit(),
          scope: scope(),
        },
        (p, r) => {
          setPath(p);
          setResolving(r);
        },
      ),
    );
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

  // Wire the theme switcher + framework menu + styled control tooltips +
  // code-block helpers + the nav's exact-match active pill once. The menu and
  // the nav sync are the two with something to unhook.
  onMount(() => {
    initTheme();
    onCleanup(initFwMenu());
    initTooltips();
    initCodeBlocks();
    initWordmark();
    onCleanup(initActiveNav());
  });

  return (
    <>
      <h1>
        <img class="glyph-mark" src={logo} alt="" />
        <a href={import.meta.env.BASE_URL} class="wordmark">
          glyphnav
        </a>
        <span class="sep">/</span>
        <span class="crumb">tanstack-router/solid</span>
        <button
          type="button"
          class="fw-switch"
          aria-label="Switch demo"
          aria-expanded="false"
          aria-controls="fw-menu"
        ></button>
      </h1>

      <p class={resolving() ? 'bar resolving' : 'bar'}>
        Watch the address bar. Current path: <span class="path">{path()}</span>
      </p>

      <nav class="tabs" aria-label="demo pages">
        <GlyphnavLink to="/">Home</GlyphnavLink>
        <GlyphnavLink to="/about">About</GlyphnavLink>
        <GlyphnavLink to="/posts">Posts</GlyphnavLink>
        <GlyphnavLink to="/docs">Docs</GlyphnavLink>
      </nav>

      <nav class="deep" aria-label="deep links">
        <span class="deep-label">deep links:</span>
        <GlyphnavLink to="/about" search={{ ref: 'deep', page: 2 }}>
          ?query
        </GlyphnavLink>
        <GlyphnavLink to="/docs" hash="options">
          #hash
        </GlyphnavLink>
        <GlyphnavLink to="/about" search={{ q: 'glyph' }} hash="results">
          ?query+#hash
        </GlyphnavLink>
      </nav>

      <div class="controls">
        <label data-tip={CONTROL_TOOLTIPS.charset}>
          charset
          <select value={charset()} onChange={(e) => setCharset(e.currentTarget.value)}>
            <For each={TOOLBAR_SELECTS.charset}>
              {(o) => <option value={o.value}>{o.label}</option>}
            </For>
          </select>
        </label>
        <label data-tip={CONTROL_TOOLTIPS.speed}>
          speed
          <input
            type="range"
            {...SPEED_SLIDER}
            value={durationToSlider(duration())}
            aria-valuetext={`${duration()}ms`}
            onInput={(e) => setDuration(sliderToDuration(Number(e.currentTarget.value)))}
          />
          <span class="ms">{duration()}ms</span>
        </label>
        <label data-tip={CONTROL_TOOLTIPS.effect}>
          effect
          <select
            value={effect()}
            onChange={(e) => setEffect(e.currentTarget.value as GlyphEffect)}
          >
            <For each={TOOLBAR_SELECTS.effect}>
              {(o) => <option value={o.value}>{o.label}</option>}
            </For>
          </select>
        </label>
        <label data-tip={CONTROL_TOOLTIPS.commit}>
          commit
          <select
            value={commit()}
            onChange={(e) => setCommit(e.currentTarget.value as CommitTiming)}
          >
            <For each={TOOLBAR_SELECTS.commit}>
              {(o) => <option value={o.value}>{o.label}</option>}
            </For>
          </select>
        </label>
        <label data-tip={CONTROL_TOOLTIPS.scope}>
          scope
          <select value={scope()} onChange={(e) => setScope(e.currentTarget.value as AnimateScope)}>
            <For each={TOOLBAR_SELECTS.scope}>
              {(o) => <option value={o.value}>{o.label}</option>}
            </For>
          </select>
        </label>
        <label class="toggle" data-tip={CONTROL_TOOLTIPS.backForward}>
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
        title="Home"
        body="TanStack Router on Solid. A <code>GlyphnavProvider</code> shares one controller; each <code>GlyphnavLink</code> decodes the URL. With <code>commit: 'navigate first'</code> the route swaps instantly and the bar animates on top."
      />
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/about',
    component: () => (
      <View
        title="About"
        body="<code>useGlyphnavNavigate()</code> mirrors <code>useNavigate()</code>; <code>GlyphnavLink</code> renders a plain anchor. Deep links with <code>?search</code> and <code>#hash</code> animate too — they are just part of the path."
      />
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/posts',
    component: () => (
      <View
        title="Posts"
        body="The animation rides on <code>history.replaceState</code>; TanStack Router performs the real navigation. Try <code>scope: tail</code> — only the part of the path that differs gets scrambled."
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
