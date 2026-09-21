<template>
  <div v-if="!print.archivedAt" class="flex items-center justify-end gap-2">
    <UTooltip v-if="nextStatus" :text="nextLabel">
      <CommonConfirmButton
        v-if="print.status === 'DRAFT'"
        icon="i-tabler-arrow-right"
        color="neutral"
        variant="outline"
        :aria-label="nextLabel"
        :confirmation="t('prints.statusChangeConfirmation')"
        :disabled="saving"
        @confirm="update({ status: nextStatus })"
      />
      <UButton
        v-else
        icon="i-tabler-arrow-right"
        color="neutral"
        variant="outline"
        :aria-label="nextLabel"
        :loading="saving"
        @click="update({ status: nextStatus })"
      />
    </UTooltip>
    <UTooltip v-if="!print.paidAt" :text="t('prints.markPaid')">
      <UButton
        icon="i-tabler-cash"
        color="neutral"
        variant="outline"
        :aria-label="t('prints.markPaid')"
        :loading="saving"
        @click="update({ paid: true })"
      />
    </UTooltip>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { printStatuses, type PrintStatus } from '#shared/schemas/prints';
import type { PrintJobDto } from '#shared/types/prints';

const props = defineProps<{ print: Pick<PrintJobDto, 'id' | 'status' | 'paidAt' | 'archivedAt'> }>();
const emit = defineEmits<{ updated: []; error: [message: string] }>();
const { t } = useI18n();
const saving = ref(false);
const nextStatus = computed(() => printStatuses[printStatuses.indexOf(props.print.status) + 1]);
const nextLabel = computed(() =>
  nextStatus.value
    ? t('prints.advanceStatus', { status: t(`prints.${nextStatus.value.toLowerCase()}`) })
    : '',
);

async function update(body: { status?: PrintStatus; paid?: boolean }) {
  if (saving.value || props.print.archivedAt) return;
  saving.value = true;
  try {
    await $fetch(`/api/prints/${props.print.id}`, { method: 'PATCH', body });
    emit('updated');
  } catch (reason) {
    emit('error', reason instanceof Error ? reason.message : String(reason));
  } finally {
    saving.value = false;
  }
}
</script>
