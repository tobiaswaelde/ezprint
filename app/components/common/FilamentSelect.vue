<template>
  <USelectMenu
    v-model="model"
    v-bind="$attrs"
    value-key="value"
    :items="items"
    :aria-label="$attrs['aria-label'] || t('nav.filaments')"
    :search-input="{ placeholder: t('common.search') }"
  >
    <template #leading>
      <UAvatar
        v-if="selectedItem"
        aria-hidden="true"
        data-slot="filamentColor"
        size="xs"
        class="shrink-0 ring-1 ring-default"
        :style="{ backgroundColor: selectedItem.colorHex }"
      />
      <UIcon v-else name="i-tabler-disc" class="size-5 shrink-0" />
    </template>

    <template #item-leading="{ item }">
      <UAvatar
        aria-hidden="true"
        data-slot="filamentColor"
        size="xs"
        class="shrink-0 ring-1 ring-default"
        :style="{ backgroundColor: item.colorHex }"
      />
    </template>
  </USelectMenu>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });

interface FilamentSelectOption {
  label: string;
  value: string;
  colorName: string;
  colorHex: string;
}

const props = defineProps<{ items: FilamentSelectOption[] }>();
const model = defineModel<string>({ required: true });
const { t } = useI18n();
const selectedItem = computed(() => props.items.find((item) => item.value === model.value));
</script>
