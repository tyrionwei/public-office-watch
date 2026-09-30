import { expect, test } from '@playwright/test';

for (const county of [
  { name: '雲林縣', slug: 'yunlin-county', url: 'https://web.cec.gov.tw/ylec/article/64366' },
  { name: '澎湖縣', slug: 'penghu-county', url: 'https://web.cec.gov.tw/phec/article/63671' },
]) {
  test(`${county.name}正常設定流程保留缺地址公告及原民查詢界線`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.locator('[data-voting-region-onboarding]').getByRole('button', { name: '手動設定戶籍投票地區' }).click();
    const dialog = page.getByRole('dialog', { name: '我的投票地區' });
    await dialog.locator('[data-voting-county]').selectOption({ label: county.name });
    await expect(dialog.locator('[data-voting-district] option').nth(1)).toBeAttached();
    await dialog.locator('[data-voting-district]').selectOption({ index: 1 });
    await dialog.locator('[data-voting-village-trigger]').click();
    await dialog.locator('#voting-village-options').getByRole('option').nth(1).click();
    await dialog.locator('[data-voting-ballot-category]').selectOption('general');
    await dialog.getByRole('button', { name: '儲存投票地區', exact: true }).click();
    await expect(dialog).toBeHidden();

    // Assert the real persisted representation instead of injecting a county-* fixture.
    const savedCountyId = await page.evaluate(() => JSON.parse(localStorage.getItem('public-office-watch.voting-region-preference.v1') ?? 'null')?.county.id);
    expect(savedCountyId).toBe(county.slug);
    await expect(page.locator('#my-ballots')).toContainText(county.name);
    await expect(page.locator('[data-polling-missing-address]')).toContainText('官方尚未提供投開票所地址');
    await expect(page.locator('[data-polling-missing-address] a')).toHaveAttribute('href', county.url);

    await page.locator('[data-voting-region-summary]').getByRole('button', { name: '變更', exact: true }).click();
    await dialog.locator('[data-voting-ballot-category]').selectOption('lowland');
    await dialog.getByRole('button', { name: '儲存投票地區', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('[data-my-polling-place]')).toContainText('尚無法依此選票查詢類別判定投開票所');
    await expect(page.locator('[data-polling-missing-address]')).toHaveCount(0);
  });
}
