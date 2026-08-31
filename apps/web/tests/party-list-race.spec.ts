import { expect, test } from '@playwright/test';

const partyListRacePath = '/elections/races/fbf84648-d6d7-480b-a0a4-518ad1f39d2b';

test('2024 party-list race shows party results, full rosters, and party comparison', async ({ page }) => {
  await page.goto(partyListRacePath);

  await expect(page.getByRole('heading', { name: '全國不分區及僑居國外國民立法委員選舉' })).toBeVisible();
  await expect(page.getByText('政黨票結果')).toBeVisible();
  await expect(page.getByRole('heading', { name: '民主進步黨', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '中國國民黨', exact: true })).toBeVisible();
  await expect(page.getByText('4,981,060')).toBeVisible();
  await expect(page.getByText('4,764,293')).toBeVisible();

  const partyRows = page.locator('[data-party-result-row]');
  await expect(partyRows).toHaveCount(16);
  const dppRow = page.locator('[data-party-result-row="dpp"]');
  await dppRow.getByRole('button', { name: '查看完整名單' }).click();
  await expect(page.getByText('民主進步黨 不分區名單')).toBeVisible();
  await expect(page.getByRole('link', { name: '林月琴', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '查看中選會共同政見原文' })).toBeVisible();

  await page.getByRole('checkbox', { name: '比較 民主進步黨' }).click();
  await expect(page.getByRole('checkbox', { name: '比較 民主進步黨' })).toBeChecked();
  await page.getByRole('checkbox', { name: '比較 中國國民黨' }).click();
  await expect(page.getByRole('checkbox', { name: '比較 中國國民黨' })).toBeChecked();
  await expect(page.getByText('政黨比較')).toBeVisible();
  await expect(page.getByText('女性 18 · 男性 16 · 未知 0')).toBeVisible();
  await expect(page.getByText('女性 17 · 男性 17 · 未知 0')).toBeVisible();
  await expect(page).toHaveURL(/compare=dpp%2Ckmt/u);
});
