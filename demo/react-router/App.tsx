import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { GlyphnavLink, useGlyphnavController } from 'glyphnav/react-router';
import type { AnimateScope, CommitTiming, GlyphEffect } from 'glyphnav/core';
import { highlight } from '../shared/highlight';
import logo from '../shared/logo.svg';
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
} from '../shared/content';
import { initCodeBlocks } from '../shared/code-blocks';
import { initFwMenu } from '../shared/fw-menu';
import { initTheme } from '../shared/theme';
import { initTooltips } from '../shared/tooltip';
import { initWordmark } from '../shared/wordmark';

/** This page's own localStorage key — not shared with the other demos. */
const STORE_KEY = 'react-router';

const DOCS_SETUP = `import { GlyphnavProvider, GlyphnavLink, useGlyphnavNavigate } from 'glyphnav/react-router';

<GlyphnavProvider duration={250} commit="before">
  <GlyphnavLink to="/about?tab=2#top">About</GlyphnavLink>
</GlyphnavProvider>;

// imperative, drop-in for useNavigate():
const navigate = useGlyphnavNavigate();
await navigate('/dashboard');`;

function View({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className="view">
      <article>
        <header className="lead">
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
  caption?: ReactNode;
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
    <div className="view docs">
      <article>
        <header className="lead">
          <h2>Docs</h2>
          Install the package — React Router stays a peer dependency:
        </header>
        <Figure code={DOCS_INSTALL} />
        <Figure
          caption={
            <>
              <code>GlyphnavLink</code> is a drop-in for <code>&lt;Link&gt;</code> (basename-aware
              via <code>useHref</code>); nothing is patched globally:
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

function NavLink({ to, children }: { to: string; children: string }) {
  // Active only on an exact match — same path with no query/hash — so a deep
  // link (e.g. /about?ref=deep) never lights up the plain "About" tab.
  const { pathname, search, hash } = useLocation();
  const active = pathname === to && !search && !hash;
  return (
    <GlyphnavLink to={to} className={active ? 'active' : undefined}>
      {children}
    </GlyphnavLink>
  );
}

export default function App() {
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
    controller.update(
      glyphnavOptions({ charset, duration, effect, commit, scope }, (p, r) => {
        setPath(p);
        setResolving(r);
      }),
    );
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

  // Wire the theme switcher + framework menu + styled control tooltips +
  // code-block helpers once. Only the menu injects into this component's DOM,
  // so its detach function is the effect's cleanup.
  useEffect(() => {
    initTheme();
    const disposeFwMenu = initFwMenu();
    initTooltips();
    initCodeBlocks();
    initWordmark();
    return disposeFwMenu;
  }, []);

  return (
    <>
      <h1>
        <img className="glyph-mark" src={logo} alt="" />
        <a href={import.meta.env.BASE_URL} className="wordmark">
          glyphnav
        </a>
        <span className="sep">/</span>
        <span className="crumb">react-router</span>
        <button
          type="button"
          className="fw-switch"
          aria-label="Switch demo"
          aria-expanded="false"
          aria-controls="fw-menu"
        ></button>
      </h1>

      <p className={resolving ? 'bar resolving' : 'bar'}>
        Watch the address bar. Current path: <span className="path">{path}</span>
      </p>

      <nav aria-label="demo pages">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/about">About</NavLink>
        <NavLink to="/docs">Docs</NavLink>
        <NavLink to="/blog">Blog</NavLink>
      </nav>

      <nav className="deep" aria-label="deep links">
        deep links:
        <GlyphnavLink to="/about?ref=deep&page=2">?query</GlyphnavLink>
        <GlyphnavLink to="/docs#options">#hash</GlyphnavLink>
        <GlyphnavLink to="/about?q=glyph#results">?query+#hash</GlyphnavLink>
      </nav>

      <div className="controls">
        <label data-tip={CONTROL_TOOLTIPS.charset}>
          charset
          <select value={charset} onChange={(e) => setCharset(e.target.value)}>
            {TOOLBAR_SELECTS.charset.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label data-tip={CONTROL_TOOLTIPS.speed}>
          speed
          <input
            type="range"
            {...SPEED_SLIDER}
            value={durationToSlider(duration)}
            aria-valuetext={`${duration}ms`}
            onChange={(e) => setDuration(sliderToDuration(Number(e.target.value)))}
          />
          <span className="ms">{duration}ms</span>
        </label>
        <label data-tip={CONTROL_TOOLTIPS.effect}>
          effect
          <select value={effect} onChange={(e) => setEffect(e.target.value as GlyphEffect)}>
            {TOOLBAR_SELECTS.effect.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label data-tip={CONTROL_TOOLTIPS.commit}>
          commit
          <select value={commit} onChange={(e) => setCommit(e.target.value as CommitTiming)}>
            {TOOLBAR_SELECTS.commit.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label data-tip={CONTROL_TOOLTIPS.scope}>
          scope
          <select value={scope} onChange={(e) => setScope(e.target.value as AnimateScope)}>
            {TOOLBAR_SELECTS.scope.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="toggle" data-tip={CONTROL_TOOLTIPS.backForward}>
          <input
            type="checkbox"
            checked={backForward}
            onChange={(e) => setBackForward(e.target.checked)}
          />
          back/forward
        </label>
      </div>

      <Routes>
        <Route
          path="/"
          element={
            <View
              title="Home"
              body={
                <>
                  React Router edition. A <code>GlyphnavProvider</code> shares one controller; each{' '}
                  <code>GlyphnavLink</code> decodes the URL. With{' '}
                  <code>commit: 'navigate first'</code> the route swaps instantly and the bar
                  animates on top.
                </>
              }
            />
          }
        />
        <Route
          path="/about"
          element={
            <View
              title="About"
              body={
                <>
                  <code>GlyphnavLink</code> is a drop-in for <code>&lt;Link&gt;</code>;{' '}
                  <code>useGlyphnavNavigate()</code> is the imperative equivalent of{' '}
                  <code>useNavigate()</code>. Deep links with <code>?query</code> and{' '}
                  <code>#hash</code> animate too — they are just part of the path.
                </>
              }
            />
          }
        />
        <Route path="/docs" element={<Docs />} />
        <Route
          path="/blog"
          element={
            <View
              title="Blog"
              body={
                <>
                  The animation rides on <code>history.replaceState</code>; React Router performs
                  the real navigation. Modified clicks (⌘/Ctrl/middle) fall through to the browser,
                  exactly like a normal link.
                </>
              }
            />
          }
        />
      </Routes>

      <p className="foot">
        Served under the <code>/react-router</code> basename — the animated path is basename-aware
        via <code>useHref</code>. The title link is a plain anchor (full page load).
      </p>
    </>
  );
}
