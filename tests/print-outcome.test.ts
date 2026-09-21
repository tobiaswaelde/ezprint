import { describe, expect, it } from 'vitest';
import { calculateActualPrintPartsCost, calculateActualPrintCost } from '../shared/domain/print-outcome';
import {
  createPrintOutcomeCorrectionSchema,
  createPrintOutcomeSchema,
  printOutcomeSchema,
} from '../shared/schemas/print-outcomes';

const source = {
  quantity: 2,
  currency: 'EUR',
  totalDurationSeconds: 3600,
  printerId: 'printer',
  snapshot: {
    printerName: 'Printer',
    printerHourlyRate: '1',
    printerPowerWatts: 100,
    electricityPricePerKwh: '0.3',
  },
  componentUsages: [
    { id: 'hotend', name: 'Hotend', type: 'HOTEND', hourlyRate: '0.5', appliedDurationSeconds: 3600 },
    { id: 'plate', name: 'Plate', type: 'BUILD_PLATE', hourlyRate: '0.1', appliedDurationSeconds: 3600 },
  ],
  filamentUsages: [{ id: 'usage', name: 'PLA', costPerGram: '0.02' }],
};
const input = printOutcomeSchema.parse({
  status: 'SUCCESS',
  durationSeconds: 1800,
  filaments: [{ usageId: 'usage', usedGrams: '10' }],
});

describe('actual print costs', () => {
  it('uses frozen rates with actual duration and material for successful and failed runs', () => {
    const result = calculateActualPrintCost(source, input);
    expect(result.totalCost).toBe('1.015');
    expect(result.costPerUnit).toBe('0.5075');
    expect(
      calculateActualPrintCost(source, { ...input, status: 'FAILED', failureReason: 'Adhesion' }),
    ).toEqual(result);
    expect(
      calculateActualPrintCost(source, {
        ...input,
        durationSeconds: 0,
        filaments: [{ usageId: 'usage', usedGrams: '0' }],
      }).totalCost,
    ).toBe('0');
  });
  it('rejects failures without a reason and missing, duplicate, or unknown usage', () => {
    expect(printOutcomeSchema.safeParse({ ...input, status: 'FAILED' }).success).toBe(false);
    expect(printOutcomeSchema.safeParse({ ...input, durationSeconds: -1 }).success).toBe(false);
    expect(
      printOutcomeSchema.safeParse({ ...input, filaments: [...input.filaments, ...input.filaments] }).success,
    ).toBe(false);
    expect(() =>
      calculateActualPrintCost(source, { ...input, filaments: [{ usageId: 'other', usedGrams: '1' }] }),
    ).toThrow();
  });
  it('uses caller-provided validation messages for user-facing outcome errors', () => {
    const messages = {
      failureReasonRequired: 'Ein Fehlergrund ist erforderlich.',
      uniqueUsageRequired: 'Jeden Filamentverbrauch genau einmal angeben.',
      correctionNoteRequired: 'Die Korrektur begründen.',
    };
    const failed = createPrintOutcomeSchema(messages).safeParse({ ...input, status: 'FAILED' });
    expect(failed.error?.issues[0]?.message).toBe(messages.failureReasonRequired);

    const duplicate = createPrintOutcomeSchema(messages).safeParse({
      ...input,
      filaments: [...input.filaments, ...input.filaments],
    });
    expect(duplicate.error?.issues[0]?.message).toBe(messages.uniqueUsageRequired);

    const correction = createPrintOutcomeCorrectionSchema(messages).safeParse({
      ...input,
      expectedRevision: 1,
      operationKey: '12345678-1234-4234-8234-123456789abc',
      note: '',
    });
    expect(correction.error?.issues[0]?.message).toBe(messages.correctionNoteRequired);
  });
});

it('calculates actual machine time independently for each part using frozen rates', () => {
  const parts = [
    { ...source, id: 'a' },
    {
      ...source,
      id: 'b',
      snapshot: { ...source.snapshot, printerHourlyRate: '2' },
      filamentUsages: [{ id: 'usage-b', name: 'PLA', costPerGram: '0.03' }],
    },
  ];
  const actual = printOutcomeSchema.parse({
    ...input,
    durationSeconds: 5400,
    parts: [
      { partId: 'a', durationSeconds: 1800 },
      { partId: 'b', durationSeconds: 3600 },
    ],
    filaments: [...input.filaments, { usageId: 'usage-b', usedGrams: '20' }],
  });
  const result = calculateActualPrintPartsCost({ quantity: 2, currency: 'EUR', parts }, actual);
  expect(result.totalCost).toBe('4.245');
  expect(result.costPerUnit).toBe('2.1225');
  expect(result.calculationVersion).toBe('actual-2');
  expect(() => calculateActualPrintPartsCost({ quantity: 2, currency: 'EUR', parts }, input)).toThrow();
  expect(printOutcomeSchema.safeParse({ ...actual, durationSeconds: 1 }).success).toBe(false);
});
