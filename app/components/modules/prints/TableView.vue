<template>
  <LayoutPagePanel :panel-id="panelId" :title="title" table>
    <template #toolbar>
      <div data-table-toolbar>
        <QTableToolbar
          v-model:search="search"
          v-model:filtering="filtering"
          :breadcrumb-items="breadcrumbItems"
          :filter-fields="filterFields"
          :ui="{
            root: 'border-b border-default',
            primary: 'flex-wrap',
            secondary: 'flex-wrap',
          }"
        >
          <template #options>
            <QTableFiltering v-model:filtering="filtering" :fields="filterFields">
              <template #item="{ filter, field, remove, update }">
                <ModulesPrintsFilterItem
                  v-if="field"
                  :filter="filter"
                  :field="field"
                  :remove="remove"
                  :update="update"
                />
              </template>
            </QTableFiltering>
          </template>
          <template #new>
            <slot name="actions" :open-create="openCreate">
              <UTooltip :text="t('report.csv')">
                <UButton
                  :to="exportUrl"
                  icon="i-tabler-download"
                  external
                  color="neutral"
                  variant="outline"
                />
              </UTooltip>
              <CommonButtonsNew @click="openCreate" />
            </slot>
          </template>
        </QTableToolbar>
      </div>
    </template>

    <div v-if="$slots.details" class="shrink-0 border-b border-default p-4 sm:p-6">
      <slot name="details" />
    </div>

    <UAlert v-if="error" class="m-4 shrink-0 sm:m-6" color="error" :description="error" />

    <dl
      v-if="summary"
      class="grid shrink-0 gap-3 border-b border-default p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4"
    >
      <div class="rounded-lg border border-default p-3">
        <dt>{{ t('dashboard.completedPrints') }}</dt>
        <dd>{{ summary.completedPrints }} · {{ t('prints.quantity') }}: {{ summary.quantity }}</dd>
      </div>
      <div class="rounded-lg border border-default p-3">
        <dt>{{ t('series.produced') }}</dt>
        <dd>{{ summary.producedQuantity }} · {{ t('outcome.PENDING') }}: {{ summary.pending }}</dd>
      </div>
      <div class="rounded-lg border border-default p-3">
        <dt>{{ t('outcome.planned') }}</dt>
        <dd>{{ money(summary.plannedCost, summaryCurrency) }}</dd>
      </div>
      <div class="rounded-lg border border-default p-3">
        <dt>{{ t('outcome.actualCost') }}</dt>
        <dd>{{ money(summary.actualCost, summaryCurrency) }}</dd>
      </div>
      <div class="rounded-lg border border-default p-3">
        <dt>{{ t('outcome.failedCost') }}</dt>
        <dd>{{ money(summary.failedCost, summaryCurrency) }}</dd>
      </div>
      <div class="rounded-lg border border-default p-3">
        <dt>{{ t('sales.realizedRevenue') }}</dt>
        <dd>{{ money(summary.revenue, summaryCurrency) }}</dd>
      </div>
      <div class="rounded-lg border border-default p-3">
        <dt>{{ t('sales.realizedMargin') }}</dt>
        <dd>{{ money(summary.margin, summaryCurrency) }}</dd>
      </div>
      <div class="rounded-lg border border-default p-3">
        <dt>{{ t('prints.duration') }}</dt>
        <dd>{{ duration(summary.totalDurationSeconds) }}</dd>
      </div>
    </dl>

    <div data-table-region class="min-h-0 flex-1 overflow-auto">
      <div v-if="loading" class="flex min-h-full items-center justify-center">
        <UIcon name="i-tabler-loader-2" class="size-8 animate-spin" />
      </div>
      <CommonEmptyState
        v-else-if="!items.length"
        class="min-h-full rounded-none border-0"
        :title="t('common.empty')"
        icon="i-tabler-history"
      >
        <UButton v-if="!customerArchived" icon="i-tabler-plus" :label="t('common.new')" @click="openCreate" />
      </CommonEmptyState>
      <table v-else class="w-full min-w-220 text-sm">
        <thead class="sticky top-0 z-10 bg-elevated text-left text-xs text-muted uppercase">
          <tr>
            <th class="px-4 py-3 font-medium sm:first:pl-6">{{ t('master.name') }}</th>
            <th v-if="!customerId" class="px-4 py-3 font-medium">{{ t('nav.customers') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('nav.printers') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('prints.duration') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('prints.totalCost') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('prints.status') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('outcome.title') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('prints.payment') }}</th>
            <th class="px-4 py-3 text-right font-medium sm:pr-6">
              {{ t('history.actions') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.id"
            class="border-t border-default transition-colors hover:bg-elevated/50"
            :class="item.archivedAt && 'opacity-60'"
          >
            <td class="px-4 py-2.5 sm:first:pl-6">
              <NuxtLink :to="`/prints/${item.id}`" class="font-medium text-primary hover:underline">
                {{ item.name }}
              </NuxtLink>
              <p class="text-xs text-muted">{{ dateTime(item.completedAt ?? item.createdAt) }}</p>
              <NuxtLink
                v-if="item.series && printSeriesEnabled"
                :to="`/series/${item.series.id}`"
                class="block text-xs text-primary"
              >
                {{ item.series.name }}
              </NuxtLink>
              <span v-else-if="item.series" class="block text-xs text-muted">{{ item.series.name }}</span>
            </td>
            <td v-if="!customerId" class="px-4 py-2.5">
              <NuxtLink
                v-if="item.customer"
                :to="`/customers/${item.customer.id}`"
                class="text-primary underline"
              >
                {{ item.customer.name }}
              </NuxtLink>
              <span v-else>—</span>
            </td>
            <td class="px-4 py-2.5">
              {{
                [...new Set(item.parts.map((part: { printer: { name: string } }) => part.printer.name))].join(
                  ', ',
                )
              }}
            </td>
            <td class="px-4 py-2.5">{{ duration(item.totalDurationSeconds) }}</td>
            <td class="px-4 py-2.5">
              {{ money(item.totalCost, item.currency) }}
              <div class="text-xs text-muted">
                {{ t('prints.quantity') }}: {{ item.quantity }} · {{ t('prints.costPerUnit') }}:
                {{ money(item.costPerUnit, item.currency) }}
              </div>
            </td>
            <td class="px-4 py-2.5">
              <UBadge :color="statusColors[item.status]" variant="subtle">
                {{ t(`prints.${item.status.toLowerCase()}`) }}
              </UBadge>
            </td>
            <td class="px-4 py-2.5">
              <UBadge
                v-if="item.status === 'DONE'"
                :color="item.outcome?.status === 'FAILED' ? 'error' : item.outcome ? 'success' : 'neutral'"
              >
                {{ t(`outcome.${item.outcome?.status ?? 'PENDING'}`) }}
              </UBadge>
            </td>
            <td class="px-4 py-2.5">
              <UBadge :color="item.paidAt ? 'success' : 'neutral'" variant="subtle">
                {{ t(item.paidAt ? 'prints.paid' : 'prints.unpaid') }}
              </UBadge>
            </td>
            <td class="px-4 py-2.5 text-right sm:pr-6">
              <ModulesPrintsWorkflowActions :print="item" @updated="refresh" @error="error = $event">
                <UButton
                  v-if="customerId && item.status === 'DONE' && !item.archivedAt"
                  size="sm"
                  :label="t('history.repeat')"
                  @click="repeat(item.id)"
                />
              </ModulesPrintsWorkflowActions>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UPagination
      v-if="total > pageSize"
      v-model:page="page"
      :total="total"
      :items-per-page="pageSize"
      class="shrink-0 p-4"
    />
    <p v-if="summary?.lastActivity" class="shrink-0 px-4 pb-4 text-sm text-muted">
      {{ t('history.lastActivity') }}: {{ dateTime(summary.lastActivity) }}
    </p>

    <ModulesPrintsCreateDialog
      v-model:open="createOpen"
      :initial-series-id="initialSeriesId"
      :initial-customer-id="customerId ?? initialCustomerId"
      @created="refresh"
    />
  </LayoutPagePanel>
</template>

<script setup lang="ts">
import { filteringToWhere } from '@querry-kit/nuxt';
import {
  FilterFieldType,
  FilteringMode,
  type FilterField,
  type Filtering,
  type FilteringField,
} from '@querry-kit/nuxt-ui/types';
import { printStatuses } from '#shared/schemas/prints';
import type { PrintSummary } from '#shared/domain/print-summary';
import type { PaginatedResponse } from '#shared/types/master-data';
import type { PrintJobDto } from '#shared/types/prints';

const props = defineProps<{
  panelId: string;
  title: string;
  customerId?: string;
  customerName?: string;
  customerArchived?: boolean;
}>();
const { t } = useI18n();
const route = useRoute();
const { money, duration, dateTime } = useFormatting();
const { load: loadFeatures, printSeriesEnabled } = useFeatures();
const pageSize = 25;
const items = ref<PrintJobDto[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(true);
const error = ref('');
const summary = ref<PrintSummary | null>(null);
const summaryCurrency = ref('EUR');
const createOpen = ref(route.query.create === 'true');
const search = ref(typeof route.query.search === 'string' ? route.query.search : '');
let request = 0;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

const initialFilters: FilteringField[] = [
  { id: 'archive-default', field: 'archived', type: FilterFieldType.Boolean, value: false },
];
if (printStatuses.includes(route.query.status as PrintJobDto['status']))
  initialFilters.push({
    id: 'status-route',
    field: 'status',
    type: FilterFieldType.Enum,
    operator: 'in',
    value: [String(route.query.status)],
  });
if (typeof route.query.seriesId === 'string' && route.query.seriesId)
  initialFilters.push({
    id: 'series-route',
    field: 'seriesId',
    type: FilterFieldType.Enum,
    operator: 'in',
    value: [route.query.seriesId],
  });
const filtering = ref<Filtering>({ operator: FilteringMode.Intersect, filters: initialFilters });

const breadcrumbItems = useBreadcrumbItems(() => props.customerName);
const activeFields = computed(() => new Set(filtering.value.filters.map((filter) => filter.field)));
const filterFields = computed<FilterField[]>(() => {
  const fields: FilterField[] = [
    {
      value: 'status',
      label: t('prints.status'),
      type: FilterFieldType.Enum,
      values: printStatuses.map((value) => ({ value, label: t(`prints.${value.toLowerCase()}`) })),
    },
    {
      value: 'outcome',
      label: t('outcome.title'),
      type: FilterFieldType.Enum,
      values: ['PENDING', 'SUCCESS', 'FAILED'].map((value) => ({ value, label: t(`outcome.${value}`) })),
    },
    {
      value: 'printerId',
      label: t('nav.printers'),
      type: FilterFieldType.Enum,
      values: [],
    },
    ...(!props.customerId
      ? ([
          {
            value: 'customerId',
            label: t('nav.customers'),
            type: FilterFieldType.Enum,
            values: [],
          },
        ] satisfies FilterField[])
      : []),
    ...(printSeriesEnabled.value
      ? ([
          {
            value: 'seriesId',
            label: t('nav.series'),
            type: FilterFieldType.Enum,
            values: [],
          },
        ] satisfies FilterField[])
      : []),
    { value: 'dateFrom', label: t('history.from'), type: FilterFieldType.Enum, values: [] },
    { value: 'dateTo', label: t('history.to'), type: FilterFieldType.Enum, values: [] },
    { value: 'archived', label: t('history.archived'), type: FilterFieldType.Boolean },
  ];
  return fields.map((field) => ({ ...field, disabled: activeFields.value.has(field.value) }));
});

const normalizedFiltering = computed<Filtering>(() => ({
  operator: filtering.value.operator,
  filters: filtering.value.filters.flatMap((filter) => {
    if (filter.field === 'dateFrom' || filter.field === 'dateTo') {
      if (typeof filter.value !== 'string' || !filter.value) return [];
      return [{ ...filter, operator: filter.field === 'dateFrom' ? 'gte' : 'lte' }];
    }
    if (filter.field === 'archived') return typeof filter.value === 'boolean' ? [filter] : [];
    return Array.isArray(filter.value) && filter.value.length ? [filter] : [];
  }),
}));
const where = computed(() => {
  const value = filteringToWhere(normalizedFiltering.value);
  return value ? JSON.stringify(value) : undefined;
});
const initialSeriesId = computed(() => {
  if (!printSeriesEnabled.value) return null;
  const filter = normalizedFiltering.value.filters.find((item) => item.field === 'seriesId');
  return Array.isArray(filter?.value) && filter.value.length === 1 ? String(filter.value[0]) : null;
});
const initialCustomerId = computed(() => {
  const filter = normalizedFiltering.value.filters.find((item) => item.field === 'customerId');
  return Array.isArray(filter?.value) && filter.value.length === 1 ? String(filter.value[0]) : null;
});
const query = computed(() => ({
  page: page.value,
  pageSize,
  search: search.value || undefined,
  includeArchived: true,
  where: where.value,
}));
const exportUrl = computed(() => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query.value))
    if (value !== undefined && key !== 'page') params.set(key, String(value));
  return `/api/prints/export?${params}`;
});
const statusColors = {
  DRAFT: 'neutral',
  PRINTING: 'info',
  PRINTED: 'primary',
  SHIPPED: 'warning',
  DONE: 'success',
} as const;

function openCreate() {
  createOpen.value = true;
}

async function refresh() {
  const current = ++request;
  loading.value = true;
  try {
    const endpoint = props.customerId ? `/api/customers/${props.customerId}/history` : '/api/prints';
    const response = await $fetch<
      PaginatedResponse<PrintJobDto> & { summary?: PrintSummary; currency?: string }
    >(endpoint, {
      query: query.value,
    });
    if (current !== request) return;
    items.value = response.items;
    total.value = response.total;
    summary.value = response.summary ?? null;
    summaryCurrency.value = response.currency ?? 'EUR';
    error.value = '';
  } catch (reason) {
    if (current === request) error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    if (current === request) loading.value = false;
  }
}

async function repeat(id: string) {
  try {
    const draft = await $fetch<PrintJobDto>(`/api/prints/${id}/repeat`, { method: 'POST' });
    await navigateTo(`/prints/${draft.id}`);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  }
}

watch([search, where], () => {
  page.value = 1;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refresh, 250);
});
watch(page, refresh);
watch(createOpen, (open) => {
  if (open || route.query.create === undefined) return;
  const routeQuery = { ...route.query };
  delete routeQuery.create;
  void navigateTo({ path: route.path, query: routeQuery }, { replace: true });
});
onMounted(async () => {
  await loadFeatures();
  if (!printSeriesEnabled.value)
    filtering.value = {
      ...filtering.value,
      filters: filtering.value.filters.filter((item) => item.field !== 'seriesId'),
    };
  await refresh();
});
</script>
