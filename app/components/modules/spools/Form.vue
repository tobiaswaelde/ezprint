<template>
  <UForm :schema="spoolSchema" :state="form" class="grid gap-4 sm:grid-cols-2" @submit="save">
    <UAlert v-if="error" color="error" :description="error" class="sm:col-span-2" />
    <UFormField name="code" :label="t('spool.code')" required>
      <UInput
        v-model="form.code"
        class="w-full"
        icon="i-tabler-barcode"
        :readonly="editing"
        :autofocus="!editing"
      />
    </UFormField>
    <UFormField name="filamentId" :label="t('nav.filaments')" required>
      <CommonEntitySelect
        v-model="form.filamentId"
        resource="filaments"
        :disabled="editing || Boolean(initialFilamentId)"
      />
    </UFormField>
    <UFormField name="purchasePrice" :label="t('master.purchasePrice')" required>
      <UInput
        v-model="form.purchasePrice"
        type="number"
        min="0"
        step="0.01"
        class="w-full"
        icon="i-tabler-cash"
        :autofocus="editing"
      />
    </UFormField>
    <UFormField name="initialNetWeightGrams" :label="t('spool.initialWeight')" required>
      <UInput
        v-model="form.initialNetWeightGrams"
        type="number"
        min="0.000001"
        step="0.01"
        class="w-full"
        icon="i-tabler-scale"
        :readonly="editing"
      >
        <template #trailing><span class="text-xs text-muted">g</span></template>
      </UInput>
    </UFormField>
    <UFormField name="location" :label="t('spool.location')">
      <UInput v-model="form.location" class="w-full" icon="i-tabler-map-pin" />
    </UFormField>
    <UFormField name="purchaseLot" :label="t('spool.lot')">
      <UInput v-model="form.purchaseLot" class="w-full" icon="i-tabler-packages" />
    </UFormField>
    <UFormField name="acquiredAt" :label="t('spool.acquired')" class="sm:col-span-2">
      <UInput v-model="form.acquiredAt" type="date" class="w-full" icon="i-tabler-calendar" />
    </UFormField>
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
import { spoolSchema } from '#shared/schemas/spools';
import type { SpoolDto } from '#shared/types/spools';

const props = defineProps<{ value?: SpoolDto; initialFilamentId?: string }>();
const emit = defineEmits<{ saved: [spool: SpoolDto] }>();
const { t } = useI18n();
const editing = computed(() => Boolean(props.value));
const saving = ref(false);
const error = ref('');
const form = reactive({
  code: props.value?.code ?? '',
  filamentId: props.value?.filamentId ?? props.initialFilamentId ?? '',
  purchasePrice: props.value?.purchasePrice ?? '0',
  initialNetWeightGrams: props.value?.initialNetWeightGrams ?? '1000',
  location: props.value?.location ?? '',
  purchaseLot: props.value?.purchaseLot ?? '',
  acquiredAt: props.value?.acquiredAt ?? '',
});

async function save() {
  saving.value = true;
  error.value = '';
  try {
    emit(
      'saved',
      await $fetch<SpoolDto>(props.value ? `/api/spools/${props.value.id}` : '/api/spools', {
        method: props.value ? 'PATCH' : 'POST',
        body: form,
      }),
    );
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    saving.value = false;
  }
}
</script>
