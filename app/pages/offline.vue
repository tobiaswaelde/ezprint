<template>
  <div class="text-center">
    <UIcon name="i-tabler-wifi-off" class="mx-auto size-12 text-warning" aria-hidden="true" />
    <h1 class="mt-4 text-2xl font-semibold">{{ t('pwa.offlineTitle') }}</h1>
    <p class="mt-2 text-sm text-muted">{{ t('pwa.offlinePageDescription') }}</p>
    <UButton class="mt-6" icon="i-tabler-refresh" :label="t('pwa.retry')" @click="retry" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const { t } = useI18n();
const route = useRoute();

async function returnToApp() {
  if (!navigator.onLine) return;
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
  await navigateTo(redirect, { replace: true });
}

function retry() {
  if (navigator.onLine) void returnToApp();
  else window.location.reload();
}

onMounted(() => window.addEventListener('online', returnToApp));
onBeforeUnmount(() => window.removeEventListener('online', returnToApp));
</script>
