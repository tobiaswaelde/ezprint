<template>
  <UDashboardToolbar
    data-table-toolbar
    :ui="{
      root: 'flex-wrap',
      left: 'shrink-0',
      right: 'ml-auto min-w-0 basis-full flex-wrap justify-end gap-2 xl:basis-auto',
    }"
  >
    <template #left>
      <UBreadcrumb :items="breadcrumbItems" />
    </template>
    <template #right>
      <UInput
        v-model="search"
        class="w-full min-w-0 sm:w-auto sm:flex-1 xl:w-64 xl:flex-none"
        type="search"
        icon="i-tabler-search"
        :aria-label="t('common.search')"
        :placeholder="t('common.search')"
      />
      <div class="flex max-w-full flex-wrap items-center justify-end gap-2">
        <slot name="filters" />
        <slot name="options" />
        <slot name="create" />
      </div>
    </template>
  </UDashboardToolbar>
</template>

<script setup lang="ts">
defineProps<{ icon: string; title: string }>();
const search = defineModel<string>('search', { required: true });
const { t } = useI18n();
const breadcrumbItems = useBreadcrumbItems();
</script>
