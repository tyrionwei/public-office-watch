import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { oenSupportUrl } from '../src/config/oenSupport';

const policy = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')
  .split('Content-Security-Policy: ')[1].split('\n')[0].trim();

for (const width of [320, 390, 430, 1440]) {
  for (const language of ['zh-TW', 'en'] as const) {
    test(`OEN is above USDT, accessible and responsive at ${width}px in ${language}`, async ({ page, context }) => {
      const errors: string[] = [];
      const writes: string[] = [];
      const checkoutRequests: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(lang => localStorage.setItem('public-office-watch-language', lang), language);
      await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin === new URL(oenSupportUrl).origin) {
          checkoutRequests.push(request.url());
          expect(request.method()).toBe('GET');
          expect(request.headers().referer).toBeUndefined();
          return route.fulfill({ contentType: 'text/html', body: '<title>Isolated OEN destination</title><h1>Payment destination intercepted; no payment</h1>' });
        }
        if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
        if (request.method() !== 'GET') writes.push(request.url());
        if (request.isNavigationRequest()) {
          const response = await route.fetch();
          return route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy } });
        }
        return route.continue();
      });
      await page.goto('/support');
      const english = language === 'en';
      const link = page.getByRole('link', { name: english ? 'Support via OEN (new tab)' : '前往 OEN 支持（新分頁）', exact: true });
      const card = link.locator('xpath=ancestor::section[1]');
      await expect(card.getByRole('heading', { name: english ? 'One-time support in TWD' : '台幣單次支持', exact: true })).toBeVisible();
      await expect(card).toContainText('NT$100–2,000');
      await expect(card).toContainText(english ? 'credit card or convenience-store payment code' : '信用卡或超商代碼');
      await expect(card).toContainText(english ? 'real OEN payment page' : 'OEN 真實付款頁');
      await expect(link).toHaveAttribute('href', 'https://pow4vote.oen.tw/payment-url/3Lv6wrTAQPc8sq5qvmgtZr5MjHZ');
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(link).toHaveAccessibleDescription(english ? /real OEN payment page/ : /OEN 真實付款頁/);
      const crypto = page.getByRole('heading', { name: english ? 'USDT support' : 'USDT 支持', exact: true });
      expect((await card.boundingBox())!.y).toBeLessThan((await crypto.boundingBox())!.y);
      await expect(page.getByRole('heading', { name: english ? 'Leave a message after your transfer' : '轉帳後留下留言', exact: true })).toHaveCount(1);
      await expect(page.getByLabel(english ? 'Transaction ID or sending wallet address' : '交易編號或付款錢包地址', { exact: true })).toHaveCount(1);
      await expect(page.locator('body')).not.toContainText(english ? 'Other support methods are being prepared' : '其他支持方式準備中');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const box = (await link.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
      await link.focus();
      await expect(link).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(link).toBeFocused();
      expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
      expect(await link.evaluate(el => parseFloat(getComputedStyle(el).outlineOffset))).toBeLessThanOrEqual(-4);
      expect(checkoutRequests).toEqual([]);
      for (let visit = 0; visit < 2; visit++) {
        const popupPromise = context.waitForEvent('page');
        await page.keyboard.press('Enter');
        const popup = await popupPromise;
        await popup.waitForLoadState();
        await expect(popup).toHaveURL(oenSupportUrl);
        expect(await popup.evaluate(() => window.opener)).toBeNull();
        await popup.close();
        await expect(page).toHaveURL(/\/support$/);
        await expect(link).toBeFocused();
      }
      expect(checkoutRequests).toEqual([oenSupportUrl, oenSupportUrl]);
      await page.screenshot({ path: test.info().outputPath(`support-${language}-${width}.png`), fullPage: true });
      expect(writes).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

test('support entry, history and reload keep OEN available', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/about');
  await page.getByRole('link', { name: '查看支持方式', exact: true }).click();
  await expect(page).toHaveURL(/\/support$/);
  const support = page.getByRole('link', { name: '前往 OEN 支持（新分頁）', exact: true });
  await expect(support).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/about$/);
  await page.goForward();
  await expect(support).toBeVisible();
  await page.reload();
  await expect(support).toBeVisible();
});

test('OEN button and inset keyboard focus retain contrast in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/support');
  const link = page.getByRole('link', { name: '前往 OEN 支持（新分頁）', exact: true });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    await link.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    const contrast = await link.evaluate(el => {
      const css = getComputedStyle(el);
      const luminance = (color: string) => {
        const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(n => {
          const c = n / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const ratio = (a: string, b: string) => {
        const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (values[0] + 0.05) / (values[1] + 0.05);
      };
      return { text: ratio(css.color, css.backgroundColor), focus: ratio(css.outlineColor, css.backgroundColor), offset: parseFloat(css.outlineOffset) };
    });
    expect(contrast.text).toBeGreaterThanOrEqual(4.5);
    expect(contrast.focus).toBeGreaterThanOrEqual(3);
    expect(contrast.offset).toBeLessThanOrEqual(-4);
    await page.screenshot({ path: test.info().outputPath(`support-focus-${theme}.png`) });
  }
});
