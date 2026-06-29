<script lang="ts">
  import '@glyphnav-demo/shared/styles.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { attachGlyphnav } from 'glyphnav/sveltekit';
  import type { SvelteKitGlyphnavInstance } from 'glyphnav/sveltekit';
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
  const STORE_KEY = 'sveltekit';
  const tips = CONTROL_TOOLTIPS;
  const stack = GLYPHNAV_STACK;

  // `resolve` prefixes the configured `paths.base` (the non-deprecated successor
  // to the `base` string). The picker lives one level up from this app's base
  // (`…/sveltekit/` → `…/`).
  const rootHref = resolve('/').replace(/sveltekit\/?$/, '');

  // Base-prefixed nav targets, resolved once so each link's `href` and its
  // active-state check below compare the exact same path.
  const homeHref = resolve('/');
  const aboutHref = resolve('/about/');
  const docsHref = resolve('/docs/');
  const featuresHref = resolve('/features/');

  // A nav link is active when it points at the current page (trailing slash
  // ignored, so `/sveltekit/` matches home) AND there's no query/hash — so a
  // deep link like /about?ref=deep never lights up the plain "About" tab.
  // Called from the template's `class:active` so the `$app/state` page signal is
  // tracked at runtime — a legacy `$:` block wouldn't react to its mutation.
  const isActive = (href: string): boolean =>
    page.url.pathname.replace(/\/+$/, '') === href.replace(/\/+$/, '') &&
    page.url.search === '' &&
    page.url.hash === '';

  // State starts at the defaults so the prerendered markup is stable; the saved
  // toolbar is restored on the client after mount.
  let path = '/';
  let resolving = false;
  let charset = 'url';
  let duration = 250;
  let effect: GlyphEffect = 'decode';
  let commit: CommitTiming = 'before';
  let scope: AnimateScope = 'full';
  let backForward = false;
  let mounted = false;

  let glyph: SvelteKitGlyphnavInstance | null = null;
  let stopPopState: (() => void) | null = null;

  // Back/forward animation is opt-in; the checkbox attaches/detaches the popstate
  // listener. The instance only exists client-side, so this runs after mount.
  function applyBackForward(): void {
    if (!glyph) return;
    if (backForward && !stopPopState) {
      stopPopState = glyph.controller.enableHistoryAnimation();
    } else if (!backForward && stopPopState) {
      stopPopState();
      stopPopState = null;
    }
  }

  function persist(): void {
    saveToolbar(STORE_KEY, { charset, duration, effect, commit, scope, backForward });
  }

  function apply(): void {
    if (!glyph) return; // absent during SSR/prerender
    glyph.controller.update({
      charset: charsets[charset],
      duration,
      effect,
      commit,
      scope,
      hooks: {
        onFrame: (f) => {
          path = f.path;
          resolving = f.phase === 'resolve';
        },
        onComplete: () => {
          resolving = false;
          path = currentUrl();
        },
      },
    });
    persist();
  }

  onMount(() => {
    // glyphnav rewrites the address bar, so it only attaches on the client.
    glyph = attachGlyphnav(goto, { duration: 250, commit: 'before' });
    const saved = loadToolbar(STORE_KEY, DEFAULT_TOOLBAR);
    charset = saved.charset;
    duration = saved.duration;
    effect = saved.effect;
    commit = saved.commit;
    scope = saved.scope;
    backForward = saved.backForward;
    path = currentUrl();
    // Wire the theme switcher + styled control tooltips + code-block helpers.
    initTheme();
    initTooltips();
    initCodeBlocks();
    // Flip last so the reactive blocks below first run with the restored values
    // (and never clobber the saved state with the defaults on the first render).
    mounted = true;
    return () => {
      stopPopState?.();
      glyph?.detach();
    };
  });

  // Re-apply to the controller whenever a control changes. The listed args drive
  // Svelte's dependency tracking; the work happens in apply()/applyBackForward().
  $: if (mounted) reapply(charset, duration, effect, commit, scope);
  $: if (mounted) retoggle(backForward);

  function reapply(
    _c: string,
    _d: number,
    _e: GlyphEffect,
    _co: CommitTiming,
    _s: AnimateScope,
  ): void {
    apply();
  }
  function retoggle(_bf: boolean): void {
    applyBackForward();
    persist();
  }
</script>

<svelte:head>
  <title>glyphnav — sveltekit</title>
  <meta
    name="description"
    content="glyphnav for SvelteKit: attachGlyphnav(goto) intercepts <a> clicks and drives goto, animating the destination URL in the address bar. Live, interactive demo."
  />
  <link rel="canonical" href="https://z1m1n.github.io/glyphnav/sveltekit/" />
  <link rel="icon" type="image/svg+xml" href="https://z1m1n.github.io/glyphnav/favicon.svg" />
  <meta name="theme-color" content="#ffffff" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="glyphnav" />
  <meta property="og:title" content="glyphnav — SvelteKit demo" />
  <meta
    property="og:description"
    content="attachGlyphnav(goto) intercepts <a> clicks and drives goto, animating the destination URL in the address bar."
  />
  <meta property="og:url" content="https://z1m1n.github.io/glyphnav/sveltekit/" />
  <meta property="og:image" content="https://z1m1n.github.io/glyphnav/og.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://z1m1n.github.io/glyphnav/og.png" />
</svelte:head>

<div class="app-shell">
  <h1 data-fw="sveltekit">
    <img class="glyph-mark" src={logo} alt="" />
    <a href={rootHref} data-glyphnav="off">glyphnav</a>
    <span class="sep">/</span>
    <span class="crumb">sveltekit</span>
  </h1>

  <p class={resolving ? 'bar resolving' : 'bar'}>
    Watch the address bar. Current path: <span class="path">{path}</span>
  </p>

  <nav aria-label="demo pages">
    <a href={homeHref} class:active={isActive(homeHref)}>Home</a>
    <a href={aboutHref} class:active={isActive(aboutHref)}>About</a>
    <a href={docsHref} class:active={isActive(docsHref)}>Docs</a>
    <a href={featuresHref} class:active={isActive(featuresHref)}>Features</a>
  </nav>

  <nav class="deep" aria-label="deep links">
    deep links:
    <a href={resolve('/about/?ref=deep&page=2')}>?query</a>
    <a href={resolve('/docs/#options')}>#hash</a>
    <a href={resolve('/about/?q=glyph#results')}>?query+#hash</a>
  </nav>

  <div class="controls">
    <label data-tip={tips.charset}>
      charset
      <select bind:value={charset}>
        <option value="url">url-safe</option>
        <option value="hex">hex</option>
        <option value="matrix">matrix</option>
        <option value="symbols">symbols</option>
      </select>
    </label>
    <label data-tip={tips.speed}>
      speed
      <input
        type="range"
        min="20"
        max="1000"
        step="10"
        value={durationToSlider(duration)}
        aria-valuetext={`${duration}ms`}
        on:input={(e) => (duration = sliderToDuration(Number(e.currentTarget.value)))}
      />
      <span class="ms">{duration}ms</span>
    </label>
    <label data-tip={tips.effect}>
      effect
      <select bind:value={effect}>
        <option value="decode">decode</option>
        <option value="scramble">scramble</option>
      </select>
    </label>
    <label data-tip={tips.commit}>
      commit
      <select bind:value={commit}>
        <option value="before">navigate first</option>
        <option value="after">animate first</option>
      </select>
    </label>
    <label data-tip={tips.scope}>
      scope
      <select bind:value={scope}>
        <option value="full">full</option>
        <option value="tail">tail</option>
      </select>
    </label>
    <label class="toggle" data-tip={tips.backForward}>
      <input type="checkbox" bind:checked={backForward} />
      back/forward
    </label>
  </div>

  <slot />

  <p class="foot">
    Served under the <code>/sveltekit</code> base via SvelteKit's <code>paths.base</code>;
    <code>attachGlyphnav(goto)</code> installs a capture-phase listener so every
    <code>&lt;a&gt;</code> click animates, then hands the navigation to <code>goto</code>. The title
    link is a plain anchor (full page load back to the picker).
  </p>

  <footer class="site-footer">
    <a href="https://github.com/z1m1n/glyphnav" target="_blank" rel="noopener">GitHub</a>
    <a href="https://www.npmjs.com/package/glyphnav" target="_blank" rel="noopener">NPM</a>
    <!-- The changelog is part of the combined demo site (one level up from this
         app's base); `data-glyphnav="off"` opts it out of the link animation so
         it does a real full-page navigation out of the SPA, like the home link. -->
    <a href="{rootHref}changelog/" data-glyphnav="off">Changelog</a>
    <span class="stack">{stack}</span>
  </footer>
</div>
