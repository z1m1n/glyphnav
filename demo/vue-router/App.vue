<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useGlyphnav } from 'glyphnav/vue-router';
import type { FrameInfo } from 'glyphnav/core';
import {
  charsets,
  CONTROL_TOOLTIPS,
  currentUrl,
  DEFAULT_TOOLBAR,
  durationToSlider,
  loadToolbar,
  saveToolbar,
  sliderToDuration,
} from '../shared/content';
import { initCodeBlocks } from '../shared/code-blocks';
import { initTheme } from '../shared/theme';
import { initTooltips } from '../shared/tooltip';
import logo from '../shared/logo.svg';

const controller = useGlyphnav();

// A tab is active only on an exact match (full path incl. query/hash), instead
// of <router-link>'s built-in active class which ignores the query — so a deep
// link like /about?ref=deep never lights up the plain "About" tab.
const route = useRoute();
const isActive = (to: string): boolean => route.fullPath === to;

// '/' in dev, '/glyphnav/' on the deployed project page.
const base = import.meta.env.BASE_URL;

/** This page's own localStorage key — not shared with the other demos. */
const STORE_KEY = 'vue-router';
const tips = CONTROL_TOOLTIPS;

const s = loadToolbar(STORE_KEY, DEFAULT_TOOLBAR);
const displayPath = ref(currentUrl());
const resolving = ref(false);
const charset = ref(s.charset);
const duration = ref(s.duration);
const effect = ref(s.effect);
const commit = ref(s.commit);
const scope = ref(s.scope);
const backForward = ref(s.backForward);

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
  controller.update({
    charset: charsets[charset.value],
    duration: duration.value,
    effect: effect.value,
    commit: commit.value,
    scope: scope.value,
    hooks: {
      onFrame: (f: FrameInfo) => {
        displayPath.value = f.path;
        resolving.value = f.phase === 'resolve';
      },
      onComplete: () => {
        resolving.value = false;
        displayPath.value = currentUrl();
      },
    },
  });
  persist();
}
apply();
watch([charset, duration, effect, commit, scope], apply);

// Back/forward animation: attach/detach the popstate listener as the checkbox
// (restored from storage) toggles.
let stopPopState: (() => void) | null = backForward.value
  ? controller.enableHistoryAnimation()
  : null;
watch(backForward, (on) => {
  if (on && !stopPopState) stopPopState = controller.enableHistoryAnimation();
  else if (!on && stopPopState) {
    stopPopState();
    stopPopState = null;
  }
  persist();
});

// Wire the theme switcher, styled control tooltips and code-block helpers once.
onMounted(() => {
  initTheme();
  initTooltips();
  initCodeBlocks();
});
</script>

<template>
  <h1>
    <img class="glyph-mark" :src="logo" alt="" />
    <a :href="base">glyphnav</a>
    <span class="sep">/</span>
    <span class="crumb">vue-router</span>
  </h1>

  <p class="bar" :class="{ resolving }">
    Watch the address bar. Current path: <span class="path">{{ displayPath }}</span>
  </p>

  <nav aria-label="demo pages">
    <router-link to="/" :class="{ active: isActive('/') }">Home</router-link>
    <router-link to="/about" :class="{ active: isActive('/about') }">About</router-link>
    <router-link to="/features" :class="{ active: isActive('/features') }">Features</router-link>
    <router-link to="/docs" :class="{ active: isActive('/docs') }">Docs</router-link>
  </nav>

  <nav class="deep" aria-label="deep links">
    deep links:
    <router-link to="/about?ref=deep&page=2">?query</router-link>
    <router-link to="/docs#options">#hash</router-link>
    <router-link to="/about?q=glyph#results">?query+#hash</router-link>
  </nav>

  <div class="controls">
    <label :data-tip="tips.charset"
      >charset
      <select v-model="charset">
        <option value="url">url-safe</option>
        <option value="hex">hex</option>
        <option value="matrix">matrix</option>
        <option value="symbols">symbols</option>
      </select>
    </label>
    <label :data-tip="tips.speed"
      >speed
      <input
        type="range"
        min="20"
        max="1000"
        step="10"
        :value="durationToSlider(duration)"
        :aria-valuetext="`${duration}ms`"
        @input="duration = sliderToDuration(Number(($event.target as HTMLInputElement).value))"
      />
      <span class="ms">{{ duration }}ms</span>
    </label>
    <label :data-tip="tips.effect"
      >effect
      <select v-model="effect">
        <option value="decode">decode</option>
        <option value="scramble">scramble</option>
      </select>
    </label>
    <label :data-tip="tips.commit"
      >commit
      <select v-model="commit">
        <option value="before">navigate first</option>
        <option value="after">animate first</option>
      </select>
    </label>
    <label :data-tip="tips.scope"
      >scope
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

  <router-view />

  <p class="foot">
    Every <code>&lt;router-link&gt;</code> goes through the wrapped <code>router.push</code>. The
    title link is a plain anchor, so it leaves the SPA with a normal page load.
  </p>
</template>
