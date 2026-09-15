<template>
  <UForm :schema="seriesSchema" :state="form" class="grid gap-4 sm:grid-cols-2" @submit="save">
    <UAlert v-if="error" color="error" :description="error" class="sm:col-span-2" />
    <UFormField name="name" :label="t('master.name')" required
      ><UInput v-model="form.name" class="w-full" icon="i-tabler-tag" autofocus
    /></UFormField>
    <UFormField name="customerId" :label="t('nav.customers')"
      ><USelectMenu
        v-model="form.customerId"
        value-key="value"
        :items="customers"
        :aria-label="t('nav.customers')"
        :search-input="{ placeholder: t('common.search') }"
        class="w-full"
        icon="i-tabler-user"
    /></UFormField>
    <UFormField name="targetQuantity" :label="t('series.target')"
      ><UInput
        v-model="form.targetQuantity"
        type="number"
        min="1"
        max="1000000"
        step="1"
        class="w-full"
        icon="i-tabler-target-arrow"
    /></UFormField>
    <UCheckbox v-model="form.autoComplete" :label="t('series.autoComplete')" class="self-center" />
    <UFormField name="notes" :label="t('master.note')" class="sm:col-span-2"
      ><UTextarea v-model="form.notes" class="w-full" icon="i-tabler-notes"
    /></UFormField>
    <UButton
      type="submit"
      :label="t('common.save')"
      icon="i-tabler-device-floppy"
      :loading="saving"
      class="justify-center sm:col-span-2"
    />
  </UForm>
</template>
<script setup lang="ts">
import { seriesSchema } from '#shared/schemas/series';
import type { PrintSeriesDto } from '#shared/types/series';
import type { MasterDataListItem, PaginatedResponse } from '#shared/types/master-data';
const props = defineProps<{ value?: PrintSeriesDto }>();
const emit = defineEmits<{ saved: [series: PrintSeriesDto] }>();
const { t } = useI18n();
const error = ref('');
const saving = ref(false);
const customers = ref<Array<{ label: string; value: string | null }>>([{ label: '—', value: null }]);
const form = reactive({
  name: props.value?.name ?? '',
  customerId: props.value?.customerId ?? null,
  targetQuantity: props.value?.targetQuantity?.toString() ?? '',
  autoComplete: props.value?.autoComplete ?? true,
  notes: props.value?.notes ?? '',
});
async function save() {
  saving.value = true;
  try {
    emit(
      'saved',
      await $fetch<PrintSeriesDto>(props.value ? `/api/series/${props.value.id}` : '/api/series', {
        method: props.value ? 'PATCH' : 'POST',
        body: seriesSchema.parse(form),
      }),
    );
    error.value = '';
  } catch (reason) {
    error.value = String(reason);
  } finally {
    saving.value = false;
  }
}
onMounted(async () => {
  try {
    const items = (
      await $fetch<PaginatedResponse<MasterDataListItem>>('/api/customers', { query: { pageSize: 100 } })
    ).items;
    customers.value.push(...items.map((item) => ({ label: item.name, value: item.id })));
    if (props.value?.customer && !items.some((item) => item.id === props.value?.customerId))
      customers.value.push({ label: props.value.customer.name, value: props.value.customer.id });
  } catch (reason) {
    error.value = String(reason);
  }
});
</script>
