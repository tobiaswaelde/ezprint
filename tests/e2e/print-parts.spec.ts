import { expect, test, type Locator } from '@playwright/test';

test('creates and edits a print with separate build plates and material for each part', async ({ page }) => {
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

  const manufacturer = await createRecord('manufacturers', { name: 'Multipart maker' });
  const printer = await createRecord('printers', {
    name: 'Multipart printer',
    manufacturerId: manufacturer.id,
    purchasePrice: '100',
    expectedLifetimeHours: '1000',
    averagePowerWatts: 100,
  });
  await createRecord('components', {
    name: 'Multipart plate',
    type: 'BUILD_PLATE',
    purchasePrice: '10',
    expectedLifetimeHours: '1000',
    printerIds: [printer.id],
  });
  await createRecord('components', {
    name: 'Multipart hotend',
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
  await createRecord('spools', {
    filamentId: filament.id,
    code: 'MULTIPART-1',
    purchasePrice: '20',
    initialNetWeightGrams: '1000',
  });
  await createRecord('components', {
    name: 'Multipart smooth plate',
    type: 'BUILD_PLATE',
    purchasePrice: '15',
    expectedLifetimeHours: '1000',
    printerIds: [printer.id],
  });
  await page.goto('/prints?create=true');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill('Multipart complete product');
  await dialog.getByLabel('Quantity', { exact: true }).fill('3');
  async function select(group: Locator, label: string, option: string | RegExp) {
    await group.getByLabel(label, { exact: true }).click();
    await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click();
    await expect(page.getByRole('listbox')).toBeHidden();
  }
  await expect(dialog.getByRole('button', { name: 'Remove part 1' })).toBeDisabled();
  await select(dialog.getByRole('group', { name: 'Part 1', exact: true }), 'Printers', 'Multipart printer');
  await select(dialog.getByRole('group', { name: 'Part 1', exact: true }), 'Build plate', 'Multipart plate');
  await dialog.getByRole('button', { name: 'Add print part' }).click();
  const nextBounds = await dialog.getByRole('button', { name: 'Next', exact: true }).boundingBox();
  expect(nextBounds!.y + nextBounds!.height).toBeLessThanOrEqual(720);
  await select(dialog.getByRole('group', { name: 'Part 2', exact: true }), 'Printers', 'Multipart printer');
  await select(
    dialog.getByRole('group', { name: 'Part 2', exact: true }),
    'Build plate',
    'Multipart smooth plate',
  );
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  for (const number of [1, 2]) {
    const group = dialog.getByRole('group', { name: `Part ${number}`, exact: true });
    await select(group, 'Hotend', 'Multipart hotend');
    await group.getByLabel('Hours', { exact: true }).fill(String(number));
  }
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  for (const number of [1, 2]) {
    const group = dialog.getByRole('group', { name: `Part ${number}`, exact: true });
    await select(group, 'Filaments', 'Multipart maker PLA - Blue');
    await select(group, 'Spools', /^MULTIPART-1/);
    await group.getByLabel('Used weight (g)', { exact: true }).fill(String(number * 10));
  }
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(dialog.getByText('Total cost', { exact: true })).toBeVisible();
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/api/prints') && response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Save draft', exact: true }).click();
  const response = await saved;
  expect(response.ok()).toBe(true);
  const draft = await response.json();
  expect(draft.parts).toHaveLength(2);
  expect(draft.quantity).toBe(3);
  expect(draft.totalDurationSeconds).toBe(10800);
  expect(
    draft.parts[0].componentUsages.find((line: { type: string }) => line.type === 'BUILD_PLATE').name,
  ).toBe('Multipart plate');
  expect(
    draft.parts[1].componentUsages.find((line: { type: string }) => line.type === 'BUILD_PLATE').name,
  ).toBe('Multipart smooth plate');
  await page.goto(`/prints/${draft.id}`);
  await expect(
    page.getByRole('group', { name: 'Part 2', exact: true }).getByLabel('Build plate', { exact: true }),
  ).toContainText('Multipart smooth plate');
  await page.getByRole('button', { name: 'Remove part 1' }).click();
  const updated = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/prints/${draft.id}`) && response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  const remaining = await (await updated).json();
  expect(remaining.parts).toHaveLength(1);
  expect(remaining.parts[0].id).toBe(draft.parts[1].id);
  expect(
    remaining.parts[0].componentUsages.find((line: { type: string }) => line.type === 'BUILD_PLATE').name,
  ).toBe('Multipart smooth plate');
});
