<template>
  <LayoutPagePanel :panel-id="resource" :title="title" table>
    <template #toolbar>
      <CommonTableToolbar v-model:search="search" :icon="resourceIcon" :title="title">
        <template #options>
          <CommonTableOptionsMenu v-model:include-archived="includeArchived" />
        </template>
        <template #create>
          <CommonButtonsNew @click="startCreate" />
        </template>
      </CommonTableToolbar>
    </template>

    <UAlert v-if="error" class="m-4 shrink-0 sm:m-6" color="error" :description="error" />

    <ModulesCustomersDialog
      v-if="resource === 'customers'"
      v-model:open="editing"
      :value="editingCustomer"
      @saved="refresh"
    />
    <ModulesMasterDataDialog
      v-else
      v-model:open="editing"
      :resource="resource"
      :value="editingItem"
      @saved="refresh"
    />

    <div data-table-region class="min-h-0 flex-1 overflow-auto">
      <div v-if="loading" class="flex min-h-full items-center justify-center">
        <UIcon name="i-tabler-loader-2" class="size-8 animate-spin" />
      </div>
      <CommonEmptyState
        v-else-if="!items.length"
        class="min-h-full rounded-none border-0"
        :title="t('common.empty')"
      >
        <UButton icon="i-tabler-plus" label="New" @click="startCreate" />
      </CommonEmptyState>
      <table v-else class="w-full min-w-180 text-sm">
        <thead class="sticky top-0 z-10 bg-elevated text-left text-xs text-muted uppercase">
          <tr>
            <th class="px-4 py-3 font-medium sm:first:pl-6">{{ t('master.name') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('master.details') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('master.rate') }}</th>
            <th class="w-1 px-4 py-3 text-right font-medium sm:pr-6">{{ t('master.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.id"
            class="border-t border-default transition-colors hover:bg-elevated/50"
            :class="item.archivedAt && 'opacity-60'"
          >
            <td class="px-4 py-2.5 font-medium sm:first:pl-6">
              <NuxtLink
                v-if="resource === 'customers'"
                :to="`/customers/${item.id}`"
                class="text-primary underline"
                >{{ item.name }}</NuxtLink
              ><template v-else>{{ item.name }}</template>
            </td>
            <td class="px-4 py-2.5 text-muted">{{ details(item) }}</td>
            <td class="px-4 py-2.5">{{ rate(item) }}</td>
            <td class="px-4 py-2.5 sm:pr-6">
              <div class="flex justify-end gap-1">
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-tabler-pencil"
                  :aria-label="t('common.edit')"
                  @click="startEdit(item)"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  :icon="item.archivedAt ? 'i-tabler-archive-off' : 'i-tabler-archive'"
                  :aria-label="item.archivedAt ? t('common.restore') : t('common.archive')"
                  @click="toggleArchive(item)"
                />
                <CommonConfirmButton
                  color="error"
                  variant="ghost"
                  icon="i-tabler-trash"
                  :aria-label="t('common.delete')"
                  :confirmation="t('master.deleteConfirmation')"
                  @confirm="remove(item)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </LayoutPagePanel>
</template>

<script setup lang="ts">
import type {
  CustomerDto,
  MasterDataListItem,
  MasterDataResource,
  PaginatedResponse,
} from '#shared/types/master-data';

const props = defineProps<{ resource: MasterDataResource; title: string }>();
const resourceIcon = computed(
  () =>
    ({
      customers: 'i-tabler-users',
      printers: 'i-tabler-printer',
      manufacturers: 'i-tabler-building-factory-2',
      components: 'i-tabler-components',
      filaments: 'i-tabler-disc',
    })[props.resource],
);
const { t } = useI18n();
const route = useRoute();
const { money, decimal } = useFormatting();
const items = ref<MasterDataListItem[]>([]);
const search = ref(typeof route.query.search === 'string' ? route.query.search : '');
const includeArchived = ref(false);
const loading = ref(true);
const editing = ref(false);
const editingItem = ref<MasterDataListItem | null>(null);
const editingCustomer = ref<CustomerDto | null>(null);
const error = ref('');
const currency = ref('EUR');
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

async function refresh() {
  loading.value = true;
  error.value = '';
  try {
    const [response, settings] = await Promise.all([
      $fetch<PaginatedResponse<MasterDataListItem>>(`/api/${props.resource}`, {
        query: { search: search.value, includeArchived: includeArchived.value },
      }),
      $fetch<{ currency: string }>('/api/settings'),
    ]);
    items.value = response.items;
    currency.value = settings.currency;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    loading.value = false;
  }
}

function startCreate() {
  editingItem.value = null;
  editingCustomer.value = null;
  editing.value = true;
}

function startEdit(item: MasterDataListItem) {
  editingItem.value = item;
  editingCustomer.value = props.resource === 'customers' ? (item as CustomerDto) : null;
  editing.value = true;
}

async function toggleArchive(item: MasterDataListItem) {
  await $fetch(`/api/${props.resource}/${item.id}`, {
    method: 'PATCH',
    body: { archived: !item.archivedAt },
  });
  await refresh();
}

async function remove(item: MasterDataListItem) {
  try {
    await $fetch(`/api/${props.resource}/${item.id}`, { method: 'DELETE' });
    await refresh();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  }
}

function details(item: MasterDataListItem) {
  if (props.resource === 'customers')
    return [item.email ?? '—', item.excludeFromDashboard ? t('master.excludedFromDashboard') : '']
      .filter(Boolean)
      .join(' · ');
  if (props.resource === 'manufacturers') return String(item.note ?? '—');
  if (props.resource === 'filaments')
    return [item.manufacturer, item.material, item.colorName, item.colorHex].filter(Boolean).join(' · ');
  if (props.resource === 'components')
    return [
      t(`master.${String(item.type).toLowerCase()}`),
      [item.manufacturer, item.model].filter(Boolean).join(' '),
      item.alwaysUsed ? t('master.alwaysUsed') : '',
    ]
      .filter(Boolean)
      .join(' · ');
  return `${[item.manufacturer, item.model].filter(Boolean).join(' ')} · ${item.averagePowerWatts} W`;
}

function rate(item: MasterDataListItem) {
  if (props.resource === 'customers' || props.resource === 'manufacturers') return '—';
  const value = props.resource === 'filaments' ? item.costPerGram : item.hourlyRate;
  return `${money(value, currency.value)}${props.resource === 'filaments' ? '/g' : '/h'} · ${decimal(props.resource === 'filaments' ? item.netWeightGrams : item.expectedLifetimeHours)}${props.resource === 'filaments' ? ' g' : ' h'}`;
}

watch([search, includeArchived], () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refresh, 250);
});
onMounted(refresh);
</script>
