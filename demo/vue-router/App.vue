<script setup lang="ts">
import { ref } from 'vue';
import { useGlyphnav } from 'glyphnav/vue-router';
import {
  HEX,
  MATRIX,
  SYMBOLS,
  URL_SAFE,
  type AnimateScope,
  type CommitTiming,
  type FrameInfo,
  type GlyphEffect,
} from 'glyphnav/core';

const controller = useGlyphnav();

const currentUrl = () => location.pathname + location.search + location.hash;

const displayPath = ref(currentUrl());
const resolving = ref(false);
const duration = ref(250);

const charsets: Record<string, string> = { url: URL_SAFE, hex: HEX, matrix: MATRIX, symbols: SYMBOLS };
const state = {
  charset: URL_SAFE,
  duration: 250,
  effect: 'decode' as GlyphEffect,
  commit: 'before' as CommitTiming,
  scope: 'full' as AnimateScope,
};

function apply(): void {
  controller.update({
    ...state,
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
}
apply();

const onCharset = (e: Event) => {
  state.charset = charsets[(e.target as HTMLSelectElement).value];
  apply();
};
const onSpeed = (e: Event) => {
  // Slider is inverted: full right = 20 ms (fastest whole animation).
  state.duration = 1020 - Number((e.target as HTMLInputElement).value);
  duration.value = state.duration;
  apply();
};
const onEffect = (e: Event) => {
  state.effect = (e.target as HTMLSelectElement).value as GlyphEffect;
  apply();
};
const onCommit = (e: Event) => {
  state.commit = (e.target as HTMLSelectElement).value as CommitTiming;
  apply();
};
const onScope = (e: Event) => {
  state.scope = (e.target as HTMLSelectElement).value as AnimateScope;
  apply();
};
</script>

<template>
  <h1><a href="/">glyphnav</a> <span class="crumb">/ vue-router</span></h1>

  <p class="bar" :class="{ resolving }">
    Watch the address bar. Current path: <span class="path">{{ displayPath }}</span>
  </p>

  <nav>
    <router-link to="/">home</router-link>
    <router-link to="/about">about</router-link>
    <router-link to="/features">features</router-link>
    <router-link to="/docs">docs</router-link>
  </nav>

  <p class="deep">
    deep links:
    <router-link to="/about?ref=deep&page=2">?query</router-link>
    <router-link to="/docs#options">#hash</router-link>
    <router-link to="/about?q=glyph#results">?query+#hash</router-link>
  </p>

  <div class="controls">
    <label>charset
      <select @change="onCharset">
        <option value="url">url-safe</option>
        <option value="hex">hex</option>
        <option value="matrix">matrix</option>
        <option value="symbols">symbols</option>
      </select>
    </label>
    <label>speed
      <input type="range" min="20" max="1000" step="10" :value="1020 - duration" @input="onSpeed" />
      <span class="ms">{{ duration }}ms</span>
    </label>
    <label>effect
      <select @change="onEffect">
        <option value="decode">decode</option>
        <option value="scramble">scramble</option>
      </select>
    </label>
    <label>commit
      <select @change="onCommit">
        <option value="before">navigate first</option>
        <option value="after">animate first</option>
      </select>
    </label>
    <label>scope
      <select @change="onScope">
        <option value="full">full</option>
        <option value="tail">tail</option>
      </select>
    </label>
  </div>

  <router-view />

  <p class="foot">
    Every <code>&lt;router-link&gt;</code> goes through the wrapped <code>router.push</code>. The
    title link is a plain anchor, so it leaves the SPA with a normal page load.
  </p>
</template>
