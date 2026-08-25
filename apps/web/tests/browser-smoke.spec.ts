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

test('language toggle switches the public shell copy without resizing the control', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '公職資料觀測站' })).toBeVisible();
  await expect(page.getByPlaceholder('搜尋人物、公司、政黨、選舉、地區')).toBeVisible();
  const siteIdentity = page.locator('[data-site-identity]');
  await expect(siteIdentity).toHaveText('民間公共資料整理平台・非政府機關');
  await expect(siteIdentity).toHaveCSS('font-size', '10px');

  const languageToggleSelector = '[aria-label="切換語言"], [aria-label="Switch language"]';
  const languageToggle = page.locator(languageToggleSelector).first();
  const beforeToggle = await getBox(page, languageToggleSelector);
  const languageButtons = languageToggle.locator('button');

  await expect(languageButtons).toHaveCount(2);
  const zhButton = await languageButtons.nth(0).boundingBox();
  const enButton = await languageButtons.nth(1).boundingBox();
  expect(zhButton?.width).toBe(enButton?.width);

  await page.getByRole('button', { name: 'EN', exact: true }).click();

  await expect(page.getByRole('link', { name: '⌂ Home' })).toBeVisible();
  await expect(page.getByPlaceholder('Search people, companies, parties, elections, regions')).toBeVisible();
  await expect(siteIdentity).toHaveText('Independent public-data platform · Not a government agency');

  const afterToggle = await getBox(page, languageToggleSelector);

  expect(afterToggle?.width).toBe(beforeToggle?.width);
  expect(afterToggle?.height).toBe(beforeToggle?.height);
  await expect(page.getByRole('button', { name: /BGM/ })).toHaveCount(0);

  await expectNoHorizontalOverflow(page);
});

test('chat launcher introduces itself once without exposing chat messages', async ({ page }) => {
  const storageKey = 'public-office-watch-chat-nudge-seen-at-v1';

  await page.setViewportSize({ width: 375, height: 780 });
  await page.clock.install({ time: new Date('2026-08-22T12:00:00+08:00') });
  await page.goto('/');
  await page.evaluate((key) => window.localStorage.removeItem(key), storageKey);
  await page.reload();

  const launcher = page.locator('[data-chat-launcher]');
  const nudge = page.locator('[data-chat-nudge]');
  await expect(launcher).toBeVisible();
  await expect(nudge).toHaveCount(0);

  await page.clock.fastForward(5_000);
  await expect(nudge).toBeVisible();
  await expect(nudge.getByText('全站聊天室', { exact: true })).toBeVisible();
  await expect(nudge.getByText('聊選舉、人物與地方議題', { exact: true })).toBeVisible();
  await expect(nudge.getByRole('button', { name: '開啟聊天' })).toBeVisible();

  const nudgeBox = await nudge.boundingBox();
  expect(nudgeBox).not.toBeNull();
  expect(nudgeBox!.x).toBeGreaterThanOrEqual(0);
  expect(nudgeBox!.x + nudgeBox!.width).toBeLessThanOrEqual(375);
  expect(nudgeBox!.y).toBeGreaterThanOrEqual(0);
  expect(nudgeBox!.y + nudgeBox!.height).toBeLessThanOrEqual(780);

  await launcher.hover();
  await page.clock.fastForward(6_000);
  await expect(nudge).toBeVisible();
  await page.mouse.move(8, 8);
  await page.clock.fastForward(6_000);
  await expect(nudge).toHaveCount(0);

  await page.evaluate((key) => window.localStorage.removeItem(key), storageKey);
  await page.reload();
  await expect(launcher).toBeVisible();
  await page.clock.fastForward(5_000);
  await expect(nudge).toBeVisible();
  await nudge.getByRole('button', { name: '關閉聊天室提示' }).click();
  await expect(nudge).toHaveCount(0);
  const seenAt = await page.evaluate((key) => window.localStorage.getItem(key), storageKey);
  expect(Number(seenAt)).toBeGreaterThan(0);

  await page.reload();
  await expect(launcher).toBeVisible();
  await page.clock.fastForward(5_000);
  await expect(nudge).toHaveCount(0);
});
test('desktop public pages do not introduce horizontal overflow in English', async ({ page }) => {
  for (const path of ['/', '/people']) {
    await page.goto(path);
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expectNoHorizontalOverflow(page);
  }
});

test('update log is clearly presented as reviewed site data rather than political news', async ({ page }) => {
  await page.goto('/updates');

  await expect(page.getByRole('link', { name: '↻ 資料更新紀錄' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '公開資料更新紀錄' })).toBeVisible();
  await expect(page.getByText('這裡記錄本站新增與修正的資料，不是政治新聞，也不會直接公開尚未審核的自動蒐集結果。')).toBeVisible();
});

test('focused global search offers examples and person results include party context', async ({ page }) => {
  await page.goto('/');

  const searchInput = page.getByPlaceholder('搜尋人物、公司、政黨、選舉、地區');
  await searchInput.focus();
  const examples = page.getByTestId('global-search-examples');
  await expect(examples).toBeVisible();
  await expect(examples.getByRole('button')).toHaveText(['蔣萬安', '民主進步黨', '臺北市長', '臺北市']);

  await examples.getByRole('button', { name: '蔣萬安', exact: true }).click();
  const results = page.getByTestId('global-search-results');
  await expect(results.getByText('蔣萬安', { exact: true })).toBeVisible();
  await expect(results.locator('[data-search-party-label]').filter({ hasText: '中國國民黨' })).toBeVisible();

  await searchInput.fill('');
  await expect(examples).toBeVisible();
  await examples.getByRole('button', { name: '臺北市長', exact: true }).click();
  await expect(results.getByText('2022年臺北市市長選舉', { exact: true })).toBeVisible();
  await expect(results.getByText('蔣萬安', { exact: true })).toBeVisible();
});

test('party contribution summaries spell out their source level', async ({ page }) => {
  await page.goto('/parties/kmt');

  const sourceLevels = page.locator('[data-party-source-level]');
  await expect(sourceLevels.first()).toHaveText('來源層級 A｜官方結構化資料');
  expect(await sourceLevels.count()).toBeGreaterThan(0);
});

test('homepage stays within the viewport at responsive widths', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1536, height: 960 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
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


test('person and election routes do not preload unrelated party finance or chat data', async ({ page }) => {
  const apiRequests: string[] = [];
  await page.clock.install({ time: new Date('2026-08-22T12:00:00+08:00') });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/functions/v1/')) {
      apiRequests.push(url.pathname);
    }
  });

  await page.goto('/people/d888dcb7-abda-48fd-8cd0-b973e0cf43e0');
  await expect(page.locator('main')).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(apiRequests.some((path) => path.includes('party_company_contribution'))).toBe(false);
  expect(apiRequests.some((path) => path.includes('party_finance'))).toBe(false);
  expect(apiRequests.some((path) => path.includes('party_annual_finance'))).toBe(false);
  expect(apiRequests.some((path) => path.includes('chat_status'))).toBe(false);

  await page.goto('/elections');
  const eventLink = page.locator('main a[href^="/elections/events/"]').first();
  await expect(eventLink).toBeVisible();
  apiRequests.length = 0;
  await eventLink.click();
  await expect(page).toHaveURL(/\/elections\/events\//);
  await expect(page.locator('main')).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(apiRequests.some((path) => path.includes('party_company_contribution'))).toBe(false);
  expect(apiRequests.some((path) => path.includes('party_finance'))).toBe(false);
  expect(apiRequests.some((path) => path.includes('party_annual_finance'))).toBe(false);
  expect(apiRequests.some((path) => path.includes('chat_status'))).toBe(false);
});
test('person page leads with data status and keeps sensitive source context beside the claim', async ({ page }) => {
  await page.goto('/people/d888dcb7-abda-48fd-8cd0-b973e0cf43e0');

  await expect(page.getByRole('heading', { name: '王世堅', exact: true })).toBeVisible();
  const dataSummary = page.locator('[data-person-data-summary]');
  await expect(dataSummary).toBeVisible();
  await expect(dataSummary.getByText('最後更新', { exact: true })).toBeVisible();
  await expect(dataSummary.getByText('已引用來源', { exact: true })).toBeVisible();
  await expect(dataSummary.getByText('僅顯示已審核公開資料', { exact: true })).toBeVisible();
  const candidacyCards = page.locator('[data-candidacy-card]');
  expect(await candidacyCards.count()).toBeGreaterThanOrEqual(2);
  const firstPlatformBox = await candidacyCards.nth(0).locator('[data-candidacy-platform]').boundingBox();
  const secondPlatformBox = await candidacyCards.nth(1).locator('[data-candidacy-platform]').boundingBox();
  expect(firstPlatformBox).not.toBeNull();
  expect(secondPlatformBox).not.toBeNull();
  expect(Math.abs(firstPlatformBox!.y - secondPlatformBox!.y)).toBeLessThanOrEqual(1);

  const sensitiveSource = page.locator('[data-sensitive-source]').first();
  await expect(sensitiveSource).toBeVisible();
  await expect(sensitiveSource.getByText('來源名稱', { exact: true })).toBeVisible();
  await expect(sensitiveSource.getByText('資料日期', { exact: true })).toBeVisible();
  await expect(sensitiveSource.getByText('案件／文件狀態', { exact: true })).toBeVisible();
  await expect(sensitiveSource.getByText('本站整理時間', { exact: true })).toBeVisible();
  await expect(sensitiveSource.getByRole('link', { name: /查看原始資料/ })).toBeVisible();

  await sensitiveSource.getByRole('button', { name: /提出更正/ }).click();
  const feedbackPanel = page.locator('#person-feedback');
  await expect(feedbackPanel.getByRole('button', { name: '回報問題' })).toHaveAttribute('aria-pressed', 'true');
  await expect(feedbackPanel.locator('select').first()).toHaveValue('legal');
});

test('person load failures are visually distinct from uncollected data', async ({ page }) => {
  await page.route(/\/rest\/v1\/rpc\/person_claims_for(?:\?|$)/, async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'test failure' }) });
  });

  await page.goto('/people/d888dcb7-abda-48fd-8cd0-b973e0cf43e0');

  await expect(page.locator('[data-data-state="loadError"]')).toContainText('人物資料載入失敗');
  await expect(page.locator('[data-data-state="uncollected"]')).toHaveCount(0);
});


test('county highlight panel provides a distinct background for every county city', async ({ page }) => {
  await page.goto('/');

  const highlightPanel = page.locator('[data-region-highlight]');

  for (const county of countyHighlightTargets) {
    const countyControl = page.locator('[aria-label="選取 ' + county.label + '"]').first();
    await countyControl.focus();
    await countyControl.press('Enter');
    await expect(highlightPanel).toHaveAttribute('data-region-highlight', county.id);
    await expect(countyControl).toHaveAttribute('aria-pressed', 'true');

    const highlightImage = highlightPanel.locator('img').first();
    await expect(highlightImage).toHaveAttribute('src', new RegExp('/assets/regions/' + county.id + '-day\\.webp\\?v=2$'));
  }

  await expectNoHorizontalOverflow(page);
});

test('homepage defaults to Taipei when no nationwide election is announced', async ({ page }) => {
  await page.goto('/');

  const electionFrame = page.locator('[data-region-highlight]').locator('xpath=ancestor::section[1]');
  await expect(page.locator('[data-region-highlight]')).toHaveAttribute('data-region-highlight', 'county-63000');
  await expect(electionFrame.getByText('即將到來的選舉', { exact: true })).toHaveCount(1);
  await expect(electionFrame.getByText('臺北市', { exact: true })).toHaveCount(0);
  await expect(electionFrame.getByRole('link', { name: '查看此縣市', exact: true })).toHaveAttribute('href', '/regions/taipei-city');
  await expect(page.locator('[data-national-fallback-notice]')).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test('homepage ignores a remembered nationwide view during an election gap', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.setItem('public-office-watch.selected-region', 'national'));
  await page.reload();

  await expect(page.locator('[data-region-highlight]')).toHaveAttribute('data-region-highlight', 'county-63000');
  await expect(page).toHaveURL(/\/$/);
});

test('chat messages do not wait for the posting profile endpoint', async ({ page }) => {
  await page.route('**/rest/v1/rpc/chat_messages', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
  await page.route('**/functions/v1/chat-api', (route) => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'CHAT_SERVER_ERROR' }),
  }));
  await page.goto('/');

  await page.locator('[data-chat-launcher]').click();

  await expect(page.getByText('目前還沒有訊息。', { exact: true })).toBeVisible();
  await expect(page.getByText('目前可瀏覽訊息；發言功能暫時無法使用。', { exact: true })).toBeVisible();
  await expect(page.getByText('正在讀取最近訊息…', { exact: true })).toHaveCount(0);
  await expect(page.getByText('操作未完成，請稍後再試。', { exact: true })).toHaveCount(0);
});
test('explicit nationwide selection remains selected during the election gap', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /全國總覽/ }).click();

  await expect(page.locator('[data-national-overview]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '全國', exact: true })).toBeVisible();
  await expect(page.getByText('目前沒有已公布的即將到來選舉', { exact: true })).toBeVisible();
  const nationalBackground = page.locator('[data-national-overview] img').first();
  await expect(nationalBackground).toHaveAttribute('src', '/assets/elections/national-east-coast-overview-v1.png');
  const nationalBackgroundResponse = await page.request.get('/assets/elections/national-east-coast-overview-v1.png');
  expect(nationalBackgroundResponse.ok()).toBe(true);
  expect((await nationalBackgroundResponse.body()).byteLength).toBeGreaterThan(100_000);
  await expect(nationalBackground).toHaveCSS('object-fit', 'cover');
  await expect(nationalBackground).toHaveJSProperty('naturalWidth', 1672);
  await expect(page.getByText('全國議題關注', { exact: true })).toBeVisible();
  await expect(page.getByText('立法委員政黨概況', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '全國公投項目', exact: true })).toBeVisible();
  await expect(page.getByText('目前沒有已公告的全國投票項目', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /全國總覽/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\?region=national$/);
});

test('homepage quick select exposes the six municipalities and seat links carry people filters', async ({ page }) => {
  await page.goto('/');

  const quickSelect = page.getByRole('navigation', { name: '縣市快速選擇' });
  for (const label of ['臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市']) {
    await expect(quickSelect.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
  await expect(quickSelect.getByText('更多縣市', { exact: true })).toBeVisible();
  const offshoreRail = page.locator('[data-offshore-rail]');
  await expect(offshoreRail).toBeVisible();
  const offshoreRailBox = await offshoreRail.boundingBox();
  const offshoreButtonBoxes = await offshoreRail.getByRole('button').evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  }));
  expect(offshoreButtonBoxes).toHaveLength(3);
  expect(offshoreButtonBoxes[0].top - (offshoreRailBox?.y ?? 0)).toBeGreaterThan(20);
  expect((offshoreRailBox?.y ?? 0) + (offshoreRailBox?.height ?? 0) - offshoreButtonBoxes[2].bottom).toBeGreaterThan(20);
  await expect(page.locator('[data-main-island-map] > g')).toHaveAttribute('transform', /scale\(0\.93 1\.05\)/);
  const moreCounties = quickSelect.locator('details').first();
  await moreCounties.locator('summary').click();
  const moreButtonBox = await moreCounties.locator('summary').boundingBox();
  const morePanelBox = await moreCounties.locator(':scope > div').boundingBox();
  await expect(moreCounties.locator(':scope > div').getByRole('button')).toHaveText([
    '基隆市',
    '新竹市',
    '嘉義市',
    '宜蘭縣',
    '新竹縣',
    '苗栗縣',
    '彰化縣',
    '南投縣',
    '雲林縣',
    '嘉義縣',
    '屏東縣',
    '臺東縣',
    '花蓮縣',
    '澎湖縣',
    '金門縣',
    '連江縣',
  ]);
  expect(morePanelBox?.x ?? 0).toBeGreaterThanOrEqual((moreButtonBox?.x ?? 0) + (moreButtonBox?.width ?? 0) - 1);
  expect(morePanelBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(moreButtonBox?.y ?? 0);
  expect((morePanelBox?.y ?? 0) + (morePanelBox?.height ?? 0)).toBeGreaterThan((moreButtonBox?.y ?? Number.POSITIVE_INFINITY) + (moreButtonBox?.height ?? 0));
  await moreCounties.locator('summary').click();

  const seatLink = page.locator('main a[href*="role=councilor"][href*="status=current"]').first();
  await expect(seatLink).toBeVisible();
  await seatLink.click();
  await expect(page).toHaveURL(/\/people\?.*role=councilor.*status=current|\/people\?.*status=current.*role=councilor/);
});

test('more counties menu closes after selection and outside clicks', async ({ page }) => {
  await page.goto('/');

  const moreCounties = page.getByRole('navigation', { name: '縣市快速選擇' }).locator('details').first();
  const summary = moreCounties.locator('summary');
  await summary.click();
  await expect(moreCounties).toHaveAttribute('open', '');

  await moreCounties.locator(':scope > div').getByRole('button', { name: '基隆市', exact: true }).click();
  await expect(moreCounties).not.toHaveAttribute('open', '');
  await expect(page).toHaveURL(/\?region=keelung-city$/);

  await summary.click();
  await expect(moreCounties).toHaveAttribute('open', '');
  const selectedCountyButton = moreCounties.locator(':scope > div').getByRole('button', { name: '基隆市', exact: true });
  await expect(selectedCountyButton).toHaveAttribute('aria-pressed', 'true');
  await expect(selectedCountyButton).toHaveCSS('background-color', 'rgb(244, 211, 94)');
  await page.getByRole('heading', { name: '公職資料觀測站' }).click();
  await expect(moreCounties).not.toHaveAttribute('open', '');
});

test('homepage election links and candidate categories use county filters and district-ordered cards', async ({ page }) => {
  await page.goto('/');

  const electionFrame = page.locator('[data-region-highlight]').locator('xpath=ancestor::section[1]');
  await expect(electionFrame.getByRole('heading', { name: '臺北市地方公職人員選舉', exact: true })).toBeVisible();

  const mayorElectionLink = electionFrame.getByRole('link', { name: '臺北市長選舉', exact: true });
  const councilorElectionLink = electionFrame.getByRole('link', { name: '臺北市議員選舉', exact: true });
  const villageElectionLink = electionFrame.getByRole('link', { name: '臺北市里長選舉', exact: true });
  await expect(mayorElectionLink).toHaveAttribute('href', /\/elections\/events\/2026-2026-11-28-local\?category=local_chief&region=/);
  await expect(councilorElectionLink).toHaveAttribute('href', /\/elections\/events\/2026-2026-11-28-local\?category=councilor&region=/);
  await expect(villageElectionLink).toHaveAttribute('href', /\/elections\/events\/2026-2026-11-28-local\?category=village_chief&region=/);
  const electionLinkBoxes = await electionFrame.locator('[data-home-election-category]').evaluateAll((links) => links.map((link) => {
    const box = link.getBoundingClientRect();
    return {
      height: box.height,
      background: getComputedStyle(link).backgroundColor,
    };
  }));
  expect(electionLinkBoxes).toHaveLength(3);
  expect(electionLinkBoxes.every((box) => box.height >= 36)).toBe(true);
  expect(electionLinkBoxes.every((box) => box.background !== 'rgba(0, 0, 0, 0)')).toBe(true);
  expect((await page.locator('[data-region-highlight]').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(312);


  const candidateFrame = page.getByRole('heading', { name: '臺北市參選人物', exact: true }).locator('xpath=ancestor::section[1]');
  const candidateTabs = candidateFrame.locator('[data-candidate-category-tabs]');
  const mayorTab = candidateTabs.getByRole('button', { name: /市長 \(\d+\)/ });
  await expect(mayorTab).toBeVisible();
  const councilorTab = candidateTabs.getByRole('button', { name: /市議員 \(\d+\)/ });
  await expect(councilorTab).toBeVisible();
  const councilorCountText = await councilorTab.textContent();
  const councilorCandidateCount = Number(councilorCountText?.match(/\((\d+)\)/)?.[1] ?? 0);
  expect(councilorCandidateCount).toBeGreaterThan(0);
  await expect(candidateTabs.getByRole('button', { name: /村里長/ })).toHaveCount(0);
  await expect(candidateFrame.locator('header').getByRole('link', { name: '查看選舉項目與時程', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('選擇選舉項目')).toHaveCount(0);

  const homepageGrid = page.locator('main > div').first();
  const initialGridHeight = (await homepageGrid.boundingBox())?.height ?? 0;
  await councilorTab.click();
  await expect(councilorTab).toHaveAttribute('aria-pressed', 'true');

  const districtSelect = candidateFrame.getByLabel('選擇市議員選區');
  await expect(districtSelect).toHaveValue('');
  await expect(districtSelect.locator('option')).toHaveText([
    '全部選區',
    '第一選區',
    '第二選區',
    '第三選區',
    '第四選區',
    '第五選區',
    '第六選區',
    '第七選區 平地原住民',
    '第八選區 山地原住民',
  ]);
  await expect(candidateFrame.getByText('正在載入參選人物…', { exact: true })).toHaveCount(0);
  await expect(candidateFrame.locator('a[href^="/people/"]')).toHaveCount(councilorCandidateCount);
  const viewAllCandidates = candidateFrame.locator('[data-candidate-view-all]');
  await expect(viewAllCandidates).toHaveText(`查看全部 ${councilorCandidateCount} 位人選 ›`);
  await expect(viewAllCandidates).toHaveAttribute('href', /\/elections\/events\/2026-2026-11-28-local\?category=councilor&region=/);
  await expect(page).toHaveURL(/candidateCategory=councilor/);
  await expect(candidateFrame.locator('[data-candidate-position]')).toHaveText(`1 / ${councilorCandidateCount}`);
  const allDistrictContexts = await candidateFrame.locator('[data-candidate-race-context]').allTextContents();
  expect(Array.from(new Set(allDistrictContexts))).toEqual([
    '第一選區',
    '第二選區',
    '第三選區',
    '第四選區',
    '第五選區',
    '第六選區',
    '第七選區 平地原住民',
    '第八選區 山地原住民',
  ]);

  await districtSelect.selectOption({ label: '第二選區' });
  await expect(candidateFrame.getByText('正在載入參選人物…', { exact: true })).toHaveCount(0);
  await expect(candidateFrame.locator('a[href^="/people/"]')).toHaveCount(6);
  await expect(candidateFrame.locator('[data-candidate-position]')).toHaveText('1 / 6');
  const selectedDistrictContexts = await candidateFrame.locator('[data-candidate-race-context]').allTextContents();
  await expect(viewAllCandidates).toHaveText('查看全部 6 位人選 ›');
  await expect(viewAllCandidates).toHaveAttribute('href', /\/elections\/races\//);
  await expect(page).toHaveURL(/candidateDistrict=/);
  expect(Array.from(new Set(selectedDistrictContexts))).toEqual(['第二選區']);
  await expect(candidateFrame.locator('[data-candidate-order-note]')).toContainText('依選區順序顯示');

  await mayorTab.click();
  await expect(mayorTab).toHaveAttribute('aria-pressed', 'true');
  await expect(councilorTab).toHaveAttribute('aria-pressed', 'false');
  await expect(candidateFrame.getByLabel('選擇市議員選區')).toHaveCount(0);
  await expect(page).toHaveURL(/candidateCategory=local_chief/);
  await expect(page).not.toHaveURL(/candidateDistrict=/);

  const candidateCardCount = await candidateFrame.locator('a[href^="/people/"]').count();
  expect(candidateCardCount).toBeGreaterThan(0);
  const firstPartyLabel = candidateFrame.locator('[data-candidate-party-label]').first();
  await expect(firstPartyLabel).toBeVisible();
  const partyLabelColors = await firstPartyLabel.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      background: styles.backgroundColor,
      border: styles.borderTopColor,
      text: styles.color,
    };
  });
  expect(partyLabelColors.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(partyLabelColors.border).toBe(partyLabelColors.text);
  const candidateArrowCount = await candidateFrame.getByRole('button', { name: /上一位參選人物|下一位參選人物/ }).count();
  expect(candidateArrowCount).toBe(candidateCardCount > 2 ? 2 : 0);

  const selectedGridHeight = (await homepageGrid.boundingBox())?.height ?? 0;
  expect(Math.abs(selectedGridHeight - initialGridHeight)).toBeLessThanOrEqual(1);

  const columnHeights = await page.locator('main > div > section').evaluateAll((columns) => columns.map((column) => column.getBoundingClientRect().height));
  const heightDifference = Math.max(...columnHeights) - Math.min(...columnHeights);
  expect(heightDifference).toBeLessThanOrEqual(1);
  const columnOverflow = await page.locator('main > div > section').evaluateAll((columns) => columns.map((column) => column.scrollHeight - column.clientHeight));
  expect(Math.max(...columnOverflow)).toBeLessThanOrEqual(1);

  const partyFrame = page.getByRole('heading', { name: /政黨概況/ }).locator('xpath=ancestor::section[1]');
  const issueFrame = page.getByRole('heading', { name: /議題關注/ }).locator('xpath=ancestor::section[1]');
  const pairedPanelHeights = await Promise.all([
    electionFrame.boundingBox(),
    partyFrame.boundingBox(),
    candidateFrame.boundingBox(),
    issueFrame.boundingBox(),
  ]);
  expect(Math.abs((pairedPanelHeights[0]?.height ?? 0) - (pairedPanelHeights[1]?.height ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((pairedPanelHeights[2]?.height ?? 0) - (pairedPanelHeights[3]?.height ?? 0))).toBeLessThanOrEqual(1);

  const pairedPanelOverflow = await Promise.all([
    electionFrame, partyFrame, candidateFrame, issueFrame,
  ].map((frame) => frame.evaluate((element) => element.scrollHeight - element.clientHeight)));
  expect(Math.max(...pairedPanelOverflow)).toBeLessThanOrEqual(1);

  const visiblePartyRowCount = await partyFrame.locator('[data-party-seat-row]').count();
  expect(visiblePartyRowCount).toBeGreaterThan(0);
  expect(visiblePartyRowCount).toBeLessThanOrEqual(5);
});

test('homepage candidate category district and carousel position survive person navigation and back', async ({ page }) => {
  await page.goto('/');

  const candidateFrame = page.getByRole('heading', { name: '臺北市參選人物', exact: true }).locator('xpath=ancestor::section[1]');
  await candidateFrame.getByRole('button', { name: /市議員 \(\d+\)/ }).click();
  const districtSelect = candidateFrame.getByLabel('選擇市議員選區');
  await districtSelect.selectOption({ label: '第二選區' });
  await expect(candidateFrame.locator('a[href^="/people/"]')).toHaveCount(6);

  await candidateFrame.getByRole('button', { name: '下一位參選人物' }).click();
  await expect(candidateFrame.locator('[data-candidate-position]')).toHaveText('2 / 6');
  await expect(page).toHaveURL(/candidateCategory=councilor/);
  await expect(page).toHaveURL(/candidateDistrict=/);
  await expect(page).toHaveURL(/candidateIndex=1/);
  const homepageUrl = page.url();

  await candidateFrame.locator('a[href^="/people/"]').nth(1).click();
  await expect(page).toHaveURL(/\/people\/[^/?]+$/);
  await page.goBack();

  await expect(page).toHaveURL(homepageUrl);
  const restoredFrame = page.getByRole('heading', { name: '臺北市參選人物', exact: true }).locator('xpath=ancestor::section[1]');
  await expect(restoredFrame.getByRole('button', { name: /市議員 \(\d+\)/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(restoredFrame.getByLabel('選擇市議員選區')).toHaveValue(/.+/);
  await expect(restoredFrame.locator('[data-candidate-position]')).toHaveText('2 / 6');
});

test('homepage candidate carousel stays still on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const candidateFrame = page.getByRole('heading', { name: '臺北市參選人物', exact: true }).locator('xpath=ancestor::section[1]');
  await candidateFrame.getByRole('button', { name: /市議員 \(\d+\)/ }).click();
  await candidateFrame.getByLabel('選擇市議員選區').selectOption({ label: '第二選區' });
  const position = candidateFrame.locator('[data-candidate-position]');
  await expect(position).toHaveText('1 / 6');
  await page.waitForTimeout(7500);
  await expect(position).toHaveText('1 / 6');
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
  await expect(page.locator('[data-current-region]')).toContainText('目前地區：臺中市');
  await expect(page.locator('[data-current-region]')).toContainText('變更');
  await page.reload();
  await expect(page.locator('[data-current-region]')).toContainText('目前地區：臺中市');
  await page.goBack();

  await expect(page).toHaveURL(/\?region=taichung-city$/);
  await expect(page.locator('[data-region-highlight]')).toHaveAttribute('data-region-highlight', 'county-66000');
});

test('homepage falls back safely when the region query is unknown', async ({ page }) => {
  await page.goto('/?region=not-a-region');

  await expect(page.locator('[data-region-highlight]')).toHaveAttribute('data-region-highlight', 'county-63000');
  await expect(page.locator('[data-national-fallback-notice]')).toHaveCount(0);
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


test('2026 election page searches township and village names across the full race set', async ({ page }) => {
  await page.goto('/elections/events/2026-2026-11-28-local?category=village_chief&region=%E5%8D%97%E6%8A%95%E7%B8%A3');

  const searchInput = page.getByLabel('搜尋鄉鎮市區、村里或選區名稱');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('中寮鄉永福村');
  await page.getByRole('button', { name: '搜尋', exact: true }).click();

  await expect(page).toHaveURL(/q=%E4%B8%AD%E5%AF%AE%E9%84%89%E6%B0%B8%E7%A6%8F%E6%9D%91/);
  await expect(page.getByText('南投縣中寮鄉永福村村長選舉', { exact: true })).toBeVisible();
  await expect(page.getByText('顯示第 1-1 項，共 1 個選區。', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '清除', exact: true }).click();
  await expect(searchInput).toHaveValue('');
  await expect(page).not.toHaveURL(/[?&]q=/);
  await expectNoHorizontalOverflow(page);
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
  await expect(page.locator('[data-election-breadcrumb]')).toBeVisible();

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
    await expect(page.locator('[data-election-breadcrumb] li')).toHaveCount(4);
    await expect(page.locator('[data-election-breadcrumb] [aria-current="page"]')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(filteredEventUrl);
  }

  await expectNoHorizontalOverflow(page);
});
