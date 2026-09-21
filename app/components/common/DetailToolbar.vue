<template>
  <UDashboardToolbar
    :ui="{
      root: 'flex-wrap',
      left: 'min-w-0 flex-1',
      right: 'ml-auto flex-wrap justify-end gap-2',
    }"
  >
    <template #left>
      <UBreadcrumb :items="breadcrumbItems" />
    </template>
    <template #right>
      <slot />
    </template>
  </UDashboardToolbar>
</template>

<script setup lang="ts">
const props = defineProps<{
  icon: string;
  parentIcon: string;
  parentTitle: string;
  parentTo: string;
  title: string;
}>();
const breadcrumbItems = useBreadcrumbItems(() => props.title);
</script>
