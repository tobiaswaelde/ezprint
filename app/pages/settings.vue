<template>
  <LayoutPagePanel panel-id="settings" :title="t('nav.settings')">
    <template #toolbar>
      <UDashboardToolbar data-settings-toolbar>
        <UNavigationMenu highlight class="-mx-1 flex-1" :items="navigation" :ui="{ item: 'py-0' }" />
      </UDashboardToolbar>
    </template>

    <NuxtPage />
  </LayoutPagePanel>
</template>

<script setup lang="ts">
const { t } = useI18n();
const { spoolmanEnabled, bambubuddyEnabled, load: loadIntegrationSettings } = useIntegrationSettings();

const navigation = computed(() => [
  [
    {
      label: t('settings.general'),
      icon: 'i-tabler-adjustments-horizontal',
      to: '/settings',
      exact: true,
    },
    {
      label: t('settings.calculation'),
      icon: 'i-tabler-calculator',
      to: '/settings/calculation',
    },
    {
      label: t('settings.features'),
      icon: 'i-tabler-toggle-right',
      to: '/settings/features',
    },
    {
      label: t('settings.backup'),
      icon: 'i-tabler-database-export',
      to: '/settings/backup',
    },
    ...(spoolmanEnabled.value
      ? [
          {
            label: t('integration.spoolmanTab'),
            icon: 'i-tabler-packages',
            to: '/settings/spoolman',
          },
        ]
      : []),
    ...(bambubuddyEnabled.value
      ? [
          {
            label: t('integration.bambuTab'),
            icon: 'i-tabler-printer',
            to: '/settings/bambuddy',
          },
        ]
      : []),
  ],
]);

onMounted(() => loadIntegrationSettings(true));
</script>
