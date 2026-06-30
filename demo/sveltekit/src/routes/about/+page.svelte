<script lang="ts">
  import DemoView from '$lib/DemoView.svelte';
</script>

<DemoView
  title="About"
  body={`Because the adapter intercepts <code>&lt;a&gt;</code> clicks globally, <code>goto()</code> and the instance's <code>navigate()</code> animate too — no per-link wiring. Deep links with <code>?query</code> and <code>#hash</code> animate just the same; they are part of the path. Opt a link out with <code>data-glyphnav="off"</code>. Heads up: each frame writes via <code>history.replaceState</code>, so back/forward stays untouched, but your browser's own URL history/autocomplete can still log every frame — see the docs for how to keep that in check.`}
/>
