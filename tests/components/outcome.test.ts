import { calculatePrintFinancials } from '../../shared/domain/print-financials';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { expect, it } from 'vitest';
import Outcome from '../../app/components/modules/prints/Outcome.vue';
import type { PrintJobDto } from '../../shared/types/prints';

it('requires a failure reason only after choosing a failed outcome', async () => {
  const job: PrintJobDto = {
    parts: [],
    seriesId: null,
    series: null,
    repeatOf: null,
    repeats: [],
    salesValue: null,
    financials: calculatePrintFinancials(null, '1', 1),
    id: 'print',
    name: 'Synthetic print',
    customer: null,
    customerId: null,
    printer: { id: 'printer', name: 'Printer' },
    printerId: 'printer',
    status: 'DONE',
    quantity: 1,
    notes: null,
    totalDurationSeconds: 3600,
    formulaVersion: '3',
    currency: 'EUR',
    totalCost: '1',
    costPerUnit: '1',
    completedAt: '2026-09-10T00:00:00.000Z',
    paidAt: null,
    archivedAt: null,
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
    componentUsages: [],
    filamentUsages: [
      {
        id: 'usage',
        filamentId: 'filament',
        spoolId: 'spool',
        spoolCode: 'S-1',
        name: 'PLA',
        costPerGram: '0.01',
        usedGrams: '10',
        lineCost: '0.1',
      },
    ],
    snapshot: null,
    outcome: null,
    retryOf: null,
    retries: [],
  };
  job.parts = [{ ...job, id: 'part', position: 0 }];
  const wrapper = await mountSuspended(Outcome, { props: { job } });
  expect(wrapper.text()).not.toContain('Fehlergrund');
  wrapper.findComponent({ name: 'USelect' }).vm.$emit('update:modelValue', 'FAILED');
  await wrapper.vm.$nextTick();
  expect(wrapper.text()).toContain('Fehlergrund');
  expect(wrapper.text()).toContain('Tatsächliches Gewicht');
  await wrapper.find('form').trigger('submit');
  await flushPromises();
  expect(wrapper.text()).toContain('Ein Fehlergrund ist erforderlich.');
});
