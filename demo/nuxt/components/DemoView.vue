<script setup lang="ts">
defineProps<{ title: string; body: string }>();
</script>

<template>
  <div class="view">
    <h2>{{ title }}</h2>
    <p>{{ body }}</p>
  </div>
</template>
