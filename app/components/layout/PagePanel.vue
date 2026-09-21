<template>
  <UDashboardPanel
    :id="panelId"
    class="min-h-0"
    :aria-label="title"
    :ui="{ body: 'min-h-0 gap-0! overflow-hidden p-0!' }"
  >
    <template #header>
      <UDashboardNavbar :ui="{ left: 'flex-1' }">
        <template #left="{ sidebarCollapsed }">
          <UDashboardSidebarCollapse
            :aria-label="t(sidebarCollapsed.value ? 'sidebar.expand' : 'sidebar.collapse')"
          />
          <LayoutGlobalSearch />
        </template>
        <template #right>
          <slot name="actions" />
          <LayoutAppUserMenu />
        </template>
      </UDashboardNavbar>
      <slot name="toolbar">
        <UDashboardToolbar>
          <template #left><UBreadcrumb :items="breadcrumbItems" /></template>
        </UDashboardToolbar>
      </slot>
    </template>
    <template #body>
      <div v-if="table" class="flex min-h-0 flex-1 flex-col">
        <slot />
      </div>
      <div
        v-else
        class="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
      >
        <slot />
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
const { t } = useI18n();

const props = withDefaults(
  defineProps<{ panelId: string; title: string; table?: boolean; breadcrumbTitle?: string }>(),
  {
    table: false,
    breadcrumbTitle: undefined,
  },
);
const breadcrumbItems = useBreadcrumbItems(() => props.breadcrumbTitle);
</script>
