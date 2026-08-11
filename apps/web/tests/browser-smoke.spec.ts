import { expect, test } from '@playwright/test';

const countyHighlightTargets = [
  { id: 'county-63000', label: '臺北市' },
  { id: 'county-65000', label: '新北市' },
  { id: 'county-68000', label: '桃園市' },
  { id: 'county-66000', label: '臺中市' },
  { id: 'county-67000', label: '臺南市' },
  { id: 'county-64000', label: '高雄市' },
  { id: 'county-10017', label: '基隆市' },
  { id: 'county-10018', label: '新竹市' },
  { id: 'county-10020', label: '嘉義市' },
  { id: 'county-10002', label: '宜蘭縣' },
  { id: 'county-10004', label: '新竹縣' },
  { id: 'county-10005', label: '苗栗縣' },
  { id: 'county-10007', label: '彰化縣' },
  { id: 'county-10008', label: '南投縣' },
  { id: 'county-10009', label: '雲林縣' },
  { id: 'county-10010', label: '嘉義縣' },
  { id: 'county-10013', label: '屏東縣' },
  { id: 'county-10014', label: '臺東縣' },
  { id: 'county-10015', label: '花蓮縣' },
  { id: 'county-10016', label: '澎湖縣' },
  { id: 'county-09020', label: '金門縣' },
  { id: 'county-09007', label: '連江縣' },
];

async function getBox(page: import('@playwright/test').Page, selector: string) {
  return page.locator(selector).first().boundingBox();
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test('language toggle switches the public shell copy without resizing controls', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '公職資料觀測站' })).toBeVisible();
  await expect(page.getByPlaceholder('搜尋人物、公司、政黨、選舉、地區')).toBeVisible();

  const languageToggleSelector = '[aria-label="切換語言"], [aria-label="Switch language"]';
  const languageToggle = page.locator(languageToggleSelector).first();
  const beforeToggle = await getBox(page, languageToggleSelector);
  const beforeBgm = await page.getByRole('button', { name: /BGM/ }).boundingBox();
  const languageButtons = languageToggle.locator('button');

  await expect(languageButtons).toHaveCount(2);
  const zhButton = await languageButtons.nth(0).boundingBox();
  const enButton = await languageButtons.nth(1).boundingBox();
  expect(zhButton?.width).toBe(enButton?.width);

  await page.getByRole('button', { name: 'EN', exact: true }).click();

  await expect(page.getByRole('link', { name: '⌂ Home' })).toBeVisible();
  await expect(page.getByPlaceholder('Search people, companies, parties, elections, regions')).toBeVisible();

  const afterToggle = await getBox(page, languageToggleSelector);
  const afterBgm = await page.getByRole('button', { name: /BGM/ }).boundingBox();

  expect(afterToggle?.width).toBe(beforeToggle?.width);
  expect(afterToggle?.height).toBe(beforeToggle?.height);
  expect(afterBgm?.width).toBe(beforeBgm?.width);
  expect(afterBgm?.height).toBe(beforeBgm?.height);

  await expectNoHorizontalOverflow(page);
});

test('desktop public pages do not introduce horizontal overflow in English', async ({ page }) => {
  for (const path of ['/', '/people']) {
    await page.goto(path);
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expectNoHorizontalOverflow(page);
  }
});

test('people page loads public people results', async ({ page }) => {
  let candidateRequestCount = 0;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/rest/v1/public_candidates')) {
      candidateRequestCount += 1;
    }
  });

  await page.goto('/people');

  const profileLinks = page.locator('main a[href^="/people/"]');
  await expect(profileLinks.first()).toBeVisible();
  expect(await profileLinks.count()).toBeGreaterThan(0);
  expect(candidateRequestCount).toBe(0);
});

test('county highlight panel provides a distinct background for every county city', async ({ page }) => {
  await page.goto('/');

  const highlightPanel = page.locator('[data-region-highlight]');

  for (const county of countyHighlightTargets) {
    await page.locator('[aria-label="選取 ' + county.label + '"]').first().evaluate((element) => {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await expect(highlightPanel).toHaveAttribute('data-region-highlight', county.id);

    const highlightImage = highlightPanel.locator('img').first();
    await expect(highlightImage).toHaveAttribute('src', new RegExp('/assets/regions/' + county.id + '-day\\.webp\\?v=2$'));
  }

  await expectNoHorizontalOverflow(page);
});

test('homepage defaults to Taipei when no nationwide election is announced', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('[data-region-highlight]')).toHaveAttribute('data-region-highlight', 'county-63000');
  await expect(page.locator('[data-national-fallback-notice]')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('explicit nationwide selection remains selected during the election gap', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /全國總覽/ }).click();

  await expect(page.locator('[data-national-overview]')).toBeVisible();
  await expect(page.getByText('全國議題關注', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /全國總覽/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\?region=national$/);
});

test('homepage region selection survives navigation and browser back', async ({ page }) => {
  await page.goto('/');

  await page.locator('[aria-label="選取 臺中市"]').first().evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });

  await expect(page).toHaveURL(/\?region=taichung-city$/);
  await expect(page.locator('[data-region-highlight]')).toHaveAttribute('data-region-highlight', 'county-66000');

  await page.locator('a[href="/people"]').first().click();
  await expect(page).toHaveURL(/\/people$/);
  await page.goBack();

  await expect(page).toHaveURL(/\?region=taichung-city$/);
  await expect(page.locator('[data-region-highlight]')).toHaveAttribute('data-region-highlight', 'county-66000');
});

test('homepage falls back safely when the region query is unknown', async ({ page }) => {
  await page.goto('/?region=not-a-region');

  await expect(page.locator('[data-region-highlight]')).toHaveAttribute('data-region-highlight', 'county-63000');
  await expect(page.locator('[data-national-fallback-notice]')).toBeVisible();
});

test('people filters and pagination survive profile navigation and browser back', async ({ page }) => {
  await page.goto('/people?status=current&page=2');

  const profileLink = page.locator('main a[href^="/people/"]').first();
  await expect(profileLink).toBeVisible();
  await profileLink.click();
  await expect(page).toHaveURL(/\/people\/[^/?]+$/);
  await page.goBack();

  await expect(page).toHaveURL(/\/people\?status=current&page=2$/);
  await expect(page.locator('select').filter({ has: page.locator('option[value="current"]') })).toHaveValue('current');
});

test('legacy election links redirect to the bounded event page', async ({ page }) => {
  await page.goto('/');
  const legacyElectionLinks = page.locator(
    'main a[href^="/elections/"]:not([href^="/elections/events/"]):not([href^="/elections/races/"])',
  );
  const linkCount = await legacyElectionLinks.count();

  if (linkCount === 0) {
    await expectNoHorizontalOverflow(page);
    return;
  }

  await legacyElectionLinks.first().click();

  await expect(page).toHaveURL(/\/elections\/events\/[^/?]+$/);
  await expect(page.getByRole('heading', { name: '大選總覽' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '項目分類' })).toBeVisible();
});

test('people page distinguishes a load failure and retries', async ({ page }) => {
  let failOnce = true;
  await page.route(/\/rest\/v1\/(?:public_people_list_cached|people_directory)(?:\?|$)/, async (route) => {
    if (failOnce) {
      failOnce = false;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'test failure' }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/people');
  await expect(page.getByText('人物資料載入失敗，請稍後再試。')).toBeVisible();
  await expect(page.getByText('沒有符合目前篩選條件的人物資料。')).toHaveCount(0);
  await page.getByRole('button', { name: '重新載入' }).click();
  await expect(page.locator('main a[href^="/people/"]').first()).toBeVisible();
});


test('elections page groups elections into events and opens race detail', async ({ page }) => {
  await page.goto('/elections');

  await expect(page.getByRole('heading', { name: '依年份選擇大選' })).toBeVisible();
  await expect(page.getByText('選舉年份')).toBeVisible();

  const eventLinks = page.locator('main a[href^="/elections/events/"]');
  const emptyState = page.getByText('目前尚未載入可公開的選舉事件資料。');
  await expect(eventLinks.first().or(emptyState)).toBeVisible();
  const eventCount = await eventLinks.count();

  if (eventCount === 0) {
    await expect(emptyState).toBeVisible();
    await expectNoHorizontalOverflow(page);
    return;
  }

  await eventLinks.first().click();

  await expect(page.getByRole('heading', { name: '大選總覽' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '項目分類' })).toBeVisible();
  await expect(page.getByText('縣市 / 區域')).toBeVisible();

  const categoryLink = page.locator('main a[href*="category="]').first();
  await expect(categoryLink).toBeVisible();
  await categoryLink.click();
  const filteredEventUrl = page.url();

  const raceLinks = page.locator('main a[href^="/elections/races/"]');
  const raceCount = await raceLinks.count();

  if (raceCount > 0) {
    await raceLinks.first().click();
    await expect(page.getByRole('heading', { name: '選區項目細節' })).toBeVisible();
    await expect(page.getByText('候選名冊')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(filteredEventUrl);
  }

  await expectNoHorizontalOverflow(page);
});
