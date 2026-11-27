import { expect, test } from '@playwright/test';

const racePath = '/elections/races/race-example-council';

test('mock sharing covers native payload, LINE, image clipboard, and URL restoration', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as Window & {
      __sharePayload?: { title?: string; text?: string; url?: string };
      __copiedTypes?: string[];
      __comparisonCanvasText?: string[];
    };
    state.__comparisonCanvasText = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      if (this.canvas.width === 1200 && this.canvas.height === 630) state.__comparisonCanvasText?.push(text);
      if (maxWidth === undefined) return originalFillText.call(this, text, x, y);
      return originalFillText.call(this, text, x, y, maxWidth);
    };
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        state.__sharePayload = {
          title: data.title,
          text: data.text,
          url: data.url,
        };
      },
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => false,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        write: async (items: ClipboardItem[]) => {
          state.__copiedTypes = items.flatMap((item) => item.types);
        },
      },
    });
  });

  await page.goto(racePath);
  const choices = page.getByRole('checkbox', { name: /^比較 /u });
  await expect(choices).toHaveCount(2);
  const names = await choices.evaluateAll((elements) => elements.map(
    (element) => element.getAttribute('aria-label')?.replace(/^比較 /u, '') ?? '',
  ));
  await choices.first().click();
  await choices.nth(1).click();

  const panel = page
    .getByRole('heading', { name: '候選人比較', exact: true })
    .locator('xpath=ancestor::section[1]');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: '分享', exact: true }).click();

  const shareTrigger = panel.getByRole('button', { name: '分享', exact: true });
  const dialog = page.getByRole('dialog', { name: '分享預覽' });
  const closeButton = dialog.getByRole('button', { name: '關閉', exact: true });
  const preview = dialog.getByRole('img', { name: '候選人比較分享預覽' });
  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeFocused();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await expect(preview).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: '下載圖片', exact: true })).toBeFocused();
  const cardContent = await preview.getAttribute('data-share-card-content');
  expect(cardContent).toContain(names[0]);
  expect(cardContent).toContain(names[1]);
  expect(await preview.evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight])).toEqual([1200, 630]);
  const canvasText = await page.evaluate(() =>
    (window as Window & { __comparisonCanvasText?: string[] }).__comparisonCanvasText?.join(' '));
  expect(canvasText).toContain('2026 年');
  expect(canvasText).toContain('中部山線');
  expect(canvasText).toContain('範例議員選舉');
  expect(canvasText).toContain('號次 2');
  expect(canvasText).toContain('以官方公報或原始來源為準');
  expect(canvasText).not.toContain('小人圖：');
  expect(canvasText).toContain(names[0]);
  expect(canvasText).toContain(names[1]);


  const shareText = await dialog.getByLabel('分享文字').inputValue();
  const shareLink = await dialog.getByLabel('分享連結').inputValue();
  const lineHref = await dialog
    .getByRole('link', { name: '分享到 LINE', exact: true })
    .getAttribute('href');
  const lineUrl = new URL(lineHref ?? '');
  expect(lineUrl.searchParams.get('text')).toBe(shareText);
  expect(lineUrl.searchParams.get('url')).toBe(shareLink);

  await dialog.getByRole('button', { name: '分享文字與連結', exact: true }).click();
  const payload = await page.evaluate(() => (
    window as Window & { __sharePayload?: { text?: string; url?: string } }
  ).__sharePayload);
  expect(payload?.text).toBe(shareText);
  expect(payload?.text).not.toContain(shareLink);
  expect(payload?.url).toBe(shareLink);

  await dialog.getByRole('button', { name: '複製圖片', exact: true }).click();
  const copiedTypes = await page.evaluate(() => (
    window as Window & { __copiedTypes?: string[] }
  ).__copiedTypes ?? []);
  expect(copiedTypes).toContain('image/png');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await expect(shareTrigger).toBeFocused();

  await page.goto(shareLink);
  const restoredChoices = page.getByRole('checkbox', { name: /^比較 /u });
  await expect(restoredChoices.first()).toBeChecked();
  await expect(restoredChoices.nth(1)).toBeChecked();
  await expect(page.getByRole('heading', { name: '候選人比較', exact: true })).toBeVisible();

  await page.goto(`${racePath}?compare=person-example-b,not-in-race#candidate-comparison`);
  const invalidChoices = page.getByRole('checkbox', { name: /^比較 /u });
  await expect(invalidChoices.first()).toBeChecked();
  await expect(invalidChoices.nth(1)).not.toBeChecked();
  await expect(page.getByRole('button', { name: '分享', exact: true })).toHaveCount(0);
});
