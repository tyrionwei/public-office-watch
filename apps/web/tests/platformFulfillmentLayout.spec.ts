import { expect, test, type Page } from '@playwright/test';

const personPath = '/people/49a7d775-31da-413c-aa2a-f9e6190fcade';

async function firstPlatformCard(page: Page) {
  await page.goto(personPath);
  const card = page.getByRole('heading', { name: '公開政見', exact: true }).locator('xpath=ancestor::article[1]');
  await expect(card).toBeVisible();
  return card;
}

test('large platform uses one compact desktop row per promise with a header legend', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const card = await firstPlatformCard(page);
  const candidacyCards = page.locator('[data-candidacy-card]');
  await expect(candidacyCards).toHaveCount(2);
  const candidacyTops = await candidacyCards.evaluateAll((elements) => (
    elements.map((element) => Math.round(element.getBoundingClientRect().top))
  ));
  expect(new Set(candidacyTops).size).toBe(1);
  const electedResult = candidacyCards.getByText('當選', { exact: true });
  await expect(electedResult).toBeVisible();
  await expect(electedResult).toHaveClass(/text-emerald-200/u);

  const items = card.locator('ol > li');
  expect(await items.count()).toBeGreaterThan(30);

  const firstItem = items.first();
  const choices = firstItem.getByRole('group', {
    name: '你認為目前履行情況如何？',
  });
  const buttons = choices.getByRole('button');
  await expect(buttons).toHaveText(['已實現', '推進中', '尚未實現', '資訊不足']);
  const boxes = await buttons.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { top: box.top, left: box.left, right: box.right, bottom: box.bottom };
  }));
  expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBe(1);
  expect(boxes[0].left).toBeLessThan(boxes[3].left);

  const placeholder = firstItem.getByTestId('fulfillment-result-placeholder');
  await expect(placeholder).toBeVisible();
  const placeholderBox = await placeholder.boundingBox();
  const choiceBottom = Math.max(...boxes.map((box) => box.bottom));
  expect(placeholderBox?.y ?? 0).toBeGreaterThan(choiceBottom);

  await card
    .getByRole('button', { name: '查看全部結果', exact: true })
    .click();
  await expect(
    card.getByRole('img', { name: /社群投票結果/u }),
  ).toHaveCount(await items.count());
  await card
    .getByRole('button', { name: '收起全部結果', exact: true })
    .click();
  await expect(
    card.getByRole('img', { name: /社群投票結果/u }),
  ).toHaveCount(0);

  for (const label of ['已實現', '推進中', '尚未實現', '資訊不足']) {
    await expect(card.getByText(label, { exact: true }).first()).toBeVisible();
  }
  const listMetrics = await card.locator('ol').evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(listMetrics.scrollHeight).toBeGreaterThan(listMetrics.clientHeight);
  expect(listMetrics.scrollWidth).toBeLessThanOrEqual(listMetrics.clientWidth + 1);

  const basicSection = page.getByRole('heading', { name: '基本資料', exact: true }).locator('xpath=ancestor::section[1]');
  await expect(basicSection.getByRole('heading', { name: '黨籍紀錄', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '人物時間軸', exact: true })).toHaveCount(0);
});

test('mobile platform choices form a two-by-two grid without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const card = await firstPlatformCard(page);
  const firstItem = card.locator('ol > li').first();
  const choices = firstItem.getByRole('group', {
    name: '你認為目前履行情況如何？',
  });
  const buttons = choices.getByRole('button');
  await expect(buttons).toHaveText(['已實現', '推進中', '尚未實現', '資訊不足']);
  const boxes = await buttons.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { top: box.top, left: box.left, right: box.right, bottom: box.bottom };
  }));

  expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBe(2);
  expect(Math.round(boxes[0].top)).toBe(Math.round(boxes[1].top));
  expect(Math.round(boxes[2].top)).toBe(Math.round(boxes[3].top));
  expect(boxes.every((box) => box.left >= 0 && box.right <= 360)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
