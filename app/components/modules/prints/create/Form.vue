<template>
  <UForm
    :id="formId"
    ref="formRef"
    :schema="multipartPrintDraftFormSchema"
    :state="form"
    class="space-y-6"
    @submit="persist"
  >
    <UAlert v-if="error" color="error" :description="error" />

    <div v-if="loading" class="flex min-h-72 items-center justify-center">
      <UIcon name="i-tabler-loader-2" class="size-8 animate-spin" />
    </div>

    <template v-else>
      <UStepper
        v-model="currentStep"
        color="neutral"
        size="sm"
        :items="stepperItems"
        :ui="{
          header: 'pb-5',
          content: 'min-h-72',
        }"
      >
        <template #general>
          <div class="grid gap-4 md:grid-cols-2">
            <UFormField name="name" :label="t('master.name')" required>
              <UInput v-model="form.name" class="w-full" icon="i-tabler-tag" autofocus />
            </UFormField>
            <UFormField
              name="quantity"
              :label="t('prints.quantity')"
              :help="t('prints.quantityHelp')"
              required
            >
              <UInput v-model="form.quantity" class="w-full" type="number" min="1" max="1000000" step="1" />
            </UFormField>
            <UFormField name="salesValue" :label="t('sales.value')" :help="t('sales.help')">
              <UInput v-model="form.salesValue" inputmode="decimal" class="w-full" />
            </UFormField>
            <UFormField
              v-if="printSeriesEnabled"
              name="seriesId"
              :label="t('nav.series')"
              :help="t('series.customerRule')"
              ><CommonSeriesSelect v-model="form.seriesId" @customer="form.customerId = $event"
            /></UFormField>
            <UFormField name="customerId" :label="t('nav.customers')">
              <CommonEntitySelect v-model="form.customerId" resource="customers" nullable />
            </UFormField>
          </div>
          <div class="mt-5 space-y-4">
            <UCard
              v-for="(part, index) in form.parts"
              :key="part.key"
              role="group"
              :aria-label="t('prints.part', { number: index + 1 })"
            >
              <template #header
                ><div class="flex items-center justify-between gap-3">
                  <h3 class="font-semibold">{{ t('prints.part', { number: index + 1 }) }}</h3>
                  <UButton
                    icon="i-tabler-trash"
                    color="error"
                    variant="ghost"
                    :aria-label="t('prints.removePart', { number: index + 1 })"
                    :disabled="form.parts.length === 1"
                    @click="form.parts.splice(index, 1)"
                  /></div
              ></template>
              <ModulesPrintsPartForm
                v-model="form.parts[index]!"
                :part-index="index"
                section="general"
                @error="error = $event"
              />
            </UCard>
            <UButton
              icon="i-tabler-plus"
              :label="t('prints.addPart')"
              @click="form.parts.push(createPrintPartForm())"
            />
          </div>
        </template>

        <template #hotends>
          <div class="space-y-4">
            <UCard
              v-for="(part, index) in form.parts"
              :key="part.key"
              role="group"
              :aria-label="t('prints.part', { number: index + 1 })"
            >
              <template #header
                ><h3 class="font-semibold">{{ t('prints.part', { number: index + 1 }) }}</h3></template
              >
              <ModulesPrintsPartForm
                v-model="form.parts[index]!"
                :part-index="index"
                section="hotends"
                @error="error = $event"
              />
            </UCard>
          </div>
        </template>

        <template #materials>
          <div class="space-y-4">
            <UCard
              v-for="(part, index) in form.parts"
              :key="part.key"
              role="group"
              :aria-label="t('prints.part', { number: index + 1 })"
            >
              <template #header
                ><h3 class="font-semibold">{{ t('prints.part', { number: index + 1 }) }}</h3></template
              >
              <ModulesPrintsPartForm
                v-model="form.parts[index]!"
                :part-index="index"
                section="materials"
                @error="error = $event"
              />
            </UCard>
          </div>
        </template>

        <template #review>
          <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <UFormField name="notes" :label="t('master.note')">
              <UTextarea v-model="form.notes" class="w-full" :rows="8" icon="i-tabler-notes" />
            </UFormField>
            <div class="rounded-lg border border-default p-4">
              <div class="mb-4 flex items-center gap-2">
                <h3 class="font-semibold">{{ t('prints.costPreview') }}</h3>
                <UIcon v-if="previewPending" name="i-tabler-loader-2" class="animate-spin" />
              </div>
              <CommonCostBreakdown v-if="costs" v-bind="costs" />
              <CommonFinancialSummary
                v-if="costs?.financials"
                :value="costs.financials"
                :currency="costs.currency"
                class="mt-3"
              />
              <p v-if="!costs" class="text-sm text-muted">{{ t('prints.previewHint') }}</p>
            </div>
          </div>
        </template>
      </UStepper>
    </template>
  </UForm>
</template>

<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui';
import type { PrintCalculationResult } from '#shared/domain/print-calculation';
import { multipartPrintDraftFormSchema } from '#shared/schemas/prints';
import type { PrintJobDto } from '#shared/types/prints';

const emit = defineEmits<{
  created: [print: PrintJobDto];
}>();

const {
  formId = 'new-print-form',
  initialSeriesId = null,
  initialCustomerId = null,
} = defineProps<{
  formId?: string;
  initialSeriesId?: string | null;
  initialCustomerId?: string | null;
}>();

const { t } = useI18n();
const { enabled: spoolManagementEnabled, load: loadSpoolManagement } = useSpoolManagement();
const { load: loadFeatures, printSeriesEnabled } = useFeatures();
const formRef = ref<{
  validate: (options: { name?: string[] }) => Promise<unknown>;
} | null>(null);
const currentStep = ref(0);
const loading = ref(true);
const saving = ref(false);
const previewPending = ref(false);
const error = ref('');
const costs = ref<PrintCalculationResult | null>(null);
let previewTimer: ReturnType<typeof setTimeout> | undefined;
let hydrating = true;

const form = reactive({
  name: '',
  quantity: 1,
  salesValue: '',
  customerId: initialCustomerId as string | null,
  seriesId: initialSeriesId as string | null,
  parts: [createPrintPartForm()],
  notes: '',
});

const stepperItems = computed<StepperItem[]>(() => [
  { slot: 'general', title: t('prints.steps.general'), icon: 'i-tabler-info-circle' },
  { slot: 'hotends', title: t('prints.steps.hotends'), icon: 'i-tabler-clock' },
  { slot: 'materials', title: t('prints.steps.materials'), icon: 'i-tabler-disc' },
  { slot: 'review', title: t('prints.steps.review'), icon: 'i-tabler-calculator' },
]);

const fieldsByStep = computed(() => [
  [
    'name',
    'quantity',
    'salesValue',
    'seriesId',
    'customerId',
    ...form.parts.flatMap((_, index) => [`parts.${index}.printerId`, `parts.${index}.buildPlateId`]),
  ],
  form.parts.map((_, index) => `parts.${index}.hotends`),
  form.parts.flatMap((_, index) => [`parts.${index}.otherComponentIds`, `parts.${index}.filaments`]),
]);

function payload() {
  return {
    name: form.name,
    quantity: Number(form.quantity),
    salesValue: form.salesValue || null,
    customerId: form.customerId,
    seriesId: printSeriesEnabled.value ? form.seriesId : null,
    parts: form.parts.map((part) => printPartPayload(part, spoolManagementEnabled.value)),
    notes: form.notes,
  };
}

async function nextStep() {
  const fields = fieldsByStep.value[currentStep.value];
  if (!fields) return;

  try {
    await formRef.value?.validate({ name: fields });
    currentStep.value += 1;
  } catch {
    // UForm displays validation errors next to the affected fields.
  }
}

function previousStep() {
  if (currentStep.value > 0) currentStep.value -= 1;
}

const lastStep = computed(() => stepperItems.value.length - 1);

defineExpose({ currentStep, lastStep, loading, saving, nextStep, previousStep });

async function load() {
  await Promise.all([loadFeatures(), loadSpoolManagement()]);
  hydrating = false;
  loading.value = false;
}

async function preview() {
  if (!multipartPrintDraftFormSchema.safeParse(form).success) {
    costs.value = null;
    return;
  }

  previewPending.value = true;
  try {
    costs.value = await $fetch<PrintCalculationResult>('/api/prints/calculate', {
      method: 'POST',
      body: payload(),
    });
    error.value = '';
  } catch (reason) {
    costs.value = null;
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    previewPending.value = false;
  }
}

async function persist() {
  saving.value = true;
  try {
    const print = await $fetch<PrintJobDto>('/api/prints', { method: 'POST', body: payload() });
    emit('created', print);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    saving.value = false;
  }
}

watch(
  form,
  () => {
    if (hydrating) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(preview, 300);
  },
  { deep: true },
);

onMounted(() =>
  load().catch((reason) => {
    error.value = reason instanceof Error ? reason.message : String(reason);
    loading.value = false;
  }),
);
onBeforeUnmount(() => clearTimeout(previewTimer));
</script>
