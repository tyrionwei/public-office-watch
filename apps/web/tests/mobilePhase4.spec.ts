import { expect, test, type Page } from '@playwright/test';

const racePath = '/elections/races/ea1efd78-28f2-406e-b96f-c3640f465eed';
const personPath = '/people/49a7d775-31da-413c-aa2a-f9e6190fcade';

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test.use({ viewport: { width: 375, height: 812 } });

test('mobile race uses two-person comparison without a wide table', async ({ page }) => {
  await page.goto(racePath);

  const choices = page.getByRole('checkbox', { name: /^比較 /u });
  await expect(choices.first()).toBeVisible();
  expect(await choices.count()).toBeGreaterThanOrEqual(3);
  await choices.nth(0).click();
  await choices.nth(1).click();

  await expect(page.getByText('已選 2/2 人')).toBeVisible();
  await expect(choices.nth(2)).toBeDisabled();
  const comparison = page.locator('[data-candidate-comparison]');
  await expect(comparison).toBeVisible();
  expect(await comparison.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  const touchTarget = await choices.first().locator('xpath=..').boundingBox();
  expect(touchTarget?.width).toBeGreaterThanOrEqual(44);
  expect(touchTarget?.height).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalOverflow(page);
});

test('desktop race keeps four-person comparison', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(racePath);

  const choices = page.getByRole('checkbox', { name: /^比較 /u });
  await expect(choices.first()).toBeVisible();
  expect(await choices.count()).toBeGreaterThanOrEqual(4);
  await choices.nth(0).click();
  await choices.nth(1).click();
  await expect(choices.nth(2)).toBeEnabled();
  await choices.nth(2).click();
  await expect(page.getByText('已選 3/4 人')).toBeVisible();
});

test('mobile person and party profiles keep their identity cards in the viewport', async ({ page }) => {
  await page.goto(personPath);
  await expect(page.locator('[data-person-profile-hero]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const personSectionTops = await page.evaluate(() => ({
    legal: document.querySelector('[data-person-mobile-legal]')?.getBoundingClientRect().top ?? 0,
    finance: document.querySelector('[data-person-mobile-finance]')?.getBoundingClientRect().top ?? 0,
    resume: document.querySelector('[data-person-mobile-resume]')?.getBoundingClientRect().top ?? 0,
    sources: document.querySelector('[data-person-mobile-sources]')?.getBoundingClientRect().top ?? 0,
    summary: document.querySelector('[data-person-data-summary]')?.getBoundingClientRect().top ?? 0,
  }));
  expect(personSectionTops.legal).toBeLessThan(personSectionTops.finance);
  expect(personSectionTops.finance).toBeLessThan(personSectionTops.resume);
  expect(personSectionTops.resume).toBeLessThan(personSectionTops.sources);
  expect(personSectionTops.sources).toBeLessThan(personSectionTops.summary);

  await page.goto('/parties/dpp');
  await expect(page.locator('[data-party-profile-hero]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
