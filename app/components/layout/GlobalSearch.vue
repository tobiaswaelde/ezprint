<template>
  <UPopover v-model:open="open" :content="{ align: 'center', sideOffset: 8 }">
    <UButton
      color="neutral"
      variant="outline"
      class="h-9 w-9 justify-start bg-default sm:w-80"
      :aria-label="`${t('search.open')}: ${t('search.placeholder')}`"
    >
      <UIcon name="i-tabler-command" class="size-4 shrink-0 text-primary" />
      <span class="hidden truncate text-muted sm:block">{{ t('search.placeholder') }}</span>
      <UKbd class="ml-auto hidden sm:inline-flex" aria-hidden="true">/</UKbd>
    </UButton>

    <template #content>
      <div
        ref="searchPanel"
        role="search"
        :aria-label="t('search.title')"
        class="w-[min(30rem,calc(100vw-2rem))] overflow-hidden"
      >
        <div class="border-b border-default p-3">
          <UInput
            v-model="query"
            type="search"
            autofocus
            icon="i-tabler-search"
            size="lg"
            class="w-full"
            :placeholder="t('search.placeholder')"
          />
        </div>

        <div class="max-h-96 overflow-y-auto p-2" aria-live="polite">
          <p v-if="query.trim().length < 2" class="px-3 py-8 text-center text-sm text-muted">
            {{ t('search.hint') }}
          </p>
          <div
            v-else-if="loading"
            class="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted"
          >
            <UIcon name="i-tabler-loader-2" class="size-4 animate-spin" />
            {{ t('common.loading') }}
          </div>
          <p v-else-if="error" class="px-3 py-8 text-center text-sm text-error">{{ error }}</p>
          <p v-else-if="!totalResults" class="px-3 py-8 text-center text-sm text-muted">
            {{ t('search.empty') }}
          </p>
          <div v-else class="space-y-3">
            <section v-for="group in response?.groups" :key="group.type">
              <h2 class="px-3 py-1 text-xs font-semibold tracking-wide text-muted uppercase">
                {{ t(`nav.${group.type}`) }}
              </h2>
              <div class="space-y-0.5">
                <NuxtLink
                  v-for="item in group.items"
                  :key="`${group.type}-${item.id}`"
                  :to="item.to"
                  class="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
                  @click="open = false"
                >
                  <UIcon :name="icons[group.type]" class="size-4 shrink-0 text-primary" />
                  <span class="min-w-0">
                    <span class="block truncate font-medium text-highlighted">{{ item.title }}</span>
                    <span v-if="item.description" class="block truncate text-xs text-muted">{{
                      item.description
                    }}</span>
                  </span>
                  <UIcon name="i-tabler-arrow-up-right" class="ml-auto size-3.5 shrink-0 text-muted" />
                </NuxtLink>
              </div>
            </section>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
import type { GlobalSearchKind, GlobalSearchResponse } from '#shared/types/search';

const { t } = useI18n();
const open = ref(false);
const query = ref('');
const response = ref<GlobalSearchResponse | null>(null);
const loading = ref(false);
const error = ref('');
const searchPanel = useTemplateRef<HTMLElement>('searchPanel');
let timer: ReturnType<typeof setTimeout> | undefined;
let requestId = 0;

const icons: Record<GlobalSearchKind, string> = {
  prints: 'i-tabler-printer',
  customers: 'i-tabler-users',
  printers: 'i-tabler-printer',
  components: 'i-tabler-components',
  filaments: 'i-tabler-disc',
  spools: 'i-tabler-qrcode',
  series: 'i-tabler-list-check',
};
const totalResults = computed(
  () => response.value?.groups.reduce((total, group) => total + group.items.length, 0) ?? 0,
);

watch(query, (value) => {
  clearTimeout(timer);
  const searchTerm = value.trim();
  error.value = '';
  if (searchTerm.length < 2) {
    requestId += 1;
    response.value = null;
    loading.value = false;
    return;
  }

  loading.value = true;
  const currentRequest = ++requestId;
  timer = setTimeout(async () => {
    try {
      const result = await $fetch<GlobalSearchResponse>('/api/search', { query: { q: searchTerm } });
      if (currentRequest === requestId) response.value = result;
    } catch {
      if (currentRequest === requestId) {
        response.value = null;
        error.value = t('search.failed');
      }
    } finally {
      if (currentRequest === requestId) loading.value = false;
    }
  }, 250);
});

watch(open, async (isOpen) => {
  if (!isOpen) return;
  await nextTick();
  searchPanel.value?.querySelector('input')?.focus();
});

function onShortcut(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (
    event.key !== '/' ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey ||
    target?.matches('input, textarea, select, [contenteditable="true"]')
  )
    return;
  event.preventDefault();
  open.value = true;
}

onMounted(() => window.addEventListener('keydown', onShortcut));
onBeforeUnmount(() => {
  clearTimeout(timer);
  window.removeEventListener('keydown', onShortcut);
});
</script>
