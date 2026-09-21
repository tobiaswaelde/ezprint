import type { PrintJobDto } from '../types/prints';

export function reportFilename(name: string, date: string | null) {
  return `${
    name
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'print'
  }-${date?.slice(0, 10) ?? 'undated'}`;
}
export function csvCell(value: string | number | null | undefined, text = false) {
  let field = String(value ?? '');
  // Control-prefixed formulas must also be neutralized for spreadsheet imports.
  // eslint-disable-next-line no-control-regex
  if (text && /^[\s\u0000-\u001f]*[=+\-@]/.test(field)) field = `'${field}`;
  return `"${field.replaceAll('"', '""')}"`;
}
export const printCsvColumns = [
  'id',
  'name',
  'customer',
  'printer',
  'series',
  'completed_at',
  'archived_at',
  'currency',
  'quantity',
  'duration_seconds',
  'planned_cost',
  'planned_cost_per_unit',
  'outcome',
  'outcome_at',
  'actual_duration_seconds',
  'actual_cost',
  'actual_cost_per_unit',
  'failure_reason',
  'spool_codes',
  'sales_value',
  'planned_margin',
  'revenue',
  'realized_margin',
  'parts',
] as const;
export function printCsvRow(print: PrintJobDto) {
  const values = [
    print.id,
    print.name,
    print.customer?.name,
    print.parts?.map((part) => part.snapshot?.printerName ?? part.printer.name).join('; ') ??
      print.snapshot?.printerName ??
      print.printer.name,
    print.series?.name,
    print.completedAt,
    print.archivedAt,
    print.currency,
    print.quantity,
    print.totalDurationSeconds,
    print.totalCost,
    print.costPerUnit,
    print.outcome?.status,
    print.outcome?.recordedAt,
    print.outcome?.durationSeconds,
    print.outcome?.costs.totalCost,
    print.outcome?.costs.costPerUnit,
    print.outcome?.failureReason,
    print.filamentUsages
      .map((line) => line.spoolCode)
      .filter(Boolean)
      .join('; '),
    print.salesValue,
    print.financials.plannedMargin,
    print.financials.realizedRevenue,
    print.financials.realizedMargin,
    JSON.stringify(
      print.parts?.map((part) => ({
        printer: part.snapshot?.printerName ?? part.printer.name,
        buildPlate: part.componentUsages.find((line) => line.type === 'BUILD_PLATE')?.name,
        durationSeconds: part.totalDurationSeconds,
        totalCost: part.totalCost,
      })) ?? [],
    ),
  ];
  return (
    values.map((value, index) => csvCell(value, [0, 1, 2, 3, 4, 17, 18].includes(index))).join(',') + '\r\n'
  );
}
