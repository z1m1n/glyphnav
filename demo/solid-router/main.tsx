import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import type { JSX } from 'solid-js';
import { render } from 'solid-js/web';
import { Route, Router, useLocation, useResolvedPath } from '@solidjs/router';
import type { RouteSectionProps } from '@solidjs/router';
import { GlyphnavLink, GlyphnavProvider, useGlyphnavController } from 'glyphnav/solid-router';
import type { AnimateScope, CommitTiming, GlyphEffect } from 'glyphnav/core';
import { highlight } from '../shared/highlight';
import logo from '../shared/logo.svg';
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
} from '../shared/content';
import { initCodeBlocks } from '../shared/code-blocks';
import { initTheme } from '../shared/theme';
import { initTooltips } from '../shared/tooltip';

/** This page's own localStorage key — not shared with the other demos. */
const STORE_KEY = 'solid-router';

const DOCS_SETUP = `import { GlyphnavProvider, GlyphnavLink, useGlyphnavNavigate } from 'glyphnav/solid-router';

<GlyphnavProvider duration={250} commit="before">
  <Router root={Layout}>{/* <Route> children */}</Router>
</GlyphnavProvider>;

// inside the router tree — a drop-in for Solid Router's <A href>:
<GlyphnavLink href="/posts?page=2#top">Posts</GlyphnavLink>;

const navigate = useGlyphnavNavigate();
await navigate('/posts');`;

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
          Install the package — Solid Router stays a peer dependency:
        </header>
        <Figure code={DOCS_INSTALL} />
        <Figure
          caption={
            <>
              The animated path is base-aware via <code>useHref()</code>; nothing is patched
              globally:
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

function NavItem(props: { href: string; children: JSX.Element }): JSX.Element {
  // Active only on an exact match: the route-resolved path (base-less) equals
  // the current path AND there's no query/hash, so a deep link like
  // /about?ref=deep never lights up the plain "About" tab.
  const resolved = useResolvedPath(() => props.href);
  const location = useLocation();
  const active = (): boolean =>
    resolved() === location.pathname && !location.search && !location.hash;
  return (
    <GlyphnavLink href={props.href} class={active() ? 'active' : undefined}>
      {props.children}
    </GlyphnavLink>
  );
}

function Layout(props: RouteSectionProps): JSX.Element {
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

  // Wire the theme switcher + styled control tooltips + code-block helpers once.
  onMount(() => {
    initTheme();
    initTooltips();
    initCodeBlocks();
  });

  return (
    <>
      <h1 data-fw="solid-router">
        <img class="glyph-mark" src={logo} alt="" />
        <a href={import.meta.env.BASE_URL}>glyphnav</a>
        <span class="sep">/</span>
        <span class="crumb">solid-router</span>
      </h1>

      <p class={resolving() ? 'bar resolving' : 'bar'}>
        Watch the address bar. Current path: <span class="path">{path()}</span>
      </p>

      <nav aria-label="demo pages">
        <NavItem href="/">Home</NavItem>
        <NavItem href="/about">About</NavItem>
        <NavItem href="/posts">Posts</NavItem>
        <NavItem href="/docs">Docs</NavItem>
      </nav>

      <nav class="deep" aria-label="deep links">
        deep links:
        <GlyphnavLink href="/about?ref=deep&page=2">?query</GlyphnavLink>
        <GlyphnavLink href="/docs#options">#hash</GlyphnavLink>
        <GlyphnavLink href="/about?q=glyph#results">?query+#hash</GlyphnavLink>
      </nav>

      <div class="controls">
        <label data-tip={CONTROL_TOOLTIPS.charset}>
          charset
          <select value={charset()} onChange={(e) => setCharset(e.currentTarget.value)}>
            <option value="url">url-safe</option>
            <option value="hex">hex</option>
            <option value="matrix">matrix</option>
            <option value="symbols">symbols</option>
          </select>
        </label>
        <label data-tip={CONTROL_TOOLTIPS.speed}>
          speed
          <input
            type="range"
            min={20}
            max={1000}
            step={10}
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
            <option value="decode">decode</option>
            <option value="scramble">scramble</option>
          </select>
        </label>
        <label data-tip={CONTROL_TOOLTIPS.commit}>
          commit
          <select
            value={commit()}
            onChange={(e) => setCommit(e.currentTarget.value as CommitTiming)}
          >
            <option value="before">navigate first</option>
            <option value="after">animate first</option>
          </select>
        </label>
        <label data-tip={CONTROL_TOOLTIPS.scope}>
          scope
          <select value={scope()} onChange={(e) => setScope(e.currentTarget.value as AnimateScope)}>
            <option value="full">full</option>
            <option value="tail">tail</option>
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

      {props.children}

      <p class="foot">
        Solid Router on Solid: <code>GlyphnavLink</code> is a drop-in for <code>&lt;A&gt;</code>{' '}
        that hands off to <code>useNavigate()</code>. The animated path is base-aware via{' '}
        <code>useHref()</code> — the framework-agnostic engine, Solid bindings.
      </p>
    </>
  );
}

render(
  () => (
    <GlyphnavProvider duration={250} commit="before">
      <Router base={import.meta.env.BASE_URL + 'solid-router'} root={Layout}>
        <Route
          path="/"
          component={() => (
            <View
              title="Home"
              body="Solid Router (<code>@solidjs/router</code>). A <code>GlyphnavProvider</code> shares one controller; each <code>GlyphnavLink</code> decodes the URL. With <code>commit: 'navigate first'</code> the route swaps instantly and the bar animates on top."
            />
          )}
        />
        <Route
          path="/about"
          component={() => (
            <View
              title="About"
              body={`<code>useGlyphnavNavigate()</code> mirrors <code>useNavigate()</code>; <code>GlyphnavLink</code> is a drop-in for <code>&lt;A&gt;</code>. Deep links with <code>?search</code> and <code>#hash</code> animate too — they are just part of the path.`}
            />
          )}
        />
        <Route
          path="/posts"
          component={() => (
            <View
              title="Posts"
              body="The animation rides on <code>history.replaceState</code>; Solid Router performs the real navigation. Try <code>scope: tail</code> — only the part of the path that differs gets scrambled."
            />
          )}
        />
        <Route path="/docs" component={Docs} />
      </Router>
    </GlyphnavProvider>
  ),
  document.getElementById('root')!,
);
