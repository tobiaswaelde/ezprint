<template>
  <CommonEntitySelect
    v-model="selected"
    resource="spools"
    :disabled="!filamentId"
    :query="{ filamentId, availableOnly: true }"
    :defaults="{ filamentId }"
    @selected="validateFilament"
  />
</template>
<script setup lang="ts">
import type { MasterDataListItem } from '#shared/types/master-data';
const props = defineProps<{ filamentId: string }>();
const selected = defineModel<string | undefined>({ default: undefined });
function validateFilament(record?: MasterDataListItem) {
  if (record && record.filamentId !== props.filamentId) selected.value = undefined;
}
watch(
  () => props.filamentId,
  () => {
    selected.value = undefined;
  },
);
</script>
