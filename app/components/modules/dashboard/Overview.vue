<template>
  <div class="space-y-5">
    <UAlert v-if="data?.lowStock.length" color="warning" :title="t('spool.lowStock')">
      <template #description
        ><ul>
          <li v-for="item in data.lowStock" :key="item.filamentId">
            <NuxtLink :to="`/spools?search=${encodeURIComponent(item.name)}`" class="underline"
              >{{ item.name }}: {{ item.remainingGrams }} g / {{ item.minimumStockGrams }} g</NuxtLink
            >
          </li>
        </ul></template
      >
    </UAlert>
    <div class="flex justify-end">
      <USelect
        v-model="period"
        class="w-44"
        value-key="value"
        :items="periodOptions"
        :aria-label="t('dashboard.period')"
      />
    </div>
    <UAlert v-if="error" color="error" :description="error" />
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <NuxtLink
        v-for="kpi in kpis"
        :key="kpi.label"
        :to="kpi.to"
        class="group relative overflow-hidden rounded-xl border border-default bg-default p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
      >
        <div class="absolute inset-x-0 top-0 h-1" :class="kpi.accentClass" />
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-medium text-muted">{{ kpi.label }}</div>
            <div class="mt-3 text-3xl font-semibold tracking-tight">{{ kpi.value }}</div>
          </div>
          <div
            class="flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-transform group-hover:scale-105"
            :class="kpi.iconWellClass"
          >
            <UIcon :name="kpi.icon" class="size-5" />
          </div>
        </div>
      </NuxtLink>
    </div>

    <dl v-if="data" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-lg border border-default p-4">
        <dt>{{ t('sales.realizedRevenue') }}</dt>
        <dd>{{ money(data.kpis.revenue, data.currency) }}</dd>
      </div>
      <div class="rounded-lg border border-default p-4">
        <dt>{{ t('sales.realizedMargin') }}</dt>
        <dd :class="Number(data.kpis.margin) < 0 && 'text-error'">
          {{ money(data.kpis.margin, data.currency) }}
        </dd>
      </div>
      <div class="rounded-lg border border-default p-4">
        <dt>{{ t('outcome.successRate') }}</dt>
        <dd>{{ data.kpis.successRate === null ? '—' : `${Number(data.kpis.successRate).toFixed(1)} %` }}</dd>
      </div>
      <div class="rounded-lg border border-default p-4">
        <dt>{{ t('outcome.failedCost') }}</dt>
        <dd>{{ money(data.kpis.failedCost, data.currency) }}</dd>
      </div>
      <div class="rounded-lg border border-default p-4">
        <dt>{{ t('outcome.variance') }}</dt>
        <dd>{{ money(data.kpis.variance, data.currency) }}</dd>
      </div>
      <div class="rounded-lg border border-default p-4">
        <dt>{{ t('outcome.PENDING') }}</dt>
        <dd>{{ data.kpis.pendingOutcomes }}</dd>
      </div>
    </dl>
    <div class="grid gap-5 xl:grid-cols-2">
      <UCard class="overflow-hidden" :ui="{ header: 'bg-blue-50/70 dark:bg-blue-950/20' }">
        <template #header>
          <div class="flex items-center gap-3">
            <div
              class="flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800"
            >
              <UIcon name="i-tabler-chart-line" class="size-4.5" />
            </div>
            <h2 class="font-semibold">{{ t('dashboard.costOverTime') }}</h2>
          </div>
        </template>
        <ClientOnly
          ><VChart v-if="data" class="dashboard-chart" autoresize :option="lineOption"
        /></ClientOnly>
        <ul class="sr-only">
          <li v-for="point in data?.completedCostSeries" :key="point.date">
            {{ point.date }}: {{ money(point.value, data!.currency) }}
          </li>
        </ul>
      </UCard>
      <UCard class="overflow-hidden" :ui="{ header: 'bg-violet-50/70 dark:bg-violet-950/20' }">
        <template #header>
          <div class="flex items-center gap-3">
            <div
              class="flex size-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-800"
            >
              <UIcon name="i-tabler-chart-pie" class="size-4.5" />
            </div>
            <h2 class="font-semibold">{{ t('dashboard.costCategories') }}</h2>
          </div>
        </template>
        <ClientOnly><VChart v-if="data" class="dashboard-chart" autoresize :option="pieOption" /></ClientOnly>
        <ul class="sr-only">
          <li v-for="item in data?.categoryTotals" :key="item.category">
            {{ categoryLabel(item.category) }}: {{ money(item.value, data!.currency) }}
          </li>
        </ul>
      </UCard>
    </div>

    <UCard
      class="overflow-hidden"
      :ui="{ header: 'bg-amber-50/70 dark:bg-amber-950/20', body: 'p-0 sm:p-0' }"
    >
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div
              class="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800"
            >
              <UIcon name="i-tabler-file-time" class="size-4.5" />
            </div>
            <h2 class="font-semibold">{{ t('dashboard.unfinished') }}</h2>
          </div>
          <UButton icon="i-tabler-plus" :label="t('prints.new')" @click="createOpen = true" />
        </div>
      </template>
      <CommonEmptyState
        v-if="data && !data.unfinishedPrints.length"
        class="rounded-none border-0"
        :title="t('dashboard.noDrafts')"
        :description="t('dashboard.noDraftsDescription')"
        ><UButton :label="t('prints.new')" @click="createOpen = true"
      /></CommonEmptyState>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-200 text-sm">
          <thead class="text-left text-muted">
            <tr>
              <th class="p-3">{{ t('master.name') }}</th>
              <th class="p-3">{{ t('nav.customers') }}</th>
              <th class="p-3">{{ t('nav.printers') }}</th>
              <th class="p-3">{{ t('prints.status') }}</th>
              <th class="p-3">{{ t('dashboard.updated') }}</th>
              <th class="p-3 text-right">{{ t('prints.duration') }}</th>
              <th class="p-3 text-right">{{ t('prints.totalCost') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in data?.unfinishedPrints"
              :key="item.id"
              class="border-t border-default hover:bg-elevated/50"
            >
              <td class="p-3">
                <NuxtLink
                  :to="`/prints/${item.id}`"
                  class="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                >
                  <UIcon name="i-tabler-cube" class="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  {{ item.name }}
                </NuxtLink>
              </td>
              <td class="p-3">
                <UBadge color="neutral" variant="subtle" icon="i-tabler-user">
                  {{ item.customer?.name ?? '—' }}
                </UBadge>
              </td>
              <td class="p-3">
                <UBadge color="neutral" variant="subtle" icon="i-tabler-printer">{{
                  [...new Set(item.printers.map((printer: { name: string }) => printer.name))].join(', ')
                }}</UBadge>
              </td>
              <td class="p-3">
                <UBadge :color="statusColors[item.status]" variant="subtle">
                  {{ t(`prints.${item.status.toLowerCase()}`) }}
                </UBadge>
              </td>
              <td class="p-3">{{ dateTime(item.updatedAt) }}</td>
              <td class="p-3 text-right font-mono tabular-nums">{{ duration(item.totalDurationSeconds) }}</td>
              <td class="p-3 text-right font-mono tabular-nums">
                {{ money(item.totalCost, item.currency) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <ModulesPrintsCreateDialog v-model:open="createOpen" @created="refresh" />
  </div>
</template>

<script setup lang="ts">
import type { DashboardDto } from '#shared/types/prints';

const { t } = useI18n();
const { money, dateTime, duration } = useFormatting();
const period = ref<DashboardDto['period']>('30d');
const colorMode = useColorMode();
const data = ref<DashboardDto | null>(null);
const error = ref('');
const createOpen = ref(false);
const periodOptions = computed(() => [
  { label: t('dashboard.last30Days'), value: '30d' },
  { label: t('dashboard.last90Days'), value: '90d' },
  { label: t('dashboard.allTime'), value: 'all' },
]);
const categoryLabel = (category: string) => t(`dashboard.category.${category}`);
const statusColors = {
  DRAFT: 'neutral',
  PRINTING: 'info',
  PRINTED: 'primary',
  SHIPPED: 'warning',
  DONE: 'success',
} as const;
const kpis = computed(() => [
  {
    label: t('dashboard.activeDrafts'),
    value: data.value?.kpis.activeDrafts ?? 0,
    to: '/prints?status=DRAFT',
    icon: 'i-tabler-file-time',
    accentClass: 'bg-amber-500',
    iconWellClass:
      'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800',
  },
  {
    label: t('dashboard.completedPrints'),
    value: data.value?.kpis.completedPrints ?? 0,
    to: '/prints?status=DONE',
    icon: 'i-tabler-circle-check',
    accentClass: 'bg-emerald-500',
    iconWellClass:
      'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800',
  },
  {
    label: t('dashboard.totalDuration'),
    value: duration(data.value?.kpis.totalDurationSeconds ?? 0),
    to: '/prints?status=DONE',
    icon: 'i-tabler-clock',
    accentClass: 'bg-violet-500',
    iconWellClass:
      'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-800',
  },
  {
    label: t('dashboard.totalCost'),
    value: money(data.value?.kpis.totalCost ?? '0', data.value?.currency ?? 'EUR'),
    to: '/prints?status=DONE',
    icon: 'i-tabler-coins',
    accentClass: 'bg-blue-500',
    iconWellClass:
      'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-800',
  },
]);
const chartTextColor = computed(() => (colorMode.value === 'dark' ? '#cbd5e1' : '#334155'));
const lineOption = computed(() => ({
  color: ['#3b82f6'],
  textStyle: { color: chartTextColor.value },
  tooltip: { trigger: 'axis', valueFormatter: (value: number) => money(value, data.value?.currency) },
  grid: { left: 16, right: 16, top: 16, bottom: 16, containLabel: true },
  xAxis: { type: 'category', data: data.value?.completedCostSeries.map((item) => item.date) ?? [] },
  yAxis: { type: 'value' },
  series: [
    {
      type: 'line',
      smooth: true,
      symbolSize: 7,
      lineStyle: { width: 3 },
      data: data.value?.completedCostSeries.map((item) => Number(item.value)) ?? [],
      areaStyle: { color: 'rgba(59, 130, 246, 0.16)' },
    },
  ],
}));
const pieOption = computed(() => ({
  color: ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b'],
  textStyle: { color: chartTextColor.value },
  tooltip: { trigger: 'item', valueFormatter: (value: number) => money(value, data.value?.currency) },
  legend: { bottom: 0, textStyle: { color: chartTextColor.value } },
  series: [
    {
      type: 'pie',
      radius: ['38%', '68%'],
      ...(colorMode.value === 'dark'
        ? { label: { color: chartTextColor.value, textBorderColor: 'transparent', textBorderWidth: 0 } }
        : {}),
      data:
        data.value?.categoryTotals.map((item) => ({
          name: categoryLabel(item.category),
          value: Number(item.value),
        })) ?? [],
    },
  ],
}));

async function refresh() {
  try {
    data.value = await $fetch<DashboardDto>('/api/dashboard', { query: { period: period.value } });
    error.value = '';
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  }
}

watch(period, refresh);
onMounted(refresh);
</script>

<style scoped>
.dashboard-chart {
  display: block;
  height: 20rem;
}
</style>
