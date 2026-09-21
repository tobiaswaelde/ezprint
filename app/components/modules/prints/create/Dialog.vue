<template>
  <UModal
    v-model:open="open"
    :title="t('prints.new')"
    :description="t('prints.createDescription')"
    :ui="{
      content: 'sm:max-w-4xl',
    }"
  >
    <template v-if="$slots.trigger" #default>
      <slot name="trigger" />
    </template>

    <template #body>
      <ModulesPrintsCreateForm
        v-if="open"
        ref="formRef"
        :form-id="formId"
        :initial-series-id="initialSeriesId"
        :initial-customer-id="initialCustomerId"
        @created="handleCreated"
      />
    </template>

    <template v-if="formRef && !formRef.loading" #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-3">
        <div class="flex gap-2">
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            :label="t('common.cancel')"
            :disabled="formRef.saving"
            @click="open = false"
          />
          <UButton
            v-if="formRef.currentStep > 0"
            type="button"
            color="neutral"
            variant="soft"
            icon="i-tabler-arrow-left"
            :label="t('common.back')"
            :disabled="formRef.saving"
            @click="formRef.previousStep"
          />
        </div>
        <UButton
          v-if="formRef.currentStep < formRef.lastStep"
          type="button"
          trailing-icon="i-tabler-arrow-right"
          :label="t('common.next')"
          @click="formRef.nextStep"
        />
        <UButton
          v-else
          type="submit"
          :form="formId"
          icon="i-tabler-device-floppy"
          :label="t('prints.saveDraft')"
          :loading="formRef.saving"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { PrintJobDto } from '#shared/types/prints';

const emit = defineEmits<{
  created: [print: PrintJobDto];
}>();

defineProps<{ initialSeriesId?: string | null; initialCustomerId?: string | null }>();

const open = defineModel<boolean>('open', { default: false });
const { t } = useI18n();
const formId = 'new-print-form';
const formRef = useTemplateRef<{
  currentStep: number;
  lastStep: number;
  loading: boolean;
  saving: boolean;
  nextStep: () => Promise<void>;
  previousStep: () => void;
}>('formRef');

async function handleCreated(print: PrintJobDto) {
  open.value = false;
  emit('created', print);
  await navigateTo(`/prints/${print.id}`);
}
</script>
