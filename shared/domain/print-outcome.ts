import Decimal from 'decimal.js';
import type { PrintOutcomeInput } from '../schemas/print-outcomes';
import { printOutcomeSchema } from '../schemas/print-outcomes';
import {
  aggregatePrintPartCosts,
  type PrintCalculationResult,
  type CostBreakdownLine,
} from './print-calculation';
import { canonicalDecimal } from '../utils/decimal';

export interface OutcomeCostSources {
  quantity: number;
  currency: string;
  totalDurationSeconds: number;
  printerId: string;
  snapshot: {
    printerName: string;
    printerHourlyRate: string;
    printerPowerWatts: number;
    electricityPricePerKwh: string;
  };
  componentUsages: Array<{
    id: string;
    name: string;
    type: string;
    hourlyRate: string;
    appliedDurationSeconds: number;
  }>;
  filamentUsages: Array<{ id: string; name: string; costPerGram: string }>;
}

export function calculateActualPrintCost(
  source: OutcomeCostSources,
  input: PrintOutcomeInput,
): PrintCalculationResult {
  const outcome = printOutcomeSchema.parse(input);
  const grams = new Map(outcome.filaments.map((line) => [line.usageId, line.usedGrams]));
  if (
    grams.size !== source.filamentUsages.length ||
    source.filamentUsages.some((line) => !grams.has(line.id))
  )
    throw new Error('Actual usage must cover every planned filament line exactly once');
  const hours = new Decimal(outcome.durationSeconds).div(3600);
  const lines: CostBreakdownLine[] = [];
  function add(
    category: CostBreakdownLine['category'],
    sourceId: string,
    label: string,
    quantity: Decimal,
    rate: string,
  ) {
    const cost = quantity.mul(rate);
    lines.push({
      category,
      sourceId,
      label,
      quantity: canonicalDecimal(quantity),
      unitRate: rate,
      cost: canonicalDecimal(cost),
    });
    return cost;
  }
  const printer = add(
    'printer',
    source.printerId,
    source.snapshot.printerName,
    hours,
    source.snapshot.printerHourlyRate,
  );
  let components = new Decimal(0);
  for (const line of source.componentUsages) {
    const duration =
      line.type === 'HOTEND'
        ? hours.mul(line.appliedDurationSeconds).div(source.totalDurationSeconds)
        : hours;
    components = components.plus(add('component', line.id, line.name, duration, line.hourlyRate));
  }
  let filament = new Decimal(0);
  for (const line of source.filamentUsages)
    filament = filament.plus(
      add('filament', line.id, line.name, new Decimal(grams.get(line.id)!), line.costPerGram),
    );
  const electricity = add(
    'electricity',
    'electricity',
    'Electricity',
    hours.mul(source.snapshot.printerPowerWatts).div(1000),
    source.snapshot.electricityPricePerKwh,
  );
  const total = printer.plus(components).plus(filament).plus(electricity);
  return {
    calculationVersion: 'actual-1',
    currency: source.currency,
    quantity: source.quantity,
    totalDurationSeconds: outcome.durationSeconds,
    printerCost: canonicalDecimal(printer),
    componentCost: canonicalDecimal(components),
    filamentCost: canonicalDecimal(filament),
    electricityCost: canonicalDecimal(electricity),
    totalCost: canonicalDecimal(total),
    costPerUnit: canonicalDecimal(total.div(source.quantity)),
    lines,
  };
}

export function calculateActualPrintPartsCost(
  source: { quantity: number; currency: string; parts: Array<OutcomeCostSources & { id: string }> },
  input: PrintOutcomeInput,
): PrintCalculationResult {
  if (source.parts.length === 1 && !input.parts) return calculateActualPrintCost(source.parts[0]!, input);
  if (
    !input.parts ||
    input.parts.length !== source.parts.length ||
    source.parts.some((part) => !input.parts!.some((actual) => actual.partId === part.id))
  )
    throw new Error('Actual duration must cover every print part exactly once');
  const costs = source.parts.map((part) => ({
    id: part.id,
    costs: calculateActualPrintCost(part, {
      ...input,
      parts: undefined,
      durationSeconds: input.parts!.find((actual) => actual.partId === part.id)!.durationSeconds,
      filaments: input.filaments.filter((line) =>
        part.filamentUsages.some((usage) => usage.id === line.usageId),
      ),
    }),
  }));
  return aggregatePrintPartCosts(costs, source.quantity, 'actual-2');
}
