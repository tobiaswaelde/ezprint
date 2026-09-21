import type { Prisma } from '../../prisma/generated/client/client';
import { calculatePrintCost, type PrintCalculationResult } from '../../shared/domain/print-calculation';
import { calculateActualPrintCost } from '../../shared/domain/print-outcome';
import type { PrintOutcomeInput } from '../../shared/schemas/print-outcomes';
import { canonicalDecimal } from '../../shared/utils/decimal';

type Transaction = Prisma.TransactionClient;
export type DemoDataOptions = {
  currency: string;
  electricityPrice: string;
  printSeriesEnabled: boolean;
  spoolManagementEnabled: boolean;
};
type PrintStatus = 'DRAFT' | 'PRINTING' | 'PRINTED' | 'SHIPPED' | 'DONE';
type DemoPrint = {
  slug: string;
  name: string;
  status: PrintStatus;
  daysAgo: number;
  quantity: number;
  salesValue: string;
  plannedSeconds: number;
  plannedGrams: string;
  filament: 'teal' | 'orange' | 'black';
  paid: boolean;
  outcome?: {
    status: 'SUCCESS' | 'FAILED';
    actualSeconds: number;
    actualGrams: string;
    failureReason?: string;
  };
};

const ids = {
  customerNorth: 'demo-customer-studio-north',
  customerLab: 'demo-customer-prototype-lab',
  printer: 'demo-printer-mk4',
  prusa: 'demo-manufacturer-prusa',
  e3d: 'demo-manufacturer-e3d',
  workshop: 'demo-manufacturer-workshop',
  polymaker: 'demo-manufacturer-polymaker',
  plate: 'demo-component-build-plate',
  hotend: 'demo-component-hotend',
  enclosure: 'demo-component-enclosure',
  teal: 'demo-filament-teal',
  orange: 'demo-filament-orange',
  black: 'demo-filament-black',
  tealSpool: 'demo-spool-teal',
  orangeSpool: 'demo-spool-orange',
  blackSpool: 'demo-spool-black',
  series: 'demo-series-studio-collection',
} as const;

const filamentData = {
  teal: {
    id: ids.teal,
    spoolId: ids.tealSpool,
    spoolCode: 'DEMO-PLA-TEAL-001',
    name: 'Polymaker PLA - Teal',
    material: 'PLA',
    purchasePrice: '24.99',
    netWeightGrams: '1000',
  },
  orange: {
    id: ids.orange,
    spoolId: ids.orangeSpool,
    spoolCode: 'DEMO-PETG-ORANGE-001',
    name: 'Polymaker PETG - Orange',
    material: 'PETG',
    purchasePrice: '27.9',
    netWeightGrams: '1000',
  },
  black: {
    id: ids.black,
    spoolId: ids.blackSpool,
    spoolCode: 'DEMO-ASA-BLACK-001',
    name: 'Polymaker ASA - Black',
    material: 'ASA',
    purchasePrice: '31.5',
    netWeightGrams: '750',
  },
} as const;

const demoPrints: DemoPrint[] = [
  {
    slug: 'lamp-draft',
    name: 'Architectural Lamp Draft',
    status: 'DRAFT',
    daysAgo: 0,
    quantity: 2,
    salesValue: '39.9',
    plannedSeconds: 21_600,
    plannedGrams: '185',
    filament: 'teal',
    paid: false,
  },
  {
    slug: 'housing-printing',
    name: 'Prototype Housing',
    status: 'PRINTING',
    daysAgo: 1,
    quantity: 1,
    salesValue: '29',
    plannedSeconds: 14_400,
    plannedGrams: '120',
    filament: 'orange',
    paid: true,
  },
  {
    slug: 'organizer-printed',
    name: 'Workshop Organizer',
    status: 'PRINTED',
    daysAgo: 2,
    quantity: 3,
    salesValue: '18',
    plannedSeconds: 18_000,
    plannedGrams: '210',
    filament: 'black',
    paid: false,
  },
  {
    slug: 'stand-shipped',
    name: 'Display Stand',
    status: 'SHIPPED',
    daysAgo: 4,
    quantity: 2,
    salesValue: '24',
    plannedSeconds: 10_800,
    plannedGrams: '95',
    filament: 'orange',
    paid: true,
  },
  {
    slug: 'lamp-success',
    name: 'Architectural Lamp',
    status: 'DONE',
    daysAgo: 7,
    quantity: 3,
    salesValue: '42',
    plannedSeconds: 23_400,
    plannedGrams: '185',
    filament: 'teal',
    paid: true,
    outcome: { status: 'SUCCESS', actualSeconds: 22_980, actualGrams: '181.4' },
  },
  {
    slug: 'bracket-failed',
    name: 'Machine Bracket Prototype',
    status: 'DONE',
    daysAgo: 16,
    quantity: 1,
    salesValue: '16.5',
    plannedSeconds: 8_100,
    plannedGrams: '72',
    filament: 'black',
    paid: false,
    outcome: {
      status: 'FAILED',
      actualSeconds: 4_200,
      actualGrams: '39.8',
      failureReason: 'Synthetic layer-shift example',
    },
  },
  {
    slug: 'fixture-success',
    name: 'Assembly Fixture Set',
    status: 'DONE',
    daysAgo: 45,
    quantity: 4,
    salesValue: '21',
    plannedSeconds: 28_800,
    plannedGrams: '260',
    filament: 'orange',
    paid: true,
    outcome: { status: 'SUCCESS', actualSeconds: 29_340, actualGrams: '267.2' },
  },
  {
    slug: 'vase-pending',
    name: 'Presentation Vase',
    status: 'DONE',
    daysAgo: 3,
    quantity: 1,
    salesValue: '35',
    plannedSeconds: 19_800,
    plannedGrams: '160',
    filament: 'teal',
    paid: false,
  },
];

function dateDaysAgo(days: number) {
  const value = new Date();
  value.setUTCHours(12, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() - days);
  return value;
}

export async function assertEmptyDatabase(transaction: Transaction) {
  const counts = await Promise.all([
    transaction.user.count(),
    transaction.appSettings.count(),
    transaction.customer.count(),
    transaction.printer.count(),
    transaction.manufacturer.count(),
    transaction.component.count(),
    transaction.filament.count(),
    transaction.spool.count(),
    transaction.printSeries.count(),
    transaction.printJob.count(),
  ]);
  if (counts.some(Boolean))
    throw new Error('Refusing to seed a database that already contains application data.');
}

function line(result: PrintCalculationResult, sourceId: string) {
  const value = result.lines.find((entry) => entry.sourceId === sourceId);
  if (!value) throw new Error(`Missing calculated line for ${sourceId}.`);
  return value;
}

async function createPrint(transaction: Transaction, spec: DemoPrint, options: DemoDataOptions) {
  const filament = filamentData[spec.filament];
  const createdAt = dateDaysAgo(spec.daysAgo);
  const printId = `demo-print-${spec.slug}`;
  const plateUsageId = `${printId}-plate`;
  const hotendUsageId = `${printId}-hotend`;
  const enclosureUsageId = `${printId}-enclosure`;
  const filamentUsageId = `${printId}-filament`;
  const filamentSourceId = options.spoolManagementEnabled ? filament.spoolId : filament.id;
  const calculation = calculatePrintCost({
    quantity: spec.quantity,
    printer: {
      id: ids.printer,
      name: 'Workshop Prusa MK4',
      purchasePrice: '1199',
      expectedLifetimeHours: '5000',
      averagePowerWatts: 120,
    },
    buildPlate: {
      id: ids.plate,
      name: 'Textured PEI plate',
      purchasePrice: '44.9',
      expectedLifetimeHours: '1800',
    },
    hotends: [
      {
        id: ids.hotend,
        name: '0.4 mm high-flow hotend',
        purchasePrice: '89.9',
        expectedLifetimeHours: '2500',
        durationSeconds: spec.plannedSeconds,
      },
    ],
    otherComponents: [
      {
        id: ids.enclosure,
        name: 'Heated enclosure',
        purchasePrice: '249',
        expectedLifetimeHours: '6000',
      },
    ],
    filaments: [
      {
        id: filamentSourceId,
        name: options.spoolManagementEnabled ? `${filament.name} · ${filament.spoolCode}` : filament.name,
        purchasePrice: filament.purchasePrice,
        netWeightGrams: filament.netWeightGrams,
        usedGrams: spec.plannedGrams,
      },
    ],
    electricityPricePerKwh: options.electricityPrice,
    currency: options.currency,
  });
  const plateLine = line(calculation, ids.plate);
  const hotendLine = line(calculation, ids.hotend);
  const enclosureLine = line(calculation, ids.enclosure);
  const filamentLine = line(calculation, filamentSourceId);

  await transaction.printJob.create({
    data: {
      id: printId,
      seriesId: options.printSeriesEnabled ? ids.series : null,
      name: spec.name,
      salesValue: spec.salesValue,
      customerId: ids.customerNorth,
      printerId: ids.printer,
      status: spec.status,
      notes: 'Synthetic demonstration data.',
      quantity: spec.quantity,
      totalDurationSeconds: calculation.totalDurationSeconds,
      formulaVersion: calculation.calculationVersion,
      currency: calculation.currency,
      totalCost: calculation.totalCost,
      completedAt: spec.status === 'DONE' ? createdAt : null,
      paidAt: spec.paid ? createdAt : null,
      createdAt,
      updatedAt: createdAt,
      parts: {
        create: {
          id: `${printId}-part`,
          position: 0,
          printerId: ids.printer,
          totalDurationSeconds: spec.plannedSeconds,
          componentUsages: {
            create: [
              {
                printJobId: printId,
                id: plateUsageId,
                componentId: ids.plate,
                componentType: 'BUILD_PLATE',
                componentName: 'Textured PEI plate',
                purchasePrice: '44.9',
                expectedLifetimeHours: '1800',
                hourlyRate: plateLine.unitRate,
                appliedDurationSeconds: spec.plannedSeconds,
                lineCost: plateLine.cost,
                createdAt,
              },
              {
                printJobId: printId,
                id: hotendUsageId,
                componentId: ids.hotend,
                componentType: 'HOTEND',
                componentName: '0.4 mm high-flow hotend',
                purchasePrice: '89.9',
                expectedLifetimeHours: '2500',
                hourlyRate: hotendLine.unitRate,
                appliedDurationSeconds: spec.plannedSeconds,
                lineCost: hotendLine.cost,
                createdAt,
              },
              {
                printJobId: printId,
                id: enclosureUsageId,
                componentId: ids.enclosure,
                componentType: 'OTHER',
                componentName: 'Heated enclosure',
                purchasePrice: '249',
                expectedLifetimeHours: '6000',
                hourlyRate: enclosureLine.unitRate,
                appliedDurationSeconds: spec.plannedSeconds,
                lineCost: enclosureLine.cost,
                createdAt,
              },
            ],
          },
          filamentUsages: {
            create: {
              printJobId: printId,
              id: filamentUsageId,
              spoolId: options.spoolManagementEnabled ? filament.spoolId : null,
              spoolCode: options.spoolManagementEnabled ? filament.spoolCode : null,
              filamentId: filament.id,
              filamentName: filament.name,
              manufacturer: 'Polymaker',
              material: filament.material,
              purchasePrice: filament.purchasePrice,
              netWeightGrams: filament.netWeightGrams,
              costPerGram: filamentLine.unitRate,
              usedGrams: spec.plannedGrams,
              lineCost: filamentLine.cost,
              createdAt,
            },
          },
        },
      },
      snapshot: {
        create: {
          id: `${printId}-snapshot`,
          calculationJson: JSON.stringify(calculation),
          salesValue: spec.salesValue,
          quantity: spec.quantity,
          costPerUnit: calculation.costPerUnit,
          electricityPricePerKwh: options.electricityPrice,
          printerName: 'Workshop Prusa MK4',
          printerPurchasePrice: '1199',
          printerExpectedLifetimeHours: '5000',
          printerHourlyRate: line(calculation, ids.printer).unitRate,
          printerPowerWatts: 120,
          printerCost: calculation.printerCost,
          componentCost: calculation.componentCost,
          filamentCost: calculation.filamentCost,
          electricityCost: calculation.electricityCost,
          totalCost: calculation.totalCost,
          currency: calculation.currency,
          formulaVersion: calculation.calculationVersion,
          calculatedAt: createdAt,
        },
      },
    },
  });

  if (!spec.outcome) return;
  const outcomeInput: PrintOutcomeInput = {
    status: spec.outcome.status,
    durationSeconds: spec.outcome.actualSeconds,
    filaments: [{ usageId: filamentUsageId, usedGrams: spec.outcome.actualGrams }],
    failureReason: spec.outcome.failureReason ?? null,
    note: spec.outcome.status === 'SUCCESS' ? 'Synthetic successful print.' : 'Synthetic failed print.',
  };
  const actualCosts = calculateActualPrintCost(
    {
      quantity: spec.quantity,
      currency: options.currency,
      totalDurationSeconds: spec.plannedSeconds,
      printerId: ids.printer,
      snapshot: {
        printerName: 'Workshop Prusa MK4',
        printerHourlyRate: line(calculation, ids.printer).unitRate,
        printerPowerWatts: 120,
        electricityPricePerKwh: options.electricityPrice,
      },
      componentUsages: [
        {
          id: ids.plate,
          name: 'Textured PEI plate',
          type: 'BUILD_PLATE',
          hourlyRate: plateLine.unitRate,
          appliedDurationSeconds: spec.plannedSeconds,
        },
        {
          id: ids.hotend,
          name: '0.4 mm high-flow hotend',
          type: 'HOTEND',
          hourlyRate: hotendLine.unitRate,
          appliedDurationSeconds: spec.plannedSeconds,
        },
        {
          id: ids.enclosure,
          name: 'Heated enclosure',
          type: 'OTHER',
          hourlyRate: enclosureLine.unitRate,
          appliedDurationSeconds: spec.plannedSeconds,
        },
      ],
      filamentUsages: [{ id: filamentUsageId, name: filament.name, costPerGram: filamentLine.unitRate }],
    },
    outcomeInput,
  );
  await transaction.printOutcome.create({
    data: {
      id: `${printId}-outcome`,
      printJobId: printId,
      status: outcomeInput.status,
      durationSeconds: outcomeInput.durationSeconds,
      failureReason: outcomeInput.failureReason,
      note: outcomeInput.note,
      inputSnapshot: JSON.stringify(outcomeInput),
      costSnapshot: JSON.stringify(actualCosts),
      stockTracked: options.spoolManagementEnabled,
      recordedAt: createdAt,
    },
  });
  if (options.spoolManagementEnabled)
    await transaction.stockMovement.create({
      data: {
        id: `${printId}-stock`,
        spoolId: filament.spoolId,
        kind: 'PRINT',
        grams: canonicalDecimal(`-${spec.outcome.actualGrams}`),
        note: `Consumed by ${spec.name}.`,
        operationKey: `demo-outcome:${printId}:${filamentUsageId}`,
        printUsageId: filamentUsageId,
        createdAt,
      },
    });
}

export async function createDemoData(transaction: Transaction, options: DemoDataOptions) {
  await transaction.customer.createMany({
    data: [
      {
        id: ids.customerNorth,
        name: 'Studio North',
        email: 'hello@studio-north.example',
        note: 'Synthetic demonstration customer.',
      },
      {
        id: ids.customerLab,
        name: 'Prototype Lab',
        email: 'orders@prototype-lab.example',
        note: 'Synthetic demonstration customer.',
      },
    ],
  });
  await transaction.manufacturer.createMany({
    data: [
      { id: ids.prusa, name: 'Prusa Research' },
      { id: ids.e3d, name: 'E3D' },
      { id: ids.workshop, name: 'Workshop' },
      { id: ids.polymaker, name: 'Polymaker' },
    ],
  });
  await transaction.printer.create({
    data: {
      id: ids.printer,
      name: 'Workshop Prusa MK4',
      manufacturerId: ids.prusa,
      model: 'MK4',
      purchasePrice: '1199',
      expectedLifetimeHours: '5000',
      averagePowerWatts: 120,
      note: 'Primary synthetic demonstration printer.',
    },
  });
  await transaction.component.createMany({
    data: [
      {
        id: ids.plate,
        type: 'BUILD_PLATE',
        name: 'Textured PEI plate',
        alwaysUsed: true,
        manufacturerId: ids.prusa,
        model: 'MK4 textured sheet',
        purchasePrice: '44.9',
        expectedLifetimeHours: '1800',
      },
      {
        id: ids.hotend,
        type: 'HOTEND',
        name: '0.4 mm high-flow hotend',
        alwaysUsed: true,
        manufacturerId: ids.e3d,
        model: 'Revo High Flow',
        purchasePrice: '89.9',
        expectedLifetimeHours: '2500',
      },
      {
        id: ids.enclosure,
        type: 'OTHER',
        name: 'Heated enclosure',
        alwaysUsed: true,
        manufacturerId: ids.workshop,
        model: 'Enclosure V2',
        purchasePrice: '249',
        expectedLifetimeHours: '6000',
      },
    ],
  });
  await transaction.printerComponent.createMany({
    data: [ids.plate, ids.hotend, ids.enclosure].map((componentId) => ({
      printerId: ids.printer,
      componentId,
    })),
  });
  await transaction.filament.createMany({
    data: [
      {
        id: ids.teal,
        name: filamentData.teal.name,
        manufacturerId: ids.polymaker,
        material: filamentData.teal.material,
        minimumStockGrams: '250',
        colorName: 'Teal',
        colorHex: '#1F9E89',
        purchasePrice: filamentData.teal.purchasePrice,
        netWeightGrams: filamentData.teal.netWeightGrams,
      },
      {
        id: ids.orange,
        name: filamentData.orange.name,
        manufacturerId: ids.polymaker,
        material: filamentData.orange.material,
        minimumStockGrams: '200',
        colorName: 'Orange',
        colorHex: '#F97316',
        purchasePrice: filamentData.orange.purchasePrice,
        netWeightGrams: filamentData.orange.netWeightGrams,
      },
      {
        id: ids.black,
        name: filamentData.black.name,
        manufacturerId: ids.polymaker,
        material: filamentData.black.material,
        minimumStockGrams: '250',
        colorName: 'Black',
        colorHex: '#18181B',
        purchasePrice: filamentData.black.purchasePrice,
        netWeightGrams: filamentData.black.netWeightGrams,
      },
    ],
  });
  if (options.spoolManagementEnabled)
    await transaction.spool.createMany({
      data: [
        {
          id: ids.tealSpool,
          code: filamentData.teal.spoolCode,
          filamentId: ids.teal,
          purchaseLot: 'DEMO-2026-A',
          location: 'Shelf A',
          acquiredAt: dateDaysAgo(60),
          purchasePrice: filamentData.teal.purchasePrice,
          initialNetWeightGrams: filamentData.teal.netWeightGrams,
        },
        {
          id: ids.orangeSpool,
          code: filamentData.orange.spoolCode,
          filamentId: ids.orange,
          purchaseLot: 'DEMO-2026-B',
          location: 'Shelf B',
          acquiredAt: dateDaysAgo(55),
          purchasePrice: filamentData.orange.purchasePrice,
          initialNetWeightGrams: filamentData.orange.netWeightGrams,
        },
        {
          id: ids.blackSpool,
          code: filamentData.black.spoolCode,
          filamentId: ids.black,
          purchaseLot: 'DEMO-2026-C',
          location: 'Shelf C',
          acquiredAt: dateDaysAgo(50),
          purchasePrice: filamentData.black.purchasePrice,
          initialNetWeightGrams: filamentData.black.netWeightGrams,
        },
      ],
    });
  if (options.spoolManagementEnabled)
    await transaction.stockMovement.createMany({
      data: [
        {
          id: 'demo-stock-opening-teal',
          spoolId: ids.tealSpool,
          kind: 'RECEIPT',
          grams: '1000',
          note: 'Synthetic opening stock.',
          operationKey: 'demo-opening:teal',
          createdAt: dateDaysAgo(60),
        },
        {
          id: 'demo-stock-opening-orange',
          spoolId: ids.orangeSpool,
          kind: 'RECEIPT',
          grams: '1000',
          note: 'Synthetic opening stock.',
          operationKey: 'demo-opening:orange',
          createdAt: dateDaysAgo(55),
        },
        {
          id: 'demo-stock-opening-black',
          spoolId: ids.blackSpool,
          kind: 'RECEIPT',
          grams: '750',
          note: 'Synthetic opening stock.',
          operationKey: 'demo-opening:black',
          createdAt: dateDaysAgo(50),
        },
        {
          id: 'demo-stock-adjustment-black',
          spoolId: ids.blackSpool,
          kind: 'CORRECTION',
          grams: '-500',
          note: 'Synthetic prior workshop consumption.',
          operationKey: 'demo-adjustment:black',
          createdAt: dateDaysAgo(20),
        },
      ],
    });
  if (options.printSeriesEnabled)
    await transaction.printSeries.create({
      data: {
        id: ids.series,
        name: 'Studio Collection',
        customerId: ids.customerNorth,
        targetQuantity: 20,
        notes: 'Synthetic repeat-order example.',
      },
    });
  for (const print of demoPrints) await createPrint(transaction, print, options);
}
