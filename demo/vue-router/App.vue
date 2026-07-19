<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useGlyphnav } from 'glyphnav/vue-router';
import {
  CONTROL_TOOLTIPS,
  createHistoryToggle,
  currentUrl,
  DEFAULT_TOOLBAR,
  durationToSlider,
  glyphnavOptions,
  loadToolbar,
  saveToolbar,
  sliderToDuration,
  SPEED_SLIDER,
  TOOLBAR_SELECTS,
} from '../shared/content';
import { initActiveNav } from '../shared/active-nav';
import { initCodeBlocks } from '../shared/code-blocks';
import { initFwMenu } from '../shared/fw-menu';
import { initTheme } from '../shared/theme';
import { initTooltips } from '../shared/tooltip';
import { initWordmark } from '../shared/wordmark';
import logo from '../shared/logo.svg';

const controller = useGlyphnav();

// '/' in dev, '/glyphnav/' on the deployed project page.
const base = import.meta.env.BASE_URL;

/** This page's own localStorage key — not shared with the other demos. */
const STORE_KEY = 'vue-router';
const tips = CONTROL_TOOLTIPS;
const selects = TOOLBAR_SELECTS;
const slider = SPEED_SLIDER;

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
  controller.update(
    glyphnavOptions(
      {
        charset: charset.value,
        duration: duration.value,
        effect: effect.value,
        commit: commit.value,
        scope: scope.value,
      },
      (p, r) => {
        displayPath.value = p;
        resolving.value = r;
      },
    ),
  );
  persist();
}
apply();
watch([charset, duration, effect, commit, scope], apply);

// Back/forward animation: attach/detach the popstate listener as the checkbox
// (restored from storage) toggles.
const toggleHistory = createHistoryToggle(() => controller.enableHistoryAnimation());
toggleHistory(backForward.value);
watch(backForward, (on) => {
  toggleHistory(on);
  persist();
});

// Wire the theme switcher, framework menu, styled control tooltips, code-block
// helpers and the nav's exact-match active pill once. The menu and the nav
// sync are the two with something to unhook.
let disposeFwMenu: (() => void) | undefined;
let disposeActiveNav: (() => void) | undefined;
onMounted(() => {
  initTheme();
  disposeFwMenu = initFwMenu();
  initTooltips();
  initCodeBlocks();
  initWordmark();
  disposeActiveNav = initActiveNav();
});
onUnmounted(() => {
  disposeFwMenu?.();
  disposeActiveNav?.();
});
</script>

<template>
  <h1>
    <img class="glyph-mark" :src="logo" alt="" />
    <a :href="base" class="wordmark">glyphnav</a>
    <span class="sep">/</span>
    <span class="crumb">vue-router</span>
    <button
      type="button"
      class="fw-switch"
      aria-label="Switch demo"
      aria-expanded="false"
      aria-controls="fw-menu"
    ></button>
  </h1>

  <p class="bar" :class="{ resolving }">
    Watch the address bar. Current path: <span class="path">{{ displayPath }}</span>
  </p>

  <nav class="tabs" aria-label="demo pages">
    <router-link to="/">Home</router-link>
    <router-link to="/about">About</router-link>
    <router-link to="/features">Features</router-link>
    <router-link to="/docs">Docs</router-link>
  </nav>

  <nav class="deep" aria-label="deep links">
    <span class="deep-label">deep links:</span>
    <router-link to="/about?ref=deep&page=2">?query</router-link>
    <router-link to="/docs#options">#hash</router-link>
    <router-link to="/about?q=glyph#results">?query+#hash</router-link>
  </nav>

  <div class="controls">
    <label :data-tip="tips.charset"
      >charset
      <select v-model="charset">
        <option v-for="o in selects.charset" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>
    <label :data-tip="tips.speed"
      >speed
      <input
        type="range"
        :min="slider.min"
        :max="slider.max"
        :step="slider.step"
        :value="durationToSlider(duration)"
        :aria-valuetext="`${duration}ms`"
        @input="duration = sliderToDuration(Number(($event.target as HTMLInputElement).value))"
      />
      <span class="ms">{{ duration }}ms</span>
    </label>
    <label :data-tip="tips.effect"
      >effect
      <select v-model="effect">
        <option v-for="o in selects.effect" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>
    <label :data-tip="tips.commit"
      >commit
      <select v-model="commit">
        <option v-for="o in selects.commit" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>
    <label :data-tip="tips.scope"
      >scope
      <select v-model="scope">
        <option v-for="o in selects.scope" :key="o.value" :value="o.value">{{ o.label }}</option>
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
