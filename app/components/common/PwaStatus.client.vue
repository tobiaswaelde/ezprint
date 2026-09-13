<template>
  <div
    v-if="status"
    data-pwa-status
    class="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-4 sm:max-w-md"
  >
    <UAlert
      class="pointer-events-auto w-full shadow-lg"
      :color="status.color"
      :icon="status.icon"
      :title="t(status.title)"
      :description="t(status.description)"
      variant="solid"
    >
      <template #actions>
        <UButton
          size="xs"
          color="neutral"
          variant="solid"
          :label="t(status.primaryLabel)"
          @click="primaryAction"
        />
        <UButton
          v-if="status.secondaryLabel"
          size="xs"
          color="neutral"
          variant="ghost"
          :label="t(status.secondaryLabel)"
          @click="secondaryAction"
        />
      </template>
    </UAlert>
  </div>
</template>

<script setup lang="ts">
type Status = {
  type: 'offline' | 'update' | 'install';
  color: 'warning' | 'info' | 'primary';
  icon: string;
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel?: string;
};

const { t } = useI18n();
const route = useRoute();
const { $pwa } = useNuxtApp();
const online = ref(navigator.onLine);

const status = computed<Status | null>(() => {
  if (!online.value && route.path !== '/offline') {
    return {
      type: 'offline',
      color: 'warning',
      icon: 'i-tabler-wifi-off',
      title: 'pwa.offlineTitle',
      description: 'pwa.offlineDescription',
      primaryLabel: 'pwa.retry',
    };
  }
  if (online.value && $pwa?.needRefresh) {
    return {
      type: 'update',
      color: 'info',
      icon: 'i-tabler-refresh',
      title: 'pwa.updateTitle',
      description: 'pwa.updateDescription',
      primaryLabel: 'pwa.reload',
      secondaryLabel: 'pwa.later',
    };
  }
  if (online.value && $pwa?.showInstallPrompt && !$pwa.isPWAInstalled) {
    return {
      type: 'install',
      color: 'primary',
      icon: 'i-tabler-device-mobile-down',
      title: 'pwa.installTitle',
      description: 'pwa.installDescription',
      primaryLabel: 'pwa.install',
      secondaryLabel: 'pwa.dismiss',
    };
  }
  return null;
});

function updateOnlineState() {
  online.value = navigator.onLine;
}

async function primaryAction() {
  if (status.value?.type === 'offline') {
    window.location.reload();
  } else if (status.value?.type === 'update') {
    await $pwa?.updateServiceWorker(true);
  } else if (status.value?.type === 'install') {
    await $pwa?.install();
  }
}

async function secondaryAction() {
  if (status.value?.type === 'update') await $pwa?.cancelPrompt();
  else if (status.value?.type === 'install') $pwa?.cancelInstall();
}

onMounted(() => {
  window.addEventListener('online', updateOnlineState);
  window.addEventListener('offline', updateOnlineState);
});

onBeforeUnmount(() => {
  window.removeEventListener('online', updateOnlineState);
  window.removeEventListener('offline', updateOnlineState);
});
</script>
