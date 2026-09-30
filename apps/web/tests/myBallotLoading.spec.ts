import { expect, test } from '@playwright/test';

const mappingModule = /\/(?:src\/lib\/)?myBallot(?:\.ts|-[^/]+\.js)(?:\?|$)/;
const mappingData = /\/(?:ballotMappings2026|villageBallotMappings2026|localChiefBallotMappings2026|representativeBallotMappings2026)\./;
const key = 'public-office-watch.voting-region-preference.v1';
const preference = {
  county: { id: 'taipei-city', name: '臺北市' }, district: { id: 'district-63000010', name: '松山區' },
  village: { id: 'village-63000010002', name: '莊敬里' }, ballotCategory: 'general',
  source: 'manual', confirmedAt: '2026-09-28T00:00:00Z',
};

test('未設定戶籍的一般首頁不載入完整 mapping', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => { if (mappingModule.test(request.url()) || mappingData.test(request.url())) requests.push(request.url()); });
  await page.goto('/');
  await expect(page.locator('[data-desktop-voting-region]')).toContainText('尚未設定投票地區');
  await page.waitForLoadState('networkidle');
  expect(requests).toEqual([]);
  await page.locator('[data-desktop-voting-region]').getByRole('button', { name: '查看我的選票' }).click();
  await expect(page.getByRole('dialog')).toContainText('請先設定戶籍地區');
  expect(requests).toEqual([]);
});

test('摘要與視窗共用一次延遲載入，完成前不顯示錯誤票數或資料缺漏', async ({ page }) => {
  await page.addInitScript(({ key, preference }) => localStorage.setItem(key, JSON.stringify(preference)), { key, preference });
  let requests = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(mappingModule, async (route) => { requests += 1; await gate; await route.continue(); });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const summary = page.locator('[data-desktop-voting-region]');
  await expect(summary).toContainText('載入選票資料');
  await expect(summary.locator('[data-desktop-ballot-count]')).toHaveCount(0);
  await summary.getByRole('button', { name: '查看我的選票' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('正在載入選票資料');
  await expect(dialog).not.toContainText('依設定預估');
  await expect(dialog).not.toContainText('資料待補');
  await dialog.getByRole('tab', { name: '投開票所', exact: true }).click();
  await dialog.getByRole('tab', { name: '我的選票', exact: true }).click();
  expect(requests).toBe(1);
  release();
  await expect(dialog).toContainText('依設定預估 3 張地方選舉票');
  await dialog.getByRole('button', { name: '關閉', exact: true }).click();
  await expect(summary.locator('[data-desktop-ballot-count]')).toContainText('預估 3 張');
  await summary.getByRole('button', { name: '查看我的選票' }).click();
  await expect(dialog).toContainText('依設定預估 3 張地方選舉票');
  expect(requests).toBe(1);
});
