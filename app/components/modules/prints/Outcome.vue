<template>
  <UCard>
    <template #header
      ><h2 class="font-semibold">{{ t('outcome.title') }}</h2></template
    >
    <UAlert v-if="error" color="error" :description="error" class="mb-4" />
    <div v-if="job.outcome" class="space-y-4">
      <UBadge :color="job.outcome.status === 'SUCCESS' ? 'success' : 'error'">{{
        t(`outcome.${job.outcome.status}`)
      }}</UBadge>
      <p>{{ dateTime(job.outcome.recordedAt) }} · {{ duration(job.outcome.durationSeconds) }}</p>
      <p v-for="(part, index) in job.outcome.parts" :key="part.partId">
        {{
          t('prints.part', {
            number: job.parts.findIndex((item: { id: string }) => item.id === part.partId) + 1 || index + 1,
          })
        }}: {{ duration(part.durationSeconds) }}
      </p>
      <p v-if="job.outcome.failureReason" class="whitespace-pre-wrap">{{ job.outcome.failureReason }}</p>
      <p v-if="job.outcome.note" class="whitespace-pre-wrap">{{ job.outcome.note }}</p>
      <p>
        {{ t('outcome.planned') }}: {{ money(job.totalCost, job.currency) }} · {{ t('outcome.variance') }}:
        {{ money(variance, job.currency) }}
      </p>
      <CommonCostBreakdown v-bind="job.outcome.costs" />
      <ul class="text-sm">
        <li v-for="line in job.outcome.filaments" :key="line.usageId">
          {{ usageName(line.usageId) }}: {{ line.usedGrams }} g
        </li>
      </ul>
      <UButton
        v-if="job.outcome.status === 'FAILED' && !job.archivedAt"
        :label="t('outcome.retry')"
        :loading="saving"
        @click="retry"
      />
      <UButton
        v-if="!job.archivedAt"
        :label="t('outcome.correct')"
        color="neutral"
        @click="beginCorrection"
      />
      <details v-if="job.outcome.history.length > 1">
        <summary>{{ t('outcome.history') }}</summary>
        <ul class="space-y-2 py-3">
          <li v-for="entry in job.outcome.history" :key="entry.revision">
            {{ t('outcome.revision', { revision: entry.revision }) }} · {{ dateTime(entry.recordedAt) }} ·
            {{ t(`outcome.${entry.status}`) }} · {{ money(entry.costs.totalCost, job.currency) }}
            <p>{{ entry.note }}</p>
          </li>
        </ul>
      </details>
    </div>
    <UForm
      v-if="!job.outcome || correcting"
      :schema="formSchema"
      :state="form"
      class="space-y-4"
      @submit="save"
    >
      <p class="text-sm text-muted">{{ t('outcome.pendingHelp') }}</p>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField name="status" :label="t('outcome.title')" required
          ><USelect v-model="form.status" :items="statusOptions" class="w-full"
        /></UFormField>
        <UFormField
          v-if="job.parts.length === 1"
          name="durationSeconds"
          :label="t('outcome.duration')"
          required
          ><UInput v-model.number="form.durationSeconds" type="number" min="0" step="1" class="w-full"
        /></UFormField>
        <UFormField
          v-for="(part, index) in form.parts"
          :key="part.partId"
          :name="`parts.${index}.durationSeconds`"
          :label="`${t('prints.part', { number: index + 1 })} · ${t('outcome.duration')}`"
          required
        >
          <UInput v-model.number="part.durationSeconds" type="number" min="0" step="1" class="w-full" />
        </UFormField>
        <UFormField
          v-for="(line, index) in form.filaments"
          :key="line.usageId"
          :name="`filaments.${index}.usedGrams`"
          :label="`${usageName(line.usageId)} · ${t('outcome.grams')}`"
          required
          ><UInput v-model="line.usedGrams" type="text" inputmode="decimal" class="w-full"
        /></UFormField>
      </div>
      <UFormField v-if="form.status === 'FAILED'" name="failureReason" :label="t('outcome.reason')" required
        ><UTextarea v-model="form.failureReason" class="w-full"
      /></UFormField>
      <UFormField name="note" :label="t('master.note')" :required="correcting"
        ><UTextarea v-model="form.note" class="w-full"
      /></UFormField>
      <UButton type="submit" :label="t('outcome.record')" :loading="saving" :disabled="!!job.archivedAt" />
    </UForm>
    <div class="mt-4 flex flex-wrap gap-3 text-sm">
      <NuxtLink v-if="job.retryOf" :to="`/prints/${job.retryOf.id}`" class="text-primary underline"
        >{{ t('outcome.retryOf') }}: {{ job.retryOf.name }}</NuxtLink
      >
      <NuxtLink
        v-for="item in job.retries"
        :key="item.id"
        :to="`/prints/${item.id}`"
        class="text-primary underline"
        >{{ t('outcome.retry') }}: {{ item.name }}</NuxtLink
      >
    </div>
  </UCard>
</template>

<script setup lang="ts">
import Decimal from 'decimal.js';
import { createPrintOutcomeCorrectionSchema, createPrintOutcomeSchema } from '#shared/schemas/print-outcomes';
import type { PrintJobDto } from '#shared/types/prints';
const props = defineProps<{ job: PrintJobDto }>();
const emit = defineEmits<{ recorded: [job: PrintJobDto] }>();
const { t } = useI18n();
const { money, dateTime, duration } = useFormatting();
const usageName = (id: string) => {
  const name = props.job.filamentUsages.find((usage) => usage.id === id)?.name;
  const index = props.job.parts.findIndex((part) => part.filamentUsages.some((usage) => usage.id === id));
  return props.job.parts.length > 1 ? `${t('prints.part', { number: index + 1 })} · ${name}` : name;
};
const error = ref('');
const saving = ref(false);
const correcting = ref(false);
const form = reactive({
  expectedRevision: 1,
  operationKey: crypto.randomUUID(),
  status: 'SUCCESS',
  durationSeconds: props.job.totalDurationSeconds,
  parts:
    props.job.parts.length > 1
      ? props.job.parts.map((part) => ({ partId: part.id, durationSeconds: part.totalDurationSeconds }))
      : undefined,
  filaments: props.job.filamentUsages.map((line) => ({ usageId: line.id, usedGrams: line.usedGrams })),
  failureReason: '',
  note: '',
});
const statusOptions = computed(() =>
  ['SUCCESS', 'FAILED'].map((value) => ({ value, label: t(`outcome.${value}`) })),
);
const validationMessages = computed(() => ({
  failureReasonRequired: t('validation.outcomeFailureReasonRequired'),
  uniqueUsageRequired: t('validation.outcomeUniqueUsageRequired'),
  correctionNoteRequired: t('validation.outcomeCorrectionNoteRequired'),
}));
const formSchema = computed(() =>
  correcting.value
    ? createPrintOutcomeCorrectionSchema(validationMessages.value)
    : createPrintOutcomeSchema(validationMessages.value),
);
const variance = computed(() =>
  new Decimal(props.job.outcome?.costs.totalCost ?? '0').minus(props.job.totalCost).toFixed(),
);
function beginCorrection() {
  if (!props.job.outcome) return;
  const outcome = props.job.outcome;
  Object.assign(form, {
    status: outcome.status,
    durationSeconds: outcome.durationSeconds,
    parts: outcome.parts
      ? props.job.parts.map((part) => ({ ...outcome.parts!.find((actual) => actual.partId === part.id)! }))
      : undefined,
    filaments: outcome.filaments.map((line) => ({ ...line })),
    failureReason: outcome.failureReason ?? '',
    note: '',
    expectedRevision: outcome.revision,
    operationKey: crypto.randomUUID(),
  });
  correcting.value = true;
}
watch(
  () => form.parts,
  (parts) => {
    if (parts) form.durationSeconds = parts.reduce((total, part) => total + part.durationSeconds, 0);
  },
  { deep: true },
);
async function save() {
  saving.value = true;
  try {
    emit(
      'recorded',
      await $fetch<PrintJobDto>(`/api/prints/${props.job.id}/outcome${correcting.value ? '/correct' : ''}`, {
        method: 'POST',
        body: { ...form, failureReason: form.status === 'FAILED' ? form.failureReason : null },
      }),
    );
    correcting.value = false;
    error.value = '';
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    saving.value = false;
  }
}
async function retry() {
  saving.value = true;
  try {
    const draft = await $fetch<PrintJobDto>(`/api/prints/${props.job.id}/retry`, { method: 'POST' });
    await navigateTo(`/prints/${draft.id}`);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    saving.value = false;
  }
}
</script>
