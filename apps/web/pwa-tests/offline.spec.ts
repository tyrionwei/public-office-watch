import { expect, test } from '@playwright/test';

test('production build is installable and shows a branded offline fallback', async ({ context, page }) => {
  await page.goto('/');

  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifest).toBe('/site.webmanifest');
  const manifestResponse = await page.request.get(manifest!);
  expect(manifestResponse.ok()).toBe(true);
  const manifestBody = await manifestResponse.json();
  expect(manifestBody).toMatchObject({
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
  });
  expect(manifestBody.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: '192x192' }),
    expect.objectContaining({ sizes: '512x512' }),
  ]));

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: '目前離線' })).toBeVisible();
  await expect.poll(() => page.locator('main img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('link', { name: '重新連線' })).toHaveAttribute('href', '/');
  await context.setOffline(false);
  await page.getByRole('link', { name: '重新連線' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('#root')).not.toBeEmpty();
});
