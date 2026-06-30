'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { GlyphnavLink, GlyphnavProvider, useGlyphnavController } from 'glyphnav/next';
import type { AnimateScope, CommitTiming, GlyphEffect } from 'glyphnav/core';
import {
  charsets,
  CONTROL_TOOLTIPS,
  currentUrl,
  DEFAULT_TOOLBAR,
  durationToSlider,
  initCodeBlocks,
  initTheme,
  initTooltips,
  loadToolbar,
  saveToolbar,
  sliderToDuration,
} from '@glyphnav-demo/shared';
import logo from '@glyphnav-demo/shared/logo.svg';

/** This page's own localStorage key — not shared with the other demos. */
const STORE_KEY = 'next';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
// The picker lives one level up from this app's base path (`/glyphnav/next` →
// `/glyphnav/`). A plain anchor (Next leaves it untouched) does the full reload.
const ROOT_HREF = BASE_PATH.replace(/next$/, '') || '/';

const norm = (p: string): string => (p !== '/' && p.endsWith('/') ? p.slice(0, -1) : p);

function Inner({ children }: { children: ReactNode }) {
  const controller = useGlyphnavController();
  const pathname = usePathname();
  // The current URL's query+hash, kept in sync so a deep link (?query / #hash)
  // never lights up a plain tab. usePathname covers cross-path navigations; the
  // listeners (and the controller's onComplete below) cover same-path hash and
  // query changes and browser back/forward.
  const [extra, setExtra] = useState('');
  const isActive = (href: string): boolean => norm(pathname) === norm(href) && extra === '';
  const [path, setPath] = useState('/');
  const [resolving, setResolving] = useState(false);
  const [charset, setCharset] = useState('url');
  const [duration, setDuration] = useState(250);
  const [effect, setEffect] = useState<GlyphEffect>('decode');
  // App Router navigations are async (the URL isn't observable synchronously
  // right after router.push). Both timings animate: 'after' animates to the
  // precomputed target then navigates, while 'before' navigates first and the
  // adapter waits for the URL to settle before animating to the landed path.
  // 'after' stays the default for its smoother, navigate-at-the-end feel.
  const [commit, setCommit] = useState<CommitTiming>('after');
  const [scope, setScope] = useState<AnimateScope>('full');
  const [backForward, setBackForward] = useState(true);

  // usePathname() changes once Next commits a navigation; mirror the real,
  // settled path then. The App Router updates the URL asynchronously (after the
  // controller's onComplete), so this — not onComplete — is the authority for
  // the resting readout. Also covers the client-only initial value (the server
  // has no location), avoiding a hydration mismatch.
  useEffect(() => {
    setPath(currentUrl());
    setResolving(false);
  }, [pathname]);

  // Keep `extra` (query+hash) in sync for the exact tab-active check above.
  useEffect(() => {
    const sync = (): void => setExtra(window.location.search + window.location.hash);
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
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
          // Same-path query navigations (router.push, no pathname change) settle
          // here — refresh `extra` so the active check stays exact.
          setExtra(window.location.search + window.location.hash);
        },
      },
    });
  }, [controller, charset, duration, effect, commit, scope]);

  // Back/forward animation is opt-in; toggling the checkbox attaches/detaches
  // the popstate listener (the cleanup returned by enableHistoryAnimation).
  useEffect(() => {
    if (backForward) return controller.enableHistoryAnimation();
  }, [controller, backForward]);

  // Wire the theme switcher + styled control tooltips + code-block helpers once.
  useEffect(() => {
    initTheme();
    initTooltips();
    initCodeBlocks();
  }, []);

  // Restore the saved toolbar on the client (after hydration), so the
  // statically prerendered markup — which has no localStorage — never mismatches.
  useEffect(() => {
    const s = loadToolbar(STORE_KEY, { ...DEFAULT_TOOLBAR, commit: 'after' as CommitTiming });
    setCharset(s.charset);
    setDuration(s.duration);
    setEffect(s.effect);
    setCommit(s.commit);
    setScope(s.scope);
    setBackForward(s.backForward);
  }, []);

  // Persist on change, under this page's own key. Skip the initial mount so the
  // restore above wins instead of writing the defaults back over it.
  const firstSave = useRef(true);
  useEffect(() => {
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    saveToolbar(STORE_KEY, { charset, duration, effect, commit, scope, backForward });
  }, [charset, duration, effect, commit, scope, backForward]);

  return (
    <>
      <h1>
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny shared brand mark, not a content image */}
        <img className="glyph-mark" src={logo.src} alt="" />
        <a href={ROOT_HREF}>glyphnav</a>
        <span className="sep">/</span>
        <span className="crumb">next</span>
      </h1>

      <p className={resolving ? 'bar resolving' : 'bar'}>
        Watch the address bar. Current path: <span className="path">{path}</span>
      </p>

      <nav aria-label="demo pages">
        <GlyphnavLink href="/" className={isActive('/') ? 'active' : undefined}>
          Home
        </GlyphnavLink>
        <GlyphnavLink href="/about" className={isActive('/about') ? 'active' : undefined}>
          About
        </GlyphnavLink>
        <GlyphnavLink href="/docs" className={isActive('/docs') ? 'active' : undefined}>
          Docs
        </GlyphnavLink>
        <GlyphnavLink href="/blog" className={isActive('/blog') ? 'active' : undefined}>
          Blog
        </GlyphnavLink>
      </nav>

      <nav className="deep" aria-label="deep links">
        deep links:
        <GlyphnavLink href="/about?ref=deep&page=2">?query</GlyphnavLink>
        <GlyphnavLink href="/docs#options">#hash</GlyphnavLink>
        <GlyphnavLink href="/about?q=glyph#results">?query+#hash</GlyphnavLink>
      </nav>

      <div className="controls">
        <label data-tip={CONTROL_TOOLTIPS.charset}>
          charset
          <select value={charset} onChange={(e) => setCharset(e.target.value)}>
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
            onChange={(e) => setDuration(sliderToDuration(Number(e.target.value)))}
          />
          <span className="ms">{duration}ms</span>
        </label>
        <label data-tip={CONTROL_TOOLTIPS.effect}>
          effect
          <select value={effect} onChange={(e) => setEffect(e.target.value as GlyphEffect)}>
            <option value="decode">decode</option>
            <option value="scramble">scramble</option>
          </select>
        </label>
        <label data-tip={CONTROL_TOOLTIPS.commit}>
          commit
          <select value={commit} onChange={(e) => setCommit(e.target.value as CommitTiming)}>
            <option value="before">navigate first</option>
            <option value="after">animate first</option>
          </select>
        </label>
        <label data-tip={CONTROL_TOOLTIPS.scope}>
          scope
          <select value={scope} onChange={(e) => setScope(e.target.value as AnimateScope)}>
            <option value="full">full</option>
            <option value="tail">tail</option>
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
          NPM
        </a>
        {/* The changelog page is part of the combined demo site, one level up
            from this app's base path — a plain anchor (full navigation). */}
        <a href={`${ROOT_HREF}changelog/`}>Changelog</a>
        <span className="stack" data-tip={process.env.NEXT_PUBLIC_STACK_TIP}>
          {process.env.NEXT_PUBLIC_STACK}
        </span>
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
