import type { PrintPartDto } from '#shared/types/prints';

export function createPrintPartForm(part?: PrintPartDto) {
  return {
    key: crypto.randomUUID(),
    bambuLinked: part?.bambuLinked ?? false,
    id: part?.id,
    printerId: part?.printerId ?? '',
    buildPlateId: part?.componentUsages.find((entry) => entry.type === 'BUILD_PLATE')?.componentId ?? '',
    hotends: part
      ? part.componentUsages
          .filter((entry) => entry.type === 'HOTEND')
          .map((entry) => ({
            componentId: entry.componentId,
            hours: Math.floor(entry.appliedDurationSeconds / 3600),
            minutes: Math.floor((entry.appliedDurationSeconds % 3600) / 60),
          }))
      : [{ componentId: '', hours: 1, minutes: 0 }],
    otherComponentIds:
      part?.componentUsages.filter((entry) => entry.type === 'OTHER').map((entry) => entry.componentId) ?? [],
    filaments: part
      ? part.filamentUsages.map((entry) => ({
          filamentId: entry.filamentId,
          spoolId: entry.spoolId ?? undefined,
          usedGrams: entry.usedGrams,
        }))
      : [{ filamentId: '', spoolId: undefined as string | undefined, usedGrams: '1' }],
  };
}
export type PrintPartForm = ReturnType<typeof createPrintPartForm>;

export function printPartPayload(part: PrintPartForm, spoolManagementEnabled: boolean) {
  return {
    id: part.id,
    printerId: part.printerId,
    buildPlateId: part.buildPlateId,
    hotends: part.hotends.map((entry) => ({
      componentId: entry.componentId,
      durationSeconds: Number(entry.hours) * 3600 + Number(entry.minutes) * 60,
    })),
    otherComponentIds: part.otherComponentIds,
    filaments: part.filaments.map((entry) => ({
      filamentId: entry.filamentId,
      usedGrams: entry.usedGrams,
      ...(spoolManagementEnabled ? { spoolId: entry.spoolId } : {}),
    })),
  };
}
