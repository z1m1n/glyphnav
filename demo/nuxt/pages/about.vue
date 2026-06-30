<template>
  <DemoView
    title="About"
    body="Because the plugin wraps the router, <code>navigateTo()</code> animates too — no per-link wiring. Deep links with <code>?query</code> and <code>#hash</code> animate just the same; they are part of the path. Hash-mode routers work as well via <code>historyMode: 'hash'</code>. Heads up: each frame writes via <code>history.replaceState</code>, so back/forward stays untouched, but your browser's own URL history/autocomplete can still log every frame — see the docs for how to keep that in check."
  />
</template>
