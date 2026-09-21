<template>
  <CommonEntitySelect v-model="model" resource="filaments" />
</template>
<script setup lang="ts">
const model = defineModel<string>({ required: true });
</script>
