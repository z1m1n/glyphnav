'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { GlyphnavLink, GlyphnavProvider, useGlyphnavController } from 'glyphnav/next';
import type { AnimateScope, CommitTiming, GlyphEffect } from 'glyphnav/core';
import { charsets, currentUrl, durationToSlider, sliderToDuration } from '@glyphnav-demo/shared';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
// The picker lives one level up from this app's base path (`/glyphnav/next` →
// `/glyphnav/`). A plain anchor (Next leaves it untouched) does the full reload.
const ROOT_HREF = BASE_PATH.replace(/next$/, '') || '/';

const norm = (p: string): string => (p !== '/' && p.endsWith('/') ? p.slice(0, -1) : p);

function NavLink({ href, children }: { href: string; children: string }) {
  const pathname = usePathname();

  return (
    <GlyphnavLink href={href} className={norm(pathname) === norm(href) ? 'active' : undefined}>
      {children}
    </GlyphnavLink>
  );
}

function Inner({ children }: { children: ReactNode }) {
  const controller = useGlyphnavController();
  const pathname = usePathname();
  const [path, setPath] = useState('/');
  const [resolving, setResolving] = useState(false);
  const [charset, setCharset] = useState('url');
  const [duration, setDuration] = useState(250);
  const [effect, setEffect] = useState<GlyphEffect>('decode');
  // App Router navigations are async (the URL isn't observable synchronously
  // right after router.push), so 'after' — animate to the precomputed target,
  // then navigate — is the mode that reliably animates here. 'before' still
  // navigates correctly; it just skips the on-top animation on the App Router.
  const [commit, setCommit] = useState<CommitTiming>('after');
  const [scope, setScope] = useState<AnimateScope>('full');

  // usePathname() changes once Next commits a navigation; mirror the real,
  // settled path then. The App Router updates the URL asynchronously (after the
  // controller's onComplete), so this — not onComplete — is the authority for
  // the resting readout. Also covers the client-only initial value (the server
  // has no location), avoiding a hydration mismatch.
  useEffect(() => {
    setPath(currentUrl());
    setResolving(false);
  }, [pathname]);

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
        <a href={ROOT_HREF}>glyphnav</a> <span className="crumb">/ next</span>
      </h1>

      <p className={resolving ? 'bar resolving' : 'bar'}>
        Watch the address bar. Current path: <span className="path">{path}</span>
      </p>

      <nav>
        <NavLink href="/">home</NavLink>
        <NavLink href="/about">about</NavLink>
        <NavLink href="/docs">docs</NavLink>
        <NavLink href="/blog">blog</NavLink>
      </nav>

      <p className="deep">
        deep links:
        <GlyphnavLink href="/about?ref=deep&page=2">?query</GlyphnavLink>
        <GlyphnavLink href="/docs#options">#hash</GlyphnavLink>
        <GlyphnavLink href="/about?q=glyph#results">?query+#hash</GlyphnavLink>
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

      {children}

      <p className="foot">
        Served under the <code>/next</code> base path via Next&apos;s <code>basePath</code>; the App
        Router performs the real navigation while glyphnav animates the bar. The title link is a
        plain anchor (full page load back to the picker).
      </p>

      <footer className="site-footer">
        <a href="https://github.com/z1m1n/glyphnav" target="_blank" rel="noopener">
          GitHub
        </a>
        <a href="https://www.npmjs.com/package/glyphnav" target="_blank" rel="noopener">
          npm package
        </a>
      </footer>
    </>
  );
}

/**
 * The persistent client shell. It lives in the root layout, so its controls and
 * the address-bar mirror survive client navigations between the route pages.
 */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <GlyphnavProvider duration={250} commit="after" routerMode="app" basePath={BASE_PATH}>
      <Inner>{children}</Inner>
    </GlyphnavProvider>
  );
}
