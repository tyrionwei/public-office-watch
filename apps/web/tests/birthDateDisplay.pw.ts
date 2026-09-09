import { expect, test, type Page } from '@playwright/test';
import { startBirthDateFixture } from './fixtures/birth-date-display/server.mjs';

let fixture: Awaited<ReturnType<typeof startBirthDateFixture>>;
let errors: string[];
let external: string[];
async function observe(page: Page) {
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === fixture.origin) return route.continue();
    external.push(route.request().url()); return route.abort();
  });
}
test.beforeAll(async () => { fixture = await startBirthDateFixture(); });
test.afterAll(async () => { await fixture?.close(); });
test.beforeEach(async ({ page }) => { fixture.reset(); errors = []; external = []; await observe(page); });
test.afterEach(() => { expect(errors).toEqual([]); expect(external).toEqual([]); });

test('admin keyboard toggle persists across browsers and restores full date without changing claims', async ({ page, browser }, testInfo) => {
  await page.goto(fixture.origin + '/?page=admin');
  const toggle = page.getByRole('switch', { name: '僅顯示出生年份' });
  await expect(toggle).not.toBeChecked();
  const viewerContext = await browser.newContext();
  try {
    const viewer = await viewerContext.newPage(); await observe(viewer);
    await viewer.goto(fixture.origin);
    await expect(viewer.getByText('1981-07-23', { exact: true })).toBeVisible();
    fixture.configure({ saveDelay: 300 });
    await toggle.focus(); await page.keyboard.press('Space');
    await expect(toggle).toBeDisabled();
    await expect(toggle).toBeChecked();
    await expect(page.getByRole('status')).toContainText('已儲存');
    await viewer.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(viewer.getByText('1981', { exact: true })).toBeVisible();
    await expect(viewer.getByText('1981-07-23', { exact: true })).toHaveCount(0);
    await expect(viewer.getByText('出生年份', { exact: true })).toBeVisible();
    const newViewer = await viewerContext.newPage(); await observe(newViewer);
    await newViewer.goto(fixture.origin);
    await expect(newViewer.getByText('1981', { exact: true })).toBeVisible();
    await page.reload(); await expect(toggle).toBeChecked();
    await page.getByRole('heading', { name: '生日公開顯示' }).locator('xpath=ancestor::section[1]').screenshot({ path: testInfo.outputPath('admin-year-only.png') });
    await toggle.focus(); await page.keyboard.press('Space');
    await expect(toggle).not.toBeChecked();
    await expect(page.getByRole('status')).toContainText('已儲存');
    await viewer.reload();
    await expect(viewer.getByText('1981-07-23', { exact: true })).toBeVisible();
    expect(await viewer.evaluate(() => (window as unknown as { __birthdayProfile: { public_claims: Array<{ claim_value: string }> } }).__birthdayProfile.public_claims[0].claim_value)).toBe('1981-07-23');
    expect(fixture.snapshot().writes.map((row: { expectedRevision: number }) => row.expectedRevision)).toEqual([0, 1]);
  } finally { await viewerContext.close(); }
});

test('signed-out, anonymous and ordinary users never receive the admin switch', async ({ page }) => {
  for (const auth of ['signed-out', 'anonymous', 'ordinary']) {
    await page.goto(`${fixture.origin}/?page=admin&auth=${auth}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('switch')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '生日公開顯示' })).toHaveCount(0);
  }
  expect(fixture.snapshot().writes).toHaveLength(0);
});

test('failed reads and uncertain writes require refresh instead of claiming success', async ({ page }) => {
  fixture.configure({ failAdminLoad: true });
  await page.goto(fixture.origin + '/?page=admin');
  await expect(page.getByRole('alert')).toContainText('無法讀取生日顯示設定');
  await expect(page.getByRole('switch')).toHaveCount(0);
  fixture.configure({ failAdminLoad: false, failSave: 'before' });
  await page.getByRole('button', { name: '重新整理生日設定' }).click();
  await page.getByRole('switch').click();
  await expect(page.getByRole('alert')).toContainText('未能確認儲存結果');
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(fixture.snapshot().settings.birth_date_year_only).toBe(false);
  await page.getByRole('button', { name: '重新整理生日設定' }).click();
  await expect(page.getByRole('switch')).not.toBeChecked();
  fixture.configure({ failSave: 'after' });
  await page.getByRole('switch').click();
  await expect(page.getByRole('alert')).toContainText('未能確認儲存結果');
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(fixture.snapshot().settings.birth_date_year_only).toBe(true);
  await page.getByRole('button', { name: '重新整理生日設定' }).click();
  await expect(page.getByRole('switch')).toBeChecked();
});

test('another admin change invalidates the stale switch state', async ({ page }) => {
  await page.goto(fixture.origin + '/?page=admin');
  await expect(page.getByRole('switch')).not.toBeChecked();
  fixture.setSettings({ birth_date_year_only: true, revision: 1 });
  await page.getByRole('switch').click();
  await expect(page.getByRole('alert')).toContainText('其他管理員更新');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: '重新整理生日設定' }).click();
  await expect(page.getByRole('switch')).toBeChecked();
  expect(fixture.snapshot().settings.revision).toBe(1);
});

test('public setting read failure uses year only and visible pages refresh the global setting', async ({ page }) => {
  fixture.configure({ failPublic: true });
  await page.clock.install();
  await page.goto(fixture.origin);
  await expect(page.getByText('1981', { exact: true })).toBeVisible();
  await expect(page.getByText('1981-07-23', { exact: true })).toHaveCount(0);
  fixture.configure({ failPublic: false });
  await page.clock.runFor(60_001);
  await expect(page.getByText('1981-07-23', { exact: true })).toBeVisible();
  fixture.setSettings({ birth_date_year_only: true, revision: 1 });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('1981', { exact: true })).toBeVisible();
  await expect(page.getByText('1981-07-23', { exact: true })).toHaveCount(0);
});
