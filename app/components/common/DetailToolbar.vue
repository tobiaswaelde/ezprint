<template>
  <UDashboardToolbar
    :ui="{
      root: 'flex-wrap items-center gap-3',
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
const { t } = useI18n();

const breadcrumbItems = computed(() => [
  { icon: 'i-tabler-home', label: t('nav.dashboard'), to: '/' },
  { icon: props.parentIcon, label: props.parentTitle, to: props.parentTo },
  { icon: props.icon, label: props.title },
]);
</script>
