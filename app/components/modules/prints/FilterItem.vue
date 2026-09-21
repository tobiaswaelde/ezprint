<template>
  <span class="grow truncate text-sm text-muted">{{ field.label }}</span>
  <template v-if="filter.field === 'dateFrom' || filter.field === 'dateTo'">
    <span class="text-sm text-muted">{{ filter.field === 'dateFrom' ? '≥' : '≤' }}</span>
    <UInput
      class="w-40"
      size="sm"
      type="date"
      :model-value="typeof filter.value === 'string' ? filter.value : ''"
      @update:model-value="updateDate"
    />
  </template>
  <UCheckbox
    v-else-if="filter.field === 'archived'"
    :model-value="filter.value === true"
    @update:model-value="
      (value: boolean | 'indeterminate') => update({ value: Boolean(value), operator: undefined })
    "
  />
  <template v-else>
    <USelect
      class="w-16"
      size="sm"
      value-key="value"
      :model-value="filter.operator"
      :items="operators"
      @update:model-value="
        (operator: string | number) => update({ operator: String(operator) as FilteringFieldOperator })
      "
    />
    <CommonEntitySelect
      v-if="entityResource"
      :resource="entityResource"
      multiple
      :query="{ includeArchived: true }"
      :aria-label="field.label"
      :model-value="Array.isArray(filter.value) ? filter.value.map(String) : []"
      @update:model-value="(value: string[]) => update({ value })"
    />
    <USelectMenu
      v-else
      class="w-48"
      size="sm"
      value-key="value"
      multiple
      :model-value="Array.isArray(filter.value) ? filter.value : []"
      :items="choices"
      @update:model-value="(value: Array<string | number>) => update({ value })"
    />
  </template>
  <UButton
    color="error"
    size="sm"
    variant="outline"
    icon="i-tabler-x"
    :aria-label="t('querrykit.table.filtering.remove')"
    @click="remove"
  />
</template>

<script setup lang="ts">
import type { FilterField, FilteringField, FilteringFieldOperator } from '@querry-kit/nuxt-ui/types';

const props = defineProps<{
  filter: FilteringField;
  field: FilterField;
  remove: () => void;
  update: (patch: Partial<FilteringField>) => void;
}>();
const entityResource = computed(
  () =>
    (({ printerId: 'printers', customerId: 'customers', seriesId: 'series' }) as const)[
      props.filter.field as 'printerId' | 'customerId' | 'seriesId'
    ],
);
const { t } = useI18n();
const operators = [
  { value: 'in', label: '∈' },
  { value: 'notIn', label: '∉' },
];
const choices = computed(() => ('values' in props.field ? props.field.values : []));

function updateDate(value: string | number | undefined) {
  props.update({
    operator: props.filter.field === 'dateFrom' ? 'gte' : 'lte',
    value: value ? String(value) : undefined,
  });
}
</script>
