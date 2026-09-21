<template>
  <UCard id="integration-bambubuddy-tools">
    <template #header>
      <h3 class="font-semibold">{{ t('integration.bambuTools') }}</h3>
    </template>
    <div class="space-y-5">
      <p>{{ t('integration.configHelp') }}</p>
      <UAlert v-if="error" color="error" :description="error" />
      <UAlert v-if="status && !status.configured" color="warning" :description="t('integration.disabled')" />
      <template v-if="status?.configured">
        <p>{{ t('integration.version') }}: {{ status.version ?? '—' }}</p>
        <UAlert v-if="status.error" color="warning" :description="t('integration.offline')" />
        <div v-if="status.remotePrinters.length" class="space-y-2">
          <p class="text-sm font-medium">{{ t('integration.remotePrinters') }}</p>
          <ul class="divide-y divide-default rounded-lg border border-default">
            <li
              v-for="remote in status.remotePrinters"
              :key="remote.id"
              class="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span>{{ remote.name }}</span>
              <span class="text-sm text-muted">#{{ remote.id }}</span>
            </li>
          </ul>
        </div>
        <UFormField :label="t('nav.printers')"
          ><CommonEntitySelect v-model="printerId" resource="printers"
        /></UFormField>
        <div v-if="selected" class="space-y-3">
          <UFormField :label="t('integration.remotePrinter')"
            ><USelectMenu
              v-model="remotePrinter"
              :items="[
                { label: t('integration.unlinked'), value: 0 },
                ...status.remotePrinters.map((item: { id: number; name: string }) => ({
                  label: `${item.name} (#${item.id})`,
                  value: item.id,
                })),
              ]"
              value-key="value"
              :aria-label="t('integration.remotePrinter')"
              :search-input="{ placeholder: t('common.search') }"
              class="w-full"
          /></UFormField>
          <div class="flex flex-wrap gap-2">
            <UButton
              :label="t('integration.linkPrinter')"
              :loading="busy"
              @click="action({ action: 'LINK_PRINTER', printerId, remoteId: remotePrinter || null })"
            /><UButton
              :label="t('integration.sync')"
              :loading="busy"
              @click="action({ action: 'SYNC_PRINTER', printerId })"
            />
          </div>
          <UAlert v-if="selected.stale" color="warning" :description="t('integration.stale')" />
          <p v-if="selected.state">
            {{ selected.state.connected ? selected.state.state : t('integration.offline') }} ·
            {{ selected.syncedAt }}
          </p>
          <UAlert
            v-if="spoolManagementEnabled && selected.state?.mappingWarning"
            color="warning"
            :description="t('integration.mappingWarning')"
          />
          <template v-if="spoolManagementEnabled">
            <div
              v-for="tray in selected.state?.trays ?? []"
              :key="tray.slot"
              class="grid gap-2 rounded border border-default p-3 sm:grid-cols-3"
            >
              <p>
                {{ t('integration.slot') }} {{ tray.slot }} · {{ tray.material ?? '—'
                }}<span class="block">{{ tray.spoolCode ?? t('integration.unmapped') }}</span
                ><span v-if="tray.ambiguous || tray.unavailable" class="text-warning">{{
                  t('integration.mappingWarning')
                }}</span>
              </p>
              <CommonEntitySelect
                v-model="trayChoices[tray.slot]"
                resource="spools"
                :aria-label="`${t('integration.slot')} ${tray.slot}`"
              />
              <UButton
                :label="t('integration.map')"
                :disabled="!trayChoices[tray.slot]"
                @click="
                  action({ action: 'MAP_TRAY', printerId, slot: tray.slot, spoolId: trayChoices[tray.slot] })
                "
              />
            </div>
          </template>
        </div>
        <template v-if="print">
          <h2 class="text-lg font-semibold">{{ print.name }}</h2>
          <p>{{ t('integration.resultHelp') }}</p>
          <template v-if="!status.link"
            ><UButton :label="t('integration.loadLogs')" :loading="busy" @click="loadLogs" />
            <div v-if="logs" class="space-y-2">
              <div
                v-for="log in logs.items"
                :key="log.id"
                class="flex flex-wrap items-center justify-between gap-2 border-b border-default py-2"
              >
                <span>#{{ log.id }} · {{ log.print_name }} · {{ log.status }}</span
                ><UButton
                  :label="t('integration.attach')"
                  @click="action({ action: 'ATTACH', printId: print.id, remoteLogId: log.id })"
                />
              </div>
              <div class="flex gap-2">
                <UButton :label="t('common.previous')" :disabled="page === 1" @click="logPage(-1)" /><UButton
                  :label="t('common.next')"
                  :disabled="page * 50 >= logs.total"
                  @click="logPage(1)"
                />
              </div></div
          ></template>
          <section v-else class="space-y-3 rounded border border-default p-4">
            <p>
              #{{ status.link.remoteLogId }} · {{ status.link.log.print_name }} · {{ status.link.log.status }}
            </p>
            <p>{{ t('integration.remoteGrams') }}: {{ status.link.log.filament_used_grams ?? '—' }} g</p>
            <UButton
              :label="t('integration.sync')"
              @click="action({ action: 'SYNC_PRINT', printId: print.id })"
            />
            <UAlert v-if="status.link.error" color="warning" :description="t('integration.offline')" />
            <UAlert
              v-if="!status.link.terminal"
              color="warning"
              :description="t('integration.pendingResult')"
            />
            <UAlert
              v-else-if="status.link.importedAt"
              color="success"
              :description="t('integration.APPLIED')"
            />
            <template v-else>
              <p>{{ t(`outcome.${status.link.terminal}`) }}</p>
              <UFormField :label="t('outcome.duration')"
                ><UInput
                  v-model="actualSeconds"
                  type="number"
                  min="0"
                  :disabled="status.link.log.duration_seconds != null"
              /></UFormField>
              <UFormField
                v-for="line in print.filamentUsages"
                :key="line.id"
                :label="`${line.name} · ${t('outcome.grams')}`"
                ><UInput v-model="actualGrams[line.id]" inputmode="decimal"
              /></UFormField>
              <UFormField v-if="status.link.terminal === 'FAILED'" :label="t('outcome.reason')"
                ><UInput v-model="failureReason" class="w-full"
              /></UFormField>
              <UButton
                :label="t('integration.confirmResult')"
                :disabled="print.status !== 'DONE' || !!status.link.error"
                :loading="busy"
                @click="importResult"
              />
            </template>
          </section>
          <UButton :to="`/prints/${print.id}`" :label="t('common.back')" color="neutral" />
        </template>
      </template>
    </div>
  </UCard>
</template>
<script setup lang="ts">
import type { BambuLog, BambuStatus } from '#shared/types/integrations';
import type { PrintJobDto } from '#shared/types/prints';
const { t } = useI18n();
const { enabled: spoolManagementEnabled, load: loadSpoolManagement } = useSpoolManagement();
const route = useRoute();
const printId = typeof route.query.printId === 'string' ? route.query.printId : undefined;
const printerId = ref(typeof route.query.printerId === 'string' ? route.query.printerId : '');
const status = ref<BambuStatus | null>(null);
const print = ref<PrintJobDto | null>(null);
const trayChoices = reactive<Record<string, string>>({});
const remotePrinter = ref(0);
const error = ref('');
const busy = ref(false);
const page = ref(1);
const logs = ref<{ items: BambuLog[]; total: number } | null>(null);
const actualSeconds = ref<string | number>('');
const actualGrams = reactive<Record<string, string>>({});
const failureReason = ref('');
const selected = computed(() => status.value?.printers.find((item) => item.id === printerId.value));
watch(printerId, (value, old) => {
  if (old && value !== old) void run(refresh);
});
watch(selected, (item) => {
  remotePrinter.value = item?.remoteId ?? 0;
});
async function run(fn: () => Promise<void>) {
  busy.value = true;
  error.value = '';
  try {
    await fn();
  } catch {
    error.value = t('integration.requestFailed');
  } finally {
    busy.value = false;
  }
}
async function refresh() {
  status.value = await $fetch<BambuStatus>('/api/integrations/bambubuddy', {
    query: { printId, printerId: printerId.value || undefined },
  });
  printerId.value ||= status.value.printers[0]?.id ?? '';
  const link = status.value.link;
  if (link) {
    actualSeconds.value = link.log.duration_seconds ?? '';
    failureReason.value = link.log.failure_reason ?? '';
    if (print.value?.filamentUsages.length === 1 && link.log.filament_used_grams != null)
      actualGrams[print.value.filamentUsages[0]!.id] = String(link.log.filament_used_grams);
  }
}
async function action(body: unknown) {
  await run(async () => {
    await $fetch('/api/integrations/bambubuddy', { method: 'POST', body: body as Record<string, unknown> });
    await refresh();
  });
}
async function loadLogs() {
  await run(async () => {
    logs.value = await $fetch('/api/integrations/bambubuddy', {
      query: { view: 'logs', printerId: printerId.value, page: page.value },
    });
  });
}
async function logPage(delta: number) {
  page.value += delta;
  await loadLogs();
}
async function importResult() {
  if (!print.value || !status.value?.link || actualSeconds.value === '') return;
  await action({
    action: 'IMPORT',
    printId: print.value.id,
    previewHash: status.value.link.previewHash,
    outcome: {
      status: status.value.link.terminal,
      durationSeconds: Number(actualSeconds.value),
      filaments: print.value.filamentUsages.map((line) => ({
        usageId: line.id,
        usedGrams: actualGrams[line.id] ?? '',
      })),
      failureReason: failureReason.value || null,
    },
  });
}
onMounted(() =>
  run(async () => {
    if (printId) print.value = await $fetch<PrintJobDto>(`/api/prints/${printId}`);
    await loadSpoolManagement();
    await refresh();
  }),
);
</script>
