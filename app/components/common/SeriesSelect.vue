<template>
  <CommonEntitySelect v-model="selected" resource="series" nullable @selected="applyCustomer" />
</template>
<script setup lang="ts">
import type { MasterDataListItem } from '#shared/types/master-data';
const selected = defineModel<string | null>({ default: null });
const emit = defineEmits<{ customer: [id: string | null] }>();
function applyCustomer(record?: MasterDataListItem) {
  if (typeof record?.customerId === 'string') emit('customer', record.customerId);
}
</script>
