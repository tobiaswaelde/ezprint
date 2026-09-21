import { expect, test } from '@playwright/test';

test('print and customer tables advance workflow and record payment', async ({ page }) => {
  await page.goto('/');
  const setupHeading = page.getByRole('heading', { name: 'Ersteinrichtung' });
  const loginHeading = page.getByRole('heading', { name: 'Anmelden' });
  await expect(setupHeading.or(loginHeading)).toBeVisible();
  if (await setupHeading.isVisible()) {
    await page.getByLabel('Anzeigename').fill('Browser Test');
    await page.getByLabel('E-Mail').fill('browser@example.test');
    await page.getByLabel('Passwort').fill('browser-test-password-123');
    await page.getByLabel('Strompreis pro kWh').fill('0.32');
    await page.getByRole('button', { name: 'Ersteinrichtung' }).click();
  } else {
    await page.getByLabel('E-Mail').fill('browser@example.test');
    await page.getByLabel('Passwort').fill('browser-test-password-123');
    await page.getByRole('button', { name: 'Anmelden' }).click();
  }
  await expect(
    page.getByRole('button', { name: /^(Globale Suche öffnen|Open global search)$/ }),
  ).toBeVisible();
  const preferences = await page.request.patch('/api/auth/preferences', {
    headers: { origin: new URL(page.url()).origin },
    data: { locale: 'en-US' },
  });
  expect(preferences.ok()).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  async function createRecord(resource: string, data: object) {
    const response = await page.request.post(`/api/${resource}`, {
      headers: { origin: new URL(page.url()).origin },
      data,
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  const customer = await createRecord('customers', { name: 'Workflow customer' });
  const manufacturer = await createRecord('manufacturers', { name: 'Workflow maker' });
  const printer = await createRecord('printers', {
    name: 'Workflow printer',
    manufacturerId: manufacturer.id,
    purchasePrice: '100',
    expectedLifetimeHours: '1000',
    averagePowerWatts: 100,
  });
  const buildPlate = await createRecord('components', {
    name: 'Workflow plate',
    type: 'BUILD_PLATE',
    purchasePrice: '10',
    expectedLifetimeHours: '1000',
    printerIds: [printer.id],
  });
  const hotend = await createRecord('components', {
    name: 'Workflow hotend',
    type: 'HOTEND',
    purchasePrice: '10',
    expectedLifetimeHours: '1000',
    printerIds: [printer.id],
  });
  const filament = await createRecord('filaments', {
    manufacturerId: manufacturer.id,
    material: 'PLA',
    colorName: 'Blue',
    colorHex: '#0000FF',
    purchasePrice: '20',
    netWeightGrams: '1000',
  });
  const spool = await createRecord('spools', {
    filamentId: filament.id,
    code: 'WORKFLOW-1',
    purchasePrice: '20',
    initialNetWeightGrams: '1000',
  });
  const draft = await createRecord('prints', {
    name: 'Workflow print',
    customerId: customer.id,
    printerId: printer.id,
    buildPlateId: buildPlate.id,
    hotends: [{ componentId: hotend.id, durationSeconds: 3600 }],
    filaments: [{ filamentId: filament.id, spoolId: spool.id, usedGrams: '10' }],
  });
  await page.goto('/prints');
  const workflowRow = page.locator('tr').filter({ has: page.locator(`a[href="/prints/${draft.id}"]`) });
  await workflowRow.getByRole('button', { name: 'Advance to Printing' }).click();
  await expect(page.getByText('Leaving draft finalizes', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(workflowRow.getByRole('button', { name: 'Advance to Printed' })).toBeVisible();
  await workflowRow.getByRole('button', { name: 'Mark as paid' }).click();
  await expect(workflowRow.getByRole('button', { name: 'Mark as paid' })).toHaveCount(0);
  await expect(workflowRow.getByText('Paid', { exact: true })).toBeVisible();
  await page.goto(`/customers/${draft.customerId}`);
  await expect(workflowRow.getByRole('button', { name: 'Advance to Printed' })).toBeVisible();
  await workflowRow.getByRole('button', { name: 'Advance to Printed' }).click();
  await expect(workflowRow.getByRole('button', { name: 'Advance to Shipped' })).toBeVisible();
  const updatedPrint = await (await page.request.get(`/api/prints/${draft.id}`)).json();
  expect(updatedPrint.status).toBe('PRINTED');
  expect(updatedPrint.paidAt).toBeTruthy();
  expect(updatedPrint.outcome).toBeNull();
});
