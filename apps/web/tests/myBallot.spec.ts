import { expect, test } from '@playwright/test';

const storageKey = 'public-office-watch.voting-region-preference.v1';
const preference = {
  county: { id: 'taipei-city', name: '臺北市' },
  district: { id: 'district-63000010', name: '松山區' },
  village: { id: 'village-63000010002', name: '莊敬里' },
  source: 'manual', confirmedAt: '2026-09-28T00:00:00Z',
};

test('平原專席顯示五票；新分里連到獨立選區頁', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(({ key, base }) => localStorage.setItem(key, JSON.stringify({
    ...base, county: { id: 'miaoli-county', name: '苗栗縣' },
    district: { id: 'district-10005110', name: '南庄鄉' },
    village: { id: 'village-10005110001', name: '東村' }, ballotCategory: 'lowland',
  })), { key: storageKey, base: preference });
  await page.reload();
  const ballots = page.locator('#my-ballots');
  await expect(ballots).toContainText('依設定預估 5 張地方選舉票');
  await expect(ballots).toContainText('苗栗縣南庄鄉第4選舉區');
  await expect(ballots.getByRole('link')).toHaveCount(5);
  await page.evaluate(({ key, base }) => localStorage.setItem(key, JSON.stringify({
    ...base, county: { id: 'tainan-city', name: '臺南市' },
    district: { id: 'district-67000100', name: '官田區' },
    village: { id: 'village-67000100017', name: '東庄里' }, ballotCategory: 'general',
  })), { key: storageKey, base: preference });
  await page.reload();
  await expect(ballots).toContainText('依設定預估 3 張地方選舉票');
  await expect(ballots).toContainText('臺南市官田區東庄里里長');
  await expect(ballots).not.toContainText('選區頁連結待補');
  await expect(ballots.getByRole('link')).toHaveCount(3);
});

test('舊戶籍補類別後手機與桌機共用選票；瀏覽不改戶籍且網址不含類別', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
  }, { key: storageKey, value: preference });
  const apiErrors: string[] = [];
  const apiOrigins = new Set<string>();
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/rest/v1/')) {
      apiOrigins.add(url.origin);
      if (response.status() >= 400) apiErrors.push(url.pathname + ':' + response.status());
    }
  });
  await page.goto('/');
  const ballots = page.locator('#my-ballots');
  await expect(ballots).toContainText('需補設定：選票查詢類別');
  await expect(ballots.getByRole('link')).toHaveCount(2);
  await expect(page.locator('[data-my-polling-place]')).toBeVisible();
  await expect(page.locator('[data-my-polling-place] a', { hasText: '中選會官方查詢' })).toHaveAttribute('href', 'https://info.cec.gov.tw/vote2026/voteSearch/');
  await ballots.getByRole('button', { name: '補充設定' }).click();
  await expect(page.locator('[data-voting-ballot-category]')).toHaveValue('unspecified');
  await page.locator('[data-voting-ballot-category]').selectOption('general');
  await page.getByRole('button', { name: '儲存投票地區' }).click();
  await expect(ballots).toContainText('依設定預估 3 張地方選舉票');
  await expect(ballots.getByRole('link')).toHaveCount(3);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
  expect(saved.county).toEqual(preference.county);
  expect(saved.village).toEqual(preference.village);
  expect(saved.ballotCategory).toBe('general');
  const positions = await page.evaluate(() => ['[data-mobile-my-election] article', '#my-ballots', '[data-my-polling-place]', '#my-election-candidates-title', '[data-mobile-region-browser]'].map((selector) => document.querySelector(selector)!.getBoundingClientRect().top));
  expect(positions).toEqual([...positions].sort((a,b) => a-b));
  const mayorHref = await ballots.getByRole('link').first().getAttribute('href');
  await ballots.getByRole('link').first().click();
  await expect(page).toHaveURL(new RegExp(mayorHref!));
  await expect(page.getByRole('heading', { name: /臺北市.*長/ }).first()).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/?region=kaohsiung-city');
  await page.locator('[data-desktop-voting-region]').getByRole('button', { name: '查看我的選票' }).click();
  await expect(page.locator('#desktop-my-ballots')).toContainText('依設定預估 3 張地方選舉票');
  await expect(page.locator('#desktop-my-ballots')).toContainText('臺北市第3選舉區');
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).county.id, storageKey)).toBe('taipei-city');
  expect(page.url()).not.toMatch(/general|lowland|highland|ballotCategory/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect([...apiOrigins]).toEqual(['http://127.0.0.1:54321']);
  expect(apiErrors).toEqual([]);
});

test('桌機共用視窗引導設定、返回原查詢、固定分頁並保留首頁位置', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  const summary = page.locator('[data-desktop-voting-region]');
  await summary.getByRole('button', { name: '查看投開票所' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('tab', { name: '戶籍設定' })).toHaveAttribute('aria-selected', 'true');
  await expect(dialog).toContainText('儲存後會回到原本的查詢分頁');
  await dialog.locator('[data-voting-county]').selectOption('taipei-city');
  await dialog.locator('[data-voting-district]').selectOption('district-63000010');
  await dialog.locator('[data-voting-village-trigger]').click();
  await dialog.getByRole('option', { name: '莊敬里', exact: true }).click();
  await dialog.locator('[data-voting-ballot-category]').selectOption('general');
  const tabsTop = await dialog.getByRole('tablist').evaluate((el) => el.getBoundingClientRect().top);
  await dialog.getByRole('button', { name: '儲存投票地區' }).scrollIntoViewIfNeeded();
  expect(await dialog.getByRole('tablist').evaluate((el) => el.getBoundingClientRect().top)).toBe(tabsTop);
  await dialog.getByRole('button', { name: '儲存投票地區' }).click();
  await expect(dialog.getByRole('tab', { name: '投開票所', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.locator('[data-my-polling-place]')).toBeVisible();
  await dialog.getByRole('button', { name: '變更戶籍設定' }).click();
  await dialog.locator('[data-voting-ballot-category]').selectOption('lowland');
  await dialog.getByRole('button', { name: '儲存投票地區' }).click();
  await expect(dialog.getByRole('tab', { name: '投開票所', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(dialog).toContainText('請至官方查詢選擇投票類別');
  await dialog.getByRole('tab', { name: '我的選票', exact: true }).click();
  await expect(dialog).toContainText('依設定預估 3 張地方選舉票');
  await dialog.getByRole('tab', { name: '戶籍設定' }).click();
  await dialog.locator('[data-voting-ballot-category]').selectOption('highland');
  await dialog.getByRole('button', { name: '儲存投票地區' }).click();
  await expect(dialog.getByRole('tab', { name: '我的選票', exact: true })).toHaveAttribute('aria-selected', 'true');
  await dialog.getByRole('button', { name: '關閉', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('main #desktop-my-ballots, main [data-desktop-polling-place]')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 240));
  const before = await page.evaluate(() => ({ y: scrollY, height: document.documentElement.scrollHeight }));
  await summary.getByRole('button', { name: '查看我的選票' }).evaluate((el: HTMLButtonElement) => { el.focus({ preventScroll: true }); el.click(); });
  await expect(dialog.getByRole('tab', { name: '我的選票', exact: true })).toHaveAttribute('aria-selected', 'true');
  await dialog.getByRole('button', { name: '關閉', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => ({ y: scrollY, height: document.documentElement.scrollHeight }))).toEqual(before);
  await expect(summary.getByRole('button', { name: '查看我的選票' })).toBeFocused();
  await summary.getByRole('button', { name: '查看我的選票' }).click();
  await dialog.getByRole('tab', { name: '我的選票', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('tab', { name: '投開票所', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(dialog.getByRole('tab', { name: '我的選票', exact: true })).toBeFocused();
  await dialog.locator('#desktop-my-ballots').getByRole('link').first().click();
  await expect(page).toHaveURL(/\/elections\/races\//);
  await expect(dialog).toHaveCount(0);
});
