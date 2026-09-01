import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US' });

test('first visit defaults to Traditional Chinese regardless of browser locale', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem('public-office-watch-language');
  });

  await page.goto('/about');

  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant');
  await expect(page.getByRole('heading', { name: '關於本站' }).first()).toBeVisible();
  expect(await page.evaluate(() => (
    window.localStorage.getItem('public-office-watch-language')
  ))).toBe('zh-TW');
});
