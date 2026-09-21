import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`legal status help supports hover, focus and Escape at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/people/a86bf49e-1d29-43b0-a0d2-bf0e423fd9a2');
    const button = page.getByRole('button', { name: '案件狀態與判決結果說明' });
    await expect(button).toBeVisible();
    const card = page.locator('[data-legal-summary]').first();
    await expect(card).toContainText('判決結果');
    await expect(card).toContainText('是否定讞待查');
    await expect(card).toContainText('結果待確認');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await button.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    // Allow the viewport scroll event to settle before opening the floating help.
    await page.waitForTimeout(300);
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('緩起訴');
    await expect(tooltip).toContainText('其他／狀態待確認');
    const tipBox = await tooltip.boundingBox();
    expect(tipBox!.x).toBeGreaterThanOrEqual(0);
    expect(tipBox!.x + tipBox!.width).toBeLessThanOrEqual(width);
    await page.mouse.move(0, 0);
    await expect(tooltip).toHaveCount(0);
    await button.focus();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
  });
}
