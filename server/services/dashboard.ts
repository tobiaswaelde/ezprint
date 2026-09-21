import { lowStockFilaments } from './spools';
import Decimal from 'decimal.js';
import { dashboardPeriodSchema } from '#shared/schemas/prints';
import { canonicalDecimal } from '#shared/utils/decimal';
import { db } from '../utils/db';
import { parseBody } from '../utils/validation';

function startFor(period: '30d' | '90d' | 'all', now: Date) {
  if (period === 'all') return undefined;
  const days = period === '30d' ? 30 : 90;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
}

function bucket(date: Date, period: '30d' | '90d' | 'all') {
  if (period === 'all') return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  return date.toISOString().slice(0, 10);
}

export async function dashboardData(periodInput: unknown, now = new Date()) {
  const period = parseBody(dashboardPeriodSchema, periodInput);
  const start = startFor(period, now);
  const includedCustomer = {
    OR: [{ customerId: null }, { customer: { is: { excludeFromDashboard: false } } }],
  };
  const [completed, unfinished] = await Promise.all([
    db.printJob.findMany({
      where: {
        ...includedCustomer,
        status: 'DONE',
        archivedAt: null,
        ...(start ? { completedAt: { gte: start, lte: now } } : {}),
      },
      include: {
        snapshot: true,
        outcome: { include: { corrections: { orderBy: { revision: 'desc' }, take: 1 } } },
      },
      orderBy: { completedAt: 'asc' },
    }),
    db.printJob.findMany({
      where: { ...includedCustomer, status: { not: 'DONE' }, archivedAt: null },
      include: {
        customer: true,
        printer: true,
        snapshot: true,
        parts: { include: { printer: true }, orderBy: { position: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  let revenue = new Decimal(0);
  let margin = new Decimal(0);
  let successes = 0;
  let failures = 0;
  let actualCost = new Decimal(0);
  let failedCost = new Decimal(0);
  let variance = new Decimal(0);
  let duration = 0;
  let total = new Decimal(0);
  const categories = {
    printer: new Decimal(0),
    component: new Decimal(0),
    filament: new Decimal(0),
    electricity: new Decimal(0),
  };
  const series = new Map<string, Decimal>();
  for (const job of completed) {
    if (!job.snapshot || !job.completedAt) continue;
    const costs = job.snapshot.calculationJson ? JSON.parse(job.snapshot.calculationJson) : job.snapshot;
    if (job.outcome) {
      const cost = new Decimal(
        JSON.parse(job.outcome.corrections[0]?.costSnapshot ?? job.outcome.costSnapshot).totalCost,
      );
      actualCost = actualCost.plus(cost);
      variance = variance.plus(cost.minus(costs.totalCost.toString()));
      if (job.outcome.status === 'SUCCESS') {
        successes++;
        if (job.snapshot.salesValue !== null) {
          revenue = revenue.plus(job.snapshot.salesValue);
          margin = margin.plus(new Decimal(job.snapshot.salesValue).minus(cost));
        }
      } else {
        failures++;
        failedCost = failedCost.plus(cost);
      }
    }
    duration += job.totalDurationSeconds;
    total = total.plus(costs.totalCost.toString());
    categories.printer = categories.printer.plus(costs.printerCost.toString());
    categories.component = categories.component.plus(costs.componentCost.toString());
    categories.filament = categories.filament.plus(costs.filamentCost.toString());
    categories.electricity = categories.electricity.plus(costs.electricityCost.toString());
    const key = bucket(job.completedAt, period);
    series.set(key, (series.get(key) ?? new Decimal(0)).plus(costs.totalCost.toString()));
  }

  const settings = await db.appSettings.findUniqueOrThrow({ where: { id: 1 } });
  return {
    lowStock: settings.spoolManagementEnabled ? await lowStockFilaments() : [],
    period,
    periodStart: start?.toISOString() ?? null,
    periodEnd: now.toISOString(),
    currency: completed[0]?.currency ?? unfinished[0]?.currency ?? settings.currency,
    kpis: {
      revenue: canonicalDecimal(revenue),
      margin: canonicalDecimal(margin),
      successes,
      failures,
      pendingOutcomes: completed.length - successes - failures,
      successRate:
        successes + failures
          ? canonicalDecimal(new Decimal(successes).mul(100).div(successes + failures))
          : null,
      actualCost: canonicalDecimal(actualCost),
      failedCost: canonicalDecimal(failedCost),
      variance: canonicalDecimal(variance),
      activeDrafts: unfinished.filter((job) => job.status === 'DRAFT').length,
      completedPrints: completed.length,
      totalDurationSeconds: duration,
      totalCost: canonicalDecimal(total),
    },
    completedCostSeries: [...series.entries()].map(([date, value]) => ({
      date,
      value: canonicalDecimal(value),
    })),
    categoryTotals: Object.entries(categories).map(([category, value]) => ({
      category,
      value: canonicalDecimal(value),
    })),
    unfinishedPrints: unfinished.map((job) => ({
      id: job.id,
      name: job.name,
      status: job.status,
      customer: job.customer ? { id: job.customer.id, name: job.customer.name } : null,
      printer: { id: job.printer.id, name: job.printer.name },
      printers: job.parts.map((part) => ({ id: part.printer.id, name: part.printer.name })),
      totalDurationSeconds: job.totalDurationSeconds,
      totalCost: job.snapshot?.calculationJson
        ? JSON.parse(job.snapshot.calculationJson).totalCost
        : canonicalDecimal(job.totalCost.toString()),
      currency: job.currency,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    })),
  };
}
