import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('setup, navigation, persistence, accessibility, and responsive shell', async ({ page }) => {
  test.setTimeout(90_000);
  const iconCdnRequests: string[] = [];
  await page.route(
    /https:\/\/(?:api\.iconify\.design|api\.simplesvg\.com|api\.unisvg\.com|cdn\.jsdelivr\.net)\/.*/,
    async (route) => {
      iconCdnRequests.push(route.request().url());
      await route.abort();
    },
  );
  await page.route('**/api/version-latest', (route) => route.fulfill({ json: { latest: '999.0.0' } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ersteinrichtung' })).toBeVisible();
  await page.getByLabel('Anzeigename').fill('Browser Test');
  await page.getByLabel('E-Mail').fill('browser@example.test');
  await page.getByLabel('Passwort').fill('browser-test-password-123');
  const setupPrintSeries = page.getByRole('switch', { name: 'Druckserien' });
  const setupSpoolManagement = page.getByRole('switch', { name: 'Spulenverwaltung' });
  const setupDemoData = page.getByRole('switch', { name: 'Mit Demodaten starten' });
  await expect(setupPrintSeries).toBeChecked();
  await expect(setupSpoolManagement).toBeChecked();
  await expect(setupDemoData).not.toBeChecked();
  await expect(page.getByLabel('Server-URL')).toHaveCount(0);
  await setupPrintSeries.click();
  await expect(setupPrintSeries).not.toBeChecked();
  await setupPrintSeries.click();
  const electricityPrice = page.getByLabel('Strompreis pro kWh');
  await expect(electricityPrice).toHaveAttribute('type', 'number');
  await expect(electricityPrice.locator('..')).toContainText('EUR/kWh');
  await electricityPrice.fill('0.32');
  await page.getByRole('button', { name: 'Ersteinrichtung' }).click();
  await expect(page.getByRole('heading', { name: 'Druckkosten im Zeitverlauf' })).toBeVisible();
  await expect(page).toHaveTitle('ezPrint');
  const brandLink = page.getByRole('link', { name: 'ezPrint' });
  await expect(brandLink).toHaveText('ezPrint');
  await expect(
    page.getByRole('link', { name: 'Druckserien', exact: true }).locator('[data-slot="linkLeadingIcon"]'),
  ).toHaveClass(/i-tabler:list-check/);
  await expect(page.getByRole('link', { name: 'Bambuddy-Anbindung', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toHaveCount(0);
  const inventoryLinkBoxes = await Promise.all(
    ['Hersteller', 'Drucker', 'Komponenten', 'Filamente', 'Spulen'].map(async (name) =>
      page.getByRole('link', { name, exact: true }).boundingBox(),
    ),
  );
  expect(inventoryLinkBoxes.every(Boolean)).toBe(true);
  expect(inventoryLinkBoxes.map((box) => box!.y)).toEqual(
    inventoryLinkBoxes.map((box) => box!.y).toSorted((left, right) => left - right),
  );
  await page.keyboard.press('Shift+/');
  const shortcutsDialog = page.getByRole('dialog', { name: 'Tastenkürzel' });
  await expect(shortcutsDialog).toContainText('Neuen Eintrag erstellen');
  await expect(shortcutsDialog.getByRole('cell', { name: '⇧ + N' })).toBeVisible();
  await page.keyboard.press('Escape');
  const collapseButton = page.getByRole('button', { name: 'Navigation einklappen' });
  const globalSearchButton = page.getByRole('button', { name: 'Globale Suche öffnen' });
  await expect(collapseButton).toHaveCount(1);
  const lucideIcon = collapseButton.locator('.iconify[class*="i-lucide:"]');
  await expect(lucideIcon).toBeVisible();
  expect(await lucideIcon.evaluate((element) => getComputedStyle(element).maskImage)).toContain(
    'data:image/svg+xml',
  );
  const [collapseBox, searchBox] = await Promise.all([
    collapseButton.boundingBox(),
    globalSearchButton.boundingBox(),
  ]);
  expect(collapseBox!.x).toBeLessThan(searchBox!.x);
  expect(searchBox!.width).toBeGreaterThan(256);
  await collapseButton.click();
  await expect(brandLink).toHaveText('ez');
  await page.getByRole('button', { name: 'Navigation ausklappen' }).click();
  await expect(brandLink).toHaveText('ezPrint');
  const footer = page.locator('[data-sidebar-footer]');
  const footerItems = page.locator('[data-sidebar-footer-item]');
  await expect(footerItems).toHaveCount(3);
  await expect(footerItems.nth(0)).toContainText('GitHub');
  await expect(footerItems.nth(1)).toContainText('Dokumentation');
  const simpleIcon = footerItems.nth(0).locator('.iconify[class*="i-simple-icons:"]');
  await expect(simpleIcon).toBeVisible();
  expect(await simpleIcon.evaluate((element) => getComputedStyle(element).maskImage)).toContain(
    'data:image/svg+xml',
  );
  const footerBox = (await footer.boundingBox())!;
  const footerBoxes = await footerItems.evaluateAll((items) =>
    items.map((item) => {
      const { top, right, bottom, left, width } = item.getBoundingClientRect();
      return { top, right, bottom, left, width };
    }),
  );
  expect(footerBoxes[0]!.bottom).toBeLessThanOrEqual(footerBoxes[1]!.top);
  expect(footerBoxes[1]!.bottom).toBeLessThanOrEqual(footerBoxes[2]!.top);
  expect(footerBoxes[0]!.width).toBeGreaterThanOrEqual(footerBox.width - 1);
  expect(footerBoxes[1]!.width).toBeGreaterThanOrEqual(footerBox.width - 1);
  expect((footerBoxes[2]!.left + footerBoxes[2]!.right) / 2).toBeCloseTo(
    footerBox.x + footerBox.width / 2,
    0,
  );
  const changelogButton = page.getByRole('button', { name: 'Changelog öffnen' });
  const updateBadge = changelogButton.getByText('Update verfügbar', { exact: true });
  await expect(updateBadge).toBeVisible();
  await expect(updateBadge.locator('[data-update-indicator]')).toHaveClass(/bg-success/);
  await changelogButton.click();
  await expect(page.getByRole('dialog', { name: 'Changelog' })).toContainText('v0.2.0');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('link', { name: 'Dokumentation öffnen' })).toHaveAttribute(
    'href',
    'https://tobiaswaelde.github.io/ezprint/',
  );
  const tablerIcon = page.locator('.iconify[class*="i-tabler:"]').first();
  await expect(tablerIcon).toBeVisible();
  expect(await tablerIcon.evaluate((element) => getComputedStyle(element).maskImage)).toContain(
    'data:image/svg+xml',
  );
  const filamentIcon = page.getByRole('link', { name: 'Filamente' }).locator('.iconify');
  await expect(filamentIcon).toBeVisible();
  expect(await filamentIcon.evaluate((element) => getComputedStyle(element).maskImage)).toContain(
    'data:image/svg+xml',
  );

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')),
  ).toEqual([]);

  await page.goto('/prints');
  const printsToolbar = page.locator('[data-table-toolbar]');
  await expect(printsToolbar.getByText('Drucke', { exact: true })).toBeVisible();
  const breadcrumbItems = printsToolbar
    .getByRole('navigation', { name: 'breadcrumb' })
    .locator('[data-slot="item"]');
  await expect(breadcrumbItems).toHaveCount(2);
  await expect(breadcrumbItems.locator('[data-slot="linkLeadingIcon"]')).toHaveCount(2);
  await expect(printsToolbar.getByRole('textbox')).toBeVisible();
  const filterButton = printsToolbar.getByRole('button', { name: 'Filter' });
  const querryKitIcon = filterButton.locator('.iconify.i-tabler\\:filter');
  await expect(querryKitIcon).toBeVisible();
  expect(await querryKitIcon.evaluate((element) => getComputedStyle(element).maskImage)).toContain(
    'data:image/svg+xml',
  );
  await filterButton.click();
  await expect(page.getByText('Archiviert', { exact: true })).toBeVisible();
  const filterMode = page.getByRole('button', { name: 'UND/ODER wechseln' });
  await expect(filterMode).toBeVisible();
  await filterMode.click();
  await filterMode.click();
  await page.getByRole('dialog').getByRole('combobox').click();
  for (const option of ['Status', 'Druckergebnis', 'Drucker', 'Kunden', 'Ab Datum', 'Bis Datum']) {
    await expect(page.getByRole('option', { name: option, exact: true })).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(printsToolbar.getByRole('button', { name: 'New' })).toBeVisible();
  await page.keyboard.press('Shift+n');
  const createPrintDialog = page.getByRole('dialog', { name: 'Neuer Druck' });
  await expect(createPrintDialog).toBeVisible();
  await expect(createPrintDialog.getByText('Allgemein')).toBeVisible();
  const createPrintFooter = createPrintDialog.locator('[data-slot="footer"]');
  await expect(createPrintFooter).toBeVisible();
  await expect(createPrintFooter.getByRole('button', { name: 'Abbrechen' })).toBeVisible();
  await expect(createPrintFooter.getByRole('button', { name: 'Weiter' })).toBeVisible();
  await createPrintDialog.getByRole('button', { name: 'Weiter' }).click();
  await expect(createPrintDialog.getByLabel('Name')).toBeVisible();
  await createPrintDialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(createPrintDialog).toBeHidden();

  await page.getByRole('link', { name: 'Kunden' }).click();
  const tableToolbar = page.locator('[data-table-toolbar]');
  const tableRegion = page.locator('[data-table-region]');
  await expect(tableToolbar).toBeVisible();
  await expect(tableToolbar.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await expect(tableToolbar.getByText('Kunden')).toBeVisible();
  await expect(tableToolbar.getByRole('searchbox')).toBeVisible();
  await expect(tableRegion).toBeVisible();
  await expect(tableToolbar.getByRole('button', { name: 'New' })).toBeVisible();
  await page.keyboard.press('Shift+n');
  const resourceDialog = page.getByRole('dialog');
  await expect(resourceDialog).toBeVisible();
  await expect(resourceDialog.getByLabel('Name')).toBeFocused();
  await resourceDialog.getByLabel('Name').fill('Acme');
  await resourceDialog.getByLabel('E-Mail').fill('hello@example.test');
  const excludeFromDashboard = resourceDialog.getByRole('checkbox', {
    name: 'Vom Dashboard ausschließen',
  });
  await expect(excludeFromDashboard).not.toBeChecked();
  await excludeFromDashboard.click();
  await resourceDialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(resourceDialog).toBeHidden();
  await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible();

  const customerRow = page.getByRole('row', { name: /Acme/ });
  await expect(customerRow).toContainText('Vom Dashboard ausgeschlossen');
  await customerRow.getByRole('button', { name: 'Bearbeiten' }).click();
  await expect(resourceDialog).toBeVisible();
  await expect(excludeFromDashboard).toBeChecked();
  await resourceDialog.getByLabel('Name').fill('Discarded name');
  await page.keyboard.press('Escape');
  await expect(resourceDialog).toBeHidden();
  await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible();

  await customerRow.getByRole('button', { name: 'Bearbeiten' }).click();
  await resourceDialog.getByLabel('Name').fill('Acme Updated');
  await resourceDialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(resourceDialog).toBeHidden();
  await expect(page.getByRole('cell', { name: 'Acme Updated' })).toBeVisible();

  await page.getByRole('link', { name: 'Acme Updated', exact: true }).click();
  const customerDetailToolbar = page.locator('[data-table-toolbar]');
  const customerBreadcrumbItems = customerDetailToolbar
    .getByRole('navigation', { name: 'breadcrumb' })
    .locator('[data-slot="item"]');
  await expect(customerBreadcrumbItems).toHaveCount(3);
  await expect(customerBreadcrumbItems.locator('[data-slot="linkLeadingIcon"]')).toHaveCount(3);
  await expect(customerDetailToolbar.getByRole('textbox')).toBeVisible();
  await customerDetailToolbar.getByRole('button', { name: 'Bearbeiten' }).click();
  await expect(page).toHaveURL(/\/customers\/[^/?]+$/);
  await expect(resourceDialog.getByLabel('Name')).toHaveValue('Acme Updated');
  await page.keyboard.press('Escape');
  await customerDetailToolbar.getByRole('button', { name: 'Neuer Druck' }).click();
  const customerSelect = createPrintDialog.getByRole('button', { name: 'Kunden' });
  await expect(customerSelect).toContainText('Acme Updated');
  await customerSelect.click();
  const customerSearch = page.getByPlaceholder('Suchen', { exact: true });
  await expect(customerSearch).toBeFocused();
  await customerSearch.fill('kein Treffer');
  await expect(page.getByRole('option', { name: 'Acme Updated', exact: true })).toBeHidden();
  await customerSearch.fill('Acme Upd');
  await expect(page.getByRole('option', { name: 'Acme Updated', exact: true })).toBeVisible();
  await page.getByRole('option', { name: 'Acme Updated', exact: true }).click();
  await expect(customerSelect).toContainText('Acme Updated');
  await createPrintDialog.getByRole('button', { name: 'Abbrechen' }).click();
  await customerDetailToolbar.getByRole('button', { name: 'Filter' }).click();
  await page.getByRole('dialog').getByRole('combobox').click();
  await expect(page.getByRole('option', { name: 'Kunden', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Kunden', exact: true }).last().click();

  const updatedCustomerRow = page.getByRole('row', { name: /Acme Updated/ });
  const deleteButton = updatedCustomerRow.getByRole('button', { name: 'Löschen' });
  await expect(deleteButton).toHaveText('');
  await deleteButton.click();
  const deleteConfirmation = page.getByText(
    'Dieser Eintrag wird dauerhaft gelöscht, sofern er nicht verwendet wird.',
  );
  await expect(deleteConfirmation).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(deleteConfirmation).toBeHidden();

  await page.getByRole('button', { name: 'Globale Suche öffnen' }).click();
  const globalSearch = page.getByRole('search', { name: 'Globale Suche' });
  await globalSearch.getByRole('searchbox').fill('Acme');
  await expect(globalSearch.getByRole('link', { name: /Acme/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('/');
  await expect(globalSearch.getByRole('searchbox')).toBeFocused();
  await page.keyboard.press('Escape');

  await page.getByRole('link', { name: 'Einstellungen' }).click();
  await expect(page.getByRole('heading', { name: 'Allgemein' })).toBeVisible();
  await page.getByRole('link', { name: 'Berechnung', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Berechnung' })).toBeVisible();
  await expect(page.getByLabel('Währung')).toBeVisible();
  await page.getByRole('link', { name: 'Features', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Druckserien' })).toBeVisible();
  await page.getByRole('link', { name: 'Backup', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Backup erstellen' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Backup herunterladen' }).click();
  await expect((await download).suggestedFilename()).toMatch(/^ezprint-backup-.*\.ezprint-backup$/);
  await page.getByLabel('ezPrint-Backupdatei').setInputFiles({
    name: 'invalid.ezprint-backup',
    mimeType: 'application/vnd.ezprint.backup',
    buffer: Buffer.from('invalid'),
  });
  await page.getByRole('button', { name: 'Backup wiederherstellen', exact: true }).click();
  const restoreDialog = page.getByRole('dialog', { name: 'Wiederherstellung bestätigen' });
  await restoreDialog.getByLabel('Passwort').fill('wrong-password');
  await restoreDialog.getByRole('button', { name: 'Ersetzen und neu starten' }).click();
  await expect(restoreDialog.getByText('E-Mail oder Passwort ist ungültig.')).toBeVisible();
  await restoreDialog.getByRole('button', { name: 'Abbrechen' }).click();
  await page.getByRole('link', { name: 'Features', exact: true }).click();
  await page.getByRole('switch', { name: 'Druckserien' }).click();
  await page.getByRole('switch', { name: 'Spulenverwaltung' }).click();
  const featureAlertIcons = page.locator(
    '[data-slot="root"].ring-inset.ring-accented > [data-slot="icon"].i-tabler\\:info-circle',
  );
  await expect(featureAlertIcons).toHaveCount(2);
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByText('Einstellungen gespeichert.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Druckserien', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Spulen', exact: true })).toHaveCount(0);
  await page.goto('/series');
  await expect(page).toHaveURL(/\/prints$/);
  await page.goto('/spools');
  await expect(page).toHaveURL(/\/filaments$/);
  await page.goto('/settings/features');
  await page.getByRole('switch', { name: 'Druckserien' }).click();
  await page.getByRole('switch', { name: 'Spulenverwaltung' }).click();
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Druckserien', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Spulen', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Spoolman-Anbindung' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bambuddy-Anbindung' })).toBeVisible();
  const spoolmanSettings = page.locator('#integration-spoolman');
  const bambubuddySettings = page.locator('#integration-bambubuddy');
  await expect(spoolmanSettings.getByRole('link', { name: 'Dokumentation öffnen' })).toHaveAttribute(
    'href',
    'https://tobiaswaelde.github.io/ezprint/guide/integrations#spoolman-import-and-ownership',
  );
  await expect(bambubuddySettings.getByRole('link', { name: 'Dokumentation öffnen' })).toHaveAttribute(
    'href',
    'https://tobiaswaelde.github.io/ezprint/guide/integrations#bambuddy-printer-and-print-links',
  );
  await expect(spoolmanSettings.locator('[data-slot="body"]')).toHaveCount(0);
  await expect(bambubuddySettings.locator('[data-slot="body"]')).toHaveCount(0);
  await spoolmanSettings.getByRole('switch', { name: 'Aktiviert' }).click();
  await expect(spoolmanSettings.locator('[data-slot="body"]')).toHaveCount(0);
  await bambubuddySettings.getByRole('switch', { name: 'Aktiviert' }).click();
  await expect(bambubuddySettings.locator('[data-slot="body"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Speichern', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByText('Einstellungen gespeichert.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Spoolman', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bambuddy', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Spoolman', exact: true }).click();
  await expect(page.getByText('Anbindung ist nicht konfiguriert.')).toBeVisible();
  const spoolmanConfiguration = page.locator('#spoolman-configuration');
  await spoolmanConfiguration.getByLabel('Server-URL').fill('http://spoolman:7912');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByText('Einstellungen gespeichert.')).toBeVisible();
  await expect(page.getByText('Anbindung ist nicht konfiguriert.')).toHaveCount(0);
  await page.goto('/settings/integrations#integration-spoolman');
  await expect(page).toHaveURL(/\/settings\/spoolman#spoolman-configuration$/);
  await page.getByRole('link', { name: 'Bambuddy', exact: true }).click();
  await expect(page.getByText('Anbindung ist nicht konfiguriert.')).toBeVisible();
  const bambubuddyConfiguration = page.locator('#bambubuddy-configuration');
  await bambubuddyConfiguration.getByLabel('Server-URL').fill('http://bambubuddy:8000');
  await bambubuddyConfiguration.getByLabel('API-Schlüssel').fill('synthetic-browser-key');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByText('Einstellungen gespeichert.')).toBeVisible();
  await expect(page.getByText('Anbindung ist nicht konfiguriert.')).toHaveCount(0);
  await page.goto('/settings/integrations#integration-bambubuddy');
  await expect(page).toHaveURL(/\/settings\/bambuddy#bambubuddy-configuration$/);

  await page.goto('/settings/bambubuddy#bambubuddy-configuration');
  await expect(page).toHaveURL(/\/settings\/bambuddy#bambubuddy-configuration$/);
  await page.getByRole('link', { name: 'Features', exact: true }).click();
  const spoolManagement = page.getByRole('switch', { name: 'Spulenverwaltung' });
  await expect(spoolManagement).toBeChecked();
  await spoolManagement.click();
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByText('Einstellungen gespeichert.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Spulen' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Spoolman', exact: true })).toHaveCount(0);
  await page.goto('/spools');
  await expect(page).toHaveURL(/\/filaments$/);
  await page.getByRole('link', { name: 'Einstellungen' }).click();
  await page.getByRole('link', { name: 'Features', exact: true }).click();
  await expect(
    page.getByText(
      'Aktiviere die Spulenverwaltung unter Einstellungen → Features, um Spoolman zu konfigurieren.',
    ),
  ).toBeVisible();
  await expect(page.locator('#integration-spoolman')).toBeVisible();
  await expect(
    page.locator('#integration-spoolman').getByRole('switch', { name: 'Aktiviert' }),
  ).toBeDisabled();
  await page.getByRole('switch', { name: 'Spulenverwaltung' }).click();
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Spulen' })).toBeVisible();
  await page.request.patch('/api/settings/integrations', {
    headers: { origin: new URL(page.url()).origin },
    data: {
      spoolman: { enabled: false, url: 'http://spoolman:7912' },
      bambubuddy: { enabled: false, url: 'http://bambubuddy:8000' },
    },
  });
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('link', { name: 'Berechnung', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Features', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Spoolman', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Bambuddy', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Integrationen', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('link', { name: 'Allgemein', exact: true }).click();
  await page.getByRole('combobox', { name: 'Sprache' }).click();
  await page.getByRole('option', { name: 'English' }).click();
  const dateFormat = page.getByRole('combobox', { name: 'Datumsformat' });
  await dateFormat.click();
  await page.getByRole('option', { name: 'YYYY-MM-DD' }).click();
  const timeFormat = page.getByRole('combobox', { name: 'Uhrzeitformat' });
  await timeFormat.click();
  await page.getByRole('option', { name: 'hh:mm A' }).click();
  const durationFormat = page.getByRole('combobox', { name: 'Dauerformat' });
  await durationFormat.click();
  await page.getByRole('option', { name: 'Digital (01:30:00)' }).click();
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByText('Settings saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Date format' })).toContainText('YYYY-MM-DD');
  await expect(page.getByRole('combobox', { name: 'Time format' })).toContainText('hh:mm A');
  await expect(page.getByRole('combobox', { name: 'Duration format' })).toContainText('Clock (01:30:00)');
  await page.getByRole('link', { name: 'Customers' }).click();
  await expect(tableToolbar.getByText('Customers')).toBeVisible();
  await page.reload();
  await expect(tableToolbar.getByText('Customers')).toBeVisible();

  await page.getByRole('button', { name: 'Open user menu' }).click();
  await page.getByRole('menuitem', { name: 'Appearance' }).hover();
  await page.getByRole('menuitem', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(tableToolbar.getByText('Customers')).toBeVisible();
  const geometry = await page.evaluate(() => ({
    viewportWidth: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyOverflow: getComputedStyle(document.body).overflow,
    toolbarBottom: document.querySelector<HTMLElement>('[data-table-toolbar]')?.getBoundingClientRect()
      .bottom,
    tableTop: document.querySelector<HTMLElement>('[data-table-region]')?.getBoundingClientRect().top,
    tableOverflowX: getComputedStyle(document.querySelector<HTMLElement>('[data-table-region]')!).overflowX,
    tableOverflowY: getComputedStyle(document.querySelector<HTMLElement>('[data-table-region]')!).overflowY,
    tableScrollWidth: document.querySelector<HTMLElement>('[data-table-region]')?.scrollWidth,
    tableClientWidth: document.querySelector<HTMLElement>('[data-table-region]')?.clientWidth,
  }));
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.bodyOverflow).toBe('hidden');
  expect(geometry.toolbarBottom).toBeLessThanOrEqual(geometry.tableTop!);
  expect(geometry.tableOverflowX).toBe('auto');
  expect(geometry.tableOverflowY).toBe('auto');
  expect(geometry.tableScrollWidth!).toBeGreaterThan(geometry.tableClientWidth!);
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  expect(iconCdnRequests).toEqual([]);
});
