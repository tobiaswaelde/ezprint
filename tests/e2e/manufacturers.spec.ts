import { expect, test } from '@playwright/test';

test('manufacturer inventory supplies printer, component, and filament dropdowns', async ({ page }) => {
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

  const manufacturersLink = page.getByRole('link', { name: /^(Hersteller|Manufacturers)$/ });
  await expect(manufacturersLink).toBeVisible();
  const german = await page.getByRole('link', { name: 'Hersteller' }).isVisible();
  const labels = german
    ? {
        components: 'Komponenten',
        filaments: 'Filamente',
        printers: 'Drucker',
        manufacturer: 'Hersteller',
        manufacturerRequired: 'Ein Hersteller ist erforderlich.',
        colorName: 'Farbname',
        colorHex: 'Farbe (HEX-Code)',
        edit: 'Bearbeiten',
        save: 'Speichern',
        cancel: 'Abbrechen',
      }
    : {
        components: 'Components',
        filaments: 'Filaments',
        printers: 'Printers',
        manufacturer: 'Manufacturer',
        manufacturerRequired: 'A manufacturer is required.',
        colorName: 'Color name',
        colorHex: 'Color (hex code)',
        edit: 'Edit',
        save: 'Save',
        cancel: 'Cancel',
      };
  const toolbar = page.locator('[data-table-toolbar]');
  await manufacturersLink.click();
  await toolbar.getByRole('button', { name: 'New' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Dropdown Maker');
  await dialog.getByRole('button', { name: labels.save }).click();
  await expect(page.getByRole('cell', { name: 'Dropdown Maker' })).toBeVisible();
  const additionalManufacturers = await Promise.all(
    Array.from({ length: 100 }, (_, index) =>
      page.request.post('/api/manufacturers', {
        headers: { origin: new URL(page.url()).origin },
        data: { name: `Manufacturer ${String(index).padStart(3, '0')}`, note: '' },
      }),
    ),
  );
  expect(additionalManufacturers.every((response) => response.ok())).toBe(true);

  await page.getByRole('link', { name: labels.printers }).click();
  await expect(page).toHaveURL(/\/printers$/);
  await toolbar.getByRole('button', { name: 'New' }).click();
  await dialog.getByRole('button', { name: labels.save }).click();
  await expect(dialog.getByText(labels.manufacturerRequired)).toBeVisible();
  await dialog.getByLabel(labels.manufacturer, { exact: true }).click();
  await page.getByRole('combobox').fill('Manufacturer 099');
  await expect(page.getByRole('option', { name: 'Manufacturer 099' })).toBeVisible();
  await page.getByRole('option', { name: 'Manufacturer 099' }).click();
  await expect(page.getByRole('listbox')).toBeHidden();
  await dialog.getByLabel('Name').fill('Dropdown Printer');
  await expect(dialog.getByLabel('Name')).toHaveValue('Dropdown Printer');
  await dialog.getByRole('button', { name: labels.save }).click();
  await expect(page.getByRole('cell', { name: 'Dropdown Printer' })).toBeVisible();
  const printerRow = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'Dropdown Printer' }) });
  await printerRow.getByRole('button', { name: labels.edit }).click();
  await expect(dialog.getByLabel(labels.manufacturer, { exact: true })).toContainText('Manufacturer 099');
  await dialog.getByRole('button', { name: labels.cancel }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('link', { name: labels.components }).click();
  await expect(page).toHaveURL(/\/components$/);
  await toolbar.getByRole('button', { name: 'New' }).click();
  await dialog.getByLabel(labels.manufacturer, { exact: true }).click();
  await expect(page.getByRole('option', { name: 'Dropdown Maker' })).toBeVisible();
  await page.getByRole('option', { name: 'Dropdown Maker' }).click();
  await dialog.getByRole('button', { name: labels.cancel }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('link', { name: labels.filaments }).click();
  await expect(page).toHaveURL(/\/filaments$/);
  await toolbar.getByRole('button', { name: 'New' }).click();
  await expect(dialog.getByLabel(/^Name/)).toHaveCount(0);
  const derivedName = dialog.getByText(/^Name:/);
  await expect(derivedName).toHaveText('Name: —');
  await dialog.getByLabel(labels.manufacturer, { exact: true }).click();
  await page.getByRole('option', { name: 'Dropdown Maker' }).click();
  await expect(page.getByRole('option', { name: 'Dropdown Maker' })).toBeHidden();
  await expect(derivedName).toHaveText('Name: Dropdown Maker');
  const material = dialog.getByLabel('Material');
  await material.fill('PLA');
  await expect(material).toHaveValue('PLA');
  await expect(derivedName).toHaveText('Name: Dropdown Maker PLA');
  await dialog.getByLabel(labels.colorName).fill('Ocean Blue');
  await expect(derivedName).toHaveText('Name: Dropdown Maker PLA - Ocean Blue');
  await dialog.getByLabel(labels.colorHex).fill('#112233');
  await dialog.getByRole('button', { name: labels.save }).click();
  await expect(page.getByRole('cell', { name: 'Dropdown Maker PLA - Ocean Blue' })).toBeVisible();
});
