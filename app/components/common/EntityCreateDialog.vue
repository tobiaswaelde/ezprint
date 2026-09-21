<template>
  <ModulesCustomersDialog v-if="resource === 'customers'" v-model:open="open" @saved="saved" />
  <UModal
    v-else-if="resource === 'series' || resource === 'spools'"
    v-model:open="open"
    :title="t('common.createEntry', { name: t(`nav.${resource}`) })"
    scrollable
  >
    <template #body>
      <ModulesSeriesForm
        v-if="resource === 'series'"
        :initial-customer-id="String(defaults.customerId ?? '') || null"
        @saved="saved"
      />
      <ModulesSpoolsForm v-else :initial-filament-id="String(defaults.filamentId ?? '')" @saved="saved" />
    </template>
  </UModal>
  <ModulesMasterDataDialog
    v-else
    v-model:open="open"
    :resource="resource"
    :defaults="defaults"
    @saved="saved"
  />
</template>
<script setup lang="ts">
import type { MasterDataResource } from '#shared/types/master-data';
withDefaults(
  defineProps<{ resource: MasterDataResource | 'series' | 'spools'; defaults?: Record<string, unknown> }>(),
  { defaults: () => ({}) },
);
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ created: [id: string] }>();
const { t } = useI18n();
function saved(item: { id: string }) {
  open.value = false;
  emit('created', item.id);
}
</script>
