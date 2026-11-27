import { expect, test } from '@playwright/test';

const storageKey = 'public-office-watch.voting-region-preference.v1';

// A saved neighborhood can still be present when the release withholds both
// stations. Exercise that state as well as a voter who has not set one.
for (const neighborhood of [undefined, 12, 13]) {
  test(`斗六市文化里只提供官方查詢（鄰別：${neighborhood ?? '未設定'}）`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    }, {
      key: storageKey,
      value: {
        county: { id: 'yunlin-county', name: '雲林縣' },
        district: { id: 'district-10009010', name: '斗六市' },
        village: { id: 'village-10009010039', name: '文化里' },
        source: 'manual',
        confirmedAt: '2026-11-27T00:00:00Z',
        ballotCategory: 'general',
        neighborhood,
      },
    });
    await page.goto('/');

    const polling = page.locator('[data-my-polling-place]');
    await expect(polling).toContainText('雲林縣 斗六市 文化里');
    await expect(polling.locator('[data-polling-missing-address]')).toBeVisible();
    await expect(polling.getByRole('link', { name: /中選會官方查詢/ })).toHaveAttribute(
      'href', /^https:\/\/info\.cec\.gov\.tw\/vote2026\/voteSearch\//,
    );
    await expect(polling.locator('[data-polling-match-status]')).toHaveCount(0);
    await expect(polling.locator('li')).toHaveCount(0);
    await expect(polling.locator('a[href*="google.com/maps"]')).toHaveCount(0);
  });
}
