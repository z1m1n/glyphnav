<script setup lang="ts">
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
  THEME_INIT_SCRIPT,
} from '@glyphnav-demo/shared';
import logo from '@glyphnav-demo/shared/logo.svg';

// SEO / social + AI link previews. Absolute URLs so the tags stay correct in the
// statically generated output served from the GitHub Pages project subpath.
useHead({
  htmlAttrs: { lang: 'en', 'data-fw': 'nuxt' },
  link: [
    { rel: 'canonical', href: 'https://z1m1n.github.io/glyphnav/nuxt/' },
    { rel: 'icon', type: 'image/svg+xml', href: 'https://z1m1n.github.io/glyphnav/favicon.svg' },
  ],
  meta: [{ name: 'theme-color', content: '#ffffff' }],
  // Apply the saved/OS theme before first paint (no flash). `tagPriority` puts it
  // ahead of other head tags so it runs as early as possible.
  script: [{ innerHTML: THEME_INIT_SCRIPT, tagPosition: 'head', tagPriority: 'critical' }],
});
useSeoMeta({
  title: 'glyphnav — nuxt',
  description:
    'glyphnav for Nuxt: a client plugin wraps router.push / navigateTo so every NuxtLink animates the destination URL in the address bar. Live, interactive demo.',
  ogType: 'website',
  ogSiteName: 'glyphnav',
  ogTitle: 'glyphnav — Nuxt demo',
  ogDescription:
    'A client plugin wraps router.push / navigateTo so every NuxtLink animates the destination URL in the address bar.',
  ogUrl: 'https://z1m1n.github.io/glyphnav/nuxt/',
  ogImage: 'https://z1m1n.github.io/glyphnav/og.png',
  twitterCard: 'summary_large_image',
  twitterImage: 'https://z1m1n.github.io/glyphnav/og.png',
});

// The picker lives one level up from this app's base (`/glyphnav/nuxt/` →
// `/glyphnav/`). A plain anchor does the full reload back to it.
const config = useRuntimeConfig();
const baseURL = config.app.baseURL;
const rootHref = baseURL.replace(/nuxt\/$/, '') || '/';
const stack = config.public.stack;
const stackTip = config.public.stackTip;

/** This page's own localStorage key — not shared with the other demos. */
const STORE_KEY = 'nuxt';
const tips = CONTROL_TOOLTIPS;

// A tab is active only on an exact match (full path incl. query/hash), instead
// of <NuxtLink>'s built-in active class which ignores the query — so a deep link
// like /about?ref=deep never lights up the plain "About" tab.
const route = useRoute();
const isActive = (to: string): boolean => route.fullPath === to;

// Refs start at the defaults so the prerendered markup is stable; the saved
// toolbar is restored on the client in onMounted (after hydration).
const path = ref('/');
const resolving = ref(false);
const charset = ref('url');
const duration = ref(250);
const effect = ref<GlyphEffect>('decode');
const commit = ref<CommitTiming>('before');
const scope = ref<AnimateScope>('full');
const backForward = ref(true);

// Back/forward animation is opt-in; the checkbox attaches/detaches the popstate
// listener. The instance only exists client-side, so this runs from onMounted.
let stopPopState: (() => void) | null = null;
function applyBackForward(): void {
  const instance = useNuxtApp().$glyphnav;
  if (!instance) return;
  if (backForward.value && !stopPopState) {
    stopPopState = instance.controller.enableHistoryAnimation();
  } else if (!backForward.value && stopPopState) {
    stopPopState();
    stopPopState = null;
  }
}

function persist(): void {
  saveToolbar(STORE_KEY, {
    charset: charset.value,
    duration: duration.value,
    effect: effect.value,
    commit: commit.value,
    scope: scope.value,
    backForward: backForward.value,
  });
}

function apply(): void {
  const instance = useNuxtApp().$glyphnav;
  if (!instance) return; // absent during SSR/prerender
  instance.controller.update({
    charset: charsets[charset.value],
    duration: duration.value,
    effect: effect.value,
    commit: commit.value,
    scope: scope.value,
    hooks: {
      onFrame: (f) => {
        path.value = f.path;
        resolving.value = f.phase === 'resolve';
      },
      onComplete: () => {
        resolving.value = false;
        path.value = currentUrl();
      },
    },
  });
  persist();
}

onMounted(() => {
  const saved = loadToolbar(STORE_KEY, DEFAULT_TOOLBAR);
  charset.value = saved.charset;
  duration.value = saved.duration;
  effect.value = saved.effect;
  commit.value = saved.commit;
  scope.value = saved.scope;
  backForward.value = saved.backForward;
  path.value = currentUrl();
  apply();
  applyBackForward();
  // Wire the theme switcher + styled control tooltips + code-block helpers.
  initTheme();
  initTooltips();
  initCodeBlocks();
});
watch([charset, duration, effect, commit, scope], apply);
watch(backForward, () => {
  applyBackForward();
  persist();
});
</script>

<template>
  <div class="app-shell">
    <main>
      <h1>
        <img class="glyph-mark" :src="logo" alt="" />
        <a :href="rootHref">glyphnav</a>
        <span class="sep">/</span>
        <span class="crumb">nuxt</span>
      </h1>

      <p :class="resolving ? 'bar resolving' : 'bar'">
        Watch the address bar. Current path: <span class="path">{{ path }}</span>
      </p>

      <nav aria-label="demo pages">
        <NuxtLink to="/" :class="{ active: isActive('/') }">Home</NuxtLink>
        <NuxtLink to="/about" :class="{ active: isActive('/about') }">About</NuxtLink>
        <NuxtLink to="/docs" :class="{ active: isActive('/docs') }">Docs</NuxtLink>
        <NuxtLink to="/features" :class="{ active: isActive('/features') }">Features</NuxtLink>
      </nav>

      <nav class="deep" aria-label="deep links">
        deep links:
        <NuxtLink to="/about?ref=deep&page=2">?query</NuxtLink>
        <NuxtLink to="/docs#options">#hash</NuxtLink>
        <NuxtLink to="/about?q=glyph#results">?query+#hash</NuxtLink>
      </nav>

      <div class="controls">
        <label :data-tip="tips.charset">
          charset
          <select v-model="charset">
            <option value="url">url-safe</option>
            <option value="hex">hex</option>
            <option value="matrix">matrix</option>
            <option value="symbols">symbols</option>
          </select>
        </label>
        <label :data-tip="tips.speed">
          speed
          <input
            type="range"
            :min="20"
            :max="1000"
            :step="10"
            :value="durationToSlider(duration)"
            :aria-valuetext="`${duration}ms`"
            @input="duration = sliderToDuration(Number(($event.target as HTMLInputElement).value))"
          />
          <span class="ms">{{ duration }}ms</span>
        </label>
        <label :data-tip="tips.effect">
          effect
          <select v-model="effect">
            <option value="decode">decode</option>
            <option value="scramble">scramble</option>
          </select>
        </label>
        <label :data-tip="tips.commit">
          commit
          <select v-model="commit">
            <option value="before">navigate first</option>
            <option value="after">animate first</option>
          </select>
        </label>
        <label :data-tip="tips.scope">
          scope
          <select v-model="scope">
            <option value="full">full</option>
            <option value="tail">tail</option>
          </select>
        </label>
        <label class="toggle" :data-tip="tips.backForward">
          <input v-model="backForward" type="checkbox" />
          back/forward
        </label>
      </div>

      <NuxtPage />

      <p class="foot">
        Served under the <code>/nuxt</code> base via Nuxt's <code>app.baseURL</code>; the Nuxt
        plugin wraps <code>router.push</code> so every <code>&lt;NuxtLink&gt;</code> and
        <code>navigateTo()</code> animates. The title link is a plain anchor (full page load back to
        the picker).
      </p>
    </main>

    <footer class="site-footer">
      <a href="https://github.com/z1m1n/glyphnav" target="_blank" rel="noopener">GitHub</a>
      <a href="https://www.npmjs.com/package/glyphnav" target="_blank" rel="noopener">NPM</a>
      <!-- The changelog lives in the combined demo site, one level up from this
           app's base — a plain anchor so it does a full navigation. -->
      <a :href="`${rootHref}changelog/`">Changelog</a>
      <span class="stack" :data-tip="stackTip">{{ stack }}</span>
    </footer>
  </div>
</template>
