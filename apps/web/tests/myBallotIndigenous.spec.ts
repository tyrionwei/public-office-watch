import { expect, test } from '@playwright/test';
import { taiwanRegions } from '../src/data/taiwanRegions';
import { taiwanDistrictsByCountyCode } from '../src/data/generated/taiwanDistrictDirectory';
import { taiwanVillagesByDistrictCode } from '../src/data/generated/taiwanVillageDirectory';

// Expected representative districts were checked against the 2026 announcement scopes.
const cases = [
  ['新北市', '烏來區', '忠治里', 1, 1],
  ['桃園市', '復興區', '三民里', 1, 1],
  ['臺中市', '和平區', '南勢里', 1, 1],
  ['高雄市', '茂林區', '茂林里', 2, 2],
  ['高雄市', '桃源區', '寶山里', 2, 2],
  ['高雄市', '那瑪夏區', '瑪星哈蘭里', 1, 1],
  ['苗栗縣', '南庄鄉', '東村', 1, 4],
  ['屏東縣', '滿州鄉', '滿州村', 1, 4],
  ['花蓮縣', '玉里鎮', '中城里', 1, 3],
  ['花蓮縣', '玉里鎮', '樂合里', 2, 4],
  ['澎湖縣', '馬公市', '復興里', 1, 1],
] as const;

for (const [countyName, districtName, villageName, ordinary, lowland] of cases) {
  test(`${countyName}${districtName}${villageName} 三類別在桌機與手機的票種分流`, async ({ page }) => {
    const county = taiwanRegions.find((row) => row.name === countyName)!;
    const district = taiwanDistrictsByCountyCode[county.code].find((row) => row.name === districtName)!;
    const village = taiwanVillagesByDistrictCode[district.code].find((row) => row.name === villageName)!;
    const key = 'public-office-watch.voting-region-preference.v1';
    const saved = {
      county: { id: county.slug, name: countyName },
      district: { id: `district-${district.code}`, name: districtName },
      village: { id: `village-${village.code}`, name: villageName },
      source: 'manual', confirmedAt: '2026-09-28T00:00:00Z',
    };
    const apiErrors: string[] = [];
    const apiOrigins = new Set<string>();
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (!url.pathname.startsWith('/rest/v1/')) return;
      apiOrigins.add(url.origin);
      if (response.status() >= 400) apiErrors.push(`${url.pathname}:${response.status()}`);
    });
    await page.addInitScript(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key, saved });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const summary = page.locator('[data-desktop-voting-region]');
    const dialog = page.getByRole('dialog');
    await summary.getByRole('button', { name: '查看我的選票' }).click();
    const ballots = dialog.locator('#desktop-my-ballots');
    if (countyName === '澎湖縣') await expect(ballots).toContainText('依設定預估 5 張地方選舉票');
    else {
      await expect(ballots).toContainText('需補設定：選票查詢類別');
      await expect(ballots).not.toContainText('依設定預估');
    }
    const councilLinks: string[] = [];
    for (const category of ['general', 'lowland', 'highland'] as const) {
      await dialog.getByRole('tab', { name: '戶籍設定', exact: true }).click();
      await dialog.locator('[data-voting-ballot-category]').selectOption(category);
      await dialog.getByRole('button', { name: '儲存投票地區' }).click();
      await expect(dialog.getByRole('tab', { name: '我的選票', exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(ballots).toContainText('依設定預估 5 張地方選舉票');
      await expect(ballots.getByRole('link')).toHaveCount(5);
      const representativeName = `${countyName}${districtName}第${category === 'lowland' ? lowland : ordinary}選舉區`;
      await expect(ballots).toContainText(representativeName);
      await expect(ballots).toContainText(districtName.endsWith('區') ? '山地原住民區民代表' : '鄉鎮市民代表');
      councilLinks.push((await ballots.getByRole('link').filter({ hasText: '縣市議員' }).getAttribute('href'))!);
      const desktopLinks = await ballots.getByRole('link').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      await dialog.getByRole('tab', { name: '投開票所', exact: true }).click();
      const polling = dialog.locator('[data-my-polling-place]');
      if (category !== 'general') {
        await expect(polling).toContainText('目前尚無法依此選票查詢類別判定投開票所');
        await expect(polling.locator('[data-polling-match-status]')).toHaveCount(0);
        await expect(polling.getByRole('link', { name: '中選會官方查詢' })).toHaveAttribute('href', 'https://info.cec.gov.tw/vote2026/voteSearch/');
      } else await expect(polling).not.toContainText('目前尚無法依此選票查詢類別');
      await dialog.getByRole('button', { name: '關閉', exact: true }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      const mobile = page.locator('#my-ballots');
      await expect(mobile).toContainText('依設定預估 5 張地方選舉票');
      await expect(mobile).toContainText(representativeName);
      expect(await mobile.getByRole('link').evaluateAll((links) => links.map((link) => link.getAttribute('href')))).toEqual(desktopLinks);
      const actual = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
      expect(actual.village).toEqual(saved.village);
      expect(actual.ballotCategory).toBe(category);
      expect(page.url()).not.toMatch(/general|lowland|highland|ballotCategory/);
      await page.setViewportSize({ width: 1280, height: 800 });
      if (category !== 'highland') await summary.getByRole('button', { name: '查看我的選票' }).click();
    }
    expect(new Set(councilLinks).size).toBe(countyName === '澎湖縣' ? 1 : 3);
    expect([...apiOrigins]).toEqual(['http://127.0.0.1:54321']);
    expect(apiErrors).toEqual([]);
  });
}
