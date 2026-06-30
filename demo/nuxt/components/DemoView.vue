<script setup lang="ts">
defineProps<{ title: string; body: string }>();
</script>

<template>
  <div class="view">
    <article>
      <header class="lead">
        <h2>{{ title }}</h2>
        <span v-html="body" />
      </header>
    </article>
  </div>
</template>
