<template>
  <div class="min-w-0">
    <div class="flex items-center gap-2">
      <USelectMenu
        v-bind="$attrs"
        v-model:search-term="search"
        :model-value="model"
        :multiple="multiple"
        :items="options"
        value-key="value"
        :icon="icon"
        :aria-label="label"
        :search-input="{ placeholder: t('common.search') }"
        :loading="loading"
        :disabled="disabled"
        ignore-filter
        class="min-w-0 flex-1"
        @update:model-value="model = $event as M"
      >
        <template #default
          ><span data-slot="value" class="truncate">{{ selectedLabel }}</span></template
        >
        <template v-if="resource === 'filaments'" #leading>
          <UAvatar
            v-if="selectedRecord"
            aria-hidden="true"
            data-slot="filamentColor"
            size="xs"
            class="shrink-0 ring-1 ring-default"
            :style="{ backgroundColor: String(selectedRecord.colorHex) }"
          />
          <UIcon v-else name="i-tabler-disc" class="size-5 shrink-0" />
        </template>
        <template v-if="resource === 'filaments'" #item-leading="{ item }">
          <UAvatar
            v-if="item.colorHex"
            aria-hidden="true"
            size="xs"
            class="shrink-0 ring-1 ring-default"
            :style="{ backgroundColor: item.colorHex }"
          />
        </template>
        <template #content-bottom>
          <UButton
            v-if="hasMore"
            block
            variant="ghost"
            :loading="loading"
            :label="t('common.loadMore')"
            @click.stop="load(true)"
          />
        </template>
      </USelectMenu>
      <UButton
        v-if="creatable && !disabled"
        type="button"
        :title="t('common.createEntry', { name: label })"
        icon="i-tabler-plus"
        color="neutral"
        variant="outline"
        :aria-label="t('common.createEntry', { name: label })"
        @click="creating = true"
      />
    </div>
    <p v-if="error" role="alert" class="mt-1 text-sm text-error">{{ error }}</p>
    <CommonEntityCreateDialog
      v-if="creating"
      v-model:open="creating"
      :resource="resource"
      :defaults="defaults"
      @created="created"
    />
  </div>
</template>

<script setup lang="ts" generic="M extends string | string[] | null | undefined">
import type { MasterDataListItem, MasterDataResource, PaginatedResponse } from '#shared/types/master-data';

defineOptions({ inheritAttrs: false });
const props = withDefaults(
  defineProps<{
    resource: MasterDataResource | 'series' | 'spools';
    multiple?: boolean;
    nullable?: boolean;
    disabled?: boolean;
    creatable?: boolean;
    query?: Record<string, string | boolean | undefined>;
    defaults?: Record<string, unknown>;
  }>(),
  {
    multiple: false,
    nullable: false,
    disabled: false,
    creatable: true,
    query: () => ({}),
    defaults: () => ({}),
  },
);
const model = defineModel<M>({ required: true });
const emit = defineEmits<{ selected: [record: MasterDataListItem | undefined] }>();
const attrs = useAttrs();
const { t } = useI18n();
const label = computed(() => String(attrs['aria-label'] || t(`nav.${props.resource}`)));
const icon = computed(() =>
  typeof attrs.icon === 'string'
    ? attrs.icon
    : mainNavigation.find((item) => item.to === `/${props.resource}`)?.icon,
);
const search = ref('');
const creating = ref(false);
const loading = ref(false);
const error = ref('');
const items = ref<MasterDataListItem[]>([]);
const selectedItems = ref<MasterDataListItem[]>([]);
const page = ref(0);
const total = ref(0);
let request = 0;
let selectionRequest = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const selectedIds = computed(() =>
  Array.isArray(model.value) ? model.value : model.value ? [model.value] : [],
);
const selectedRecord = computed(() =>
  [...selectedItems.value, ...items.value].find((item) => item.id === model.value),
);
function recordLabel(item: MasterDataListItem) {
  return props.resource === 'spools' ? `${item.code} · ${item.remainingGrams ?? '—'} g` : item.name;
}
const selectedLabel = computed(() =>
  selectedIds.value.length
    ? selectedIds.value
        .map((id) => {
          const record = [...selectedItems.value, ...items.value].find((item) => item.id === id);
          return record ? recordLabel(record) : t('common.loading');
        })
        .join(', ')
    : props.nullable
      ? '—'
      : String(attrs.placeholder ?? '\u00a0'),
);
const hasMore = computed(() => page.value * 25 < total.value);
const options = computed(() => {
  const records = [
    ...items.value,
    ...(search.value
      ? []
      : selectedItems.value.filter((selected) => !items.value.some((item) => item.id === selected.id))),
  ];
  return [
    ...(props.nullable && !props.multiple
      ? [{ label: '—', value: null, colorHex: '', disabled: false }]
      : []),
    ...records.map((item) => ({
      label: recordLabel(item),
      value: item.id,
      colorHex: String(item.colorHex ?? ''),
      disabled:
        (!props.query.includeArchived && Boolean(item.archivedAt)) ||
        (props.resource === 'spools' &&
          Boolean(props.query.availableOnly) &&
          (['ARCHIVED', 'MISSING'].includes(String(item.remoteState)) ||
            (item.remainingGrams != null && Number(item.remainingGrams) <= 0))),
    })),
  ];
});
async function hydrateSelection() {
  const current = ++selectionRequest;
  try {
    const records = await Promise.all(
      selectedIds.value.map(
        (id) =>
          items.value.find((item) => item.id === id) ??
          selectedItems.value.find((item) => item.id === id) ??
          $fetch<MasterDataListItem>(`/api/${props.resource}/${id}`),
      ),
    );
    if (current === selectionRequest) selectedItems.value = records;
  } catch (reason) {
    if (current === selectionRequest) error.value = String(reason);
  }
}
async function load(more = false) {
  if (props.disabled || (more && loading.value)) return;
  const current = ++request;
  const nextPage = more ? page.value + 1 : 1;
  loading.value = true;
  try {
    const response = await $fetch<PaginatedResponse<MasterDataListItem>>(`/api/${props.resource}`, {
      query: { ...props.query, search: search.value, page: nextPage, pageSize: 25 },
    });
    if (current !== request) return;
    items.value = more ? [...items.value, ...response.items] : response.items;
    page.value = response.page;
    total.value = response.total;
    error.value = '';
    if (props.resource === 'spools' && !model.value && !search.value && response.total === 1)
      model.value = response.items[0]!.id as M;
    await hydrateSelection();
  } catch (reason) {
    if (current === request) error.value = String(reason);
  } finally {
    if (current === request) loading.value = false;
  }
}
async function created(id: string) {
  model.value = (props.multiple ? [...selectedIds.value, id] : id) as M;
  search.value = '';
  await load();
}
watch(selectedIds, hydrateSelection, { immediate: true });
watch(selectedRecord, (record) => emit('selected', record), { immediate: true });
watch([search, () => JSON.stringify(props.query), () => props.disabled], () => {
  ++request;
  clearTimeout(timer);
  items.value = [];
  page.value = 0;
  total.value = 0;
  loading.value = false;
  timer = setTimeout(() => load(), 250);
});
onMounted(() => load());
onBeforeUnmount(() => {
  ++request;
  ++selectionRequest;
  clearTimeout(timer);
});
</script>
