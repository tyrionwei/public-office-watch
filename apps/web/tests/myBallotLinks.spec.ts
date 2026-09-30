import { expect, test } from '@playwright/test';

for (const [countyId, countyName, districtCode, districtName, villageCode, villageName, raceId, raceTitle, count] of [
  ['tainan-city', '臺南市', '67000100', '官田區', '67000100017', '東庄里', '50d51085-f950-4ea6-982b-9166a51f791f', '臺南市官田區東庄里里長選舉', 3],
  ['tainan-city', '臺南市', '67000100', '官田區', '67000100018', '西庄里', 'fe21df5e-f078-4658-b850-d43900202afe', '臺南市官田區西庄里里長選舉', 3],
  ['yunlin-county', '雲林縣', '10009200', '水林鄉', '10009200021', '[欍]埔村', '6908ef24-813f-42ce-924c-c24488d6f28f', '雲林縣水林鄉瓊埔村村長選舉', 5],
] as const) {
  test(`${districtName}${villageName}連到正確既有公開選區頁`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((value) => localStorage.setItem('public-office-watch.voting-region-preference.v1', JSON.stringify(value)), {
      county: { id: countyId, name: countyName }, district: { id: `district-${districtCode}`, name: districtName },
      village: { id: `village-${villageCode}`, name: villageName }, ballotCategory: 'general', source: 'manual', confirmedAt: '2026-09-28T00:00:00Z',
    });
    const errors: number[] = [];
    const origins = new Set<string>();
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/rest/v1/')) { origins.add(url.origin); if (response.status() >= 400) errors.push(response.status()); }
    });
    await page.goto('/');
    const ballots = page.locator('#my-ballots');
    await expect(ballots).toContainText(`依設定預估 ${count} 張地方選舉票`);
    const link = ballots.getByRole('link').filter({ hasText: '村里長' });
    await expect(link).toHaveAttribute('href', `/elections/races/${raceId}`);
    await expect(ballots).not.toContainText('選區頁連結待補');
    await link.click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(raceTitle);
    expect([...origins]).toEqual(['http://127.0.0.1:54321']);
    expect(errors).toEqual([]);
  });
}
