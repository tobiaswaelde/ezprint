import { getQuery } from 'h3';
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import { beforeEach, expect, it, vi } from 'vitest';
import { reactive } from 'vue';
import BambuPart from '../../app/components/modules/settings/BambuPart.vue';
import type { BambuPartActuals, BambuStatus } from '../../shared/types/integrations';
import type { PrintPartDto } from '../../shared/types/prints';

let query: Record<string, unknown>;
let link: BambuStatus['link'];
registerEndpoint('/api/integrations/bambubuddy', (event) => {
  query = getQuery(event);
  return { link };
});
const part: PrintPartDto = {
  id: 'second-part',
  position: 1,
  bambuLinked: true,
  printerId: 'second-printer',
  printer: { id: 'second-printer', name: 'Second printer' },
  totalDurationSeconds: 3600,
  totalCost: '1',
  snapshot: null,
  componentUsages: [],
  filamentUsages: [
    {
      id: 'usage',
      filamentId: 'filament',
      spoolId: null,
      spoolCode: null,
      name: 'PLA',
      costPerGram: '0.02',
      usedGrams: '10',
      lineCost: '0.2',
    },
  ],
};
beforeEach(() => {
  query = {};
  link = {
    partId: part.id,
    remoteLogId: 99,
    previewHash: 'a'.repeat(64),
    terminal: 'SUCCESS',
    syncedAt: '2026-09-21T00:00:00Z',
    error: null,
    importedAt: null,
    log: { id: 99, printer_id: 7, status: 'completed', duration_seconds: null, filament_used_grams: null },
  };
});
function actual() {
  return reactive<BambuPartActuals>({
    durationSeconds: 3600,
    grams: { usage: '10' },
    link: null,
    ready: false,
  });
}
it('loads the requested part and requires manual values when its remote record omits them', async () => {
  const model = actual();
  const wrapper = await mountSuspended(BambuPart, {
    props: { printId: 'print', part, number: 2, modelValue: model },
  });
  await vi.waitFor(() => expect(model.ready).toBe(true));
  expect(query).toMatchObject({ printId: 'print', partId: part.id, printerId: part.printerId });
  expect(model.durationSeconds).toBe('');
  expect(model.grams.usage).toBe('');
  wrapper.unmount();
});
it('uses known remote values but preserves locally corrected actuals after recording', async () => {
  link!.log.duration_seconds = 60;
  link!.log.filament_used_grams = 2;
  const model = actual();
  const wrapper = await mountSuspended(BambuPart, {
    props: { printId: 'print', part, number: 2, modelValue: model },
  });
  await vi.waitFor(() => expect(model.ready).toBe(true));
  expect(model.durationSeconds).toBe(60);
  expect(model.grams.usage).toBe('2');
  wrapper.unmount();
  model.durationSeconds = 75;
  model.grams.usage = '3';
  model.ready = false;
  link!.importedAt = '2026-09-21T00:00:00Z';
  const recorded = await mountSuspended(BambuPart, {
    props: { printId: 'print', part, number: 2, modelValue: model, recorded: true },
  });
  await vi.waitFor(() => expect(model.ready).toBe(true));
  expect(model.durationSeconds).toBe(75);
  expect(model.grams.usage).toBe('3');
  recorded.unmount();
});
