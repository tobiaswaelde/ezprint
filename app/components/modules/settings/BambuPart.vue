<template>
  <UCard role="group" :aria-label="t('prints.part', { number })">
    <template #header
      ><h3 class="font-semibold">{{ t('prints.part', { number }) }} · {{ part.printer.name }}</h3></template
    >
    <div class="space-y-3">
      <UAlert v-if="error" color="error" :description="error" />
      <template v-if="!actual.link">
        <p v-if="!recorded" class="text-sm text-muted">{{ t('integration.manualPart') }}</p>
        <UButton v-if="!recorded" :label="t('integration.loadLogs')" :loading="busy" @click="loadLogs" />
        <div v-if="logs" class="space-y-2">
          <div
            v-for="log in logs.items"
            :key="log.id"
            class="flex flex-wrap items-center justify-between gap-2 border-b border-default py-2"
          >
            <span>#{{ log.id }} · {{ log.print_name }} · {{ log.status }}</span>
            <UButton :label="t('integration.attach')" :disabled="busy" @click="action('ATTACH', log.id)" />
          </div>
          <div class="flex gap-2">
            <UButton :label="t('common.previous')" :disabled="page === 1 || busy" @click="logPage(-1)" />
            <UButton
              :label="t('common.next')"
              :disabled="page * 50 >= logs.total || busy"
              @click="logPage(1)"
            />
          </div>
        </div>
      </template>
      <template v-else>
        <p>
          #{{ actual.link.remoteLogId }} · {{ actual.link.log.print_name }} · {{ actual.link.log.status }}
        </p>
        <p>{{ t('integration.remoteGrams') }}: {{ actual.link.log.filament_used_grams ?? '—' }} g</p>
        <UButton :label="t('integration.sync')" :loading="busy" @click="action('SYNC_PRINT')" />
        <UAlert v-if="actual.link.error" color="warning" :description="t('integration.offline')" />
        <UAlert v-if="!actual.link.terminal" color="warning" :description="t('integration.pendingResult')" />
        <UAlert v-else-if="actual.link.importedAt" color="success" :description="t('integration.APPLIED')" />
        <p v-else>{{ t(`outcome.${actual.link.terminal}`) }}</p>
      </template>
      <template v-if="!actual.link?.importedAt">
        <UFormField :label="t('outcome.duration')"
          ><UInput
            v-model="actual.durationSeconds"
            type="number"
            min="0"
            :disabled="recorded || actual.link?.log.duration_seconds != null"
        /></UFormField>
        <UFormField
          v-for="line in part.filamentUsages"
          :key="line.id"
          :label="`${line.name} · ${t('outcome.grams')}`"
        >
          <UInput v-model="actual.grams[line.id]" inputmode="decimal" :disabled="recorded" />
        </UFormField>
      </template>
    </div>
  </UCard>
</template>
<script setup lang="ts">
import type { BambuLog, BambuStatus, BambuPartActuals } from '#shared/types/integrations';
import type { PrintPartDto } from '#shared/types/prints';
const props = defineProps<{ printId: string; part: PrintPartDto; number: number; recorded?: boolean }>();
const actual = defineModel<BambuPartActuals>({ required: true });
const { t } = useI18n();
const busy = ref(false);
const error = ref('');
const page = ref(1);
const logs = ref<{ items: BambuLog[]; total: number } | null>(null);
async function run(fn: () => Promise<void>) {
  busy.value = true;
  error.value = '';
  actual.value.ready = false;
  try {
    await fn();
    actual.value.ready = true;
  } catch {
    error.value = t('integration.requestFailed');
  } finally {
    busy.value = false;
  }
}
async function refresh() {
  const status = await $fetch<BambuStatus>('/api/integrations/bambubuddy', {
    query: { printId: props.printId, partId: props.part.id, printerId: props.part.printerId },
  });
  const previous = actual.value.link;
  actual.value.link = status.link;
  if (!props.recorded && status.link) {
    if (previous?.remoteLogId !== status.link.remoteLogId) {
      actual.value.durationSeconds = '';
      for (const line of props.part.filamentUsages) actual.value.grams[line.id] = '';
    }
    if (status.link.log.duration_seconds != null)
      actual.value.durationSeconds = status.link.log.duration_seconds;
    if (props.part.filamentUsages.length === 1 && status.link.log.filament_used_grams != null)
      actual.value.grams[props.part.filamentUsages[0]!.id] = String(status.link.log.filament_used_grams);
  }
}
async function action(action: 'ATTACH' | 'SYNC_PRINT', remoteLogId?: number) {
  await run(async () => {
    await $fetch('/api/integrations/bambubuddy', {
      method: 'POST',
      body: { action, printId: props.printId, partId: props.part.id, remoteLogId },
    });
    await refresh();
  });
}
async function loadLogs() {
  await run(async () => {
    logs.value = await $fetch('/api/integrations/bambubuddy', {
      query: { view: 'logs', printerId: props.part.printerId, page: page.value },
    });
  });
}
async function logPage(delta: number) {
  page.value += delta;
  await loadLogs();
}
onMounted(() => run(refresh));
</script>
