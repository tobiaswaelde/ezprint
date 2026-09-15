<template>
  <div class="space-y-5">
    <div v-if="job" class="flex flex-wrap gap-3 text-sm">
      <NuxtLink
        v-if="job.series && printSeriesEnabled"
        :to="`/series/${job.series.id}`"
        class="text-primary underline"
        >{{ job.series.name }}</NuxtLink
      ><span v-else-if="job.series">{{ job.series.name }}</span
      ><NuxtLink v-if="job.customer" :to="`/customers/${job.customer.id}`" class="text-primary underline">{{
        job.customer.name
      }}</NuxtLink
      ><NuxtLink v-if="job.repeatOf" :to="`/prints/${job.repeatOf.id}`" class="text-primary underline"
        >{{ t('history.repeatOf') }}: {{ job.repeatOf.name }}</NuxtLink
      ><NuxtLink
        v-for="item in job.repeats"
        :key="item.id"
        :to="`/prints/${item.id}`"
        class="text-primary underline"
        >{{ t('history.repeat') }}: {{ item.name }}</NuxtLink
      >
    </div>
    <UAlert v-if="error" color="error" :description="error" />
    <UAlert
      v-if="job && job.status !== 'DRAFT'"
      color="success"
      icon="i-tabler-lock"
      :title="t(`prints.${job.status.toLowerCase()}`)"
      :description="t('prints.immutable')"
    />

    <UCard v-if="job">
      <template #header>
        <h2 class="font-semibold">{{ t('prints.workflow') }}</h2>
      </template>
      <div class="grid items-end gap-4 md:grid-cols-2">
        <UFormField :label="t('prints.status')">
          <div class="flex items-center gap-2">
            <USelect
              v-model="selectedStatus"
              class="min-w-44 flex-1"
              value-key="value"
              :items="statusOptions"
              :disabled="workflowSaving"
            />
            <CommonConfirmButton
              v-if="job.status === 'DRAFT' && selectedStatus !== 'DRAFT'"
              color="primary"
              :label="t('prints.updateStatus')"
              :confirmation="t('prints.statusChangeConfirmation')"
              :disabled="workflowSaving"
              @confirm="changeStatus"
            />
            <UButton
              v-else
              :label="t('prints.updateStatus')"
              :loading="workflowSaving"
              :disabled="selectedStatus === job.status"
              @click="changeStatus"
            />
          </div>
        </UFormField>
        <UFormField :label="t('prints.payment')">
          <div class="flex items-center gap-2">
            <UBadge :color="job.paidAt ? 'success' : 'neutral'" variant="subtle">
              {{ t(job.paidAt ? 'prints.paid' : 'prints.unpaid') }}
            </UBadge>
            <UButton
              color="neutral"
              variant="outline"
              :icon="job.paidAt ? 'i-tabler-cash-off' : 'i-tabler-cash'"
              :label="t(job.paidAt ? 'prints.markUnpaid' : 'prints.markPaid')"
              :loading="paymentSaving"
              @click="togglePaid"
            />
            <span v-if="job.paidAt" class="text-sm text-muted">{{ dateTime(job.paidAt) }}</span>
          </div>
        </UFormField>
      </div>
    </UCard>

    <CommonFinancialSummary v-if="job?.outcome" :value="job.financials" :currency="job.currency" />
    <ModulesPrintsOutcome v-if="job?.status === 'DONE'" :key="job.id" :job="job" @recorded="job = $event" />
    <NuxtLink v-else-if="job?.retryOf" :to="`/prints/${job.retryOf.id}`" class="text-primary underline"
      >{{ t('outcome.retryOf') }}: {{ job.retryOf.name }}</NuxtLink
    >

    <UForm
      ref="editorForm"
      :schema="printDraftFormSchema"
      :state="form"
      class="space-y-5"
      @submit="submitValidated"
      @error="resetSubmitIntent"
    >
      <fieldset :disabled="job?.status !== 'DRAFT' || loading" class="space-y-5 disabled:opacity-75">
        <UCard>
          <div class="grid gap-4 md:grid-cols-2">
            <UFormField name="name" :label="t('master.name')" required
              ><UInput v-model="form.name" class="w-full" icon="i-tabler-tag"
            /></UFormField>
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
            <UFormField name="customerId" :label="t('nav.customers')"
              ><USelectMenu
                v-model="form.customerId"
                class="w-full"
                icon="i-tabler-user"
                :aria-label="t('nav.customers')"
                :search-input="{ placeholder: t('common.search') }"
                value-key="value"
                :items="customerOptions"
            /></UFormField>
            <UFormField name="printerId" :label="t('nav.printers')" required
              ><USelectMenu
                v-model="form.printerId"
                class="w-full"
                icon="i-tabler-printer"
                :aria-label="t('nav.printers')"
                :search-input="{ placeholder: t('common.search') }"
                value-key="value"
                :items="printerOptions"
            /></UFormField>
            <UFormField name="buildPlateId" :label="t('master.buildPlate')" required
              ><USelectMenu
                v-model="form.buildPlateId"
                class="w-full"
                icon="i-tabler-square"
                :aria-label="t('master.buildPlate')"
                :search-input="{ placeholder: t('common.search') }"
                value-key="value"
                :items="buildPlateOptions"
            /></UFormField>
            <UFormField name="notes" :label="t('master.note')" class="md:col-span-2"
              ><UTextarea v-model="form.notes" class="w-full" icon="i-tabler-notes"
            /></UFormField>
          </div>
        </UCard>

        <UCard>
          <template #header
            ><div class="flex items-center justify-between">
              <h2 class="font-semibold">{{ t('prints.hotends') }}</h2>
              <UButton icon="i-tabler-plus" size="sm" :label="t('common.add')" @click="addHotend" /></div
          ></template>
          <div class="space-y-3">
            <div
              v-for="(hotend, index) in form.hotends"
              :key="index"
              class="grid items-start gap-3 md:grid-cols-[1fr_8rem_8rem_auto]"
            >
              <UFormField :name="`hotends.${index}.componentId`" :label="t('master.hotend')" required
                ><USelectMenu
                  v-model="hotend.componentId"
                  class="w-full"
                  icon="i-tabler-flame"
                  :aria-label="t('master.hotend')"
                  :search-input="{ placeholder: t('common.search') }"
                  value-key="value"
                  :items="hotendOptions"
              /></UFormField>
              <UFormField :name="`hotends.${index}.hours`" :label="t('prints.hours')"
                ><UInput
                  v-model="hotend.hours"
                  class="w-full"
                  type="number"
                  min="0"
                  step="1"
                  icon="i-tabler-clock-hour-4"
                >
                  <template #trailing>
                    <span class="text-xs text-muted">h</span>
                  </template>
                </UInput></UFormField
              >
              <UFormField :name="`hotends.${index}.minutes`" :label="t('prints.minutes')"
                ><UInput
                  v-model="hotend.minutes"
                  class="w-full"
                  type="number"
                  min="0"
                  max="59"
                  step="1"
                  icon="i-tabler-clock"
                >
                  <template #trailing>
                    <span class="text-xs text-muted">min</span>
                  </template>
                </UInput></UFormField
              >
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
        </UCard>

        <UCard>
          <template #header
            ><h2 class="font-semibold">{{ t('prints.components') }}</h2></template
          >
          <div class="grid gap-4 md:grid-cols-2">
            <UFormField name="otherComponentIds" :label="t('prints.otherComponents')"
              ><USelectMenu
                v-model="form.otherComponentIds"
                class="w-full"
                icon="i-tabler-components"
                multiple
                value-key="value"
                :items="otherOptions"
            /></UFormField>
          </div>
        </UCard>

        <UCard>
          <template #header
            ><div class="flex items-center justify-between">
              <h2 class="font-semibold">{{ t('nav.filaments') }}</h2>
              <UButton icon="i-tabler-plus" size="sm" :label="t('common.add')" @click="addFilament" /></div
          ></template>
          <div class="space-y-3">
            <div
              v-for="(filament, index) in form.filaments"
              :key="index"
              class="grid items-start gap-3"
              :class="
                spoolManagementEnabled ? 'md:grid-cols-[1fr_1fr_10rem_auto]' : 'md:grid-cols-[1fr_10rem_auto]'
              "
            >
              <UFormField :name="`filaments.${index}.filamentId`" :label="t('nav.filaments')" required
                ><CommonFilamentSelect v-model="filament.filamentId" class="w-full" :items="filamentOptions"
              /></UFormField>
              <UFormField
                v-if="spoolManagementEnabled"
                :name="`filaments.${index}.spoolId`"
                :label="t('nav.spools')"
                required
              >
                <CommonSpoolSelect v-model="filament.spoolId" :filament-id="filament.filamentId" />
              </UFormField>
              <UFormField :name="`filaments.${index}.usedGrams`" :label="t('prints.usedGrams')" required
                ><UInput
                  v-model="filament.usedGrams"
                  class="w-full"
                  type="number"
                  min="0.01"
                  step="0.01"
                  icon="i-tabler-scale"
                >
                  <template #trailing>
                    <span class="text-xs text-muted">g</span>
                  </template>
                </UInput></UFormField
              >
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
        </UCard>
      </fieldset>

      <UCard>
        <template #header
          ><div class="flex items-center gap-2">
            <h2 class="font-semibold">{{ t('prints.costPreview') }}</h2>
            <UIcon v-if="previewPending" name="i-tabler-loader-2" class="animate-spin" /></div
        ></template>
        <CommonCostBreakdown v-if="costs" v-bind="costs" />
        <CommonFinancialSummary
          v-if="costs?.financials"
          :value="costs.financials"
          :currency="costs.currency"
          class="mt-3"
        />
        <p v-if="!costs" class="text-sm text-muted">{{ t('prints.previewHint') }}</p>
      </UCard>

      <UCard v-if="job && job.status !== 'DRAFT' && job.snapshot">
        <template #header>
          <div>
            <h2 class="font-semibold">{{ t('prints.snapshotSources') }}</h2>
            <p class="text-xs text-muted">
              {{ t('prints.formulaVersion') }} {{ job.snapshot.formulaVersion }} ·
              {{ dateTime(job.snapshot.calculatedAt) }}
            </p>
          </div>
        </template>
        <ul class="divide-y divide-default text-sm">
          <li class="flex justify-between gap-4 py-2">
            <span>{{ job.snapshot.printerName }}</span>
            <span
              >{{ job.snapshot.printerPurchasePrice }} /
              {{ job.snapshot.printerExpectedLifetimeHours }} h</span
            >
          </li>
          <li v-for="usage in job.componentUsages" :key="usage.id" class="flex justify-between gap-4 py-2">
            <span>{{ usage.name }}</span
            ><span>{{ money(usage.lineCost, job.currency) }}</span>
          </li>
          <li v-for="usage in job.filamentUsages" :key="usage.id" class="flex justify-between gap-4 py-2">
            <span>{{ usage.name }} · {{ usage.usedGrams }} g</span
            ><span>{{ money(usage.lineCost, job.currency) }}</span>
          </li>
        </ul>
      </UCard>

      <div
        class="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-default bg-default/95 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
      >
        <UButton
          v-if="job"
          color="neutral"
          variant="outline"
          :label="t(job.archivedAt ? 'common.restore' : 'common.archive')"
          @click="toggleArchive"
        />
        <UButton
          v-if="job"
          :to="{
            path: '/settings/bambuddy',
            query: { printId: job.id, printerId: job.printerId },
            hash: '#integration-bambubuddy-tools',
          }"
          :label="t('integration.bambu')"
          color="neutral"
        />
        <UButton
          v-if="job?.status === 'DONE'"
          :to="`/reports/prints/${job.id}`"
          :label="t('report.title')"
          color="neutral"
        />
        <UButton
          v-if="job?.status === 'DONE' && !job.archivedAt"
          :label="t('history.repeat')"
          color="neutral"
          @click="repeatOrder"
        />
        <UButton
          v-if="job"
          color="neutral"
          variant="outline"
          icon="i-tabler-copy"
          :label="t('prints.duplicate')"
          @click="duplicate"
        />
        <UButton
          v-if="job?.status === 'DRAFT'"
          type="submit"
          color="neutral"
          variant="outline"
          icon="i-tabler-device-floppy"
          :loading="saving"
          :label="t('prints.saveDraft')"
          @click="submitIntent = { type: 'save' }"
        />
      </div>
    </UForm>
  </div>
</template>

<script setup lang="ts">
import type { PrintCalculationResult } from '#shared/domain/print-calculation';
import { printDraftFormSchema, printStatuses } from '#shared/schemas/prints';
import type { PrintStatus } from '#shared/schemas/prints';
import type { MasterDataListItem, PaginatedResponse } from '#shared/types/master-data';
import type { PrintJobDto } from '#shared/types/prints';

const props = defineProps<{ printId?: string }>();
const { t } = useI18n();
const { enabled: spoolManagementEnabled, load: loadSpoolManagement } = useSpoolManagement();
const { load: loadFeatures, printSeriesEnabled } = useFeatures();
const { money, dateTime } = useFormatting();
const job = ref<PrintJobDto | null>(null);
const loading = ref(true);
const saving = ref(false);
const workflowSaving = ref(false);
const paymentSaving = ref(false);
const previewPending = ref(false);
const error = ref('');
const costs = ref<PrintCalculationResult | null>(null);
const editorForm = ref<{ submit: () => Promise<void> } | null>(null);
const customers = ref<MasterDataListItem[]>([]);
const printers = ref<MasterDataListItem[]>([]);
const components = ref<MasterDataListItem[]>([]);
const filaments = ref<MasterDataListItem[]>([]);
let previewTimer: ReturnType<typeof setTimeout> | undefined;
let hydrating = true;
const selectedStatus = ref<PrintStatus>('DRAFT');
const submitIntent = ref<{ type: 'save' } | { type: 'status'; status: PrintStatus }>({ type: 'save' });
const statusOptions = computed(() =>
  printStatuses.map((value) => ({
    label: t(`prints.${value.toLowerCase()}`),
    value,
    disabled: value === 'DRAFT' && job.value?.status !== 'DRAFT',
  })),
);

const form = reactive({
  name: '',
  quantity: 1,
  salesValue: '',
  customerId: null as string | null,
  seriesId: null as string | null,
  printerId: '',
  buildPlateId: '',
  hotends: [{ componentId: '', hours: 1, minutes: 0 }],
  otherComponentIds: [] as string[],
  filaments: [{ filamentId: '', spoolId: undefined as string | undefined, usedGrams: '1' }],
  notes: '',
});

const options = (values: MasterDataListItem[]) =>
  values.map((item) => ({ label: item.name, value: item.id }));
const customerOptions = computed(() => [{ label: '—', value: null }, ...options(customers.value)]);
const printerOptions = computed(() => options(printers.value));
const compatibleComponents = computed(() =>
  components.value.filter(
    (item) => Array.isArray(item.printerIds) && item.printerIds.includes(form.printerId),
  ),
);
const buildPlateOptions = computed(() =>
  options(compatibleComponents.value.filter((item) => item.type === 'BUILD_PLATE')),
);
const hotendOptions = computed(() =>
  options(compatibleComponents.value.filter((item) => item.type === 'HOTEND')),
);
const otherOptions = computed(() =>
  options(compatibleComponents.value.filter((item) => item.type === 'OTHER')),
);
const filamentOptions = computed(() =>
  filaments.value.map((item) => ({
    label: item.name,
    value: item.id,
    colorName: String(item.colorName),
    colorHex: String(item.colorHex),
  })),
);

function payload() {
  return {
    name: form.name,
    quantity: Number(form.quantity),
    salesValue: form.salesValue || null,
    customerId: form.customerId,
    seriesId: printSeriesEnabled.value ? form.seriesId : (job.value?.seriesId ?? null),
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

function hydrate(value: PrintJobDto) {
  job.value = value;
  selectedStatus.value = value.status;
  form.name = value.name;
  form.quantity = value.quantity;
  form.salesValue = value.salesValue ?? '';
  form.customerId = value.customerId;
  form.seriesId = value.seriesId;
  form.printerId = value.printerId;
  form.buildPlateId = value.componentUsages.find((entry) => entry.type === 'BUILD_PLATE')?.componentId ?? '';
  form.hotends = value.componentUsages
    .filter((entry) => entry.type === 'HOTEND')
    .map((entry) => ({
      componentId: entry.componentId,
      hours: Math.floor(entry.appliedDurationSeconds / 3600),
      minutes: Math.floor((entry.appliedDurationSeconds % 3600) / 60),
    }));
  form.otherComponentIds = value.componentUsages
    .filter((entry) => entry.type === 'OTHER')
    .map((entry) => entry.componentId);
  form.filaments = value.filamentUsages.map((entry) => ({
    filamentId: entry.filamentId,
    spoolId: entry.spoolId ?? undefined,
    usedGrams: entry.usedGrams,
  }));
  form.notes = value.notes ?? '';
  if (value.snapshot)
    costs.value = {
      ...value.snapshot,
      financials: value.financials,
      calculationVersion: value.snapshot.formulaVersion,
      totalDurationSeconds: value.totalDurationSeconds,
      lines: [],
    };
}

async function load() {
  await Promise.all([loadFeatures(), loadSpoolManagement()]);
  const [customerResponse, printerResponse, componentResponse, filamentResponse] = await Promise.all([
    $fetch<PaginatedResponse<MasterDataListItem>>('/api/customers', { query: { pageSize: 100 } }),
    $fetch<PaginatedResponse<MasterDataListItem>>('/api/printers', { query: { pageSize: 100 } }),
    $fetch<PaginatedResponse<MasterDataListItem>>('/api/components', { query: { pageSize: 100 } }),
    $fetch<PaginatedResponse<MasterDataListItem>>('/api/filaments', { query: { pageSize: 100 } }),
  ]);
  customers.value = customerResponse.items;
  printers.value = printerResponse.items;
  components.value = componentResponse.items;
  filaments.value = filamentResponse.items;
  if (props.printId) hydrate(await $fetch<PrintJobDto>(`/api/prints/${props.printId}`));
  hydrating = false;
  loading.value = false;
}

function addHotend() {
  form.hotends.push({ componentId: '', hours: 1, minutes: 0 });
}
function addFilament() {
  form.filaments.push({ filamentId: '', spoolId: undefined as string | undefined, usedGrams: '1' });
}

function applyComponentDefaults() {
  const defaults = getPrintComponentDefaults(components.value, form.printerId);
  form.buildPlateId = defaults.buildPlateId;
  form.hotends = defaults.hotendIds.length
    ? defaults.hotendIds.map((componentId) => ({ componentId, hours: 1, minutes: 0 }))
    : [{ componentId: '', hours: 1, minutes: 0 }];
  form.otherComponentIds = defaults.otherComponentIds;
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
    const value = props.printId
      ? await $fetch<PrintJobDto>(`/api/prints/${props.printId}`, { method: 'PATCH', body: payload() })
      : await $fetch<PrintJobDto>('/api/prints', { method: 'POST', body: payload() });
    hydrate(value);
    if (!props.printId) await navigateTo(`/prints/${value.id}`);
    return true;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
    return false;
  } finally {
    saving.value = false;
  }
}

async function submitValidated() {
  const intent = submitIntent.value;
  submitIntent.value = { type: 'save' };
  if (!(await persist())) {
    if (job.value) selectedStatus.value = job.value.status;
    return;
  }
  if (intent.type !== 'status') return;
  await updateWorkflow({ status: intent.status });
}

function resetSubmitIntent() {
  submitIntent.value = { type: 'save' };
  if (job.value) selectedStatus.value = job.value.status;
}

async function updateWorkflow(body: { status?: PrintStatus; paid?: boolean }) {
  if (!job.value) return;
  const value = await $fetch<PrintJobDto>(`/api/prints/${job.value.id}`, { method: 'PATCH', body });
  job.value = value;
  selectedStatus.value = value.status;
}

async function changeStatus() {
  if (!job.value || selectedStatus.value === job.value.status) return;
  workflowSaving.value = true;
  try {
    if (job.value.status === 'DRAFT') {
      submitIntent.value = { type: 'status', status: selectedStatus.value };
      await editorForm.value?.submit();
    } else {
      await updateWorkflow({ status: selectedStatus.value });
    }
  } catch (reason) {
    selectedStatus.value = job.value.status;
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    workflowSaving.value = false;
  }
}

async function togglePaid() {
  if (!job.value) return;
  paymentSaving.value = true;
  try {
    await updateWorkflow({ paid: !job.value.paidAt });
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    paymentSaving.value = false;
  }
}

async function toggleArchive() {
  if (!job.value) return;
  try {
    hydrate(
      await $fetch<PrintJobDto>(`/api/prints/${job.value.id}`, {
        method: 'PATCH',
        body: { archived: !job.value.archivedAt },
      }),
    );
  } catch (reason) {
    error.value = String(reason);
  }
}
async function repeatOrder() {
  if (!job.value) return;
  try {
    const draft = await $fetch<PrintJobDto>(`/api/prints/${job.value.id}/repeat`, { method: 'POST' });
    await navigateTo(`/prints/${draft.id}`);
  } catch (reason) {
    error.value = String(reason);
  }
}

async function duplicate() {
  if (!job.value) return;
  try {
    const duplicate = await $fetch<PrintJobDto>(`/api/prints/${job.value.id}/duplicate`, {
      method: 'POST',
    });
    await navigateTo(`/prints/${duplicate.id}`);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  }
}

watch(
  () => form.printerId,
  () => {
    if (hydrating) return;
    applyComponentDefaults();
  },
  { flush: 'sync' },
);
watch(
  form,
  () => {
    if (hydrating || job.value?.status !== 'DRAFT') return;
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
</script>
