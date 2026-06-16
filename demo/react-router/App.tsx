import { useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { GlyphnavLink, useGlyphnavController } from 'glyphnav/react-router';
import type { AnimateScope, CommitTiming, GlyphEffect } from 'glyphnav/core';
import { highlight } from '../shared/highlight';
import logo from '../shared/logo.svg';
import {
  charsets,
  currentUrl,
  DOCS_INSTALL,
  durationToSlider,
  sliderToDuration,
} from '../shared/content';

const DOCS_SETUP = `import { GlyphnavProvider, GlyphnavLink, useGlyphnavNavigate } from 'glyphnav/react-router';

<GlyphnavProvider duration={250} commit="before">
  <GlyphnavLink to="/about?tab=2#top">About</GlyphnavLink>
</GlyphnavProvider>;

// imperative, drop-in for useNavigate():
const navigate = useGlyphnavNavigate();
await navigate('/dashboard');`;

const DOCS_OPTIONS = `<GlyphnavProvider
  duration={250}        // total animation time (ms), spread over all frames
  effect="scramble"     // 'decode' grows + resolves; 'scramble' bursts, then locks randomly
  commit="before"       // navigate instantly, animate on top ('after' = classic order)
  charset={MATRIX}      // glyph pool — URL_SAFE stays readable in the bar
  scope="tail"          // animate only the part that differs from the current path
>`;

function View({ title, body }: { title: string; body: string }) {
  return (
    <div className="view">
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

/** A syntax-highlighted code block. */
function Code({ children }: { children: string }) {
  return (
    <pre>
      <code dangerouslySetInnerHTML={{ __html: highlight(children) }} />
    </pre>
  );
}

function Docs() {
  return (
    <div className="view docs">
      <h2>docs</h2>
      <p>Install the package — React Router stays a peer dependency:</p>
      <Code>{DOCS_INSTALL}</Code>
      <p>
        <code>GlyphnavLink</code> is a drop-in for <code>&lt;Link&gt;</code> (basename-aware via{' '}
        <code>useHref</code>); nothing is patched globally:
      </p>
      <Code>{DOCS_SETUP}</Code>
      <p id="options">Every entry point accepts the same options object:</p>
      <Code>{DOCS_OPTIONS}</Code>
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: string }) {
  const { pathname } = useLocation();
  return (
    <GlyphnavLink to={to} className={pathname === to ? 'active' : undefined}>
      {children}
    </GlyphnavLink>
  );
}

export default function App() {
  const controller = useGlyphnavController();
  const [path, setPath] = useState(currentUrl());
  const [resolving, setResolving] = useState(false);
  const [charset, setCharset] = useState('url');
  const [duration, setDuration] = useState(250);
  const [effect, setEffect] = useState<GlyphEffect>('decode');
  const [commit, setCommit] = useState<CommitTiming>('before');
  const [scope, setScope] = useState<AnimateScope>('full');

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

  return (
    <>
      <h1>
        <img className="glyph-mark" src={logo} alt="" />
        <a href={import.meta.env.BASE_URL}>glyphnav</a>{' '}
        <span className="crumb">/ react-router</span>
      </h1>

      <p className={resolving ? 'bar resolving' : 'bar'}>
        Watch the address bar. Current path: <span className="path">{path}</span>
      </p>

      <nav>
        <NavLink to="/">home</NavLink>
        <NavLink to="/about">about</NavLink>
        <NavLink to="/docs">docs</NavLink>
        <NavLink to="/blog">blog</NavLink>
      </nav>

      <p className="deep">
        deep links:
        <GlyphnavLink to="/about?ref=deep&page=2">?query</GlyphnavLink>
        <GlyphnavLink to="/docs#options">#hash</GlyphnavLink>
        <GlyphnavLink to="/about?q=glyph#results">?query+#hash</GlyphnavLink>
      </p>

      <div className="controls">
        <label>
          charset
          <select value={charset} onChange={(e) => setCharset(e.target.value)}>
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
            value={durationToSlider(duration)}
            onChange={(e) => setDuration(sliderToDuration(Number(e.target.value)))}
          />
          <span className="ms">{duration}ms</span>
        </label>
        <label>
          effect
          <select value={effect} onChange={(e) => setEffect(e.target.value as GlyphEffect)}>
            <option value="decode">decode</option>
            <option value="scramble">scramble</option>
          </select>
        </label>
        <label>
          commit
          <select value={commit} onChange={(e) => setCommit(e.target.value as CommitTiming)}>
            <option value="before">navigate first</option>
            <option value="after">animate first</option>
          </select>
        </label>
        <label>
          scope
          <select value={scope} onChange={(e) => setScope(e.target.value as AnimateScope)}>
            <option value="full">full</option>
            <option value="tail">tail</option>
          </select>
        </label>
      </div>

      <Routes>
        <Route
          path="/"
          element={
            <View
              title="home"
              body="React Router edition. A GlyphnavProvider shares one controller; each GlyphnavLink decodes the URL. With commit: 'navigate first' the route swaps instantly and the bar animates on top."
            />
          }
        />
        <Route
          path="/about"
          element={
            <View
              title="about"
              body="GlyphnavLink is a drop-in for <Link>; useGlyphnavNavigate() is the imperative equivalent of useNavigate(). Deep links with ?query and #hash animate too — they are just part of the path."
            />
          }
        />
        <Route path="/docs" element={<Docs />} />
        <Route
          path="/blog"
          element={
            <View
              title="blog"
              body="The animation rides on history.replaceState; React Router performs the real navigation. Modified clicks (⌘/Ctrl/middle) fall through to the browser, exactly like a normal link."
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
