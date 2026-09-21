<template>
  <main class="report mx-auto h-full overflow-y-auto max-w-4xl bg-white p-6 text-black sm:p-10">
    <nav class="mb-6 flex gap-3 print:hidden" :aria-label="t('report.actions')">
      <UButton :label="t('report.save')" :disabled="!job" @click="printReport" />
      <UButton :label="t('common.back')" :to="`/prints/${id}`" color="neutral" />
    </nav>
    <p v-if="error" role="alert">{{ error }}</p>
    <article v-if="job && job.snapshot" class="space-y-6">
      <header>
        <p class="text-sm">ezPrint · {{ t('report.title') }}</p>
        <h1 class="text-3xl font-semibold">{{ job.name }}</h1>
        <p>{{ t('report.disclaimer') }}</p>
      </header>
      <dl class="grid grid-cols-2 gap-3 text-sm">
        <div v-for="entry in identity" :key="entry[0]">
          <dt class="font-semibold">{{ entry[0] }}</dt>
          <dd class="break-words">{{ entry[1] ?? '—' }}</dd>
        </div>
      </dl>
      <section>
        <h2>{{ t('report.costs') }}</h2>
        <table>
          <thead>
            <tr>
              <th>{{ t('report.category') }}</th>
              <th>{{ t('outcome.planned') }}</th>
              <th>{{ t('report.actual') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in costs" :key="row[0]">
              <th scope="row">{{ row[0] }}</th>
              <td>{{ money(row[1], job.currency) }}</td>
              <td>{{ row[2] == null ? '—' : money(row[2], job.currency) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section v-for="(part, index) in job.parts" :key="part.id">
        <h2>{{ t('report.sources') }} · {{ t('prints.part', { number: index + 1 }) }}</h2>
        <p>
          {{ t('report.formula') }}: {{ part.snapshot!.formulaVersion }} · {{ t('report.electricity') }}:
          {{ decimal(part.snapshot!.electricityPricePerKwh) }} {{ job.currency }}/kWh
        </p>
        <p>
          {{ part.snapshot!.printerName }} · {{ decimal(part.snapshot!.printerHourlyRate) }}
          {{ job.currency }}/h · {{ part.snapshot!.printerPowerWatts }} W
        </p>
        <table>
          <thead>
            <tr>
              <th>{{ t('master.name') }}</th>
              <th>{{ t('report.rate') }}</th>
              <th>{{ t('prints.duration') }}</th>
              <th>{{ t('prints.totalCost') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in part.componentUsages" :key="line.id">
              <th scope="row">{{ line.name }}</th>
              <td>{{ decimal(line.hourlyRate) }} {{ job.currency }}/h</td>
              <td>{{ duration(line.appliedDurationSeconds) }}</td>
              <td>{{ money(line.lineCost, job.currency) }}</td>
            </tr>
          </tbody>
        </table>
        <table>
          <thead>
            <tr>
              <th>{{ t('nav.filaments') }}</th>
              <th>{{ t('report.rate') }}</th>
              <th>{{ t('outcome.planned') }}</th>
              <th>{{ t('report.actual') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in part.filamentUsages" :key="line.id">
              <th scope="row">
                {{ line.name }}<small class="block">{{ line.spoolCode ?? '—' }}</small>
              </th>
              <td>{{ decimal(line.costPerGram) }} {{ job.currency }}/g</td>
              <td>{{ decimal(line.usedGrams) }} g</td>
              <td>
                {{
                  job.outcome?.filaments.find(
                    (value: { usageId: string; usedGrams: string }) => value.usageId === line.id,
                  )?.usedGrams ?? '—'
                }}
                g
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      <section>
        <h2>{{ t('report.sales') }}</h2>
        <dl class="grid grid-cols-2 gap-2">
          <template v-for="entry in financials" :key="entry[0]"
            ><dt>{{ entry[0] }}</dt>
            <dd>{{ entry[1] == null ? '—' : money(entry[1], job.currency) }}</dd></template
          >
        </dl>
      </section>
      <section v-if="job.notes || job.outcome?.note || job.outcome?.failureReason">
        <h2>{{ t('master.note') }}</h2>
        <p class="whitespace-pre-wrap break-words">{{ job.notes }}</p>
        <p class="whitespace-pre-wrap break-words">{{ job.outcome?.failureReason }}</p>
        <p class="whitespace-pre-wrap break-words">{{ job.outcome?.note }}</p>
      </section>
    </article>
  </main>
</template>
<script setup lang="ts">
import type { PrintJobDto } from '#shared/types/prints';
import { reportFilename } from '#shared/domain/print-export';
definePageMeta({ layout: false });
const { t } = useI18n();
const { money, decimal, dateTime, duration } = useFormatting();
const id = String(useRoute().params.id);
const { data: job, error } = await useFetch<PrintJobDto>(`/api/prints/${id}/report`);
useHead({
  title: () => (job.value ? reportFilename(job.value.name, job.value.completedAt) : t('report.title')),
});
const printReport = () => window.print();
const identity = computed(() => {
  const print = job.value!;
  return [
    [t('report.id'), print.id],
    [t('nav.customers'), print.customer?.name],
    [
      t('nav.printers'),
      print.parts.map((part) => part.snapshot?.printerName ?? part.printer.name).join('; '),
    ],
    [t('nav.series'), print.series?.name],
    [t('prints.quantity'), String(print.quantity)],
    [t('report.completed'), print.completedAt ? dateTime(print.completedAt) : '—'],
    [t('prints.duration'), duration(print.totalDurationSeconds)],
    [
      t('outcome.title'),
      t(
        `outcome.${print.outcome?.status === 'SUCCESS' ? 'SUCCESS' : print.outcome?.status === 'FAILED' ? 'FAILED' : 'PENDING'}`,
      ),
    ],
    [t('report.recorded'), print.outcome ? dateTime(print.outcome.recordedAt) : '—'],
    [t('report.actual'), print.outcome ? duration(print.outcome.durationSeconds) : '—'],
  ];
});
const costs = computed(() => {
  const print = job.value!;
  return (
    ['printerCost', 'componentCost', 'filamentCost', 'electricityCost', 'totalCost', 'costPerUnit'] as const
  ).map((key) => [t(`prints.${key}`), print.snapshot![key], print.outcome?.costs[key]]);
});
const financials = computed(() => {
  const finance = job.value!.financials;
  return [
    [t('sales.value'), job.value!.salesValue],
    [t('sales.plannedMargin'), finance.plannedMargin],
    [t('sales.realizedRevenue'), finance.realizedRevenue],
    [t('sales.realizedMargin'), finance.realizedMargin],
  ];
});
</script>
<style scoped>
h2 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.75rem;
  font-size: 0.85rem;
}
th,
td {
  text-align: left;
  padding: 0.4rem;
  border-bottom: 1px solid #ddd;
  overflow-wrap: anywhere;
}
tr {
  break-inside: avoid;
}
thead {
  display: table-header-group;
}
@page {
  size: A4;
  margin: 15mm;
}
@media print {
  :global(html),
  :global(body),
  :global(#__nuxt) {
    background: white !important;
    color: black !important;
    color-scheme: light;
  }
  .report {
    font-size: 10pt;
    line-height: 1.3;
  }
  .report header h1 {
    font-size: 20pt;
  }
  .space-y-6 > :not(:last-child) {
    margin-block-end: 12px;
  }
  table {
    font-size: 9pt;
  }
  th,
  td {
    padding: 0.25rem;
  }
  :global(html),
  :global(body),
  :global(#__nuxt) {
    height: auto;
    min-height: 0;
    overflow: visible;
  }
  .report {
    height: auto;
    overflow: visible;
  }

  .report {
    padding: 0;
    max-width: none;
  }
  h2 {
    break-after: avoid;
  }
}
</style>
