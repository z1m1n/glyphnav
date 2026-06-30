<script setup lang="ts">
const HOME_BODY = `Nuxt edition — file-based pages/ routing on Vue Router. A client plugin wraps <code>router.push</code>/<code>replace</code>, so every <code>&lt;NuxtLink&gt;</code> click and <code>navigateTo()</code> call decodes the URL. With <code>commit: 'navigate first'</code> the route swaps instantly and the bar animates on top.`;
</script>

<template>
  <DemoView title="Home" :body="HOME_BODY" />
</template>
