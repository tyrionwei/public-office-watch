import { expect, test } from '@playwright/test';

const racePath = '/elections/races/9599a0fa-812a-4170-9bde-01a2090f78af';

test('candidate comparison share preview supports LINE and a pasteable, downloadable PNG', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:5173' });
  await page.goto(racePath);

  const comparisonChoices = page.getByRole('checkbox', { name: /^比較 /u });
  await expect(comparisonChoices.first()).toBeVisible();
  expect(await comparisonChoices.count()).toBeGreaterThanOrEqual(2);

  const firstChoice = comparisonChoices.first();
  const secondChoice = comparisonChoices.nth(1);
  const firstName = (await firstChoice.getAttribute('aria-label'))?.replace(/^比較 /u, '') ?? '';
  const secondName = (await secondChoice.getAttribute('aria-label'))?.replace(/^比較 /u, '') ?? '';
  await firstChoice.click();
  await expect(comparisonChoices.first()).toBeChecked();
  await secondChoice.click();
  await expect(comparisonChoices.nth(1)).toBeChecked();

  const comparisonPanel = page
    .getByRole('heading', { name: '候選人比較', exact: true })
    .locator('xpath=ancestor::section[1]');
  await expect(comparisonPanel).toBeVisible();
  const platformSection = comparisonPanel
    .getByRole('heading', { name: '公開政見', exact: true })
    .locator('xpath=ancestor::section[1]');
  const firstPlatform = (await platformSection.locator('li').first().textContent())?.trim() ?? '';
  expect(firstPlatform).not.toBe('');
  await comparisonPanel.getByRole('button', { name: '分享', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: '分享預覽' });
  await expect(dialog).toBeVisible();
  const preview = dialog.getByRole('img', { name: '候選人比較分享預覽' });
  await expect(preview).toBeVisible();
  const cardContent = await preview.getAttribute('data-share-card-content');
  expect(cardContent).toContain(firstName);
  expect(cardContent).toContain(secondName);
  expect(cardContent).toContain(firstPlatform);

  const shareText = await dialog.getByLabel('分享文字').inputValue();
  const shareLink = await dialog.getByLabel('分享連結').inputValue();
  const lineButton = dialog.getByRole('link', { name: '分享到 LINE', exact: true });
  const lineUrl = new URL((await lineButton.getAttribute('href')) ?? '');
  expect(lineUrl.origin).toBe('https://social-plugins.line.me');
  expect(lineUrl.pathname).toBe('/lineit/share');
  expect(lineUrl.searchParams.get('text')).toBe(shareText);
  expect(lineUrl.searchParams.get('url')).toBe(shareLink);

  await dialog.getByRole('button', { name: '複製圖片', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('已複製圖片');

  await page.evaluate(() => {
    const target = document.createElement('div');
    target.contentEditable = 'true';
    target.dataset.clipboardPasteTarget = 'true';
    document.body.append(target);
    target.focus();
  });
  await page.keyboard.press('Control+V');
  await expect(page.locator('[data-clipboard-paste-target] img')).toHaveCount(1);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: '下載圖片', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('candidate-comparison.png');
  await expect(dialog.getByRole('status')).toHaveText('已下載 PNG');
  await expect(dialog.getByRole('button', { name: /Instagram/i })).toHaveCount(0);
});
