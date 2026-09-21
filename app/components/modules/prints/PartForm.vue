<template>
  <div class="space-y-6">
    <p v-if="form.bambuLinked && (!section || section === 'general')" class="text-sm text-muted">
      {{ t('integration.linkedPartLocked') }}
    </p>
    <div v-if="!section || section === 'general'" class="grid gap-4 md:grid-cols-2">
      <UFormField :name="`parts.${partIndex}.printerId`" :label="t('nav.printers')" required>
        <CommonEntitySelect
          v-model="form.printerId"
          resource="printers"
          :disabled="form.bambuLinked"
          @update:model-value="applyComponentDefaults"
        />
      </UFormField>
      <UFormField :name="`parts.${partIndex}.buildPlateId`" :label="t('master.buildPlate')" required>
        <CommonEntitySelect
          v-model="form.buildPlateId"
          resource="components"
          :query="{ printerId: form.printerId, type: 'BUILD_PLATE' }"
          :defaults="{ type: 'BUILD_PLATE', printerIds: [form.printerId] }"
          :disabled="!form.printerId"
          :aria-label="t('master.buildPlate')"
        />
      </UFormField>
    </div>
    <template v-if="!section || section === 'hotends'">
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h3 class="font-semibold">{{ t('prints.hotends') }}</h3>
            <p class="text-sm text-muted">{{ t('prints.hotendsHelp') }}</p>
          </div>
          <UButton icon="i-tabler-plus" size="sm" :label="t('common.add')" @click="addHotend" />
        </div>
        <div
          v-for="(hotend, index) in form.hotends"
          :key="index"
          class="grid items-start gap-3 rounded-lg border border-default p-3 md:grid-cols-[1fr_8rem_8rem_auto]"
        >
          <UFormField
            :name="`parts.${partIndex}.hotends.${index}.componentId`"
            :label="t('master.hotend')"
            required
          >
            <CommonEntitySelect
              v-model="hotend.componentId"
              resource="components"
              :query="{ printerId: form.printerId, type: 'HOTEND' }"
              :defaults="{ type: 'HOTEND', printerIds: [form.printerId] }"
              :disabled="!form.printerId"
              :aria-label="t('master.hotend')"
            />
          </UFormField>
          <UFormField :name="`parts.${partIndex}.hotends.${index}.hours`" :label="t('prints.hours')">
            <UInput
              v-model="hotend.hours"
              class="w-full"
              type="number"
              min="0"
              step="1"
              icon="i-tabler-clock-hour-4"
            >
              <template #trailing><span class="text-xs text-muted">h</span></template>
            </UInput>
          </UFormField>
          <UFormField :name="`parts.${partIndex}.hotends.${index}.minutes`" :label="t('prints.minutes')">
            <UInput
              v-model="hotend.minutes"
              class="w-full"
              type="number"
              min="0"
              max="59"
              step="1"
              icon="i-tabler-clock"
            >
              <template #trailing><span class="text-xs text-muted">min</span></template>
            </UInput>
          </UFormField>
          <UButton
            class="md:mt-6"
            color="error"
            variant="ghost"
            icon="i-tabler-trash"
            :aria-label="t('common.delete')"
            :disabled="form.hotends.length === 1"
            @click="form.hotends.splice(index, 1)"
          />
        </div>
      </div> </template
    ><template v-if="!section || section === 'materials'">
      <div class="space-y-6">
        <UFormField :name="`parts.${partIndex}.otherComponentIds`" :label="t('prints.otherComponents')">
          <CommonEntitySelect
            v-model="form.otherComponentIds"
            :aria-label="t('prints.otherComponents')"
            resource="components"
            multiple
            :query="{ printerId: form.printerId, type: 'OTHER' }"
            :defaults="{ type: 'OTHER', printerIds: [form.printerId] }"
            :disabled="!form.printerId"
          />
        </UFormField>

        <div class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-semibold">{{ t('nav.filaments') }}</h3>
            <UButton icon="i-tabler-plus" size="sm" :label="t('common.add')" @click="addFilament" />
          </div>
          <div
            v-for="(filament, index) in form.filaments"
            :key="index"
            class="grid items-start gap-3 rounded-lg border border-default p-3"
            :class="
              spoolManagementEnabled ? 'md:grid-cols-[1fr_1fr_10rem_auto]' : 'md:grid-cols-[1fr_10rem_auto]'
            "
          >
            <UFormField
              :name="`parts.${partIndex}.filaments.${index}.filamentId`"
              :label="t('nav.filaments')"
              required
            >
              <CommonFilamentSelect v-model="filament.filamentId" class="w-full" />
            </UFormField>
            <UFormField
              v-if="spoolManagementEnabled"
              :name="`parts.${partIndex}.filaments.${index}.spoolId`"
              :label="t('nav.spools')"
              required
            >
              <CommonSpoolSelect v-model="filament.spoolId" :filament-id="filament.filamentId" />
            </UFormField>
            <UFormField
              :name="`parts.${partIndex}.filaments.${index}.usedGrams`"
              :label="t('prints.usedGrams')"
              required
            >
              <UInput
                v-model="filament.usedGrams"
                class="w-full"
                type="number"
                min="0.01"
                step="0.01"
                icon="i-tabler-scale"
              >
                <template #trailing><span class="text-xs text-muted">g</span></template>
              </UInput>
            </UFormField>
            <UButton
              class="md:mt-6"
              color="error"
              variant="ghost"
              icon="i-tabler-trash"
              :aria-label="t('common.delete')"
              :disabled="form.filaments.length === 1"
              @click="form.filaments.splice(index, 1)"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
<script setup lang="ts">
import type { PrintPartForm } from '~/utils/print-parts';
defineProps<{ partIndex: number; section?: 'general' | 'hotends' | 'materials' }>();
const form = defineModel<PrintPartForm>({ required: true });
const emit = defineEmits<{ error: [message: string] }>();
const { t } = useI18n();
const { enabled: spoolManagementEnabled } = useSpoolManagement();
function addHotend() {
  form.value.hotends.push({ componentId: '', hours: 1, minutes: 0 });
}

function addFilament() {
  form.value.filaments.push({ filamentId: '', spoolId: undefined as string | undefined, usedGrams: '1' });
}

async function applyComponentDefaults() {
  const printerId = form.value.printerId;
  form.value.buildPlateId = '';
  form.value.hotends = [{ componentId: '', hours: 1, minutes: 0 }];
  form.value.otherComponentIds = [];
  let defaults;
  try {
    defaults = await loadPrintComponentDefaults(printerId);
  } catch (reason) {
    if (form.value.printerId === printerId) emit('error', String(reason));
    return;
  }
  if (form.value.printerId !== printerId) return;
  form.value.buildPlateId ||= defaults.buildPlateId;
  if (!form.value.hotends.some((entry) => entry.componentId))
    form.value.hotends = defaults.hotendIds.length
      ? defaults.hotendIds.map((componentId) => ({ componentId, hours: 1, minutes: 0 }))
      : [{ componentId: '', hours: 1, minutes: 0 }];
  if (!form.value.otherComponentIds.length) form.value.otherComponentIds = defaults.otherComponentIds;
}
</script>
