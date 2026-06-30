<script lang="ts">
  import { DOCS_INSTALL, highlight } from '@glyphnav-demo/shared';

  const DOCS_SETUP = `<!-- src/routes/+layout.svelte -->
<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { attachGlyphnav } from 'glyphnav/sveltekit';

  // Every <a> click and goto() now animates first.
  onMount(() => attachGlyphnav(goto, { duration: 250, commit: 'before' }).detach);
${'<'}/script>`;

  const DOCS_VARIANTS = `// Leave clicks to SvelteKit, animate only explicit calls:
const { navigate, link } = attachGlyphnav(goto, { intercept: 'none' });
await navigate('/dashboard', { replace: true });

// …or opt a single link in with the action:
//   <a href="/about" use:link>About</a>`;

  const DOCS_OPTIONS = `attachGlyphnav(goto, {
  duration: 250,         // total animation time (ms), spread over all frames
  effect: 'scramble',    // 'decode' grows + resolves; 'scramble' bursts, then locks randomly
  commit: 'before',      // navigate instantly, animate on top ('after' = classic order)
  intercept: 'links',    // capture-phase <a> interception ('none' = explicit-only)
  scope: 'tail',         // animate only the part that differs from the current path
  animatePopState: true, // also animate browser back/forward (opt-in)
});`;
</script>

<div class="view docs">
  <article>
    <header class="lead">
      <h2>Docs</h2>
      Install the package — SvelteKit stays a peer dependency:
    </header>
    <figure>
      <pre><code>{@html highlight(DOCS_INSTALL)}</code></pre>
    </figure>
    <figure>
      <figcaption>
        Attach once in the root layout; every <code>&lt;a&gt;</code> then animates:
      </figcaption>
      <pre><code>{@html highlight(DOCS_SETUP)}</code></pre>
    </figure>
    <figure>
      <figcaption>Or leave clicks to SvelteKit and animate explicit calls only:</figcaption>
      <pre><code>{@html highlight(DOCS_VARIANTS)}</code></pre>
    </figure>
    <figure>
      <figcaption id="options">Every entry point accepts the same options object:</figcaption>
      <pre><code>{@html highlight(DOCS_OPTIONS)}</code></pre>
    </figure>
    <aside class="note">
      <strong>Caveat:</strong> every frame writes via <code>history.replaceState</code>,
      so back/forward stays untouched — but the browser's own URL history/autocomplete
      (and any extension listening for <code>webNavigation.onHistoryStateUpdated</code>)
      can still log each frame as a visit. There's no API to opt a <code>replaceState</code>
      call out of that; keep <code>duration</code> short, <code>maxFrames</code> low, or use
      <code>scope: 'tail'</code> to cut the frame count.
    </aside>
  </article>
</div>
