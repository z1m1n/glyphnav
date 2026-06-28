<script lang="ts">
  import DemoView from '$lib/DemoView.svelte';
</script>

<DemoView
  title="About"
  body={`Because the adapter intercepts <a> clicks globally, goto() and the instance's navigate() animate too — no per-link wiring. Deep links with ?query and #hash animate just the same; they are part of the path. Opt a link out with data-glyphnav="off".`}
/>
