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
  animatePopState: true, // also animate browser back/forward (opt-in)
});`;
</script>

<template>
  <div class="view docs">
    <article>
      <header class="lead">
        <h2>Docs</h2>
        Install the package — Nuxt stays a peer dependency:
      </header>
      <figure>
        <pre><code v-html="highlight(DOCS_INSTALL)" /></pre>
      </figure>
      <figure>
        <figcaption>
          Register one client plugin; every <code>&lt;NuxtLink&gt;</code> then animates:
        </figcaption>
        <pre><code v-html="highlight(DOCS_SETUP)" /></pre>
      </figure>
      <figure>
        <figcaption>
          Works with either history mode, and with or without global interception:
        </figcaption>
        <pre><code v-html="highlight(DOCS_VARIANTS)" /></pre>
      </figure>
      <figure>
        <figcaption id="options">Every entry point accepts the same options object:</figcaption>
        <pre><code v-html="highlight(DOCS_OPTIONS)" /></pre>
      </figure>
      <aside class="note">
        <strong>Caveat:</strong> every frame writes via <code>history.replaceState</code>,
        so back/forward stays untouched — but the browser's own URL history/autocomplete
        (and any extension listening for <code>webNavigation.onHistoryStateUpdated</code>)
        can still log each frame as a visit. There's no API to opt a
        <code>replaceState</code> call out of that; keep <code>duration</code> short,
        <code>maxFrames</code> low, or use <code>scope: 'tail'</code> to cut the frame count.
      </aside>
    </article>
  </div>
</template>
