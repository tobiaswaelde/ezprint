<template>
  <div class="space-y-4">
    <h2 class="font-semibold">{{ t('history.title') }}</h2>
    <div class="grid gap-3 rounded-lg bg-elevated/50 p-4 sm:grid-cols-2 xl:grid-cols-4">
      <UFormField :label="t('history.from')"
        ><UInput v-model="filters.dateFrom" type="date" class="w-full"
      /></UFormField>
      <UFormField :label="t('history.to')"
        ><UInput v-model="filters.dateTo" type="date" class="w-full"
      /></UFormField>
      <UFormField :label="t('prints.status')"
        ><USelect v-model="filters.status" :items="statusOptions" class="w-full"
      /></UFormField>
      <UFormField :label="t('outcome.title')"
        ><USelect v-model="filters.outcome" :items="outcomeOptions" class="w-full"
      /></UFormField>
      <UFormField :label="t('nav.printers')"
        ><USelectMenu
          v-model="filters.printerId"
          value-key="value"
          :items="printerOptions"
          :aria-label="t('nav.printers')"
          :search-input="{ placeholder: t('common.search') }"
          class="w-full"
      /></UFormField>
      <UCheckbox v-model="filters.includeArchived" :label="t('spool.includeArchived')" />
    </div>
    <UAlert v-if="error" color="error" :description="error" />
    <dl v-if="result && showSummary" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-lg border border-default p-3">
        <dt>{{ t('dashboard.completedPrints') }}</dt>
        <dd>
          {{ result.summary.completedPrints }} · {{ t('prints.quantity') }}: {{ result.summary.quantity }}
        </dd>
      </div>
      <div class="rounded-lg border border-default p-3">
        <dt>{{ t('series.produced') }}</dt>
        <dd>
          {{ result.summary.producedQuantity }} · {{ t('outcome.PENDING') }}: {{ result.summary.pending }}
        </dd>
      </div>
      <div class="rounded-lg border border-default p-3">
        <dt>{{ t('outcome.planned') }}</dt>
        <dd>{{ money(result.summary.plannedCost, result.currency) }}</dd>
      </div>
      <div class="rounded-lg border border-default p-3">
        <dt>{{ t('outcome.actualCost') }}</dt>
        <dd>{{ money(result.summary.actualCost, result.currency) }}</dd>
      </div>
      <div class="rounded-lg border border-default p-3">
        <dt>{{ t('outcome.failedCost') }}</dt>
        <dd>{{ money(result.summary.failedCost, result.currency) }}</dd>
      </div>
      <div class="rounded-lg border border-default p-3">
        <dt>{{ t('sales.realizedRevenue') }}</dt>
        <dd>{{ money(result.summary.revenue, result.currency) }}</dd>
      </div>
      <div class="rounded-lg border border-default p-3">
        <dt>{{ t('sales.realizedMargin') }}</dt>
        <dd>{{ money(result.summary.margin, result.currency) }}</dd>
      </div>
      <div class="rounded-lg border border-default p-3">
        <dt>{{ t('prints.duration') }}</dt>
        <dd>{{ duration(result.summary.totalDurationSeconds) }}</dd>
      </div>
    </dl>
    <div v-if="loading" class="flex min-h-52 items-center justify-center">
      <UIcon name="i-tabler-loader-2" class="size-8 animate-spin" />
    </div>
    <div v-else class="overflow-x-auto">
      <CommonEmptyState
        v-if="result && !result.items.length"
        class="rounded-none border-0"
        :title="t('history.empty')"
        icon="i-tabler-history"
      />
      <table v-else class="w-full min-w-200 text-left text-sm">
        <thead class="bg-elevated text-left text-xs text-muted uppercase">
          <tr>
            <th class="px-4 py-3 font-medium">{{ t('master.name') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('prints.status') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('outcome.title') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('prints.quantity') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('prints.totalCost') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('history.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="print in result?.items"
            :key="print.id"
            class="border-t border-default transition-colors hover:bg-elevated/50"
            :class="print.archivedAt && 'opacity-60'"
          >
            <td class="space-y-1 px-4 py-2.5">
              <NuxtLink :to="`/prints/${print.id}`" class="text-primary underline">{{ print.name }}</NuxtLink>
              <p class="text-xs text-muted">{{ dateTime(print.completedAt ?? print.createdAt) }}</p>
              <NuxtLink
                v-if="print.series && printSeriesEnabled"
                :to="`/series/${print.series.id}`"
                class="block text-xs text-primary"
                >{{ print.series.name }}</NuxtLink
              ><span v-else-if="print.series" class="text-xs text-muted">{{ print.series.name }}</span
              ><NuxtLink
                v-if="print.retryOf"
                :to="`/prints/${print.retryOf.id}`"
                class="block text-xs text-primary"
                >{{ t('outcome.retryOf') }}: {{ print.retryOf.name }}</NuxtLink
              ><NuxtLink
                v-if="print.repeatOf"
                :to="`/prints/${print.repeatOf.id}`"
                class="block text-xs text-primary"
                >{{ t('history.repeatOf') }}: {{ print.repeatOf.name }}</NuxtLink
              >
            </td>
            <td class="px-4 py-2.5">{{ t(`prints.${print.status.toLowerCase()}`) }}</td>
            <td class="px-4 py-2.5">
              <UBadge
                v-if="print.status === 'DONE'"
                :color="print.outcome?.status === 'FAILED' ? 'error' : print.outcome ? 'success' : 'neutral'"
                >{{ t(`outcome.${print.outcome?.status ?? 'PENDING'}`) }}</UBadge
              >
            </td>
            <td class="px-4 py-2.5">{{ print.quantity }}</td>
            <td class="px-4 py-2.5">{{ money(print.totalCost, print.currency) }}</td>
            <td class="px-4 py-2.5">
              <UButton
                v-if="print.status === 'DONE' && !print.archivedAt"
                :label="t('history.repeat')"
                size="sm"
                @click="repeat(print.id)"
              /><UButton
                v-if="seriesId && !print.archivedAt"
                :label="t('series.nextRun')"
                size="sm"
                color="neutral"
                @click="nextRun(print.id)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <UPagination
      v-if="(result?.total ?? 0) > 25"
      v-model:page="page"
      :total="result?.total ?? 0"
      :items-per-page="25"
    />
    <p v-if="result?.summary.lastActivity" class="text-sm text-muted">
      {{ t('history.lastActivity') }}: {{ dateTime(result.summary.lastActivity) }}
    </p>
  </div>
</template>
<script setup lang="ts">
import { printStatuses } from '#shared/schemas/prints';
import type { PrintJobDto } from '#shared/types/prints';
import type { PrintSummary } from '#shared/domain/print-summary';
import type { MasterDataListItem, PaginatedResponse } from '#shared/types/master-data';
const props = withDefaults(defineProps<{ customerId?: string; seriesId?: string; showSummary?: boolean }>(), {
  customerId: undefined,
  seriesId: undefined,
  showSummary: true,
});
const { printSeriesEnabled } = useFeatures();
const { t } = useI18n();
const { money, duration, dateTime } = useFormatting();
const filters = reactive({
  dateFrom: '',
  dateTo: '',
  status: 'ALL',
  outcome: 'ALL',
  printerId: 'ALL',
  includeArchived: false,
});
const page = ref(1);
const error = ref('');
const loading = ref(true);
const result = ref<(PaginatedResponse<PrintJobDto> & { summary: PrintSummary; currency: string }) | null>(
  null,
);
const printers = ref<MasterDataListItem[]>([]);
const printerOptions = computed(() => [
  { label: t('history.allPrinters'), value: 'ALL' },
  ...printers.value.map((item) => ({ label: item.name, value: item.id })),
]);
const statusOptions = computed(() => [
  { label: t('prints.allStatuses'), value: 'ALL' },
  ...printStatuses.map((value) => ({ label: t(`prints.${value.toLowerCase()}`), value })),
]);
const outcomeOptions = computed(() =>
  ['ALL', 'PENDING', 'SUCCESS', 'FAILED'].map((value) => ({ label: t(`outcome.${value}`), value })),
);
let request = 0;
async function refresh() {
  const current = ++request;
  loading.value = true;
  try {
    const response = await $fetch<NonNullable<typeof result.value>>(
      `/api/${props.seriesId ? `series/${props.seriesId}` : `customers/${props.customerId}`}/history`,
      {
        query: {
          page: page.value,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          status: filters.status === 'ALL' ? undefined : filters.status,
          outcome: filters.outcome === 'ALL' ? undefined : filters.outcome,
          printerId: filters.printerId === 'ALL' ? undefined : filters.printerId,
          includeArchived: filters.includeArchived,
        },
      },
    );
    if (current === request) {
      result.value = response;
      error.value = '';
    }
  } catch (reason) {
    if (current === request) error.value = String(reason);
  } finally {
    if (current === request) loading.value = false;
  }
}
async function repeat(id: string) {
  try {
    const draft = await $fetch<PrintJobDto>(`/api/prints/${id}/repeat`, { method: 'POST' });
    await navigateTo(`/prints/${draft.id}`);
  } catch (reason) {
    error.value = String(reason);
  }
}
async function nextRun(id: string) {
  try {
    const draft = await $fetch<PrintJobDto>(`/api/series/${props.seriesId}/next-run`, {
      method: 'POST',
      body: { sourcePrintId: id },
    });
    await navigateTo(`/prints/${draft.id}`);
  } catch (reason) {
    error.value = String(reason);
  }
}
watch(
  filters,
  () => {
    page.value = 1;
    void refresh();
  },
  { deep: true },
);
watch(page, refresh);
onMounted(async () => {
  await refresh();
  try {
    printers.value = (
      await $fetch<PaginatedResponse<MasterDataListItem>>('/api/printers', { query: { pageSize: 100 } })
    ).items;
  } catch (reason) {
    error.value = String(reason);
  }
});
</script>
