/** @jsxImportSource preact */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Route, Router, useLocation } from 'preact-iso';
import { GlyphnavLink, useGlyphnavController } from 'glyphnav/preact-iso';
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
const STORE_KEY = 'preact-iso';

/**
 * preact-iso has no basename, so routes and links carry the full deploy path.
 * `/preact-iso` in dev, `/glyphnav/preact-iso` on GitHub Pages.
 */
const ROOT = import.meta.env.BASE_URL + 'preact-iso';

const DOCS_SETUP = `import { LocationProvider, Router, Route } from 'preact-iso';
import { GlyphnavProvider, GlyphnavLink, useGlyphnavRoute } from 'glyphnav/preact-iso';

<LocationProvider>
  <GlyphnavProvider duration={250} commit="before" interceptLinks>
    <a href="/about">About</a>{/* plain links animate via interceptLinks */}
    <GlyphnavLink href="/posts?page=2#top">Posts</GlyphnavLink>
    <Router>{/* <Route> children */}</Router>
  </GlyphnavProvider>
</LocationProvider>;

// imperative, drop-in for useLocation().route:
const route = useGlyphnavRoute();
await route('/dashboard');`;

const DOCS_OPTIONS = `<GlyphnavProvider
  duration={250}        // total animation time (ms), spread over all frames
  effect="scramble"     // 'decode' grows + resolves; 'scramble' bursts, then locks randomly
  commit="before"       // navigate instantly, animate on top ('after' = classic order)
  charset={MATRIX}      // glyph pool — URL_SAFE stays readable in the bar
  scope="tail"          // animate only the part that differs from the current path
  interceptLinks        // animate the plain <a> clicks preact-iso already handles
  animatePopState       // also animate browser back/forward (opt-in)
>`;

function View({ title, body }: { title: string; body: ComponentChildren }) {
  return (
    <div class="view">
      <article>
        <header class="lead">
          <h2>{title}</h2>
          <span>{body}</span>
        </header>
      </article>
    </div>
  );
}

/** A code listing as a captioned <figure>. */
function Figure({
  code,
  caption,
  captionId,
}: {
  code: string;
  caption?: ComponentChildren;
  captionId?: string;
}) {
  return (
    <figure>
      {caption ? <figcaption id={captionId}>{caption}</figcaption> : null}
      <pre>
        <code dangerouslySetInnerHTML={{ __html: highlight(code) }} />
      </pre>
    </figure>
  );
}

function Docs() {
  return (
    <div class="view docs">
      <article>
        <header class="lead">
          <h2>Docs</h2>
          Install the package — Preact and preact-iso stay peer dependencies:
        </header>
        <Figure code={DOCS_INSTALL} />
        <Figure
          caption={
            <>
              <code>interceptLinks</code> animates the plain <code>&lt;a&gt;</code> clicks
              preact-iso already handles; <code>GlyphnavLink</code> is the opt-in drop-in. Nothing
              else is patched globally:
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

const Home = () => (
  <View
    title="Home"
    body={<>Preact + preact-iso. A <code>GlyphnavProvider</code> shares one controller; with <code>interceptLinks</code> the plain <code>&lt;a&gt;</code> links preact-iso already handles decode the URL — no component swap. With <code>commit: 'navigate first'</code> the route swaps instantly and the bar animates on top.</>}
  />
);

const AboutPage = () => (
  <View
    title="About"
    body={<>preact-iso auto-intercepts every same-origin <code>&lt;a&gt;</code>; <code>interceptLinks</code> makes those clicks animate, while <code>GlyphnavLink</code> and <code>useGlyphnavRoute()</code> are the opt-in equivalents. Deep links with <code>?query</code> and <code>#hash</code> animate too — they are just part of the path.</>}
  />
);

const PostsPage = () => (
  <View
    title="Posts"
    body={<>The animation rides on <code>history.replaceState</code>; preact-iso performs the real navigation via <code>useLocation().route</code>. Try <code>scope: tail</code> — only the part of the path that differs gets scrambled.</>}
  />
);

const Fallback = () => (
  <View title="Home" body="Pick a tab above to watch the address bar decode." />
);

/**
 * A plain `<a>` — the animation comes from `interceptLinks` on the provider, not
 * a component swap. Active only on an exact match (same path, no query/hash), so
 * a deep link like /about?ref=deep never lights up the plain "About" tab.
 */
function NavItem({ sub, children }: { sub: string; children: string }) {
  const href = ROOT + sub;
  const { path } = useLocation();
  const active = path === href;
  return (
    <a href={href} class={active ? 'active' : undefined}>
      {children}
    </a>
  );
}

export function App() {
  const controller = useGlyphnavController();
  const [saved] = useState(() => loadToolbar(STORE_KEY, DEFAULT_TOOLBAR));
  const [path, setPath] = useState(currentUrl());
  const [resolving, setResolving] = useState(false);
  const [charset, setCharset] = useState(saved.charset);
  const [duration, setDuration] = useState(saved.duration);
  const [effect, setEffect] = useState<GlyphEffect>(saved.effect);
  const [commit, setCommit] = useState<CommitTiming>(saved.commit);
  const [scope, setScope] = useState<AnimateScope>(saved.scope);
  const [backForward, setBackForward] = useState(saved.backForward);

  useEffect(() => {
    controller.update({
      charset: charsets[charset],
      duration,
      effect,
      commit,
      scope,
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
  }, [controller, charset, duration, effect, commit, scope]);

  // Back/forward animation is opt-in; toggling the checkbox attaches/detaches
  // the popstate listener (the cleanup returned by enableHistoryAnimation).
  useEffect(() => {
    if (backForward) return controller.enableHistoryAnimation();
  }, [controller, backForward]);

  // Persist this page's toolbar under its own key (no syncing between demos).
  useEffect(() => {
    saveToolbar(STORE_KEY, { charset, duration, effect, commit, scope, backForward });
  }, [charset, duration, effect, commit, scope, backForward]);

  // Wire the theme switcher + styled control tooltips + code-block helpers once.
  useEffect(() => {
    initTheme();
    initTooltips();
    initCodeBlocks();
  }, []);

  return (
    <>
      <h1 data-fw="preact-iso">
        <img class="glyph-mark" src={logo} alt="" />
        {/* Cross-app link — exclude from interceptLinks so it full-loads. */}
        <a href={import.meta.env.BASE_URL} data-glyphnav="off">
          glyphnav
        </a>
        <span class="sep">/</span>
        <span class="crumb">preact-iso</span>
      </h1>

      <p class={resolving ? 'bar resolving' : 'bar'}>
        Watch the address bar. Current path: <span class="path">{path}</span>
      </p>

      <nav aria-label="demo pages">
        <NavItem sub="">Home</NavItem>
        <NavItem sub="/about">About</NavItem>
        <NavItem sub="/posts">Posts</NavItem>
        <NavItem sub="/docs">Docs</NavItem>
      </nav>

      <nav class="deep" aria-label="deep links">
        deep links:
        <GlyphnavLink href={`${ROOT}/about?ref=deep&page=2`}>?query</GlyphnavLink>
        <GlyphnavLink href={`${ROOT}/docs#options`}>#hash</GlyphnavLink>
        <GlyphnavLink href={`${ROOT}/about?q=glyph#results`}>?query+#hash</GlyphnavLink>
      </nav>

      <div class="controls">
        <label data-tip={CONTROL_TOOLTIPS.charset}>
          charset
          <select value={charset} onChange={(e) => setCharset(e.currentTarget.value)}>
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
            value={durationToSlider(duration)}
            aria-valuetext={`${duration}ms`}
            onInput={(e) => setDuration(sliderToDuration(Number(e.currentTarget.value)))}
          />
          <span class="ms">{duration}ms</span>
        </label>
        <label data-tip={CONTROL_TOOLTIPS.effect}>
          effect
          <select value={effect} onChange={(e) => setEffect(e.currentTarget.value as GlyphEffect)}>
            <option value="decode">decode</option>
            <option value="scramble">scramble</option>
          </select>
        </label>
        <label data-tip={CONTROL_TOOLTIPS.commit}>
          commit
          <select value={commit} onChange={(e) => setCommit(e.currentTarget.value as CommitTiming)}>
            <option value="before">navigate first</option>
            <option value="after">animate first</option>
          </select>
        </label>
        <label data-tip={CONTROL_TOOLTIPS.scope}>
          scope
          <select value={scope} onChange={(e) => setScope(e.currentTarget.value as AnimateScope)}>
            <option value="full">full</option>
            <option value="tail">tail</option>
          </select>
        </label>
        <label class="toggle" data-tip={CONTROL_TOOLTIPS.backForward}>
          <input
            type="checkbox"
            checked={backForward}
            onChange={(e) => setBackForward(e.currentTarget.checked)}
          />
          back/forward
        </label>
      </div>

      <Router>
        <Route path={ROOT} component={Home} />
        <Route path={`${ROOT}/about`} component={AboutPage} />
        <Route path={`${ROOT}/posts`} component={PostsPage} />
        <Route path={`${ROOT}/docs`} component={Docs} />
        <Route default component={Fallback} />
      </Router>

      <p class="foot">
        preact-iso on Preact: <code>interceptLinks</code> animates the plain <code>&lt;a&gt;</code>{' '}
        clicks it already handles; <code>GlyphnavLink</code> is the opt-in drop-in. The same
        framework-agnostic engine, Preact bindings.
      </p>
    </>
  );
}
