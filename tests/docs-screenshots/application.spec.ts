import { startFakeIntegrations } from '../utils/fake-integrations';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import Database from 'better-sqlite3';
import { join, resolve } from 'node:path';
import { assertSafeTestDatabaseUrl } from '../utils/test-database';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';

const appPort = process.env.PRINT_COST_SCREENSHOT_APP_PORT ?? '3001';
const integrationPort = Number(process.env.PRINT_COST_SCREENSHOT_INTEGRATION_PORT ?? '3003');
const appUrl = `http://127.0.0.1:${appPort}`;
const screenshotDirectory = resolve('docs/public/screenshots');
const screenshotOptions = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
  quality: 88,
  scale: 'css' as const,
  type: 'jpeg' as const,
};

type Resource = { id: string };

async function api<T>(page: Page, path: string, method: 'POST' | 'PATCH', body?: unknown): Promise<T> {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
      return JSON.parse(text) as T;
    },
    { path, method, body },
  );
}

async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.screenshot({
    path: resolve(screenshotDirectory, name),
    ...screenshotOptions,
  });
}

async function captureSignIn(browser: Browser) {
  const context = await browser.newContext({
    baseURL: appUrl,
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    locale: 'en-US',
    timezoneId: 'UTC',
  });
  const page = await context.newPage();
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await capture(page, 'sign-in.jpg');
  await context.close();
}

async function selectOption(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

let fake: Awaited<ReturnType<typeof startFakeIntegrations>>;
test.beforeAll(async () => {
  fake = await startFakeIntegrations(integrationPort);
});
test.afterAll(() => fake?.close());

test('regenerates every application screenshot used by the documentation', async ({ page, browser }) => {
  mkdirSync(screenshotDirectory, { recursive: true });

  await page.route('**/api/version-latest', async (route) => {
    await route.fulfill({ json: { latest: null } });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'First-run setup' })).toBeVisible({ timeout: 30_000 });
  await capture(page, 'first-run-setup.jpg');

  await page.getByLabel('Display name').fill('Alex Morgan');
  await page.getByLabel('Email').fill('alex@example.test');
  await page.getByLabel('Password').fill('documentation-demo-2026');
  await page.getByLabel('Electricity price per kWh').fill('0.32');
  await page.getByRole('button', { name: 'First-run setup' }).click();
  await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();

  await captureSignIn(browser);

  const customer = await api<Resource>(page, '/api/customers', 'POST', {
    name: 'Studio North',
    email: 'hello@studio-north.example',
    note: 'Synthetic documentation customer',
  });
  const prusa = await api<Resource>(page, '/api/manufacturers', 'POST', {
    name: 'Prusa Research',
    note: null,
  });
  const printer = await api<Resource>(page, '/api/printers', 'POST', {
    name: 'Workshop Prusa MK4',
    manufacturerId: prusa.id,
    model: 'MK4',
    purchasePrice: '1199',
    expectedLifetimeHours: '5000',
    averagePowerWatts: 120,
    note: 'Primary documentation printer',
  });
  const e3d = await api<Resource>(page, '/api/manufacturers', 'POST', {
    name: 'E3D',
    note: null,
  });
  const workshop = await api<Resource>(page, '/api/manufacturers', 'POST', {
    name: 'Workshop',
    note: null,
  });
  const polymaker = await api<Resource>(page, '/api/manufacturers', 'POST', {
    name: 'Polymaker',
    note: null,
  });
  const buildPlate = await api<Resource>(page, '/api/components', 'POST', {
    type: 'BUILD_PLATE',
    name: 'Textured PEI plate',
    manufacturerId: prusa.id,
    model: 'MK4 textured sheet',
    purchasePrice: '44.90',
    expectedLifetimeHours: '1800',
    printerIds: [printer.id],
    note: null,
  });
  const hotend = await api<Resource>(page, '/api/components', 'POST', {
    type: 'HOTEND',
    name: '0.4 mm high-flow hotend',
    manufacturerId: e3d.id,
    model: 'Revo High Flow',
    purchasePrice: '89.90',
    expectedLifetimeHours: '2500',
    printerIds: [printer.id],
    note: null,
  });
  const enclosure = await api<Resource>(page, '/api/components', 'POST', {
    type: 'OTHER',
    name: 'Heated enclosure',
    manufacturerId: workshop.id,
    model: 'Enclosure V2',
    purchasePrice: '249',
    expectedLifetimeHours: '6000',
    printerIds: [printer.id],
    note: null,
  });
  const filament = await api<Resource>(page, '/api/filaments', 'POST', {
    name: 'PolyTerra PLA Teal',
    manufacturerId: polymaker.id,
    material: 'PLA',
    colorName: 'Teal',
    colorHex: '#1F9E89',
    purchasePrice: '24.99',
    netWeightGrams: '1000',
    note: null,
  });

  const openingSpools = (await (await page.request.get(`/api/spools?filamentId=${filament.id}`)).json()) as {
    items: Resource[];
  };
  for (const opening of openingSpools.items)
    await api(page, `/api/spools/${opening.id}/archive`, 'POST', { archived: true });
  const spool = await api<Resource>(page, '/api/spools', 'POST', {
    code: 'DOC-PLA-001',
    filamentId: filament.id,
    purchasePrice: '24.99',
    initialNetWeightGrams: '1000',
    location: 'Shelf A',
    purchaseLot: 'DEMO-2026',
    acquiredAt: '2026-09-10',
  });
  const screenshotRoot = process.env.PRINT_COST_SCREENSHOT_ROOT!;
  const fixtureDatabasePath = join(screenshotRoot, 'app.db');
  assertSafeTestDatabaseUrl(`file:${fixtureDatabasePath}`, screenshotRoot);
  const fixtureDatabase = new Database(fixtureDatabasePath, { fileMustExist: true });
  fixtureDatabase.pragma('foreign_keys = ON');
  fixtureDatabase.prepare('UPDATE Spool SET id = ? WHERE id = ?').run('documentation-spool', spool.id);
  fixtureDatabase
    .prepare('UPDATE StockMovement SET createdAt = ? WHERE spoolId = ?')
    .run('2026-09-10T18:54:00.000Z', 'documentation-spool');
  fixtureDatabase.close();
  spool.id = 'documentation-spool';

  const series = await api<Resource>(page, '/api/series', 'POST', {
    name: 'Studio collection',
    customerId: customer.id,
    targetQuantity: 20,
  });
  const printInput = {
    seriesId: series.id,
    salesValue: '12',
    customerId: customer.id,
    printerId: printer.id,
    buildPlateId: buildPlate.id,
    hotends: [{ componentId: hotend.id, durationSeconds: 23_400 }],
    otherComponentIds: [enclosure.id],
    filaments: [{ filamentId: filament.id, spoolId: spool.id, usedGrams: '185' }],
    notes: 'Synthetic data used to keep the documentation screenshots reproducible.',
  };
  const completed = await api<Resource>(page, '/api/prints', 'POST', {
    ...printInput,
    name: 'Architectural Lamp',
  });
  await api(page, `/api/prints/${completed.id}/complete`, 'POST');
  await api(page, `/api/prints/${completed.id}`, 'PATCH', { paid: true });
  const draft = await api<Resource>(page, '/api/prints', 'POST', {
    ...printInput,
    name: 'Prototype Housing',
  });
  const workflowExamples = [
    { name: 'Paid Draft Sample', status: 'DRAFT', paid: true },
    { name: 'Paid Printing Sample', status: 'PRINTING', paid: true },
    { name: 'Unpaid Printing Sample', status: 'PRINTING', paid: false },
    { name: 'Paid Printed Sample', status: 'PRINTED', paid: true },
    { name: 'Unpaid Printed Sample', status: 'PRINTED', paid: false },
    { name: 'Paid Shipped Sample', status: 'SHIPPED', paid: true },
    { name: 'Unpaid Shipped Sample', status: 'SHIPPED', paid: false },
    { name: 'Unpaid Done Sample', status: 'DONE', paid: false },
  ] as const;
  for (const example of workflowExamples) {
    const print = await api<Resource>(page, '/api/prints', 'POST', {
      ...printInput,
      name: example.name,
    });
    if (example.status !== 'DRAFT') {
      await api(page, `/api/prints/${print.id}`, 'PATCH', { status: example.status });
    }
    if (example.paid) await api(page, `/api/prints/${print.id}`, 'PATCH', { paid: true });
  }

  await page.route('**/api/dashboard?**', async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as {
      completedCostSeries?: Array<{ date: string }>;
      unfinishedPrints?: Array<{ updatedAt: string }>;
    };
    body.completedCostSeries?.forEach((entry) => (entry.date = '2026-09-10'));
    body.unfinishedPrints?.forEach((entry) => (entry.updatedAt = '2026-09-10T18:54:00.000Z'));
    await route.fulfill({ response, json: body });
  });
  await page.route(`**/api/prints/${completed.id}`, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { paidAt?: string; snapshot?: { calculatedAt: string } };
    if (body.paidAt) body.paidAt = '2026-09-10T18:54:00.000Z';
    if (body.snapshot) body.snapshot.calculatedAt = '2026-09-10T18:54:00.000Z';
    await route.fulfill({ response, json: body });
  });

  await page.goto('/');
  await expect(page.getByText('Prototype Housing', { exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(2);
  await expect(page.locator('canvas').first()).toHaveCSS('height', '320px');
  await page.waitForTimeout(1_200);
  await capture(page, 'dashboard.jpg');
  await page.getByRole('heading', { name: 'Unfinished prints' }).scrollIntoViewIfNeeded();
  await capture(page, 'dashboard-unfinished.jpg');

  await page.goto('/prints');
  const expectedWorkflowRows = [
    { name: 'Prototype Housing', status: 'Draft', payment: 'Unpaid' },
    { name: 'Paid Draft Sample', status: 'Draft', payment: 'Paid' },
    { name: 'Paid Printing Sample', status: 'Printing', payment: 'Paid' },
    { name: 'Unpaid Printing Sample', status: 'Printing', payment: 'Unpaid' },
    { name: 'Paid Printed Sample', status: 'Printed', payment: 'Paid' },
    { name: 'Unpaid Printed Sample', status: 'Printed', payment: 'Unpaid' },
    { name: 'Paid Shipped Sample', status: 'Shipped', payment: 'Paid' },
    { name: 'Unpaid Shipped Sample', status: 'Shipped', payment: 'Unpaid' },
    { name: 'Architectural Lamp', status: 'Done', payment: 'Paid' },
    { name: 'Unpaid Done Sample', status: 'Done', payment: 'Unpaid' },
  ];
  for (const example of expectedWorkflowRows) {
    const row = page
      .getByRole('row')
      .filter({ has: page.getByRole('link', { name: example.name, exact: true }) });
    await expect(row).toBeVisible();
    await expect(row.getByText(example.status, { exact: true })).toBeVisible();
    await expect(row.getByText(example.payment, { exact: true })).toBeVisible();
  }
  await capture(page, 'prints.jpg');

  await page.goto('/customers');
  await expect(page.getByText('Studio North', { exact: true })).toBeVisible();
  await capture(page, 'customers.jpg');

  await page.goto('/printers');
  await expect(page.getByText('Workshop Prusa MK4', { exact: true })).toBeVisible();
  await capture(page, 'printers.jpg');

  await page.goto('/components');
  await expect(page.getByText('Textured PEI plate', { exact: true })).toBeVisible();
  await capture(page, 'components.jpg');

  await page.goto('/filaments');
  await expect(page.getByText('Polymaker PLA - Teal', { exact: true })).toBeVisible();
  await capture(page, 'filaments.jpg');

  await page.goto('/spools');
  await expect(page.locator('[data-table-toolbar]')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Stock source' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'DOC-PLA-001', exact: true })).toBeVisible();
  await page.locator('[data-table-toolbar]').getByRole('button', { name: 'New' }).click();
  const newSpoolDialog = page.getByRole('dialog', { name: 'New spool' });
  await expect(newSpoolDialog.getByLabel('Spool code')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(newSpoolDialog).toBeHidden();
  await page.mouse.move(640, 400);
  const spoolRow = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'DOC-PLA-001' }) });
  await expect(spoolRow.getByRole('link', { name: 'QR label' })).toBeVisible();
  await capture(page, 'spools.jpg');
  await page.getByRole('link', { name: 'DOC-PLA-001', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'DOC-PLA-001', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Spool details' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Movement history' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).click();
  const editSpoolDialog = page.getByRole('dialog', { name: 'Edit spool' });
  await expect(editSpoolDialog.getByLabel('Purchase price')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(editSpoolDialog).toBeHidden();
  await page.mouse.move(640, 400);
  await capture(page, 'spool-detail.jpg');
  await page.getByRole('link', { name: 'QR label', exact: true }).click();
  await expect(page.getByAltText('QR code for spool DOC-PLA-001')).toBeVisible();
  expect(
    await page
      .getByAltText('QR code for spool DOC-PLA-001')
      .evaluate((image) => (image as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  await capture(page, 'spool-label.jpg');

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();
  await capture(page, 'settings.jpg');
  await page.getByRole('link', { name: 'Features', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Print series' })).toBeVisible();
  await capture(page, 'settings-features.jpg');
  await page.getByRole('link', { name: 'Backup', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create backup' })).toBeVisible();
  await capture(page, 'settings-backup.jpg');
  await page.getByRole('link', { name: 'Features', exact: true }).click();

  await page.getByRole('button', { name: 'Open global search' }).click();
  await page.getByRole('searchbox').fill('Prusa');
  await expect(page.getByText('Workshop Prusa MK4', { exact: true })).toBeVisible();
  await capture(page, 'global-search.jpg');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Open user menu' }).click();
  await expect(page.getByRole('menuitem', { name: 'Appearance', exact: true })).toBeVisible();
  await capture(page, 'user-menu.jpg');
  await page.keyboard.press('Escape');

  await page.goto('/prints?create=true');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('New print', { exact: true })).toBeVisible();
  await dialog.getByLabel('Name', { exact: true }).fill('Architectural Lamp Preview');
  await dialog.getByLabel('Quantity', { exact: true }).fill('3');
  await dialog.getByLabel('Sales value', { exact: true }).fill('12');
  await selectOption(page, 'Customers', 'Studio North');
  await selectOption(page, 'Printers', 'Workshop Prusa MK4');
  await selectOption(page, 'Build plate', 'Textured PEI plate');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await selectOption(page, 'Hotend', '0.4 mm high-flow hotend');
  await dialog.getByLabel('Hours', { exact: true }).fill('6');
  await dialog.getByLabel('Minutes', { exact: true }).fill('30');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: 'Other compatible components', exact: true }).click();
  await page.getByRole('option', { name: 'Heated enclosure', exact: true }).click();
  await page.keyboard.press('Escape');
  await selectOption(page, 'Filaments', 'Polymaker PLA - Teal');
  await dialog.getByLabel('Used weight (g)', { exact: true }).fill('185');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('Total cost', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Cost per unit', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Planned margin', { exact: true })).toBeVisible();
  await capture(page, 'new-print-review.jpg');
  for (let step = 0; step < 3; step++)
    await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add print part' }).click();
  const secondPart = dialog.getByRole('group', { name: 'Part 2', exact: true });
  await secondPart.getByLabel('Printers', { exact: true }).click();
  await page.getByRole('option', { name: 'Workshop Prusa MK4', exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await secondPart.getByLabel('Build plate', { exact: true }).click();
  await page.getByRole('option', { name: 'Textured PEI plate', exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await capture(page, 'new-print-parts.jpg');
  await page.keyboard.press('Escape');

  await page.goto(`/prints/${draft.id}`);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Prototype Housing');
  await page.getByLabel('Quantity', { exact: true }).fill('4');
  const savedQuantity = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/prints/${draft.id}`) && response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  expect((await savedQuantity).ok()).toBe(true);
  await page.reload();
  await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('4');
  await page.getByRole('heading', { name: 'Hotends and durations' }).scrollIntoViewIfNeeded();
  await capture(page, 'print-draft.jpg');

  await page.goto('/series');
  await expect(page.locator('[data-table-toolbar]')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Production progress' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Studio collection', exact: true })).toBeVisible();
  await page.locator('[data-table-toolbar]').getByRole('button', { name: 'New' }).click();
  const newSeriesDialog = page.getByRole('dialog', { name: 'New series' });
  await expect(newSeriesDialog.getByLabel('Name')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(newSeriesDialog).toBeHidden();
  await page.mouse.move(640, 400);
  const seriesRow = page
    .getByRole('row')
    .filter({ has: page.getByRole('link', { name: 'Studio collection', exact: true }) });
  await expect(seriesRow.getByRole('button', { name: 'New print' })).toBeVisible();
  await capture(page, 'series.jpg');
  await page.goto(`/series/${series.id}`);
  await expect(page.getByRole('heading', { name: 'Studio collection', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Series details' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Print history' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).click();
  const editSeriesDialog = page.getByRole('dialog', { name: 'Edit series' });
  await expect(editSeriesDialog.getByLabel('Name')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(editSeriesDialog).toBeHidden();
  await page.mouse.move(640, 400);
  await capture(page, 'series-detail.jpg');
  await page.goto(`/customers/${customer.id}`);
  await expect(page.getByRole('heading', { name: 'Studio North', exact: true })).toBeVisible();
  const customerToolbar = page.locator('[data-table-toolbar]');
  const customerBreadcrumbItems = customerToolbar
    .getByRole('navigation', { name: 'breadcrumb' })
    .locator('[data-slot="item"]');
  await expect(customerBreadcrumbItems).toHaveCount(3);
  await expect(customerBreadcrumbItems.locator('[data-slot="linkLeadingIcon"]')).toHaveCount(3);
  await expect(customerToolbar.getByRole('textbox')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Printer' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Duration' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Payment' })).toBeVisible();
  await customerToolbar.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit · Customers' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/customers/${customer.id}$`));
  await page.keyboard.press('Escape');
  await capture(page, 'customer-history.jpg');
  await page.goto(`/prints/${completed.id}`);
  const immutableMessage = page.getByText(
    'The print details are immutable after leaving draft. You can duplicate the print using current inventory.',
  );
  await expect(immutableMessage).toBeVisible();
  await immutableMessage.scrollIntoViewIfNeeded();
  await capture(page, 'completed-print.jpg');
  await page.getByRole('heading', { name: 'Stored calculation sources' }).scrollIntoViewIfNeeded();
  await capture(page, 'completed-print-sources.jpg');
  await page.goto(`/reports/prints/${completed.id}`);
  await expect(page.getByRole('heading', { name: 'Architectural Lamp', exact: true })).toBeVisible();
  await capture(page, 'cost-report.jpg');
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    path: 'test-results/screenshots/cost-report.pdf',
  });
  const document = await getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise;
  let reportText = '';
  for (let index = 1; index <= document.numPages; index++) {
    const content = await (await document.getPage(index)).getTextContent();
    reportText += content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
  }
  reportText = reportText.replace(/\s+/g, ' ');
  expect(document.numPages).toBeLessThanOrEqual(3);
  expect(reportText).toContain('Architectural Lamp');
  expect(reportText).toContain('Not an invoice');
  expect(reportText).toContain('DOC-PLA-001');
  expect(reportText).toContain('Sales and margin');
  expect(reportText).toContain('€7.10');
  expect(reportText).toContain('€12.00');
  expect(reportText).not.toContain('outcome.PENDING');
  await api(page, '/api/auth/preferences', 'PATCH', { locale: 'de-DE' });
  await page.reload();
  await expect(page.getByText('Kostenbericht', { exact: false }).first()).toBeVisible();
  const germanPdf = await page.pdf({ format: 'A4', printBackground: true });
  const germanDocument = await getDocument({ data: new Uint8Array(germanPdf), useSystemFonts: true }).promise;
  let germanText = '';
  for (let index = 1; index <= germanDocument.numPages; index++) {
    const content = await (await germanDocument.getPage(index)).getTextContent();
    germanText += content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
  }
  germanText = germanText.replace(/\s+/g, ' ');
  expect(germanText).toContain('Keine Rechnung');
  expect(germanText).toContain('7,10');
  await germanDocument.destroy();
  await api(page, '/api/auth/preferences', 'PATCH', { locale: 'en-US' });
  await document.destroy();
  await page.goto(`/prints/${completed.id}`);
  await selectOption(page, 'Print outcome', 'Failed');
  await page.getByLabel('Failure reason', { exact: true }).fill('Synthetic adhesion failure');
  await page.getByLabel('Actual duration (seconds)', { exact: true }).fill('1200');
  const outcomeSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/prints/${completed.id}/outcome`) &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Record outcome', exact: true }).click();
  expect((await outcomeSaved).ok()).toBe(true);
  await expect(page.getByRole('button', { name: 'Retry print', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Synthetic adhesion failure')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Retry print', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Architectural Lamp (copy)');
  await expect(page.getByRole('link', { name: 'Retry of: Architectural Lamp', exact: true })).toBeVisible();
  await expect(page.getByLabel('Quantity', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('Sales value', { exact: true })).toHaveValue('');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/settings/spoolman#integration-spoolman-tools');
  await page.getByRole('heading', { name: 'Spoolman inventory', exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Load import preview', exact: true }).click();
  await expect(page.getByText('Synthetic remote PLA', { exact: false })).toBeVisible();
  await capture(page, 'spoolman-import.jpg');
  await page.getByRole('button', { name: 'Confirm import / link', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'SM-101', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Book movement', exact: true })).toHaveCount(0);
  await capture(page, 'spoolman-detail.jpg');
  const integrated = await api<Resource>(page, '/api/prints', 'POST', {
    ...printInput,
    name: 'Integrated test run',
  });
  await api(page, `/api/prints/${integrated.id}/complete`, 'POST');
  await api(page, '/api/integrations/bambubuddy', 'POST', {
    action: 'LINK_PRINTER',
    printerId: printer.id,
    remoteId: 7,
  });
  fake.state.logs[0]!.status = 'completed';
  fake.state.logs[0]!.completed_at = '2026-09-11T01:00:00Z';
  await page.goto(
    `/settings/bambuddy?printId=${integrated.id}&printerId=${printer.id}#integration-bambubuddy-tools`,
  );
  await page
    .getByRole('heading', { name: 'Bambuddy printers and results', exact: true })
    .scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Choose print log', exact: true }).click();
  await page.getByRole('button', { name: 'Attach this record', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Confirm actual values and import outcome', exact: true }),
  ).toBeVisible();
  await capture(page, 'bambubuddy-preview.jpg');
  await page.getByRole('button', { name: 'Confirm actual values and import outcome', exact: true }).click();
  await expect(page.getByText('Applied', { exact: true })).toBeVisible();
  fake.state.logs.push({
    ...fake.state.logs[0]!,
    id: 777,
    print_name: 'Failed enclosure plate',
    status: 'failed',
    duration_seconds: 120,
    filament_used_grams: 3,
    failure_reason: 'Synthetic adhesion failure',
  });
  const multipartIntegration = await api<{ id: string; parts: Array<{ id: string }> }>(
    page,
    '/api/prints',
    'POST',
    {
      name: 'Two-part enclosure',
      quantity: 2,
      parts: [printInput, printInput],
    },
  );
  await api(page, `/api/prints/${multipartIntegration.id}/complete`, 'POST');
  await api(page, '/api/integrations/bambubuddy', 'POST', {
    action: 'ATTACH',
    printId: multipartIntegration.id,
    partId: multipartIntegration.parts[1]!.id,
    remoteLogId: 777,
  });
  await page.goto(
    `/settings/bambuddy?printId=${multipartIntegration.id}&printerId=${printer.id}#integration-bambubuddy-tools`,
  );
  const manualPart = page.getByRole('group', { name: 'Part 1', exact: true });
  const linkedPart = page.getByRole('group', { name: 'Part 2', exact: true });
  await expect(linkedPart.getByText('Failed enclosure plate', { exact: false })).toBeVisible();
  await manualPart.getByLabel('Actual duration (seconds)', { exact: true }).fill('');
  await expect(
    page.getByRole('button', { name: 'Confirm actual values and import outcome', exact: true }),
  ).toBeDisabled();
  await manualPart.getByLabel('Actual duration (seconds)', { exact: true }).fill('30');
  await manualPart.getByLabel('Polymaker PLA - Teal · Actual weight (g)', { exact: true }).fill('4');
  await expect(linkedPart.getByLabel('Actual duration (seconds)', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Print outcome', { exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 1280, height: 1000 });
  await manualPart.evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await capture(page, 'bambubuddy-parts.jpg');
  const importedParts = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/integrations/bambubuddy') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Confirm actual values and import outcome', exact: true }).click();
  expect((await importedParts).ok()).toBe(true);
  await expect(page.getByText('Applied', { exact: true })).toBeVisible();
  const mixedResult = await (await page.request.get(`/api/prints/${multipartIntegration.id}`)).json();
  expect(mixedResult.outcome.status).toBe('FAILED');
  expect(mixedResult.outcome.durationSeconds).toBe(150);
  expect(mixedResult.outcome.parts).toHaveLength(2);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const integrationA11y = await new AxeBuilder({ page }).analyze();
  expect(
    integrationA11y.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
  ).toEqual([]);
});
