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
          <p>{{ t('integration.partsResultHelp') }}</p>
          <ModulesSettingsBambuPart
            v-for="(part, index) in print.parts"
            :key="`${part.id}:${revision}`"
            v-model="actuals[part.id]!"
            :print-id="print.id"
            :part="part"
            :number="index + 1"
            :recorded="!!print.outcome"
          />
          <template v-if="!print.outcome">
            <UFormField :label="t('outcome.title')">
              <USelect
                v-model="outcomeStatus"
                :disabled="hasFailedRun"
                :items="statusOptions"
                class="w-full"
              />
            </UFormField>
            <UFormField v-if="outcomeStatus === 'FAILED'" :label="t('outcome.reason')"
              ><UInput v-model="failureReason" class="w-full"
            /></UFormField>
            <UButton
              :label="t('integration.confirmResult')"
              :disabled="!canImport"
              :loading="busy"
              @click="importResult"
            />
          </template>
          <UButton :to="`/prints/${print.id}`" :label="t('common.back')" color="neutral" />
        </template>
      </template>
    </div>
  </UCard>
</template>
<script setup lang="ts">
import type { BambuPartActuals, BambuStatus } from '#shared/types/integrations';
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
const actuals = reactive<Record<string, BambuPartActuals>>({});
const revision = ref(0);
const outcomeStatus = ref<'SUCCESS' | 'FAILED'>('SUCCESS');
const statusOptions = computed(() =>
  ['SUCCESS', 'FAILED'].map((value) => ({ value, label: t(`outcome.${value}`) })),
);
const hasFailedRun = computed(() =>
  Object.values(actuals).some((actual) => actual.link?.terminal === 'FAILED'),
);
const canImport = computed(
  () =>
    print.value?.status === 'DONE' &&
    !busy.value &&
    print.value.parts.every(
      (part) =>
        actuals[part.id]?.ready &&
        String(actuals[part.id]!.durationSeconds).trim() !== '' &&
        part.filamentUsages.every((line) => actuals[part.id]!.grams[line.id]?.trim()) &&
        (!actuals[part.id]!.link || (actuals[part.id]!.link?.terminal && !actuals[part.id]!.link?.error)),
    ) &&
    Object.values(actuals).some((actual) => actual.link),
);
const failureReason = ref('');
watch(hasFailedRun, (failed) => {
  if (failed) {
    outcomeStatus.value = 'FAILED';
    failureReason.value ||= Object.values(actuals)
      .map((actual) => actual.link?.log.failure_reason)
      .filter(Boolean)
      .join('; ');
  }
});
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
    query: { printerId: printerId.value || undefined },
  });
  printerId.value ||= status.value.printers[0]?.id ?? '';
  if (printId) {
    print.value = await $fetch<PrintJobDto>(`/api/prints/${printId}`);
    for (const part of print.value.parts)
      actuals[part.id] ??= {
        durationSeconds:
          print.value.outcome?.parts?.find((entry) => entry.partId === part.id)?.durationSeconds ??
          (print.value.parts.length === 1 ? print.value.outcome?.durationSeconds : undefined) ??
          part.totalDurationSeconds,
        grams: Object.fromEntries(
          part.filamentUsages.map((line) => [
            line.id,
            print.value?.outcome?.filaments.find((entry) => entry.usageId === line.id)?.usedGrams ??
              line.usedGrams,
          ]),
        ),
        link: null,
        ready: false,
      };
  }
}

async function action(body: unknown) {
  await run(async () => {
    await $fetch('/api/integrations/bambubuddy', { method: 'POST', body: body as Record<string, unknown> });
    await refresh();
    revision.value++;
  });
}
async function importResult() {
  if (!print.value || !canImport.value) return;
  const parts = print.value.parts.map((part) => ({
    partId: part.id,
    durationSeconds: Number(actuals[part.id]!.durationSeconds),
  }));
  await action({
    action: 'IMPORT',
    printId: print.value.id,
    previews: print.value.parts.flatMap((part) =>
      actuals[part.id]!.link ? [{ partId: part.id, previewHash: actuals[part.id]!.link!.previewHash }] : [],
    ),
    outcome: {
      status: outcomeStatus.value,
      durationSeconds: parts.reduce((total, part) => total + part.durationSeconds, 0),
      ...(parts.length > 1 ? { parts } : {}),
      filaments: print.value.parts.flatMap((part) =>
        part.filamentUsages.map((line) => ({
          usageId: line.id,
          usedGrams: actuals[part.id]!.grams[line.id] ?? '',
        })),
      ),
      failureReason: outcomeStatus.value === 'FAILED' ? failureReason.value || null : null,
    },
  });
}
onMounted(() =>
  run(async () => {
    await loadSpoolManagement();
    await refresh();
  }),
);
</script>
