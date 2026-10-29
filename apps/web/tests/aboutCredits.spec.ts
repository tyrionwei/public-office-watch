import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const creditCount = JSON.parse(readFileSync(new URL('../src/data/candidateSpriteSources.json', import.meta.url), 'utf8')).assets.length;

const id = 'a0959bb6-fc41-4012-b5dc-52d136c4bb73';

test('About credits stay compact and keyboard users can reach the body @mobile-ci', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('/about');
  const section = page.locator('[data-sprite-credits]');
  const toggle = section.getByRole('button', { name: '查看全部署名', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(section.locator('[data-sprite-credit]')).toHaveCount(0);
  await toggle.focus();
  await page.keyboard.press('Tab');
  await expect(section.locator('[data-credit-manifest]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '查看支持方式', exact: true })).toBeFocused();
  for (let cycle = 0; cycle < 2; cycle++) {
    await toggle.focus();
    await page.keyboard.press(cycle ? 'Space' : 'Enter');
    await expect(section.locator('[data-sprite-credit]')).toHaveCount(creditCount);
    await expect(section.locator('[data-credit-source]')).toHaveCount(creditCount);
    await expect(section.locator('[data-credit-license]')).toHaveCount(creditCount);
    await section.getByRole('button', { name: '收合並回到署名區頂端', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toBeFocused();
    await expect(section.locator('[data-sprite-credit]')).toHaveCount(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('About query shows only the matching credit and unknown IDs stay compact @mobile-ci', async ({ page }) => {
  for (const query of [id, id.toUpperCase()]) {
    await page.goto('/about?imageCredit=' + query);
    await expect(page.locator('[data-sprite-credit]')).toHaveCount(1);
    await expect(page.locator('[data-sprite-credit]')).toHaveAttribute('data-sprite-credit', id);
    await expect(page.locator('[data-credit-source]')).toHaveCount(1);
    await page.getByRole('button', { name: '查看全部署名', exact: true }).click();
    await expect(page.locator('[data-sprite-credit]')).toHaveCount(creditCount);
    await page.getByRole('button', { name: '收合完整清單', exact: true }).click();
    await expect(page.locator('[data-sprite-credit]')).toHaveCount(1);
  }
  for (const query of ['unknown', '%3Cscript%3E', '']) {
    await page.goto('/about?imageCredit=' + query);
    await expect(page.getByRole('button', { name: '查看全部署名', exact: true })).toBeVisible();
    await expect(page.locator('[data-sprite-credit]')).toHaveCount(0);
    if (query) await expect(page.getByRole('status')).toContainText('找不到指定人物');
    await expect(page.locator('[data-credit-manifest]')).toBeVisible();
  }
});

test('About client navigation and history reset expanded credits @mobile-ci', async ({ page }) => {
  await page.goto('/about');
  await page.getByRole('button', { name: '查看全部署名', exact: true }).click();
  await expect(page.locator('[data-sprite-credit]')).toHaveCount(creditCount);
  await page.evaluate((selected) => {
    history.pushState(null, '', '/about?imageCredit=' + selected);
    dispatchEvent(new PopStateEvent('popstate'));
  }, id);
  await expect(page.locator('[data-sprite-credit]')).toHaveCount(1);
  await page.getByRole('button', { name: '查看全部署名', exact: true }).click();
  await page.goBack();
  await expect(page.locator('[data-sprite-credit]')).toHaveCount(0);
  await page.goForward();
  await expect(page.locator('[data-sprite-credit]')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('[data-sprite-credit]')).toHaveCount(1);
});
