import { expect, test, type Page } from '@playwright/test';
import { startHomeLoadFixture } from './fixtures/home-load-recovery/server.mjs';

declare global {
  interface Window {
    __goHomePath: (path: string) => void;
    __homeRecovery: {
      calls: Array<string | null>;
      pendingAlpha: (() => void) | null;
    };
  }
}

let fixture: Awaited<ReturnType<typeof startHomeLoadFixture>>;
let pageErrors: string[] = [];
let externalRequests: string[] = [];
test.beforeAll(async () => { fixture = await startHomeLoadFixture(); });
test.afterAll(async () => { await fixture?.close(); });
test.beforeEach(async ({ page }) => {
  pageErrors = [];
  externalRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === fixture.origin) return route.continue();
    externalRequests.push(route.request().url());
    return route.abort();
  });
});
test.afterEach(() => {
  expect(pageErrors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

async function open(page: Page, path = '/') {
  await page.goto(fixture.origin + path);
}

test('home RPC failure shows an error instead of zero or placeholders and retry restores 113 seats', async ({ page }) => {
  await open(page);
  await expect(page.locator('div[role=alert]')).toContainText('首頁資料載入失敗');
  await expect(page.getByRole('button', { name: '重試' })).toBeVisible();
  const seats = page.getByRole('heading', { name: '立法委員政黨概況' }).locator('xpath=../../..');
  await expect(seats).not.toContainText('席次合計 0');
  await expect(page.locator('main')).not.toContainText('待公告');

  await page.getByRole('button', { name: '重試' }).click();
  await expect(page.locator('div[role=alert]')).toHaveCount(0);
  await expect(page.locator('[data-races]')).toContainText('Race national');
  await expect(seats).toContainText('席次合計 113');
  await expect(seats).toContainText('甲黨');
  const calls = await page.evaluate(() => window.__homeRecovery.calls);
  expect(calls.length).toBeGreaterThanOrEqual(2);
  expect(calls.every(region => region === null)).toBe(true);
});

test('a late home response for an old region cannot replace the newly selected region', async ({ page }) => {
  await open(page, '/?region=taipei');
  await expect.poll(() => page.evaluate(() => window.__homeRecovery.calls.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => Boolean(window.__homeRecovery.pendingAlpha))).toBe(true);

  await page.evaluate(() => window.__goHomePath('/?region=new-taipei-city'));
  await expect(page.locator('[data-races]')).toContainText('Race beta');
  await page.evaluate(() => window.__homeRecovery.pendingAlpha?.());
  await page.waitForTimeout(50);
  await expect(page.locator('[data-races]')).toContainText('Race beta');
  await expect(page.locator('[data-races]')).not.toContainText('Race alpha');
  expect(await page.evaluate(() => window.__homeRecovery.calls)).toEqual(['taipei', 'new-taipei-city']);
});
