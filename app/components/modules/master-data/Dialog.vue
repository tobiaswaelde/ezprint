<template>
  <UModal
    v-model:open="open"
    :title="dialogTitle"
    :dismissible="!saving"
    scrollable
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <UAlert v-if="dialogError" class="mb-4" color="error" :description="dialogError" />
      <UForm :id="formId" :schema="formSchema" :state="form" class="grid gap-4 md:grid-cols-2" @submit="save">
        <UFormField v-if="resource !== 'filaments'" name="name" :label="t('master.name')" required>
          <UInput v-model="form.name" class="w-full" icon="i-tabler-tag" autofocus />
        </UFormField>
        <UFormField v-if="resource === 'customers'" name="email" :label="t('master.email')">
          <UInput v-model="form.email" class="w-full" type="email" icon="i-tabler-mail" />
        </UFormField>
        <UFormField v-if="resource === 'customers'" name="excludeFromDashboard" class="md:col-span-2">
          <UCheckbox
            v-model="form.excludeFromDashboard"
            :label="t('master.excludeFromDashboard')"
            :description="t('master.excludeFromDashboardDescription')"
          />
        </UFormField>
        <template v-if="resource === 'printers' || resource === 'components'">
          <UFormField
            name="manufacturerId"
            :label="t('master.manufacturer')"
            :required="resource === 'printers'"
          >
            <CommonEntitySelect
              v-model="form.manufacturerId"
              resource="manufacturers"
              :nullable="resource === 'components'"
              :aria-label="t('master.manufacturer')"
              @selected="manufacturerName = String($event?.name ?? '')"
            />
          </UFormField>
          <UFormField name="model" :label="t('master.model')"
            ><UInput v-model="form.model" class="w-full" icon="i-tabler-barcode"
          /></UFormField>
          <UFormField name="purchasePrice" :label="t('master.purchasePrice')" required
            ><UInput
              v-model="form.purchasePrice"
              class="w-full"
              type="number"
              min="0"
              step="0.01"
              icon="i-tabler-cash"
            >
              <template #trailing>
                <span class="text-xs text-muted">{{ currency }}</span>
              </template>
            </UInput></UFormField
          >
          <UFormField name="expectedLifetimeHours" :label="t('master.lifetime')" required
            ><UInput
              v-model="form.expectedLifetimeHours"
              class="w-full"
              type="number"
              min="0.01"
              step="0.01"
              icon="i-tabler-clock-hour-4"
            >
              <template #trailing>
                <span class="text-xs text-muted">h</span>
              </template>
            </UInput></UFormField
          >
          <UFormField
            v-if="resource === 'printers'"
            name="averagePowerWatts"
            :label="t('master.power')"
            required
            ><UInput
              v-model="form.averagePowerWatts"
              class="w-full"
              type="number"
              min="0"
              step="1"
              icon="i-tabler-bolt"
            >
              <template #trailing>
                <span class="text-xs text-muted">W</span>
              </template>
            </UInput></UFormField
          >
          <UFormField v-if="resource === 'components'" name="type" :label="t('master.type')" required>
            <USelect
              v-model="form.type"
              :disabled="Boolean(defaults?.type)"
              class="w-full"
              icon="i-tabler-category"
              value-key="value"
              :items="componentTypes"
            />
          </UFormField>
          <UFormField
            v-if="resource === 'components'"
            name="printerIds"
            :label="t('master.compatiblePrinters')"
            class="md:col-span-2"
          >
            <CommonEntitySelect
              v-model="form.printerIds"
              :disabled="Boolean(defaults?.printerIds)"
              resource="printers"
              multiple
            />
          </UFormField>
          <UFormField v-if="resource === 'components'" name="alwaysUsed" class="md:col-span-2">
            <UCheckbox
              v-model="form.alwaysUsed"
              :label="t('master.alwaysUsed')"
              :description="t('master.alwaysUsedDescription')"
            />
          </UFormField>
          <UAlert
            class="md:col-span-2"
            color="neutral"
            variant="subtle"
            :description="`${t('master.hourlyRate')}: ${derivedRate}`"
          />
        </template>
        <template v-if="resource === 'filaments'">
          <UFormField name="manufacturerId" :label="t('master.manufacturer')" required>
            <CommonEntitySelect
              v-model="form.manufacturerId"
              resource="manufacturers"
              :aria-label="t('master.manufacturer')"
              @selected="manufacturerName = String($event?.name ?? '')"
            />
          </UFormField>
          <UFormField name="material" :label="t('master.material')" required
            ><UInput v-model="form.material" class="w-full" icon="i-tabler-box"
          /></UFormField>
          <UFormField name="colorName" :label="t('master.colorName')" required>
            <UInput v-model="form.colorName" class="w-full" icon="i-tabler-palette" />
          </UFormField>
          <UFormField name="colorHex" :label="t('master.colorHex')" required>
            <div class="flex gap-2">
              <UInput v-model="form.colorHex" class="min-w-0 flex-1" icon="i-tabler-hash" />
              <UPopover :content="{ align: 'end', sideOffset: 8 }">
                <UButton
                  color="neutral"
                  variant="outline"
                  :aria-label="t('master.pickColor')"
                  :title="t('master.pickColor')"
                >
                  <span
                    class="size-5 rounded-sm border border-default"
                    :style="{ backgroundColor: form.colorHex || '#ffffff' }"
                  />
                </UButton>
                <template #content>
                  <UColorPicker v-model="form.colorHex" class="p-3" format="hex" />
                </template>
              </UPopover>
            </div>
          </UFormField>
          <UFormField name="purchasePrice" :label="t('master.purchasePrice')" required
            ><UInput
              v-model="form.purchasePrice"
              class="w-full"
              type="number"
              min="0"
              step="0.01"
              icon="i-tabler-cash"
            >
              <template #trailing>
                <span class="text-xs text-muted">{{ currency }}</span>
              </template>
            </UInput></UFormField
          >
          <UFormField name="netWeightGrams" :label="t('master.netWeight')" required
            ><UInput
              v-model="form.netWeightGrams"
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
          <UAlert
            class="md:col-span-2"
            color="neutral"
            variant="subtle"
            :description="`${t('master.name')}: ${form.name || '—'}`"
          />
          <UAlert
            class="md:col-span-2"
            color="neutral"
            variant="subtle"
            :description="`${t('master.costPerGram')}: ${derivedRate}`"
          />
        </template>
        <UFormField name="note" :label="t('master.note')" class="md:col-span-2"
          ><UTextarea v-model="form.note" class="w-full" icon="i-tabler-notes"
        /></UFormField>
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          type="button"
          color="error"
          variant="outline"
          :disabled="saving"
          :label="t('common.cancel')"
          @click="open = false"
        />
        <UButton
          type="submit"
          :form="formId"
          color="primary"
          variant="solid"
          icon="i-tabler-device-floppy"
          :loading="saving"
          :label="t('common.save')"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import Decimal from 'decimal.js';
import {
  componentSchema,
  createPrinterSchema,
  customerSchema,
  filamentSchema,
  manufacturerSchema,
} from '#shared/schemas/master-data';
import type { MasterDataListItem, MasterDataResource } from '#shared/types/master-data';

const props = defineProps<{
  resource: MasterDataResource;
  value?: MasterDataListItem | null;
  defaults?: Record<string, unknown>;
}>();
const emit = defineEmits<{ saved: [item: MasterDataListItem] }>();
const open = defineModel<boolean>('open', { default: false });
const { t } = useI18n();
const { money } = useFormatting();
const formId = useId();
const saving = ref(false);
const dialogError = ref('');
const currency = ref('EUR');
const manufacturerName = ref('');
const componentTypes = computed(() => [
  { label: t('master.hotend'), value: 'HOTEND' },
  { label: t('master.buildPlate'), value: 'BUILD_PLATE' },
  { label: t('master.other'), value: 'OTHER' },
]);
const dialogTitle = computed(
  () => `${props.value ? t('common.edit') : t('common.create')} · ${t(`nav.${props.resource}`)}`,
);
const printerValidationMessages = computed(() => ({
  manufacturerRequired: t('validation.printerManufacturerRequired'),
}));

const formSchema = computed(() => {
  switch (props.resource) {
    case 'customers':
      return customerSchema;
    case 'printers':
      return createPrinterSchema(printerValidationMessages.value);
    case 'manufacturers':
      return manufacturerSchema;
    case 'components':
      return componentSchema;
    case 'filaments':
      return filamentSchema;
    default:
      return customerSchema;
  }
});

function emptyForm() {
  return {
    name: '',
    email: '',
    manufacturer: '',
    manufacturerId: '' as string | null,
    model: '',
    purchasePrice: '0',
    expectedLifetimeHours: '1',
    averagePowerWatts: 0,
    type: 'HOTEND',
    alwaysUsed: false,
    excludeFromDashboard: false,
    printerIds: [] as string[],
    material: '',
    colorName: '',
    colorHex: '#FFFFFF',
    netWeightGrams: '1000',
    note: '',
  };
}
const form = reactive(emptyForm());

const derivedRate = computed(() => {
  try {
    const divisor = props.resource === 'filaments' ? form.netWeightGrams : form.expectedLifetimeHours;
    const value = new Decimal(form.purchasePrice || 0).div(divisor || 1).toString();
    return `${money(value, currency.value)}${props.resource === 'filaments' ? '/g' : '/h'}`;
  } catch {
    return '—';
  }
});

async function save() {
  saving.value = true;
  dialogError.value = '';
  try {
    const item = await $fetch<MasterDataListItem>(
      props.value ? `/api/${props.resource}/${props.value.id}` : `/api/${props.resource}`,
      {
        method: props.value ? 'PATCH' : 'POST',
        body: form,
      },
    );
    open.value = false;
    emit('saved', item);
  } catch (reason) {
    dialogError.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    saving.value = false;
  }
}
watch(
  open,
  async (value) => {
    if (!value) return;
    Object.assign(form, emptyForm(), props.defaults, props.value);
    form.printerIds = Array.isArray(form.printerIds) ? [...form.printerIds] : [];
    manufacturerName.value = String(props.value?.manufacturer ?? '');
    dialogError.value = '';
    try {
      currency.value = (await $fetch<{ currency: string }>('/api/settings')).currency;
    } catch (reason) {
      dialogError.value = String(reason);
    }
  },
  { immediate: true },
);
watchEffect(() => {
  if (props.resource !== 'filaments') return;
  const manufacturer = manufacturerName.value;
  const material = form.material.trim();
  const colorName = form.colorName.trim();
  form.name = `${manufacturer}${manufacturer && material ? ' ' : ''}${material}${colorName ? ` - ${colorName}` : ''}`;
});
</script>
