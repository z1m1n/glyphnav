<script setup lang="ts">
import { DOCS_INSTALL, highlight } from '@glyphnav-demo/shared';

const DOCS_SETUP = `// plugins/glyphnav.client.ts
import { installGlyphnav } from 'glyphnav/nuxt';

export default defineNuxtPlugin((nuxtApp) => {
  installGlyphnav(
    { $router: useRouter(), provide: (n, v) => nuxtApp.provide(n, v) },
    { duration: 250, commit: 'before' },
  );
});`;

const DOCS_VARIANTS = `// Hash-mode router? Tell the adapter so the animated
// target matches the address bar:
installGlyphnav(app, { historyMode: 'hash' })

// Leave the router untouched, animate only explicit calls:
installGlyphnav(app, { intercept: 'none' })
// then: useNuxtApp().$glyphnav.navigate('/dashboard')`;

const DOCS_OPTIONS = `installGlyphnav(app, {
  duration: 250,        // total animation time (ms), spread over all frames
  effect: 'scramble',   // 'decode' grows + resolves; 'scramble' bursts, then locks randomly
  commit: 'before',     // navigate instantly, animate on top ('after' = classic order)
  intercept: 'router',  // wrap router.push/replace ('none' = explicit-only)
  historyMode: 'history', // or 'hash' for createWebHashHistory
  scope: 'tail',        // animate only the part that differs from the current path
});`;
</script>

<template>
  <div class="view docs">
    <h2>docs</h2>
    <p>Install the package — Nuxt stays a peer dependency:</p>
    <pre><code v-html="highlight(DOCS_INSTALL)" /></pre>
    <p>Register one client plugin; every <code>&lt;NuxtLink&gt;</code> then animates:</p>
    <pre><code v-html="highlight(DOCS_SETUP)" /></pre>
    <p>Works with either history mode, and with or without global interception:</p>
    <pre><code v-html="highlight(DOCS_VARIANTS)" /></pre>
    <p id="options">Every entry point accepts the same options object:</p>
    <pre><code v-html="highlight(DOCS_OPTIONS)" /></pre>
  </div>
</template>
