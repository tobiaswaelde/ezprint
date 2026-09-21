<template>
  <LayoutPagePanel panel-id="print-detail" :title="t('prints.detail')" :breadcrumb-title="printName">
    <ModulesPrintsPrintEditor :print-id="String(route.params.id)" @title="printName = $event" />
  </LayoutPagePanel>
</template>

<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const printName = ref('');
</script>
