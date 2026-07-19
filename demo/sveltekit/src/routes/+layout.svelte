<script lang="ts">
  import '@glyphnav-demo/shared/styles.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { attachGlyphnav } from 'glyphnav/sveltekit';
  import type { SvelteKitGlyphnavInstance } from 'glyphnav/sveltekit';
  import type { AnimateScope, CommitTiming, GlyphEffect } from 'glyphnav/core';
  import {
    CONTROL_TOOLTIPS,
    createHistoryToggle,
    currentUrl,
    DEFAULT_TOOLBAR,
    durationToSlider,
    glyphnavOptions,
    initActiveNav,
    initCodeBlocks,
    initFwMenu,
    initTheme,
    initTooltips,
    initWordmark,
    loadToolbar,
    saveToolbar,
    sliderToDuration,
    SPEED_SLIDER,
    TOOLBAR_SELECTS,
  } from '@glyphnav-demo/shared';
  import logo from '@glyphnav-demo/shared/logo.svg';

  /** This page's own localStorage key — not shared with the other demos. */
  const STORE_KEY = 'sveltekit';
  const tips = CONTROL_TOOLTIPS;
  const stack = GLYPHNAV_STACK;
  const stackTip = GLYPHNAV_STACK_TIP;

  // `resolve` prefixes the configured `paths.base` (the non-deprecated successor
  // to the `base` string). The picker lives one level up from this app's base
  // (`…/sveltekit/` → `…/`).
  const rootHref = resolve('/').replace(/sveltekit\/?$/, '');

  // Base-prefixed nav targets, resolved once.
  const homeHref = resolve('/');
  const aboutHref = resolve('/about/');
  const docsHref = resolve('/docs/');
  const featuresHref = resolve('/features/');

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

  // Back/forward animation is opt-in; the checkbox attaches/detaches the popstate
  // listener. The instance only exists client-side, so this runs after mount.
  const toggleHistory = createHistoryToggle(() => glyph!.controller.enableHistoryAnimation());
  function applyBackForward(): void {
    if (!glyph) return;
    toggleHistory(backForward);
  }

  function persist(): void {
    saveToolbar(STORE_KEY, { charset, duration, effect, commit, scope, backForward });
  }

  function apply(): void {
    if (!glyph) return; // absent during SSR/prerender
    glyph.controller.update(
      glyphnavOptions({ charset, duration, effect, commit, scope }, (p, r) => {
        path = p;
        resolving = r;
      }),
    );
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
    // Wire the theme switcher + framework menu + styled control tooltips +
    // code-block helpers + the nav's exact-match active pill. The menu and the
    // nav sync are the two unhooked in the teardown below.
    initTheme();
    const disposeFwMenu = initFwMenu();
    initTooltips();
    initCodeBlocks();
    initWordmark();
    const disposeActiveNav = initActiveNav();
    // Flip last so the reactive blocks below first run with the restored values
    // (and never clobber the saved state with the defaults on the first render).
    mounted = true;
    return () => {
      toggleHistory(false);
      glyph?.detach();
      disposeFwMenu();
      disposeActiveNav();
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
  <main>
    <h1>
      <img class="glyph-mark" src={logo} alt="" />
      <a href={rootHref} class="wordmark" data-glyphnav="off">glyphnav</a>
      <span class="sep">/</span>
      <span class="crumb">sveltekit</span>
      <button type="button" class="fw-switch" aria-label="Switch demo" aria-expanded="false" aria-controls="fw-menu"></button>
    </h1>

    <p class={resolving ? 'bar resolving' : 'bar'}>
      Watch the address bar. Current path: <span class="path">{path}</span>
    </p>

    <nav class="tabs" aria-label="demo pages">
      <a href={homeHref}>Home</a>
      <a href={aboutHref}>About</a>
      <a href={docsHref}>Docs</a>
      <a href={featuresHref}>Features</a>
    </nav>

    <nav class="deep" aria-label="deep links">
      <span class="deep-label">deep links:</span>
      <a href={resolve('/about/?ref=deep&page=2')}>?query</a>
      <a href={resolve('/docs/#options')}>#hash</a>
      <a href={resolve('/about/?q=glyph#results')}>?query+#hash</a>
    </nav>

    <div class="controls">
      <label data-tip={tips.charset}>
        charset
        <select bind:value={charset}>
          {#each TOOLBAR_SELECTS.charset as o (o.value)}
            <option value={o.value}>{o.label}</option>
          {/each}
        </select>
      </label>
      <label data-tip={tips.speed}>
        speed
        <input
          type="range"
          min={SPEED_SLIDER.min}
          max={SPEED_SLIDER.max}
          step={SPEED_SLIDER.step}
          value={durationToSlider(duration)}
          aria-valuetext={`${duration}ms`}
          on:input={(e) => (duration = sliderToDuration(Number(e.currentTarget.value)))}
        />
        <span class="ms">{duration}ms</span>
      </label>
      <label data-tip={tips.effect}>
        effect
        <select bind:value={effect}>
          {#each TOOLBAR_SELECTS.effect as o (o.value)}
            <option value={o.value}>{o.label}</option>
          {/each}
        </select>
      </label>
      <label data-tip={tips.commit}>
        commit
        <select bind:value={commit}>
          {#each TOOLBAR_SELECTS.commit as o (o.value)}
            <option value={o.value}>{o.label}</option>
          {/each}
        </select>
      </label>
      <label data-tip={tips.scope}>
        scope
        <select bind:value={scope}>
          {#each TOOLBAR_SELECTS.scope as o (o.value)}
            <option value={o.value}>{o.label}</option>
          {/each}
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
  </main>

  <footer class="site-footer">
    <a href="https://github.com/z1m1n/glyphnav" target="_blank" rel="noopener">GitHub</a>
    <a href="https://www.npmjs.com/package/glyphnav" target="_blank" rel="noopener">NPM</a>
    <!-- The changelog is part of the combined demo site (one level up from this
         app's base); `data-glyphnav="off"` opts it out of the link animation so
         it does a real full-page navigation out of the SPA, like the home link. -->
    <a href="{rootHref}changelog/" data-glyphnav="off">Changelog</a>
    <span class="stack" data-tip={stackTip}>{stack}</span>
  </footer>
</div>
