<script lang="ts">
  import DemoView from '$lib/DemoView.svelte';
</script>

<DemoView
  title="Home"
  body={`SvelteKit edition — filesystem routing on Svelte's official framework. <code>attachGlyphnav(goto)</code> installs a capture-phase <code>&lt;a&gt;</code> click listener, so every link decodes the URL and hands the navigation to <code>goto</code>. With <code>commit: 'navigate first'</code> the route swaps instantly and the bar animates on top.`}
/>
