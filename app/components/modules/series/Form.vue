<template>
  <UForm :schema="seriesSchema" :state="form" class="grid gap-4 sm:grid-cols-2" @submit="save">
    <UAlert v-if="error" color="error" :description="error" class="sm:col-span-2" />
    <UFormField name="name" :label="t('master.name')" required
      ><UInput v-model="form.name" class="w-full" icon="i-tabler-tag" autofocus
    /></UFormField>
    <UFormField name="customerId" :label="t('nav.customers')"
      ><CommonEntitySelect v-model="form.customerId" resource="customers" nullable
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
const props = defineProps<{ value?: PrintSeriesDto; initialCustomerId?: string | null }>();
const emit = defineEmits<{ saved: [series: PrintSeriesDto] }>();
const { t } = useI18n();
const error = ref('');
const saving = ref(false);
const form = reactive({
  name: props.value?.name ?? '',
  customerId: props.value?.customerId ?? props.initialCustomerId ?? null,
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
</script>
