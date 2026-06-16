import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useMatchRoute,
} from '@tanstack/react-router';
import {
  GlyphnavLink,
  GlyphnavProvider,
  useGlyphnavController,
} from 'glyphnav/tanstack-router/react';
import type { AnimateScope, CommitTiming, GlyphEffect } from 'glyphnav/core';
import { highlight } from '../../shared/highlight';
import logo from '../../shared/logo.svg';
import {
  charsets,
  currentUrl,
  DOCS_INSTALL,
  durationToSlider,
  sliderToDuration,
} from '../../shared/content';

const DOCS_SETUP = `import { GlyphnavProvider, GlyphnavLink, useGlyphnavNavigate } from 'glyphnav/tanstack-router/react';

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

function NavItem({ to, children }: { to: string; children: string }) {
  const matchRoute = useMatchRoute();
  const active = Boolean(matchRoute({ to }));
  return (
    <GlyphnavLink to={to} className={active ? 'active' : undefined}>
      {children}
    </GlyphnavLink>
  );
}

function Layout() {
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
        <span className="crumb">/ tanstack-router/react</span>
      </h1>

      <p className={resolving ? 'bar resolving' : 'bar'}>
        Watch the address bar. Current path: <span className="path">{path}</span>
      </p>

      <nav>
        <NavItem to="/">home</NavItem>
        <NavItem to="/about">about</NavItem>
        <NavItem to="/posts">posts</NavItem>
        <NavItem to="/docs">docs</NavItem>
      </nav>

      <p className="deep">
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

      <Outlet />

      <p className="foot">
        TanStack Router edition: <code>GlyphnavLink</code> hands off to{' '}
        <code>router.navigate()</code>. The animated path is basepath-aware via{' '}
        <code>router.buildLocation()</code>.
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
        body="TanStack Router edition. A GlyphnavProvider shares one controller; each GlyphnavLink decodes the URL. With commit: 'navigate first' the route swaps instantly and the bar animates on top."
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
  basepath: import.meta.env.BASE_URL + 'tanstack-router/react',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlyphnavProvider duration={250} commit="before">
      <RouterProvider router={router} />
    </GlyphnavProvider>
  </StrictMode>,
);
