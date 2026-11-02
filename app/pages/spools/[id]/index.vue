<template>
  <LayoutPagePanel panel-id="spool" :title="t('nav.spools')">
    <template #toolbar>
      <CommonDetailToolbar
        icon="i-tabler-file-description"
        parent-icon="i-tabler-qrcode"
        :parent-title="t('nav.spools')"
        parent-to="/spools"
        :title="spool?.code ?? t('common.loading')"
      >
        <template v-if="spool">
          <UButton
            v-if="spool.stockAuthority === 'NATIVE'"
            color="neutral"
            variant="outline"
            icon="i-tabler-pencil"
            :label="t('common.edit')"
            @click="editing = true"
          />
          <UButton :to="`/spools/${spool.id}/label`" :label="t('spool.label')" icon="i-tabler-qrcode" />
          <UButton
            color="neutral"
            variant="outline"
            :icon="spool.archivedAt ? 'i-tabler-archive-off' : 'i-tabler-archive'"
            :label="t(spool.archivedAt ? 'common.restore' : 'common.archive')"
            :loading="saving"
            @click="archive"
          />
        </template>
      </CommonDetailToolbar>
    </template>

    <div v-if="loading" class="flex min-h-64 items-center justify-center">
      <UIcon name="i-tabler-loader-2" class="size-8 animate-spin" />
    </div>
    <UAlert v-else-if="error && !spool" color="error" :title="t('spool.loadFailed')" :description="error" />
    <div v-else-if="spool" class="mx-auto w-full max-w-7xl space-y-5">
      <UAlert v-if="error" color="error" :description="error" />

      <section class="space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="mb-2 flex flex-wrap items-center gap-2">
              <h1 class="break-all text-2xl font-semibold">{{ spool.code }}</h1>
              <UBadge v-if="spool.archivedAt" color="neutral" variant="subtle">{{
                t('spool.archived')
              }}</UBadge>
              <UBadge v-if="spool.legacy" color="warning" variant="subtle">{{ t('spool.legacy') }}</UBadge>
              <UBadge :color="spool.stockAuthority === 'NATIVE' ? 'neutral' : 'info'" variant="subtle">
                {{ spool.stockAuthority === 'NATIVE' ? t('spool.native') : t('integration.spoolman') }}
              </UBadge>
            </div>
            <p class="text-muted">{{ spool.filamentName }}</p>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <UCard>
            <p class="text-sm text-muted">{{ t('spool.remaining') }}</p>
            <p class="mt-1 text-2xl font-semibold" :class="Number(spool.remainingGrams) < 0 && 'text-error'">
              {{ spool.remainingGrams === null ? '—' : `${decimal(spool.remainingGrams)} g` }}
            </p>
          </UCard>
          <UCard>
            <p class="text-sm text-muted">{{ t('spool.initial') }}</p>
            <p class="mt-1 text-2xl font-semibold">{{ decimal(spool.initialNetWeightGrams) }} g</p>
          </UCard>
          <UCard>
            <p class="text-sm text-muted">{{ t('master.purchasePrice') }}</p>
            <p class="mt-1 text-2xl font-semibold">{{ money(spool.purchasePrice, currency) }}</p>
            <p class="text-xs text-muted">{{ money(spool.costPerGram, currency) }}/g</p>
          </UCard>
          <UCard>
            <p class="text-sm text-muted">{{ t('spool.filamentTotal') }}</p>
            <p class="mt-1 text-2xl font-semibold">
              {{ stock?.remainingGrams === null || !stock ? '—' : `${decimal(stock.remainingGrams)} g` }}
            </p>
          </UCard>
        </div>
      </section>

      <div class="space-y-3">
        <UAlert v-if="spool.stale" color="warning" :description="t('integration.stale')" />
        <UAlert v-if="spool.legacy" color="warning" :description="t('spool.legacyHelp')" />
        <UAlert v-if="Number(spool.remainingGrams) < 0" color="error" :description="t('spool.negative')" />
        <UAlert v-if="stock?.lowStock" color="warning" :description="t('spool.lowStock')" />
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
        <UCard>
          <template #header
            ><h2 class="font-semibold">{{ t('spool.details') }}</h2></template
          >
          <dl class="grid gap-4 sm:grid-cols-2">
            <div>
              <dt class="text-sm text-muted">{{ t('spool.location') }}</dt>
              <dd class="mt-1">{{ spool.location ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-sm text-muted">{{ t('spool.lot') }}</dt>
              <dd class="mt-1">{{ spool.purchaseLot ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-sm text-muted">{{ t('spool.acquired') }}</dt>
              <dd class="mt-1">{{ spool.acquiredAt ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-sm text-muted">{{ t('spool.source') }}</dt>
              <dd class="mt-1">
                {{ spool.stockAuthority === 'NATIVE' ? t('spool.native') : t('integration.spoolman') }}
              </dd>
            </div>
          </dl>
        </UCard>

        <UCard v-if="stock">
          <template #header
            ><h2 class="font-semibold">{{ t('spool.threshold') }}</h2></template
          >
          <UForm :schema="stockThresholdSchema" :state="stock" class="space-y-4" @submit="saveThreshold">
            <UFormField name="minimumStockGrams" :label="t('spool.minimum')">
              <UInput
                v-model="stock.minimumStockGrams"
                type="number"
                min="0"
                step="0.01"
                class="w-full"
                icon="i-tabler-alert-triangle"
              >
                <template #trailing><span class="text-xs text-muted">g</span></template>
              </UInput>
            </UFormField>
            <UButton
              type="submit"
              :label="t('spool.saveThreshold')"
              icon="i-tabler-device-floppy"
              :loading="saving"
            />
          </UForm>
        </UCard>
      </div>

      <UCard v-if="spool.stockAuthority !== 'NATIVE'">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="font-semibold">{{ t('spool.integration') }}</h2>
            <UBadge :color="spool.stale ? 'warning' : 'success'" variant="subtle">
              {{
                spool.remoteState ? t(`integration.${spool.remoteState}`) : t('integration.UNKNOWN_BALANCE')
              }}
            </UBadge>
          </div>
        </template>
        <div class="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p class="text-sm text-muted">{{ t('integration.lastSync') }}</p>
            <p>{{ spool.syncedAt ? dateTime(spool.syncedAt) : '—' }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              :label="t('integration.sync')"
              icon="i-tabler-refresh"
              :loading="saving"
              @click="syncRemote"
            />
            <UButton
              :to="{ path: '/settings/spoolman', hash: '#integration-spoolman-tools' }"
              :label="t('integration.spoolman')"
              color="neutral"
              variant="outline"
              icon="i-tabler-settings"
            />
          </div>
          <UFormField :label="t('integration.nativeBalance')">
            <UInput v-model="nativeBalance" type="number" min="0" step="0.01" class="w-full" />
          </UFormField>
          <UButton
            :label="t('integration.unlink')"
            color="neutral"
            variant="outline"
            icon="i-tabler-unlink"
            :loading="saving"
            @click="unlinkRemote"
          />
        </div>
      </UCard>

      <UCard v-if="!spool.archivedAt && spool.stockAuthority === 'NATIVE'">
        <template #header
          ><h2 class="font-semibold">{{ t('spool.record') }}</h2></template
        >
        <UForm
          :schema="stockMovementSchema"
          :state="movement"
          class="grid gap-4 sm:grid-cols-3"
          @submit="move"
        >
          <UFormField name="kind" :label="t('spool.movement')">
            <USelect v-model="movement.kind" value-key="value" :items="movementOptions" class="w-full" />
          </UFormField>
          <UFormField name="grams" :label="t('spool.delta')" required>
            <UInput v-model="movement.grams" type="number" step="0.01" class="w-full" icon="i-tabler-scale">
              <template #trailing><span class="text-xs text-muted">g</span></template>
            </UInput>
          </UFormField>
          <UFormField name="note" :label="t('master.note')" required>
            <UInput v-model="movement.note" class="w-full" icon="i-tabler-notes" />
          </UFormField>
          <UButton
            type="submit"
            :label="t('spool.record')"
            icon="i-tabler-plus"
            :loading="saving"
            class="justify-center sm:col-span-3"
          />
        </UForm>
      </UCard>

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <template #header
          ><h2 class="font-semibold">{{ t('spool.history') }}</h2></template
        >
        <div class="overflow-x-auto">
          <CommonEmptyState
            v-if="!spool.movements.length"
            class="rounded-none border-0"
            :title="t('spool.emptyMovements')"
            icon="i-tabler-history"
          />
          <table v-else class="w-full min-w-180 text-sm">
            <thead class="bg-elevated text-left text-xs text-muted uppercase">
              <tr>
                <th class="px-4 py-3 font-medium">{{ t('spool.movement') }}</th>
                <th class="px-4 py-3 font-medium">{{ t('spool.delta') }}</th>
                <th class="px-4 py-3 font-medium">{{ t('master.note') }}</th>
                <th class="px-4 py-3 font-medium">{{ t('spool.recordedAt') }}</th>
                <th class="px-4 py-3 font-medium">{{ t('nav.prints') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in spool.movements" :key="entry.id" class="border-t border-default">
                <td class="px-4 py-2.5">
                  <UBadge color="neutral" variant="subtle">{{ t(`spool.${entry.kind}`) }}</UBadge>
                </td>
                <td
                  class="px-4 py-2.5 font-medium"
                  :class="Number(entry.grams) < 0 ? 'text-error' : 'text-success'"
                >
                  {{ Number(entry.grams) > 0 ? '+' : '' }}{{ decimal(entry.grams) }} g
                </td>
                <td class="max-w-md break-words px-4 py-2.5 text-muted">{{ entry.note ?? '—' }}</td>
                <td class="px-4 py-2.5">{{ dateTime(entry.createdAt) }}</td>
                <td class="px-4 py-2.5">
                  <NuxtLink
                    v-if="entry.printJobId"
                    :to="`/prints/${entry.printJobId}`"
                    class="text-primary hover:underline"
                  >
                    {{ t('common.open') }}
                  </NuxtLink>
                  <span v-else>—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <template v-if="spool.movementCount > 25" #footer>
          <UPagination v-model:page="page" :total="spool.movementCount" :items-per-page="25" />
        </template>
      </UCard>
    </div>

    <UModal
      v-if="spool"
      v-model:open="editing"
      :title="t('spool.edit')"
      scrollable
      :ui="{ content: 'sm:max-w-3xl' }"
    >
      <template #body
        ><ModulesSpoolsForm :key="spool.id + spool.purchasePrice" :value="spool" @saved="saved"
      /></template>
    </UModal>
  </LayoutPagePanel>
</template>

<script setup lang="ts">
import type { z } from 'zod';
import { stockMovementSchema, stockThresholdSchema } from '#shared/schemas/spools';
import type { SpoolDetailDto, SpoolDto } from '#shared/types/spools';
type StockMovementForm = z.input<typeof stockMovementSchema>;

definePageMeta({ middleware: 'spool-management' });
const { t } = useI18n();
const { money, decimal, dateTime } = useFormatting();
const id = String(useRoute().params.id);
const spool = ref<SpoolDetailDto | null>(null);
const stock = ref<{ remainingGrams: string | null; minimumStockGrams: string; lowStock: boolean } | null>(
  null,
);
const error = ref('');
const loading = ref(true);
const saving = ref(false);
const editing = ref(false);
const page = ref(1);
const nativeBalance = ref('');
const currency = ref('EUR');
const movement = reactive<StockMovementForm>({
  kind: 'CORRECTION',
  grams: '0',
  note: '',
  operationKey: crypto.randomUUID(),
});
const movementKinds: StockMovementForm['kind'][] = ['RECEIPT', 'CORRECTION'];
const movementOptions = computed(() => movementKinds.map((value) => ({ value, label: t(`spool.${value}`) })));

async function refresh() {
  try {
    spool.value = await $fetch<SpoolDetailDto>(`/api/spools/${id}`, { query: { page: page.value } });
    stock.value = await $fetch<NonNullable<typeof stock.value>>(
      `/api/filaments/${spool.value.filamentId}/stock`,
    );
    error.value = '';
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    loading.value = false;
  }
}

async function mutate(path: string, method: 'POST' | 'PATCH', body: unknown) {
  saving.value = true;
  try {
    await $fetch(path, { method, body: body as Record<string, unknown> });
    error.value = '';
    await refresh();
    return true;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
    return false;
  } finally {
    saving.value = false;
  }
}

async function saved(value: SpoolDto) {
  editing.value = false;
  if (spool.value) spool.value = { ...spool.value, ...value };
  await refresh();
}

async function syncRemote() {
  await mutate('/api/integrations/spoolman', 'POST', { action: 'SYNC', spoolId: id });
}

async function unlinkRemote() {
  await mutate('/api/integrations/spoolman', 'POST', {
    action: 'UNLINK',
    data: { spoolId: id, ownership: 'NATIVE', openingBalance: nativeBalance.value },
  });
}

async function saveThreshold() {
  if (spool.value) await mutate(`/api/filaments/${spool.value.filamentId}/stock`, 'PATCH', stock.value);
}

async function archive() {
  await mutate(`/api/spools/${id}/archive`, 'POST', { archived: !spool.value?.archivedAt });
}

async function move() {
  if (await mutate(`/api/spools/${id}/movements`, 'POST', movement)) {
    movement.operationKey = crypto.randomUUID();
    movement.grams = '0';
    movement.note = '';
  }
}

watch(page, refresh);
onMounted(async () => {
  await Promise.all([
    refresh(),
    $fetch<{ currency: string }>('/api/settings').then((settings) => {
      currency.value = settings.currency;
    }),
  ]);
});
</script>
