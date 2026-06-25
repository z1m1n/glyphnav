<script lang="ts">
  import DemoView from '$lib/DemoView.svelte';
</script>

<DemoView
  title="features"
  body="Pass intercept: 'none' to leave clicks to SvelteKit and animate only the instance's navigate() — or links you opt in with the use:link action. animatePopState adds browser back/forward decoding. Because goto resolves a tick before the bar settles, the adapter waits for the URL to land, so commit: 'navigate first' decodes the real destination."
/>
