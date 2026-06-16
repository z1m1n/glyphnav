<script setup lang="ts">
import type { AnimateScope, CommitTiming, GlyphEffect } from 'glyphnav/core';
import { charsets, currentUrl, durationToSlider, sliderToDuration } from '@glyphnav-demo/shared';

// SEO / social + AI link previews. Absolute URLs so the tags stay correct in the
// statically generated output served from the GitHub Pages project subpath.
useHead({
  link: [
    { rel: 'canonical', href: 'https://z1m1n.github.io/glyphnav/nuxt/' },
    { rel: 'icon', type: 'image/svg+xml', href: 'https://z1m1n.github.io/glyphnav/favicon.svg' },
  ],
  meta: [{ name: 'theme-color', content: '#ffffff' }],
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
const baseURL = useRuntimeConfig().app.baseURL;
const rootHref = baseURL.replace(/nuxt\/$/, '') || '/';

const path = ref('/');
const resolving = ref(false);
const charset = ref('url');
const duration = ref(250);
const effect = ref<GlyphEffect>('decode');
const commit = ref<CommitTiming>('before');
const scope = ref<AnimateScope>('full');

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
}

onMounted(() => {
  path.value = currentUrl();
  apply();
});
watch([charset, duration, effect, commit, scope], apply);
</script>

<template>
  <div>
    <h1><a :href="rootHref">glyphnav</a> <span class="crumb">/ nuxt</span></h1>

    <p :class="resolving ? 'bar resolving' : 'bar'">
      Watch the address bar. Current path: <span class="path">{{ path }}</span>
    </p>

    <nav>
      <NuxtLink to="/">home</NuxtLink>
      <NuxtLink to="/about">about</NuxtLink>
      <NuxtLink to="/docs">docs</NuxtLink>
      <NuxtLink to="/features">features</NuxtLink>
    </nav>

    <p class="deep">
      deep links:
      <NuxtLink to="/about?ref=deep&page=2">?query</NuxtLink>
      <NuxtLink to="/docs#options">#hash</NuxtLink>
      <NuxtLink to="/about?q=glyph#results">?query+#hash</NuxtLink>
    </p>

    <div class="controls">
      <label>
        charset
        <select v-model="charset">
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
          :min="20"
          :max="1000"
          :step="10"
          :value="durationToSlider(duration)"
          @input="duration = sliderToDuration(Number(($event.target as HTMLInputElement).value))"
        />
        <span class="ms">{{ duration }}ms</span>
      </label>
      <label>
        effect
        <select v-model="effect">
          <option value="decode">decode</option>
          <option value="scramble">scramble</option>
        </select>
      </label>
      <label>
        commit
        <select v-model="commit">
          <option value="before">navigate first</option>
          <option value="after">animate first</option>
        </select>
      </label>
      <label>
        scope
        <select v-model="scope">
          <option value="full">full</option>
          <option value="tail">tail</option>
        </select>
      </label>
    </div>

    <NuxtPage />

    <p class="foot">
      Served under the <code>/nuxt</code> base via Nuxt's <code>app.baseURL</code>; the Nuxt plugin
      wraps <code>router.push</code> so every <code>&lt;NuxtLink&gt;</code> and
      <code>navigateTo()</code> animates. The title link is a plain anchor (full page load back to
      the picker).
    </p>

    <footer class="site-footer">
      <a href="https://github.com/z1m1n/glyphnav" target="_blank" rel="noopener">GitHub</a>
      <a href="https://www.npmjs.com/package/glyphnav" target="_blank" rel="noopener"
        >npm package</a
      >
    </footer>
  </div>
</template>
