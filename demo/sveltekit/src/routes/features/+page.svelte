<script lang="ts">
  import DemoView from '$lib/DemoView.svelte';
</script>

<DemoView
  title="Features"
  body="Pass <code>intercept: 'none'</code> to leave clicks to SvelteKit and animate only the instance's <code>navigate()</code> — or links you opt in with the <code>use:link</code> action. <code>animatePopState</code> adds browser back/forward decoding. Because <code>goto</code> resolves a tick before the bar settles, the adapter waits for the URL to land, so <code>commit: 'navigate first'</code> decodes the real destination."
/>
