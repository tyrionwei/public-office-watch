import { expect, test } from '@playwright/test';

async function getBox(page: import('@playwright/test').Page, selector: string) {
  return page.locator(selector).first().boundingBox();
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test('language toggle switches the public shell copy without resizing controls', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '公職資料觀測站' })).toBeVisible();
  await expect(page.getByPlaceholder('搜尋人物、公司、政黨、選舉、地區')).toBeVisible();

  const languageToggleSelector = '[aria-label="切換語言"], [aria-label="Switch language"]';
  const languageToggle = page.locator(languageToggleSelector).first();
  const beforeToggle = await getBox(page, languageToggleSelector);
  const beforeBgm = await page.getByRole('button', { name: /BGM/ }).boundingBox();
  const languageButtons = languageToggle.locator('button');

  await expect(languageButtons).toHaveCount(2);
  const zhButton = await languageButtons.nth(0).boundingBox();
  const enButton = await languageButtons.nth(1).boundingBox();
  expect(zhButton?.width).toBe(enButton?.width);

  await page.getByRole('button', { name: 'EN' }).click();

  await expect(page.getByRole('heading', { name: 'Public Office Watch' })).toBeVisible();
  await expect(page.getByPlaceholder('Search people, companies, parties, elections, regions')).toBeVisible();

  const afterToggle = await getBox(page, languageToggleSelector);
  const afterBgm = await page.getByRole('button', { name: /BGM/ }).boundingBox();

  expect(afterToggle?.width).toBe(beforeToggle?.width);
  expect(afterToggle?.height).toBe(beforeToggle?.height);
  expect(afterBgm?.width).toBe(beforeBgm?.width);
  expect(afterBgm?.height).toBe(beforeBgm?.height);

  await expectNoHorizontalOverflow(page);
});

test('desktop public pages do not introduce horizontal overflow in English', async ({ page }) => {
  for (const path of ['/', '/people']) {
    await page.goto(path);
    await page.getByRole('button', { name: 'EN' }).click();
    await expectNoHorizontalOverflow(page);
  }
});
