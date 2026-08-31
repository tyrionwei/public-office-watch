import { expect, test } from '@playwright/test';

test('2020 indigenous races are grouped under the legislator category', async ({ page }) => {
  await page.goto('/elections');
  const eventLink = page.getByRole('link').filter({ hasText: '2020' }).filter({ hasText: '立法委員' }).first();
  await expect(eventLink).toBeVisible();
  await eventLink.click();

  await expect(page.getByRole('heading', { name: /2020.*立法委員選舉/u })).toBeVisible();
  const legislatorCategory = page.getByRole('link', { name: /^立法委員\s+76$/u });
  await expect(legislatorCategory).toBeVisible();
  await expect(page.getByRole('link', { name: /^原住民選區/u })).toHaveCount(0);
  await legislatorCategory.click();
  await expect(page.getByRole('link', { name: /全國不分區及僑居國外國民立法委員選舉/u })).toBeVisible();
});
