import { expect, test } from '@playwright/test';

test('整合選票後保留官方投開票所缺地址提示及原民查詢界線', async ({ page }) => {
  const preference = {county:{id:'county-10009',name:'雲林縣'},district:{id:'district-10009010',name:'斗六市'},village:{id:'village-10009010001',name:'忠孝里'},source:'manual',confirmedAt:'2026-09-30T00:00:00Z',ballotCategory:'general'};
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.evaluate(value => localStorage.setItem('public-office-watch.voting-region-preference.v1',JSON.stringify(value)),preference);
  await page.reload();
  await expect(page.locator('#my-ballots')).toContainText('雲林縣');
  await expect(page.locator('[data-polling-missing-address]')).toContainText('官方尚未提供投開票所地址');
  await expect(page.locator('[data-polling-missing-address] a')).toHaveAttribute('href','https://web.cec.gov.tw/ylec/article/64366');
  await page.evaluate(value => localStorage.setItem('public-office-watch.voting-region-preference.v1',JSON.stringify({...value,ballotCategory:'lowland'})),preference);
  await page.reload();
  await expect(page.locator('[data-my-polling-place]')).toContainText('尚無法依此選票查詢類別判定投開票所');
  await expect(page.locator('[data-polling-missing-address]')).toHaveCount(0);
});
