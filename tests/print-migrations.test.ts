import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('preserves version 1 snapshot values when adding quantity and exact unit costs', () => {
  const database = new Database(':memory:');
  try {
    const migrations = readdirSync('prisma/migrations')
      .filter((name) => name.startsWith('20'))
      .sort();
    for (const name of migrations.filter((name) => name < '20260911160000'))
      database.exec(readFileSync(join('prisma/migrations', name, 'migration.sql'), 'utf8'));
    database.exec(`
      INSERT INTO Manufacturer (id, name, updatedAt) VALUES ('maker', 'Synthetic maker', CURRENT_TIMESTAMP);
      INSERT INTO Filament (id, name, manufacturerId, material, colorName, purchasePrice, netWeightGrams, updatedAt) VALUES ('filament', 'Legacy PLA', 'maker', 'PLA', 'White', 20, 1000, CURRENT_TIMESTAMP);
      INSERT INTO Printer (id, name, purchasePrice, expectedLifetimeHours, averagePowerWatts, updatedAt)
      VALUES ('printer', 'Historical printer', 100, 1000, 100, CURRENT_TIMESTAMP);
      INSERT INTO PrintJob (id, name, printerId, status, totalDurationSeconds, formulaVersion, currency, totalCost, updatedAt)
      VALUES ('print', 'Historical print', 'printer', 'DONE', 3600, '1', 'EUR', 1.782175, CURRENT_TIMESTAMP);
      INSERT INTO PrintCostSnapshot (id, printJobId, electricityPricePerKwh, printerName, printerPurchasePrice,
        printerExpectedLifetimeHours, printerHourlyRate, printerPowerWatts, printerCost, componentCost,
        filamentCost, electricityCost, totalCost, currency, formulaVersion)
      VALUES ('snapshot', 'print', 0.32, 'Historical printer', 100, 1000, 0.1, 100, 0.3, 0.15, 1.274575, 0.0576, 1.782175, 'EUR', '1');
    `);
    const original = database.prepare('SELECT * FROM PrintCostSnapshot').get();
    const preserved: Record<string, unknown> = {};
    for (const name of migrations.filter((name) => name >= '20260911160000')) {
      if (name.endsWith('_print_parts')) {
        database.exec(`
          INSERT INTO Component (id, name, type, purchasePrice, expectedLifetimeHours, updatedAt)
          VALUES ('plate', 'Legacy plate', 'BUILD_PLATE', 20, 1000, CURRENT_TIMESTAMP);
          INSERT INTO PrintComponentUsage (id, printJobId, componentId, componentType, componentName, purchasePrice,
            expectedLifetimeHours, hourlyRate, appliedDurationSeconds, lineCost)
          VALUES ('plate-usage', 'print', 'plate', 'BUILD_PLATE', 'Legacy plate', 20, 1000, 0.02, 3600, 0.02);
          INSERT INTO PrintFilamentUsage (id, printJobId, filamentId, filamentName, manufacturer, material,
            purchasePrice, netWeightGrams, costPerGram, usedGrams, lineCost)
          VALUES ('filament-usage', 'print', 'filament', 'Legacy PLA', 'Synthetic maker', 'PLA', 20, 1000, 0.02, 10, 0.2);
          INSERT INTO PrintOutcome (id, printJobId, status, durationSeconds, inputSnapshot, costSnapshot)
          VALUES ('outcome', 'print', 'SUCCESS', 3600, '{"legacy":"input"}', '{"legacy":"costs"}');
          INSERT INTO BambuPrintLink (id, printJobId, remoteLogId, cachedJson, importedJson)
          VALUES ('link', 'print', 123, '{"legacy":"log"}', '{"legacy":"import"}');
        `);
        for (const table of ['PrintComponentUsage', 'PrintFilamentUsage', 'PrintOutcome', 'BambuPrintLink'])
          preserved[table] = database.prepare(`SELECT * FROM ${table}`).get();
      }
      database.exec(readFileSync(join('prisma/migrations', name, 'migration.sql'), 'utf8'));
    }
    for (const table of ['PrintComponentUsage', 'PrintFilamentUsage'])
      expect(database.prepare(`SELECT * FROM ${table}`).get()).toEqual({
        ...(preserved[table] as object),
        partId: 'part:print',
      });
    for (const table of ['PrintOutcome', 'BambuPrintLink'])
      expect(database.prepare(`SELECT * FROM ${table}`).get()).toEqual(preserved[table]);
    expect(database.prepare('SELECT * FROM PrintCostSnapshot').get()).toEqual({
      ...original!,
      quantity: 1,
      costPerUnit: null,
      calculationJson: null,
      salesValue: null,
    });
    expect(database.prepare('SELECT * FROM PrintPart').get()).toEqual({
      id: 'part:print',
      printJobId: 'print',
      position: 0,
      printerId: 'printer',
      totalDurationSeconds: 3600,
      snapshotJson: null,
    });
    expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(database.prepare('SELECT quantity, totalCost FROM PrintJob').get()).toEqual({
      quantity: 1,
      totalCost: 1.782175,
    });
    expect(
      database
        .prepare('SELECT legacy, initialNetWeightGrams FROM Spool WHERE filamentId = ?')
        .get('filament'),
    ).toEqual({ legacy: 1, initialNetWeightGrams: '1000' });
    expect(database.prepare('SELECT kind, grams FROM StockMovement').get()).toEqual({
      kind: 'RECEIPT',
      grams: '1000',
    });
    database.prepare('UPDATE PrintCostSnapshot SET costPerUnit = ?').run('0.59405833333333333333');
    expect(database.prepare('SELECT costPerUnit FROM PrintCostSnapshot').get()).toEqual({
      costPerUnit: '0.59405833333333333333',
    });
  } finally {
    database.close();
  }
});
