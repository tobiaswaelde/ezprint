<template>
  <UDashboardSidebar id="navigation" collapsible resizable class="bg-elevated/25">
    <template #header="{ collapsed }">
      <NuxtLink to="/" :aria-label="t('app.name')" class="font-display text-xl font-bold">
        <span class="text-primary">ez</span
        ><span v-if="!collapsed" class="tracking-tight text-highlighted">Print</span>
      </NuxtLink>
    </template>

    <template #default="{ collapsed }">
      <UNavigationMenu orientation="vertical" :collapsed="collapsed" tooltip highlight :items="navigation" />
    </template>

    <template #footer="{ collapsed }">
      <div
        data-sidebar-footer
        class="flex w-full flex-col gap-1"
        :class="collapsed ? 'items-center' : 'items-start'"
      >
        <UButton
          data-sidebar-footer-item
          to="https://github.com/tobiaswaelde/ezprint"
          target="_blank"
          color="neutral"
          variant="ghost"
          icon="i-simple-icons-github"
          :square="collapsed"
          :label="collapsed ? undefined : t('sidebar.githubLabel')"
          :class="collapsed ? undefined : 'w-full justify-start'"
          :aria-label="t('sidebar.github')"
          :title="t('sidebar.github')"
        />
        <UButton
          data-sidebar-footer-item
          to="https://tobiaswaelde.github.io/ezprint/"
          target="_blank"
          color="neutral"
          variant="ghost"
          icon="i-tabler-book-2"
          :square="collapsed"
          :label="collapsed ? undefined : t('sidebar.docsLabel')"
          :class="collapsed ? undefined : 'w-full justify-start'"
          :aria-label="t('sidebar.docs')"
          :title="t('sidebar.docs')"
        />
        <button
          v-if="!collapsed"
          data-sidebar-footer-item
          type="button"
          class="flex w-full items-center justify-center gap-1.5 rounded-md px-1.5 py-1 font-mono text-xs text-muted transition-colors hover:bg-elevated hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
          :aria-label="t('changelog.open')"
          @click="changelogOpen = true"
        >
          v{{ appVersion }}
          <UBadge v-if="updateAvailable" color="neutral" variant="subtle" size="sm">
            <span data-update-indicator class="size-1.5 rounded-full bg-success" aria-hidden="true" />
            {{ t('changelog.update') }}
          </UBadge>
        </button>
      </div>
    </template>
  </UDashboardSidebar>
</template>

<script setup lang="ts">
const { t } = useI18n();
const appVersion = useRuntimeConfig().public.appVersion;
const changelogOpen = useState('changelog-open', () => false);
const { load: loadVersion, updateAvailable } = useVersionCheck();
const { enabled: spoolManagementEnabled } = useSpoolManagement();
const { loaded: featuresLoaded, printSeriesEnabled } = useFeatures();
const navigationItem = (path: string) => {
  const item = mainNavigation.find((item) => item.to === path)!;
  return { label: t(item.labelKey), icon: item.icon, to: item.to };
};
const navigation = computed(() => [
  { label: t('nav.sections.workspace'), type: 'label' as const },
  navigationItem('/'),
  navigationItem('/prints'),
  ...(featuresLoaded.value && printSeriesEnabled.value ? [navigationItem('/series')] : []),
  navigationItem('/customers'),
  { label: t('nav.sections.masterData'), type: 'label' as const },
  navigationItem('/manufacturers'),
  navigationItem('/printers'),
  navigationItem('/components'),
  navigationItem('/filaments'),
  ...(spoolManagementEnabled.value ? [navigationItem('/spools')] : []),
  { label: t('nav.sections.system'), type: 'label' as const },
  navigationItem('/settings'),
]);

onMounted(loadVersion);
</script>
