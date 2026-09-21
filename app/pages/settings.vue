<template>
  <LayoutPagePanel panel-id="settings" :title="t('nav.settings')">
    <template #toolbar>
      <UDashboardToolbar data-settings-toolbar :ui="{ root: 'flex-wrap', right: 'flex-wrap' }">
        <template #left><UBreadcrumb :items="breadcrumbItems" /></template>
        <template #right>
          <UNavigationMenu highlight :items="navigation" />
        </template>
      </UDashboardToolbar>
    </template>

    <NuxtPage />
  </LayoutPagePanel>
</template>

<script setup lang="ts">
const { t } = useI18n();
const { spoolmanEnabled, bambubuddyEnabled, load: loadIntegrationSettings } = useIntegrationSettings();

const breadcrumbItems = useBreadcrumbItems();
const navigation = computed(() =>
  settingsNavigation
    .filter((item) => item.to !== '/settings/spoolman' || spoolmanEnabled.value)
    .filter((item) => item.to !== '/settings/bambuddy' || bambubuddyEnabled.value)
    .map((item) => ({
      label: t(item.labelKey),
      icon: item.icon,
      to: item.to,
      exact: item.to === '/settings',
    })),
);

onMounted(() => loadIntegrationSettings(true));
</script>
