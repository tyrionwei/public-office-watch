import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`home loads responsive art without the complete attribution module at ${width}px @mobile-ci`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const requested: string[] = [];
    page.on('request', (request) => requested.push(request.url()));
    await page.goto('/');
    const image = page.locator('[data-national-overview] img').first();
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('fetchpriority', 'high');
    await expect.poll(() => image.evaluate((element) => {
      const image = element as HTMLImageElement;
      return image.complete && image.naturalWidth > 0 && /-(960|1440)\.webp$/.test(image.currentSrc);
    })).toBe(true);
    expect(requested.some((url) => /candidateSpriteCredits-.*\.js/.test(url))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}
