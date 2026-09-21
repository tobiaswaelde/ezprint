import type { PrintFinancials } from '../domain/print-financials';
import type { PrintCalculationResult } from '../domain/print-calculation';
import type { PrintOutcomeInput } from '../schemas/print-outcomes';
import type { PrintStatus } from '../schemas/prints';

export type OutcomeRevisionDto = PrintOutcomeInput & {
  revision: number;
  recordedAt: string;
  costs: PrintCalculationResult;
};

export interface PrintPartDto {
  bambuLinked: boolean;
  id: string;
  position: number;
  printerId: string;
  printer: { id: string; name: string };
  totalDurationSeconds: number;
  totalCost: string;
  componentUsages: PrintJobDto['componentUsages'];
  filamentUsages: PrintJobDto['filamentUsages'];
  snapshot: PrintJobDto['snapshot'];
}

export interface PrintJobDto {
  parts: PrintPartDto[];
  series: { id: string; name: string; archivedAt: string | null } | null;
  seriesId: string | null;
  repeatOf: { id: string; name: string } | null;
  repeats: Array<{ id: string; name: string }>;
  salesValue: string | null;
  financials: PrintFinancials;
  retryOf: { id: string; name: string } | null;
  retries: Array<{ id: string; name: string }>;
  outcome: (OutcomeRevisionDto & { history: OutcomeRevisionDto[] }) | null;
  quantity: number;
  costPerUnit: string;
  id: string;
  name: string;
  customer: { id: string; name: string } | null;
  customerId: string | null;
  printer: { id: string; name: string };
  printerId: string;
  status: PrintStatus;
  notes: string | null;
  totalDurationSeconds: number;
  formulaVersion: string;
  currency: string;
  totalCost: string;
  completedAt: string | null;
  paidAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  componentUsages: Array<{
    id: string;
    componentId: string;
    type: 'HOTEND' | 'BUILD_PLATE' | 'OTHER';
    name: string;
    purchasePrice: string;
    expectedLifetimeHours: string;
    hourlyRate: string;
    appliedDurationSeconds: number;
    lineCost: string;
  }>;
  filamentUsages: Array<{
    id: string;
    filamentId: string;
    spoolId: string | null;
    spoolCode: string | null;
    name: string;
    costPerGram: string;
    usedGrams: string;
    lineCost: string;
  }>;
  snapshot:
    | (Omit<PrintCalculationResult, 'lines' | 'totalDurationSeconds' | 'calculationVersion'> & {
        salesValue: string | null;
        printerName: string;
        printerPurchasePrice: string;
        printerExpectedLifetimeHours: string;
        printerHourlyRate: string;
        printerPowerWatts: number;
        formulaVersion: string;
        electricityPricePerKwh: string;
        calculatedAt: string;
      })
    | null;
}

export interface DashboardDto {
  lowStock: Array<{
    filamentId: string;
    name: string;
    remainingGrams: string | null;
    minimumStockGrams: string;
  }>;
  period: '30d' | '90d' | 'all';
  periodStart: string | null;
  periodEnd: string;
  currency: string;
  kpis: {
    revenue: string;
    margin: string;
    successes: number;
    failures: number;
    pendingOutcomes: number;
    successRate: string | null;
    actualCost: string;
    failedCost: string;
    variance: string;
    activeDrafts: number;
    completedPrints: number;
    totalDurationSeconds: number;
    totalCost: string;
  };
  completedCostSeries: Array<{ date: string; value: string }>;
  categoryTotals: Array<{ category: string; value: string }>;
  unfinishedPrints: Array<{
    id: string;
    name: string;
    status: PrintStatus;
    customer: { id: string; name: string } | null;
    printer: { id: string; name: string };
    printers: Array<{ id: string; name: string }>;
    totalDurationSeconds: number;
    totalCost: string;
    currency: string;
    updatedAt: string;
  }>;
}
