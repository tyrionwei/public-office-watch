import { expect, test } from '@playwright/test';

test('2020 indigenous races are grouped under the legislator category', async ({ page }) => {
  await page.goto('/elections');
  const eventLink = page.getByRole('link').filter({ hasText: '2020' }).filter({ hasText: '立法委員' }).first();
  await expect(eventLink).toBeVisible();
  await eventLink.click();

  await expect(page.getByRole('heading', { name: /2020.*立法委員選舉/u })).toBeVisible();
  await expect(page.getByRole('link', { name: /^立法委員\s+75$/u })).toBeVisible();
  await expect(page.getByRole('link', { name: /^原住民選區/u })).toHaveCount(0);
});
