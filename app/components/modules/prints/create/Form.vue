<template>
  <UForm
    :id="formId"
    ref="formRef"
    :schema="printDraftFormSchema"
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
            <UFormField name="printerId" :label="t('nav.printers')" required>
              <CommonEntitySelect v-model="form.printerId" resource="printers" />
            </UFormField>
            <UFormField name="buildPlateId" :label="t('master.buildPlate')" required>
              <CommonEntitySelect
                v-model="form.buildPlateId"
                resource="components"
                :query="{ printerId: form.printerId, type: 'BUILD_PLATE' }"
                :defaults="{ type: 'BUILD_PLATE', printerIds: [form.printerId] }"
                :disabled="!form.printerId"
                :aria-label="t('master.buildPlate')"
              />
            </UFormField>
          </div>
        </template>

        <template #hotends>
          <div class="space-y-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="font-semibold">{{ t('prints.hotends') }}</h3>
                <p class="text-sm text-muted">{{ t('prints.hotendsHelp') }}</p>
              </div>
              <UButton icon="i-tabler-plus" size="sm" :label="t('common.add')" @click="addHotend" />
            </div>
            <div
              v-for="(hotend, index) in form.hotends"
              :key="index"
              class="grid items-start gap-3 rounded-lg border border-default p-3 md:grid-cols-[1fr_8rem_8rem_auto]"
            >
              <UFormField :name="`hotends.${index}.componentId`" :label="t('master.hotend')" required>
                <CommonEntitySelect
                  v-model="hotend.componentId"
                  resource="components"
                  :query="{ printerId: form.printerId, type: 'HOTEND' }"
                  :defaults="{ type: 'HOTEND', printerIds: [form.printerId] }"
                  :disabled="!form.printerId"
                  :aria-label="t('master.hotend')"
                />
              </UFormField>
              <UFormField :name="`hotends.${index}.hours`" :label="t('prints.hours')">
                <UInput
                  v-model="hotend.hours"
                  class="w-full"
                  type="number"
                  min="0"
                  step="1"
                  icon="i-tabler-clock-hour-4"
                >
                  <template #trailing><span class="text-xs text-muted">h</span></template>
                </UInput>
              </UFormField>
              <UFormField :name="`hotends.${index}.minutes`" :label="t('prints.minutes')">
                <UInput
                  v-model="hotend.minutes"
                  class="w-full"
                  type="number"
                  min="0"
                  max="59"
                  step="1"
                  icon="i-tabler-clock"
                >
                  <template #trailing><span class="text-xs text-muted">min</span></template>
                </UInput>
              </UFormField>
              <UButton
                class="md:mt-6"
                color="error"
                variant="ghost"
                icon="i-tabler-trash"
                :aria-label="t('common.delete')"
                :disabled="form.hotends.length === 1"
                @click="form.hotends.splice(index, 1)"
              />
            </div>
          </div>
        </template>

        <template #materials>
          <div class="space-y-6">
            <UFormField name="otherComponentIds" :label="t('prints.otherComponents')">
              <CommonEntitySelect
                v-model="form.otherComponentIds"
                :aria-label="t('prints.otherComponents')"
                resource="components"
                multiple
                :query="{ printerId: form.printerId, type: 'OTHER' }"
                :defaults="{ type: 'OTHER', printerIds: [form.printerId] }"
                :disabled="!form.printerId"
              />
            </UFormField>

            <div class="space-y-4">
              <div class="flex items-center justify-between gap-3">
                <h3 class="font-semibold">{{ t('nav.filaments') }}</h3>
                <UButton icon="i-tabler-plus" size="sm" :label="t('common.add')" @click="addFilament" />
              </div>
              <div
                v-for="(filament, index) in form.filaments"
                :key="index"
                class="grid items-start gap-3 rounded-lg border border-default p-3"
                :class="
                  spoolManagementEnabled
                    ? 'md:grid-cols-[1fr_1fr_10rem_auto]'
                    : 'md:grid-cols-[1fr_10rem_auto]'
                "
              >
                <UFormField :name="`filaments.${index}.filamentId`" :label="t('nav.filaments')" required>
                  <CommonFilamentSelect v-model="filament.filamentId" class="w-full" />
                </UFormField>
                <UFormField
                  v-if="spoolManagementEnabled"
                  :name="`filaments.${index}.spoolId`"
                  :label="t('nav.spools')"
                  required
                >
                  <CommonSpoolSelect v-model="filament.spoolId" :filament-id="filament.filamentId" />
                </UFormField>
                <UFormField :name="`filaments.${index}.usedGrams`" :label="t('prints.usedGrams')" required>
                  <UInput
                    v-model="filament.usedGrams"
                    class="w-full"
                    type="number"
                    min="0.01"
                    step="0.01"
                    icon="i-tabler-scale"
                  >
                    <template #trailing><span class="text-xs text-muted">g</span></template>
                  </UInput>
                </UFormField>
                <UButton
                  class="md:mt-6"
                  color="error"
                  variant="ghost"
                  icon="i-tabler-trash"
                  :aria-label="t('common.delete')"
                  :disabled="form.filaments.length === 1"
                  @click="form.filaments.splice(index, 1)"
                />
              </div>
            </div>
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
import { printDraftFormSchema } from '#shared/schemas/prints';
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
  printerId: '',
  buildPlateId: '',
  hotends: [{ componentId: '', hours: 1, minutes: 0 }],
  otherComponentIds: [] as string[],
  filaments: [{ filamentId: '', spoolId: undefined as string | undefined, usedGrams: '1' }],
  notes: '',
});

const stepperItems = computed<StepperItem[]>(() => [
  { slot: 'general', title: t('prints.steps.general'), icon: 'i-tabler-info-circle' },
  { slot: 'hotends', title: t('prints.steps.hotends'), icon: 'i-tabler-clock' },
  { slot: 'materials', title: t('prints.steps.materials'), icon: 'i-tabler-disc' },
  { slot: 'review', title: t('prints.steps.review'), icon: 'i-tabler-calculator' },
]);

const fieldsByStep: Array<Array<keyof typeof form>> = [
  ['name', 'quantity', 'salesValue', 'seriesId', 'customerId', 'printerId', 'buildPlateId'],
  ['hotends'],
  ['otherComponentIds', 'filaments'],
];

function payload() {
  return {
    name: form.name,
    quantity: Number(form.quantity),
    salesValue: form.salesValue || null,
    customerId: form.customerId,
    seriesId: printSeriesEnabled.value ? form.seriesId : null,
    printerId: form.printerId,
    buildPlateId: form.buildPlateId,
    hotends: form.hotends.map((entry) => ({
      componentId: entry.componentId,
      durationSeconds: Number(entry.hours) * 3600 + Number(entry.minutes) * 60,
    })),
    otherComponentIds: form.otherComponentIds,
    filaments: form.filaments.map((entry) => ({
      filamentId: entry.filamentId,
      ...(spoolManagementEnabled.value ? { spoolId: entry.spoolId } : {}),
      usedGrams: entry.usedGrams,
    })),
    notes: form.notes,
  };
}

function addHotend() {
  form.hotends.push({ componentId: '', hours: 1, minutes: 0 });
}

function addFilament() {
  form.filaments.push({ filamentId: '', spoolId: undefined as string | undefined, usedGrams: '1' });
}

async function applyComponentDefaults() {
  const printerId = form.printerId;
  form.buildPlateId = '';
  form.hotends = [{ componentId: '', hours: 1, minutes: 0 }];
  form.otherComponentIds = [];
  let defaults;
  try {
    defaults = await loadPrintComponentDefaults(printerId);
  } catch (reason) {
    if (form.printerId === printerId) error.value = String(reason);
    return;
  }
  if (form.printerId !== printerId) return;
  form.buildPlateId ||= defaults.buildPlateId;
  if (!form.hotends.some((entry) => entry.componentId))
    form.hotends = defaults.hotendIds.length
      ? defaults.hotendIds.map((componentId) => ({ componentId, hours: 1, minutes: 0 }))
      : [{ componentId: '', hours: 1, minutes: 0 }];
  if (!form.otherComponentIds.length) form.otherComponentIds = defaults.otherComponentIds;
}

async function nextStep() {
  const fields = fieldsByStep[currentStep.value];
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
  if (!printDraftFormSchema.safeParse(form).success) {
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
  () => form.printerId,
  () => {
    if (hydrating) return;
    applyComponentDefaults();
  },
);

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
