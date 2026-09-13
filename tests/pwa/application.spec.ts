import { expect, test } from '@playwright/test';

test('launches the cached application shell without requesting API data offline', async ({
  context,
  page,
}) => {
  await page.goto('/setup');
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
  });

  await context.setOffline(true);
  await page.goto('/prints');
  await expect(page).toHaveURL(/\/offline\?redirect=(?:%2F|\/)prints$/);
  await expect(page.getByRole('heading', { name: 'Keine Verbindung' })).toBeVisible();
  expect(apiRequests).toEqual([]);

  await context.setOffline(false);
  await expect(page).toHaveURL(/\/setup$/);
});
