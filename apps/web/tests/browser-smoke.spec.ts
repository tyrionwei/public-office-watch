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

function parseCssColor(value: string) {
  const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
  return {
    red: channels[0] ?? 0,
    green: channels[1] ?? 0,
    blue: channels[2] ?? 0,
    alpha: channels[3] ?? 1,
  };
}

function colorContrast(foregroundValue: string, backgroundValue: string) {
  const foreground = parseCssColor(foregroundValue);
  const background = parseCssColor(backgroundValue);
  const mixed = [
    foreground.red * foreground.alpha + background.red * (1 - foreground.alpha),
    foreground.green * foreground.alpha + background.green * (1 - foreground.alpha),
    foreground.blue * foreground.alpha + background.blue * (1 - foreground.alpha),
  ];
  const luminance = (channels: number[]) => {
    const [red, green, blue] = channels.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const foregroundLuminance = luminance(mixed);
  const backgroundLuminance = luminance([background.red, background.green, background.blue]);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

test('language toggle switches the public shell copy without resizing the control', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '公職資料觀測站' })).toBeVisible();
  await expect(page.getByPlaceholder('搜尋人物、公司、政黨、選舉、地區')).toBeVisible();
  const siteIdentity = page.locator('[data-site-identity]');
  await expect(siteIdentity).toHaveText('民間公共資料整理平台・非政府機關');
  await expect(siteIdentity).toHaveCSS('font-size', '10px');

  const languageToggleSelector = '[data-desktop-header] [data-language-toggle]';
  const languageToggle = page.locator(languageToggleSelector);
  const beforeToggle = await getBox(page, languageToggleSelector);

  await expect(languageToggle).toHaveText('EN');
  await languageToggle.click();

  await expect(page.getByRole('link', { name: '⌂ Home' })).toBeVisible();
  await expect(page.getByPlaceholder('Search people, companies, parties, elections, regions')).toBeVisible();
  await expect(siteIdentity).toHaveText('Independent public-data platform · Not a government agency');

  const afterToggle = await getBox(page, languageToggleSelector);

  expect(afterToggle?.width).toBe(beforeToggle?.width);
  expect(afterToggle?.height).toBe(beforeToggle?.height);
  await expect(languageToggle).toHaveText('中');
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

test('theme toggle keeps dark as the default and remembers a light preference', async ({ page }) => {
  await page.goto('/');

  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'dark');

  const lightToggle = page.getByRole('button', { name: '切換至淺色模式' });
  await expect(lightToggle).toHaveAttribute('data-theme-toggle');
  const darkBackground = await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor);

  await lightToggle.click();

  await expect(root).toHaveAttribute('data-theme', 'light');
  const darkToggle = page.getByRole('button', { name: '切換至深色模式' });
  await expect(darkToggle).toHaveAttribute('data-theme-toggle');
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('public-office-watch-theme'))).toBe('light');
  const lightBackground = await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(lightBackground).not.toBe(darkBackground);

  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: '切換至深色模式' })).toBeVisible();

  await page.getByRole('link', { name: '◎ 人物' }).click();
  await expect(page).toHaveURL(/\/people(?:\?|$)/);
  await expect(root).toHaveAttribute('data-theme', 'light');

  await page.setViewportSize({ width: 320, height: 844 });
  await expectNoHorizontalOverflow(page);
  await page.locator('[data-mobile-header] [data-theme-toggle]').click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('public-office-watch-theme'))).toBe('dark');
  await expectNoHorizontalOverflow(page);
});

test('light theme uses warm surfaces and readable semantic colors', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '切換至淺色模式' }).click();

  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(238, 232, 220)');

  await page.goto('/people/49a7d775-31da-413c-aa2a-f9e6190fcade');
  await expect(page.getByRole('heading', { name: '人物資料', exact: true })).toBeVisible();

  const partyChip = page.locator('.theme-party-chip').first();
  await expect(partyChip).toBeVisible();
  await expect(partyChip).toHaveCSS('color', 'rgb(27, 41, 56)');

  const uncollectedSummary = page.locator('[data-summary-state="uncollected"]');
  const pendingSummary = page.locator('[data-summary-state="pending"]');
  await expect(uncollectedSummary).toBeVisible();
  await expect(pendingSummary).toBeVisible();
  await expect(uncollectedSummary.getByRole('heading')).toHaveCSS('color', 'rgb(116, 70, 0)');
  await expect(pendingSummary.getByRole('heading')).toHaveCSS('color', 'rgb(92, 59, 159)');

  const candidacyStatus = page.locator('.theme-candidacy-status').first();
  await expect(candidacyStatus).toBeVisible();
  await expect(candidacyStatus).toHaveCSS('color', 'rgb(124, 73, 0)');

  const voteButtons = page.locator('.theme-vote-button');
  await expect(voteButtons.first()).toBeVisible();
  await expect(voteButtons.nth(0)).toHaveCSS('color', 'rgb(13, 104, 73)');
  await expect(voteButtons.nth(1)).toHaveCSS('color', 'rgb(0, 104, 121)');
  await expect(voteButtons.nth(2)).toHaveCSS('color', 'rgb(154, 45, 76)');
  await expect(voteButtons.nth(3)).toHaveCSS('color', 'rgb(64, 80, 101)');

  await expectNoHorizontalOverflow(page);
});

test('light theme shared text palette keeps normal text contrast across common surfaces', async ({ page }) => {
  await page.goto('/');
  await page.locator('html').evaluate((root) => root.setAttribute('data-theme', 'light'));

  const samples = await page.evaluate(() => {
    const textClasses = [
      'text-slate-400',
      'text-slate-500',
      'text-slate-600',
      'text-signal',
      'text-signal/80',
      'text-accent',
      'text-accent/60',
      'text-success',
      'text-amber-100/75',
      'text-amber-100/80',
      'text-amber-200/80',
      'text-cyan-200/75',
      'text-cyan-200/80',
      'text-cyan-300/80',
      'text-pink-100',
      'text-pink-200/80',
      'text-pink-300',
      'text-red-200',
      'text-rose-300',
      'text-violet-200',
      'text-emerald-300',
    ];
    const rootStyle = getComputedStyle(document.documentElement);
    const surfaces = [
      { name: 'bg-bg', value: rootStyle.getPropertyValue('--color-bg') },
      { name: 'bg-panel', value: rootStyle.getPropertyValue('--color-panel') },
      { name: 'bg-panelAlt', value: rootStyle.getPropertyValue('--color-panel-alt') },
    ];
    const mount = document.createElement('div');
    document.body.append(mount);
    const result: Array<{ textClass: string; surfaceClass: string; color: string; backgroundColor: string }> = [];

    for (const { name: surfaceClass, value } of surfaces) {
      const surface = document.createElement('div');
      surface.style.backgroundColor = `rgb(${value})`;
      mount.append(surface);
      for (const textClass of textClasses) {
        const sample = document.createElement('span');
        sample.className = textClass;
        sample.textContent = 'sample';
        surface.append(sample);
        const style = getComputedStyle(sample);
        result.push({
          textClass,
          surfaceClass,
          color: style.color,
          backgroundColor: getComputedStyle(surface).backgroundColor,
        });
      }
      for (const [category, color] of Object.entries({
        presidential: '#f472b6',
        chief: '#f4d35e',
        representative: '#7dd3fc',
        basic: '#86efac',
      })) {
        const sample = document.createElement('span');
        sample.dataset.raceCategory = category;
        sample.style.color = color;
        sample.textContent = 'sample';
        surface.append(sample);
        result.push({
          textClass: `race-category-${category}`,
          surfaceClass,
          color: getComputedStyle(sample).color,
          backgroundColor: getComputedStyle(surface).backgroundColor,
        });
      }
    }

    mount.remove();
    return result;
  });

  for (const sample of samples) {
    expect(
      colorContrast(sample.color, sample.backgroundColor),
      `${sample.textClass} on ${sample.surfaceClass}: ${sample.color} / ${sample.backgroundColor}`,
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test('desktop public pages do not introduce horizontal overflow in English', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('public-office-watch-language', 'en'));
  for (const path of ['/', '/people']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expectNoHorizontalOverflow(page);
  }
});

test('update log is clearly presented as reviewed site data rather than political news', async ({ page }) => {
  await page.goto('/updates');

  await expect(page.getByRole('link', { name: '↻ 資料更新紀錄' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '公開資料更新紀錄' })).toBeVisible();
  await expect(page.getByText('這裡記錄本站新增與修正的資料，不是政治新聞，也不會直接公開尚未審核的自動蒐集結果。')).toBeVisible();
  await expect(page.getByText('補充資料品質與開源貢獻說明', { exact: true })).toBeVisible();
});

test('support page clearly presents the feature as still in preparation', async ({ page }) => {
  await page.goto('/support');

  await expect(page.getByRole('heading', { name: '支持公職資料觀測站' })).toBeVisible();
  await expect(page.getByRole('link', { name: '♡ 支持本站' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '支持功能準備中' })).toBeVisible();
  await expect(page.getByText('準備中', { exact: true })).toBeVisible();
  await expect(page.getByText('本站目前不會收集付款資料，也不會建立任何交易。支持功能完成必要準備後，會在本頁更新。')).toBeVisible();
  await expect(page.getByText(/藍新|NewebPay|信用卡|ATM/u)).toHaveCount(0);
  await expect(page.locator('[data-support-amounts]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'support@pow4vote.org' })).toHaveAttribute('href', 'mailto:support@pow4vote.org');
  await expect(page.getByText('未來的支持者不會因付款取得資料收錄、排序、查核、優先處理或政治立場的影響權。')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('data quality limits and current roadmap are public', async ({ page }) => {
  await page.goto('/data-guidance');
  await expect(page.getByRole('heading', { name: '資料品質與限制' })).toBeVisible();
  await expect(page.getByText(/無法保證每筆學經歷、政見與其他文字均已逐筆確認/)).toBeVisible();

  await page.goto('/people/d888dcb7-abda-48fd-8cd0-b973e0cf43e0');
  await expect(page.getByText(/部分人物資料（包含學經歷與政見）由選舉公報等公開來源批次整理/)).toBeVisible();
  await expect(page.getByText(/部分人物資料（包含學經歷與政見）由選舉公報等公開來源批次整理/)).toHaveCount(1);
  await expect(page.getByRole('link', { name: /了解資料品質限制/ }).first()).toHaveAttribute('href', '/data-guidance');

  await page.goto('/about');
  await expect(page.getByRole('heading', { name: '發展規劃' })).toBeVisible();
  await expect(page.getByText(/當選人政見履行情況社群投票/)).toBeVisible();
  await expect(page.getByText(/地區／選舉情境聊天室/)).toBeVisible();
  await expect(page.getByText(/持續校正學經歷/)).toBeVisible();
  await expect(page.getByText(/人物專屬小人圖/)).toBeVisible();
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

test('mobile shell provides compact navigation, search, and overflow-safe controls', { tag: '@mobile-ci' }, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => {
    window.localStorage.setItem('public-office-watch-chat-nudge-seen-at-v1', String(Date.now()));
    window.localStorage.setItem('public-office-watch-language', 'zh-TW');
    window.localStorage.setItem('public-office-watch-theme', 'dark');
  });
  await page.goto('/');

  const mobileHeader = page.locator('[data-mobile-header]');
  await expect(mobileHeader).toBeVisible();
  await expect(page.locator('[data-desktop-header]')).toBeHidden();
  await expect(mobileHeader.getByRole('button', { name: '搜尋' })).toHaveCount(0);
  await expect(mobileHeader.getByRole('button', { name: '更多' })).toHaveCount(0);
  await expect(mobileHeader.locator('[data-mobile-support]')).toHaveAttribute('href', '/support');
  await page.setViewportSize({ width: 320, height: 812 });
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 375, height: 812 });

  const languageToggle = mobileHeader.locator('[data-language-toggle]');
  const themeToggle = mobileHeader.locator('[data-theme-toggle]');
  await expect(languageToggle).toHaveText('EN');
  await languageToggle.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(languageToggle).toHaveText('中');
  await languageToggle.click();
  await expect(page.locator('html')).toHaveAttribute('lang', /^zh-(Hant|TW)$/u);
  await expect(languageToggle).toHaveText('EN');
  await themeToggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('public-office-watch-theme'))).toBe('light');
  await themeToggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const bottomNav = page.locator('[data-mobile-bottom-nav]');
  await expect(bottomNav).toBeVisible();
  await expect(bottomNav.getByText('我的選舉', { exact: true })).toBeVisible();
  await expect(bottomNav.getByText('探索', { exact: true })).toBeVisible();
  await expect(bottomNav.getByText('搜尋', { exact: true })).toBeVisible();
  await expect(bottomNav.getByText('討論', { exact: true })).toBeVisible();
  await expect(bottomNav.getByText('更多', { exact: true })).toBeVisible();

  await bottomNav.getByRole('button', { name: '搜尋' }).click();
  const searchDialog = page.getByRole('dialog', { name: '搜尋' });
  await expect(searchDialog).toBeVisible();
  const mobileSearch = searchDialog.getByPlaceholder('搜尋人物、公司、政黨、選舉、地區');
  await expect(mobileSearch).toBeFocused();
  await searchDialog.getByRole('button', { name: '關閉' }).click();

  await bottomNav.getByRole('button', { name: '探索' }).click();
  const exploreDialog = page.getByRole('dialog', { name: '探索公共資料' });
  await expect(exploreDialog.getByRole('link', { name: '人物', exact: true })).toBeVisible();
  await exploreDialog.getByRole('link', { name: '人物', exact: true }).click();
  await expect(page).toHaveURL(/\/people(?:\?|$)/);
  await expect(exploreDialog).toHaveCount(0);

  await bottomNav.getByRole('button', { name: '更多' }).click();
  const moreDialog = page.getByRole('dialog', { name: '更多功能' });
  await expect(moreDialog.getByRole('link', { name: '資料更新紀錄' })).toBeVisible();
  await expect(moreDialog.getByRole('link', { name: '支持本站' })).toBeVisible();
  await expect(moreDialog.locator('[data-language-toggle]')).toHaveCount(0);
  await expect(moreDialog.locator('[data-theme-toggle]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator('[data-mobile-header]')).toBeHidden();
  await expect(page.locator('[data-mobile-bottom-nav]')).toBeHidden();
  await expect(page.locator('[data-desktop-header]')).toBeVisible();
  await expect.poll(() => page.locator('body').evaluate((element) => element.style.overflow)).toBe('');
});

test('mobile chat stays above navigation and opens from the discussion button', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => {
    localStorage.setItem('public-office-watch-chat-nudge-seen-at-v1', String(Date.now()));
  });
  await page.goto('/');
  const bottomNav = page.locator('[data-mobile-bottom-nav]');
  const navBox = await bottomNav.boundingBox();
  const launcherBox = await page.locator('[data-chat-launcher]').boundingBox();
  expect(navBox).not.toBeNull();
  expect(launcherBox).not.toBeNull();
  expect(launcherBox!.y + launcherBox!.height).toBeLessThanOrEqual(navBox!.y);
  await bottomNav.getByRole('button', { name: '討論' }).click();
  const chatDialog = page.getByRole('dialog', { name: '即時討論' });
  await expect(chatDialog).toBeVisible();
  await chatDialog.getByRole('button', { name: '縮小聊天室' }).click();
  await expect(chatDialog).toBeHidden();
});

test('mobile voting area persists only confirmed choices and treats location as a suggestion', async ({ page }) => {
  const storageKey = 'public-office-watch.voting-region-preference.v1';
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => {
    window.localStorage.setItem('public-office-watch-chat-nudge-seen-at-v1', String(Date.now()));
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
          success({
            coords: {
              latitude: 25.033,
              longitude: 121.5654,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          });
        },
      },
    });
  });
  await page.goto('/');
  await page.evaluate((key) => window.localStorage.removeItem(key), storageKey);
  await page.reload();

  const onboarding = page.locator('[data-voting-region-onboarding]');
  await expect(onboarding.getByText('找出你的選舉資訊')).toBeVisible();
  await onboarding.getByRole('button', { name: '手動設定戶籍投票地區' }).click();

  const dialog = page.getByRole('dialog', { name: '我的投票地區' });
  await expect(dialog.locator('[data-voting-county] option')).toHaveCount(23);
  await expect(dialog.locator('[data-voting-county] option', { hasText: '臺北縣' })).toHaveCount(0);
  await expect(dialog.locator('[data-voting-county] option', { hasText: '桃園縣' })).toHaveCount(0);
  await expect(dialog.locator('[data-voting-county] option', { hasText: '臺中縣' })).toHaveCount(0);
  await expect(dialog.locator('[data-voting-county] option', { hasText: '臺南縣' })).toHaveCount(0);
  await expect(dialog.locator('[data-voting-county] option', { hasText: '高雄縣' })).toHaveCount(0);
  await dialog.locator('[data-voting-county]').selectOption({ label: '臺北市' });
  await dialog.locator('[data-voting-district]').selectOption({ label: '信義區' });
  const villageTrigger = dialog.locator('[data-voting-village-trigger]');
  await expect(villageTrigger).toBeEnabled();
  await villageTrigger.click();
  await dialog.locator('[data-voting-village-search]').fill('西村');
  await expect(dialog.getByRole('listbox').getByRole('option')).toHaveCount(2);
  await dialog.getByRole('option', { name: '西村里', exact: true }).click();
  await expect(villageTrigger).toContainText('西村里');
  await dialog.locator('[data-voting-district]').selectOption({ label: '松山區' });
  await expect(villageTrigger).toBeEnabled();
  await expect(villageTrigger).toContainText('搜尋或選擇村里');
  await dialog.locator('[data-voting-district]').selectOption({ label: '信義區' });
  await expect(villageTrigger).toBeEnabled();
  await villageTrigger.click();
  await dialog.locator('[data-voting-village-search]').fill('西村');
  await dialog.getByRole('option', { name: '西村里', exact: true }).click();
  await dialog.getByRole('button', { name: '儲存投票地區' }).click();

  await expect(page.locator('[data-voting-region-summary]')).toContainText('臺北市');
  const stored = await page.evaluate((key) => window.localStorage.getItem(key), storageKey);
  expect(stored).not.toBeNull();
  expect(stored).not.toContain('latitude');
  expect(stored).not.toContain('longitude');
  expect(JSON.parse(stored!)).toMatchObject({
    village: { id: 'village-63000020001', name: '西村里' },
    source: 'manual',
  });

  await page.reload();
  await expect(page.locator('[data-voting-region-summary]')).toContainText('臺北市');
  const persistedBeforeLocation = await page.evaluate((key) => window.localStorage.getItem(key), storageKey);

  await page.locator('[data-voting-region-summary]').getByRole('button', { name: '變更' }).click();
  const reopenedDialog = page.getByRole('dialog', { name: '我的投票地區' });
  await reopenedDialog.getByRole('button', { name: '使用目前位置' }).click();
  await expect(reopenedDialog.locator('[data-location-suggestion]')).toContainText('偵測到「臺北市 信義區」');
  expect(await page.evaluate((key) => window.localStorage.getItem(key), storageKey)).toBe(persistedBeforeLocation);
  await reopenedDialog.getByRole('button', { name: '是，套用這個地區' }).click();
  await expect(reopenedDialog.locator('[data-voting-county] option:checked')).toHaveText('臺北市');
  await expect(reopenedDialog.locator('[data-voting-district] option:checked')).toHaveText('信義區');
  await expect(reopenedDialog.locator('[data-voting-district] option')).toHaveCount(13);
  await expect(reopenedDialog.locator('[data-voting-village-trigger]')).toBeEnabled();
  await expect(reopenedDialog.locator('[data-voting-village-trigger]')).toContainText('搜尋或選擇村里');
  await expect(reopenedDialog.locator('[data-voting-village-search]')).toBeVisible();
  await expect(reopenedDialog.getByRole('option', { name: '西村里', exact: true })).toBeVisible();
  await reopenedDialog.getByRole('option', { name: '不選村里', exact: true }).click();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), storageKey)).toBe(persistedBeforeLocation);

  await reopenedDialog.getByRole('button', { name: '儲存投票地區' }).click();
  const locationConfirmed = JSON.parse((await page.evaluate((key) => window.localStorage.getItem(key), storageKey))!);
  expect(locationConfirmed.county.name).toBe('臺北市');
  expect(locationConfirmed.district.name).toBe('信義區');
  expect(locationConfirmed.village).toBeUndefined();
  expect(locationConfirmed.source).toBe('confirmed-location');
});

test('mobile voting area onboarding dismissal survives reloads', { tag: '@mobile-ci' }, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => {
    window.localStorage.setItem('public-office-watch-chat-nudge-seen-at-v1', String(Date.now()));
  });
  await page.goto('/');

  const onboarding = page.locator('[data-voting-region-onboarding]');
  await expect(onboarding).toBeVisible();
  await onboarding.getByRole('button', { name: '先看看全國資訊' }).click();
  await expect(onboarding).toBeHidden();
  expect(await page.evaluate(() => window.localStorage.getItem('public-office-watch.voting-region-onboarding-dismissed.v1'))).toBe('true');

  await page.reload();
  await expect(page.locator('[data-voting-region-onboarding]')).toBeHidden();
});

test('mobile browsing is available without a saved voting area', { tag: '@mobile-ci' }, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?region=taipei-city');
  await page.locator('[data-voting-region-onboarding]').getByRole('button', { name: '先看看全國資訊' }).click();
  await expect(page).toHaveURL(/region=national/u);
  const browser = page.locator('[data-mobile-region-browser]');
  await expect(browser).toContainText('正在瀏覽');
  await expect(page.locator('[data-mobile-browse-results]')).toBeVisible();
  await expect(browser.getByRole('button', { name: '回到我的地區' })).toHaveCount(0);
  await browser.getByRole('button', { name: /瀏覽地區/u }).click();
  const sheet = page.getByRole('dialog', { name: '瀏覽地區' });
  await expect(sheet.locator('button[aria-pressed]')).toHaveCount(23);
  await expect(sheet.getByRole('button', { name: '全國總覽' })).toHaveAttribute('aria-pressed', 'true');
  await sheet.getByRole('button', { name: '臺北市', exact: true }).click();
  await expect(browser).toContainText('正在瀏覽 臺北市');
  await expect(page).toHaveURL(/region=taipei-city/u);
  expect(await page.evaluate(() => localStorage.getItem('public-office-watch.voting-region-preference.v1'))).toBeNull();
  await page.reload();
  await expect(browser).toContainText('正在瀏覽 臺北市');
  await expect(page.locator('[data-voting-region-onboarding]')).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

test('mobile explicit browsing takes priority over my election', { tag: '@mobile-ci' }, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => {
    localStorage.setItem('public-office-watch.voting-region-preference.v1', JSON.stringify({
      county: { id: 'new-taipei-city', name: '新北市' },
      district: { id: 'district-65000010', name: '板橋區' },
      source: 'manual',
      confirmedAt: '2026-09-03T00:00:00.000Z',
    }));
  });
  await page.goto('/?region=taipei-city');
  const savedArea = await page.evaluate(() => localStorage.getItem('public-office-watch.voting-region-preference.v1'));
  const browser = page.locator('[data-mobile-region-browser]');
  await expect(page.locator('[data-mobile-my-election]')).toHaveCount(0);
  await expect(page.locator('[data-voting-region-summary]')).toContainText('新北市 板橋區');
  await expect(browser).toContainText('正在瀏覽 臺北市');
  await expect(page.locator('[data-mobile-browse-results]')).toBeVisible();
  await browser.getByRole('button', { name: /瀏覽地區/u }).click();
  await page.getByRole('dialog', { name: '瀏覽地區' }).getByRole('button', { name: '全國總覽' }).click();
  await expect(page).toHaveURL(/region=national/u);
  await expect(page.locator('[data-mobile-my-election]')).toHaveCount(0);
  await browser.getByRole('button', { name: '回到我的地區' }).click();
  await expect(page).toHaveURL((url) => !url.searchParams.has('region'));
  await expect(page.locator('[data-mobile-my-election]')).toBeVisible();
  await expect(page.locator('[data-mobile-browse-results]')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('public-office-watch.voting-region-preference.v1'))).toBe(savedArea);
  await expectNoHorizontalOverflow(page);
});

test('mobile my election uses the saved voting county and keeps research layout on desktop', async ({ page }) => {
  const homePayloads: Array<Record<string, unknown>> = [];
  page.on('request', (request) => {
    if (!request.url().includes('/rest/v1/rpc/home_page_for')) return;
    homePayloads.push(request.postDataJSON() as Record<string, unknown>);
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => {
    window.localStorage.setItem('public-office-watch-chat-nudge-seen-at-v1', String(Date.now()));
    window.localStorage.setItem('public-office-watch.selected-region', 'national');
    window.localStorage.setItem('public-office-watch.voting-region-preference.v1', JSON.stringify({
      county: { id: 'taipei-city', name: '臺北市' },
      district: { id: 'district-63000020', name: '信義區' },
      village: { id: 'village-63000020001', name: '西村里' },
      source: 'manual',
      confirmedAt: '2026-09-03T00:00:00.000Z',
    }));
  });
  await page.goto('/');

  const dashboard = page.locator('[data-mobile-my-election]');
  await expect(dashboard).toBeVisible();
  await expect(page.locator('[data-voting-region-summary]')).toContainText('臺北市 信義區 西村里');
  await expect(dashboard.getByText('下一場投票')).toBeVisible();
  await expect(dashboard.getByRole('heading', { name: '目前相關的選舉' })).toBeVisible();
  await expect(dashboard.getByText('議員選區仍須依正式選區資料確認，不能只用行政區推定。')).toBeVisible();
  await expect(dashboard.getByRole('heading', { name: '已收錄參選人物' })).toBeVisible();
  const mobileCandidateRoster = dashboard.locator('[data-mobile-candidate-roster]');
  const mobileCandidateCards = mobileCandidateRoster.locator('[data-mobile-candidate-card]');
  expect(await mobileCandidateCards.count()).toBeGreaterThan(4);
  const firstMobileCandidateSprite = mobileCandidateCards.first().locator('[data-candidate-sprite]');
  await expect(firstMobileCandidateSprite).toBeVisible();
  expect(await firstMobileCandidateSprite.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(mobileCandidateCards.first().locator('[data-mobile-candidate-status]')).toHaveText(/\S/u);
  await expect(mobileCandidateRoster.locator('[data-mobile-candidate-status]')).toHaveCount(await mobileCandidateCards.count());
  await expect(dashboard.locator('[data-mobile-candidate-roster-hint]')).toContainText('左右滑動查看全部');
  expect(await mobileCandidateRoster.evaluate((element) => element.scrollWidth)).toBeGreaterThan(await mobileCandidateRoster.evaluate((element) => element.clientWidth));
  await expect(dashboard.getByRole('heading', { name: '投票資訊' })).toBeVisible();
  const pollingPlaceStatus = dashboard.locator('[data-polling-place-status]');
  await expect(pollingPlaceStatus.getByText('官方查詢已開放')).toBeVisible();
  await expect(pollingPlaceStatus.getByText('你儲存的戶籍投票地區：臺北市 信義區 西村里')).toBeVisible();
  await expect(pollingPlaceStatus.getByRole('heading', { name: '投票要帶什麼' })).toBeVisible();
  await expect(pollingPlaceStatus.getByText('國民身分證')).toBeVisible();
  await expect(pollingPlaceStatus.getByText('目前位置不能判定你應前往的投票所。')).toBeVisible();
  await expect(pollingPlaceStatus.getByText('開啟後會帶入「臺北市／信義區／西村里」')).toBeVisible();
  const pollingPlaceLink = pollingPlaceStatus.getByRole('link', { name: /前往中選會查投票所/u });
  await expect(pollingPlaceLink).toHaveAttribute('href', /mode=tbox/u);
  await expect(pollingPlaceLink).toHaveAttribute('href', /voter=01/u);
  await expect(pollingPlaceLink).toHaveAttribute('href', /prvCityCode=63000/u);
  await expect(pollingPlaceLink).toHaveAttribute('href', /deptCode=020/u);
  await expect(pollingPlaceLink).toHaveAttribute('href', /liCode=001/u);
  await expect(page.locator('[data-home-research-grid]')).toBeHidden();
  await expect.poll(() => homePayloads.some((payload) => payload.p_region_slug === 'taipei-city')).toBe(true);
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(dashboard).toBeHidden();
  await expect(page.locator('[data-home-research-grid]')).toBeVisible();
});

test('mobile browsing region never overrides the saved voting area', async ({ page }) => {
  const homePayloads: Array<Record<string, unknown>> = [];
  page.on('request', (request) => {
    if (!request.url().includes('/rest/v1/rpc/home_page_for')) return;
    homePayloads.push(request.postDataJSON() as Record<string, unknown>);
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => {
    window.localStorage.setItem('public-office-watch-chat-nudge-seen-at-v1', String(Date.now()));
    window.localStorage.setItem('public-office-watch.selected-region', 'national');
    window.localStorage.setItem('public-office-watch.voting-region-preference.v1', JSON.stringify({
      county: { id: 'new-taipei-city', name: '新北市' },
      district: { id: 'district-65000010', name: '板橋區' },
      source: 'manual',
      confirmedAt: '2026-09-03T00:00:00.000Z',
    }));
  });

  await page.goto('/?region=taipei-city');

  const dashboard = page.locator('[data-mobile-my-election]');
  await expect(dashboard).toHaveCount(0);
  await expect(page.locator('[data-voting-region-summary]')).toContainText('新北市 板橋區');
  await expect(page.locator('[data-mobile-region-browser]')).toContainText('正在瀏覽 臺北市');
  await expect(page.locator('[data-mobile-browse-results]')).toBeVisible();
  await expect.poll(() => homePayloads.some((payload) => payload.p_region_slug === 'new-taipei-city')).toBe(true);
  await expect.poll(() => homePayloads.some((payload) => payload.p_region_slug === 'taipei-city')).toBe(true);

  const storedBeforeReturn = await page.evaluate(() => window.localStorage.getItem('public-office-watch.voting-region-preference.v1'));
  await page.locator('[data-mobile-region-browser]').getByRole('button', { name: '回到我的地區' }).click();
  await expect(page).toHaveURL((url) => !url.searchParams.has('region'));
  await expect(page.locator('[data-mobile-browse-results]')).toHaveCount(0);
  expect(await page.evaluate(() => window.localStorage.getItem('public-office-watch.voting-region-preference.v1'))).toBe(storedBeforeReturn);
  await expect(dashboard.getByText('新北市首長選舉')).toBeVisible();
});

test('desktop voting area is optional, shared, and requests location only after a click', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 768 });
  await page.addInitScript(() => {
    const testWindow = window as Window & { geolocationCallCount: number };
    testWindow.geolocationCallCount = 0;
    window.localStorage.setItem('public-office-watch.voting-region-preference.v1', JSON.stringify({
      county: { id: 'taipei-city', name: '臺北市' },
      district: { id: 'district-63000020', name: '信義區' },
      village: { id: 'village-63000020001', name: '西村里' },
      source: 'manual',
      confirmedAt: '2026-09-03T00:00:00.000Z',
    }));
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition() {
          testWindow.geolocationCallCount += 1;
        },
      },
    });
  });
  await page.goto('/');

  const card = page.locator('[data-desktop-voting-region]');
  await expect(card).toBeVisible();
  await expect(page.locator('[data-next-event-ticker]').locator('[data-desktop-voting-region]')).toBeVisible();
  await expect(card).toContainText('臺北市 信義區 西村里');
  await expect(card.getByRole('link', { name: '切到臺北市' })).toHaveAttribute('href', '/?region=taipei-city');
  const pollingPlaceLink = card.getByRole('link', { name: /投票所/u });
  await expect(pollingPlaceLink).toHaveAttribute('href', /prvCityCode=63000/u);
  await expect(pollingPlaceLink).toHaveAttribute('href', /deptCode=020/u);
  await expect(pollingPlaceLink).toHaveAttribute('href', /liCode=001/u);
  const changeButton = card.getByRole('button', { name: '變更' });
  const changeButtonBox = await changeButton.boundingBox();
  const votingAreaLabelBox = await card.getByText('投票地區', { exact: true }).boundingBox();
  expect(changeButtonBox).not.toBeNull();
  expect(votingAreaLabelBox).not.toBeNull();
  expect(changeButtonBox!.x + changeButtonBox!.width).toBeLessThan(votingAreaLabelBox!.x);
  await expect(changeButton).toHaveCSS('border-bottom-style', 'solid');
  await expect(changeButton).toHaveCSS('text-decoration-line', 'none');
  const eventDetailsBox = await page.locator('[data-next-event-details]').boundingBox();
  const votingRegionBox = await card.boundingBox();
  expect(eventDetailsBox).not.toBeNull();
  expect(votingRegionBox).not.toBeNull();
  expect(votingRegionBox!.x - (eventDetailsBox!.x + eventDetailsBox!.width)).toBeGreaterThan(32);
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 768, height: 768 });
  await expect(card).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  expect(await page.evaluate(() => (window as Window & { geolocationCallCount: number }).geolocationCallCount)).toBe(0);

  await card.getByRole('button', { name: '變更' }).click();
  const dialog = page.getByRole('dialog', { name: '我的投票地區' });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { geolocationCallCount: number }).geolocationCallCount)).toBe(0);
  await dialog.getByRole('button', { name: '使用目前位置' }).click();
  expect(await page.evaluate(() => (window as Window & { geolocationCallCount: number }).geolocationCallCount)).toBe(1);
});

test('homepage uses one scoped payload and stays populated after client-side navigation', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes('/rest/v1/')) apiRequests.push(url.pathname);
  });

  await page.goto('/?region=taipei-city');
  await expect(page.locator('[data-candidate-category-tabs]')).toBeVisible();
  await expect(page.locator('[data-party-seat-row]').first()).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(apiRequests.filter((path) => path.endsWith('/rest/v1/rpc/home_page_for'))).toHaveLength(1);
  expect(apiRequests.some((path) => path.includes('home_candidate_summaries_for'))).toBe(false);
  expect(apiRequests.some((path) => path.includes('current_legislator_party_summary'))).toBe(false);
  expect(apiRequests.some((path) => path.includes('local_office'))).toBe(false);
  expect(apiRequests.some((path) => path.includes('/rest/v1/regions'))).toBe(false);

  apiRequests.length = 0;
  await page.getByRole('link', { name: '◎ 人物', exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/people');
  await page.getByRole('link', { name: '⌂ 首頁', exact: true }).click();
  await expect(page.locator('[data-candidate-category-tabs]')).toBeVisible();
  await expect(page.locator('[data-party-seat-row]').first()).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(apiRequests.some((path) => path.endsWith('/rest/v1/rpc/home_page_for'))).toBe(false);
});

test('detail routes use bounded page payloads with only reviewed supplemental reads', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes('/rest/v1/')) {
      apiRequests.push(url.pathname.replace(/^.*\/rest\/v1\//u, ''));
    }
  });

  await page.goto('/people/d888dcb7-abda-48fd-8cd0-b973e0cf43e0');
  await expect(page.getByRole('heading', { name: '王世堅', exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(apiRequests.filter((path) => path === 'rpc/person_profiles_for')).toHaveLength(1);
  expect(apiRequests.filter((path) => path === 'rpc/platform_fulfillment_results')).toHaveLength(4);
  expect(apiRequests.filter((path) => path === 'rpc/person_feedback_priorities')).toHaveLength(1);
  expect(new Set(apiRequests)).toEqual(new Set([
    'rpc/person_profiles_for',
    'rpc/platform_fulfillment_results',
    'rpc/person_feedback_priorities',
  ]));

  apiRequests.length = 0;
  await page.goto('/elections/events/2026-2026-11-28-local');
  await expect(page.getByRole('heading', { name: '大選總覽' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(apiRequests.filter((path) => path === 'rpc/election_index_page')).toHaveLength(1);
  expect(apiRequests.some((path) => path === 'elections' || path === 'election_race_summaries')).toBe(false);

  apiRequests.length = 0;
  await page.goto('/elections/races/1ddcde35-f1ed-4e38-8652-ceb5e616f91a');
  await expect(page.getByRole('heading', { name: '選區項目細節' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(apiRequests).toEqual(['rpc/race_page_for']);

  apiRequests.length = 0;
  await page.goto('/regions/taipei-city');
  await expect(page.getByRole('heading', { name: '臺北市', exact: true, level: 1 })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(apiRequests).toEqual(['rpc/region_page_for']);
});

test('race load failures remain errors instead of becoming not-found pages', async ({ page }) => {
  await page.route('**/rest/v1/rpc/race_page_for', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Temporary upstream failure' }),
    });
  });

  await page.goto('/elections/races/1ddcde35-f1ed-4e38-8652-ceb5e616f91a');

  await expect(page.getByText('公開資料暫時無法載入，請稍後再試。')).toBeVisible();
  await expect(page.getByRole('button', { name: '重新載入' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '找不到選區項目' })).toHaveCount(0);
});

test('public participation reads do not create an anonymous session', async ({ page }) => {
  let anonymousSignupCount = 0;
  const participationRequests: Array<{ name: string; body: Record<string, unknown> }> = [];

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/auth/v1/signup')) {
      anonymousSignupCount += 1;
      return;
    }

    const name = url.pathname.match(
      /\/rest\/v1\/rpc\/(get_region_issue_response|person_feedback_priorities|get_person_feedback_own_submissions)$/u,
    )?.[1];
    if (name) {
      participationRequests.push({
        name,
        body: request.postDataJSON() as Record<string, unknown>,
      });
    }
  });

  await page.goto('/?region=taipei-city');
  await page.waitForLoadState('networkidle');

  await page.goto('/people/d888dcb7-abda-48fd-8cd0-b973e0cf43e0');
  await expect(page.getByRole('heading', { name: '王世堅', exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(anonymousSignupCount).toBe(0);
  expect(participationRequests.some(({ name }) => name === 'get_region_issue_response')).toBe(false);
  expect(participationRequests.some(({ name }) => name === 'person_feedback_priorities')).toBe(true);
  expect(participationRequests.some(({ name }) => name === 'get_person_feedback_own_submissions')).toBe(false);
  for (const { body } of participationRequests) {
    expect(body).not.toHaveProperty('p_participant_token');
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


test('parties overview loads contribution counts with one aggregate request', async ({ page }) => {
  const contributionRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes('party_company_contribution')) {
      contributionRequests.push(url.pathname);
    }
  });

  await page.goto('/parties');
  await expect(
    page.getByRole('heading', { name: '政黨與政治獻金' }).nth(1),
  ).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(contributionRequests).toEqual([
    '/rest/v1/rpc/party_company_contribution_counts',
  ]);
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
  await page.route(/\/rest\/v1\/rpc\/person_profiles_for(?:\?|$)/, async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'test failure' }) });
  });

  await page.goto('/people/d888dcb7-abda-48fd-8cd0-b973e0cf43e0');

  await expect(page.locator('[data-data-state="loadError"]')).toContainText('人物資料載入失敗');
  await expect(page.locator('[data-data-state="uncollected"]')).toHaveCount(0);
});

test('home candidate load failures are distinct from an empty roster', async ({ page }) => {
  await page.route(/\/rest\/v1\/rpc\/home_page_for(?:\?|$)/, async (route) => {
    const body = route.request().postDataJSON() as { p_region_slug?: string | null };
    if (body.p_region_slug !== 'taipei-city') {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'test failure' }) });
  });

  await page.goto('/');
  await page.locator('[aria-label="選取 臺北市"]').first().click();

  await expect(page.locator('[data-candidate-load-error]')).toContainText('參選人物載入失敗');
  await expect(page.getByText('目前沒有參選人物資料', { exact: true })).toHaveCount(0);
});

test('selecting another county city resets the candidate category to mayor', async ({ page }) => {
  await page.goto('/');
  await page.locator('[aria-label="選取 臺北市"]').first().click();

  const activeCandidateTab = page.locator('[data-candidate-category-tabs] button[aria-pressed="true"]');
  await page.locator('[data-candidate-category-tabs]').getByRole('button', { name: /市議員/ }).click();
  await expect(activeCandidateTab).toContainText('市議員');

  await page.locator('[aria-label="選取 新北市"]').first().click();

  await expect(activeCandidateTab).toContainText('市長');
  await expect(page).not.toHaveURL(/candidateCategory=/);
});


test('county highlight panel provides a distinct background for every county city', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-national-overview]')).toBeVisible();
  await expect(page.locator('main nav').first().locator('button').nth(1)).toBeVisible();

  const highlightPanel = page.locator('[data-region-highlight]');

  for (const county of countyHighlightTargets) {
    const countyControl = page.locator('[aria-label="選取 ' + county.label + '"]').first();
    await countyControl.press('Enter');
    await expect(highlightPanel).toHaveAttribute('data-region-highlight', county.id);
    await expect(countyControl).toHaveAttribute('aria-pressed', 'true');

    const highlightImage = highlightPanel.locator('img').first();
    await expect(highlightImage).toHaveAttribute('src', new RegExp('/assets/regions/' + county.id + '-day\\.webp\\?v=2$'));
  }

  await expectNoHorizontalOverflow(page);
});

test('homepage defaults to the nationwide overview', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('[data-national-overview]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '全國', exact: true })).toBeVisible();
  await expect(page.locator('[data-region-highlight]')).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test('homepage restores a remembered nationwide view', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.setItem('public-office-watch.selected-region', 'national'));
  await page.reload();

  await expect(page.locator('[data-national-overview]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '全國', exact: true })).toBeVisible();
  await expect(page.locator('[data-region-highlight]')).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test('opening chat stays read-only until name and rules are accepted', async ({ page }) => {
  let anonymousSignupCount = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/auth/v1/signup')) anonymousSignupCount += 1;
  });
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
  await expect(page.getByRole('button', { name: '開始聊天', exact: true })).toBeVisible();
  expect(anonymousSignupCount).toBe(0);
  await expect(page.getByText('正在讀取最近訊息…', { exact: true })).toHaveCount(0);
  await expect(page.getByText('操作未完成，請稍後再試。', { exact: true })).toHaveCount(0);
});

test('chat creates a CAPTCHA-protected anonymous session only after consent', async ({ page }) => {
  const signupBodies: Record<string, unknown>[] = [];
  await page.addInitScript(() => {
    Object.defineProperty(window, 'turnstile', {
      configurable: true,
      value: {
        render(_container: HTMLElement, options: { callback(token: string): void }) {
          queueMicrotask(() => options.callback('chat-consent-turnstile-token'));
          return 'chat-consent-widget';
        },
        remove() {},
      },
    });
  });
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/auth/v1/signup')) {
      signupBodies.push(request.postDataJSON() as Record<string, unknown>);
    }
  });
  await page.route('**/rest/v1/rpc/chat_messages', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
  await page.route('**/functions/v1/chat-api', async (route) => {
    const body = route.request().postDataJSON() as { action?: string; displayName?: string };
    expect(['set-profile', 'get-profile']).toContain(body.action);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        profile: {
          public_code: 'TEST01',
          current_display_name: body.displayName ?? '測試使用者',
          terms_version: '2026-07-29-v1',
          terms_accepted_at: '2026-08-27T12:00:00.000Z',
          display_name_updated_at: '2026-08-27T12:00:00.000Z',
          status: 'active',
          muted_until: null,
        },
      }),
    });
  });

  await page.goto('/');
  await page.locator('[data-chat-launcher]').click();
  await expect(page.getByText('目前還沒有訊息。', { exact: true })).toBeVisible();
  await expect(page.getByText('即時連線重新建立中…', { exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: '設定聊天名稱' }).fill('測試使用者');
  await page.getByRole('checkbox', { name: /我了解發言將公開顯示/ }).check();
  expect(signupBodies).toHaveLength(0);
  await page.getByRole('button', { name: '開始聊天', exact: true }).click();

  await expect.poll(() => signupBodies.length).toBe(1);
  expect(signupBodies[0]).toMatchObject({
    gotrue_meta_security: { captcha_token: 'chat-consent-turnstile-token' },
  });
});
test('explicit nationwide selection shows the announced referendum and its pending-vote details', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /全國總覽/ }).click();

  await expect(page.locator('[data-national-overview]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '全國', exact: true })).toBeVisible();
  const electionTiming = page.locator('[data-home-election-timing] > div');
  await expect(electionTiming).toHaveCount(2);
  const electionTimingStyles = await electionTiming.evaluateAll((items) => items.map((item) => {
    const styles = getComputedStyle(item);
    return {
      background: styles.backgroundColor,
      borderWidth: styles.borderTopWidth,
    };
  }));
  expect(electionTimingStyles.every((styles) => styles.background === 'rgba(0, 0, 0, 0)')).toBe(true);
  expect(electionTimingStyles.every((styles) => styles.borderWidth === '0px')).toBe(true);
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
  const referendumItems = page.locator('[data-national-referendum-items]');
  await expect(referendumItems.getByText('全國性公民投票第22案', { exact: true })).toHaveCount(0);
  await expect(referendumItems.getByRole('heading', { name: '你是否支持政府使用「核電」振興經濟，以廢除「非核家園」的能源政策？', exact: true })).toBeVisible();
  await expect(referendumItems.getByText('待投票', { exact: true })).toBeVisible();
  await expect(referendumItems.getByText('投票日：2026-11-28', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /全國總覽/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\?region=national$/);

  await referendumItems.getByRole('link', { name: /你是否支持政府使用「核電」/ }).click();
  await expect(page).toHaveURL(/\/elections\/races\//);
  await expect(page.getByRole('heading', { level: 1, name: '全國性公民投票第22案', exact: true })).toBeVisible();
  await expect(page.getByText('待投票', { exact: true })).toBeVisible();
  await expect(page.getByText('公民投票資訊', { exact: true })).toBeVisible();
  await expect(page.getByText('你是否支持政府使用「核電」振興經濟，以廢除「非核家園」的能源政策？', { exact: true })).toBeVisible();
  await expect(page.locator('[data-referendum-pending]')).toContainText('預定於 2026-11-28 舉行投票');
  await expect(page.getByText('投票人數', { exact: true })).toHaveCount(0);
});

test('first issue write obtains Turnstile clearance and uses the participation proxy', async ({ page }) => {
  let challengeCalls = 0;
  let submitCalls = 0;
  await page.addInitScript(() => {
    window.localStorage.removeItem('public-office-watch-participation-clearance-v1');
    Object.defineProperty(window, 'turnstile', {
      configurable: true,
      value: {
        render(_container: HTMLElement, options: { callback(token: string): void }) {
          queueMicrotask(() => options.callback('browser-smoke-turnstile-token'));
          return 'browser-smoke-widget';
        },
        remove() {},
      },
    });
  });
  await page.route('**/api/participation/challenge', async (route) => {
    challengeCalls += 1;
    expect(route.request().postDataJSON()).toEqual({ token: 'browser-smoke-turnstile-token' });
    await route.fulfill({ status: 204 });
  });
  await page.route('**/api/participation/submit', async (route) => {
    submitCalls += 1;
    const authorization = await route.request().headerValue('authorization');
    expect(authorization).toMatch(/^Bearer .+/u);
    const body = route.request().postDataJSON() as {
      action?: string;
      regionId?: string;
      issueIds?: string[];
    };
    expect(body.action).toBe('region-issue');
    expect(body.regionId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(body.issueIds?.length).toBeGreaterThan(0);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ responseStatus: 'accepted' }),
    });
  });

  await page.goto('/?region=national');
  const issueFrame = page.getByRole('heading', { name: '全國議題關注' }).locator('xpath=ancestor::section[1]');
  await expect(issueFrame.locator('input[type="checkbox"]').first()).toBeVisible();
  if (await issueFrame.locator('input[type="checkbox"]:checked').count() === 0) {
    await issueFrame.locator('input[type="checkbox"]').first().check();
  }
  await issueFrame.getByRole('button', { name: /送出選擇|更新選擇/ }).click();
  await expect(issueFrame.getByText('已更新你的選擇。', { exact: true })).toBeVisible();
  expect(challengeCalls).toBe(1);
  expect(submitCalls).toBe(1);
});

test('homepage quick select exposes the six municipalities and seat links carry people filters', async ({ page }) => {
  await page.goto('/?region=taipei-city');

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
    const styles = getComputedStyle(button);
    return { top: box.top, bottom: box.bottom, borderWidth: styles.borderTopWidth };
  }));
  expect(offshoreButtonBoxes).toHaveLength(3);
  expect(offshoreButtonBoxes.every((box) => box.borderWidth === '0px')).toBe(true);
  expect(offshoreButtonBoxes[0].top - (offshoreRailBox?.y ?? 0)).toBeGreaterThan(20);
  expect((offshoreRailBox?.y ?? 0) + (offshoreRailBox?.height ?? 0) - offshoreButtonBoxes[2].bottom).toBeGreaterThan(20);
  await expect(page.locator('[data-main-island-map] > g')).toHaveAttribute('transform', /scale\(0\.93 1\.05\)/);
  const readIslandLayoutRatio = async () => {
    const railBox = await page.locator('[data-offshore-rail]').boundingBox();
    const mainIslandBox = await page.locator('[data-main-island-map]').boundingBox();
    expect(railBox).not.toBeNull();
    expect(mainIslandBox).not.toBeNull();
    return (railBox?.width ?? 0) / (mainIslandBox?.width ?? 1);
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-main-island-map]')).toBeHidden();
  await expect(page.locator('[data-mobile-region-browser]')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  const compactIslandLayoutRatio = await readIslandLayoutRatio();
  await page.setViewportSize({ width: 1920, height: 1080 });
  const wideIslandLayoutRatio = await readIslandLayoutRatio();
  expect(Math.abs(compactIslandLayoutRatio - wideIslandLayoutRatio)).toBeLessThan(0.02);
  await page.setViewportSize({ width: 1440, height: 900 });
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
  await page.goto('/?region=taipei-city');

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
  await expect(viewAllCandidates).toHaveText(`查看目前已收錄 ${councilorCandidateCount} 位公開人選 ›`);
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
  await expect(viewAllCandidates).toHaveText('查看目前已收錄 6 位公開人選 ›');
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

  const columnHeights = await page.locator('[data-home-research-grid] > section').evaluateAll((columns) => columns.map((column) => column.getBoundingClientRect().height));
  const heightDifference = Math.max(...columnHeights) - Math.min(...columnHeights);
  expect(heightDifference).toBeLessThanOrEqual(1);
  const columnOverflow = await page.locator('[data-home-research-grid] > section').evaluateAll((columns) => columns.map((column) => column.scrollHeight - column.clientHeight));
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
  const overviewBarColor = await partyFrame.locator('[data-party-seat-segment]').first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  const firstPartyBarColor = await partyFrame.locator('[data-party-seat-bar]').first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(firstPartyBarColor).toBe(overviewBarColor);
});

test('homepage candidate category district and carousel position survive person navigation and back', async ({ page }) => {
  await page.goto('/?region=taipei-city');

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
  await page.goto('/?region=taipei-city');

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
  await expect(page.locator('[data-current-region]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-current-region]')).toHaveCount(0);
  await page.goBack();

  await expect(page).toHaveURL(/\?region=taichung-city$/);
  await expect(page.locator('[data-region-highlight]')).toHaveAttribute('data-region-highlight', 'county-66000');
});

test('homepage falls back safely when the region query is unknown', async ({ page }) => {
  await page.goto('/?region=not-a-region');

  await expect(page.locator('[data-national-overview]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '全國', exact: true })).toBeVisible();
  await expect(page.locator('[data-region-highlight]')).toHaveCount(0);
});

test('people filters, pagination, and scroll position survive profile navigation and browser back', async ({ page }) => {
  await page.goto('/people?status=current&page=2');

  const profileLink = page.locator('main a[href^="/people/"]').last();
  await profileLink.scrollIntoViewIfNeeded();
  await expect(profileLink).toBeVisible();
  const peopleScrollY = await page.evaluate(() => window.scrollY);
  expect(peopleScrollY).toBeGreaterThan(0);
  await profileLink.click();
  await expect(page).toHaveURL(/\/people\/[^/?]+$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(24);
  await page.goBack();

  await expect(page).toHaveURL(/\/people\?status=current&page=2$/);
  await expect.poll(
    () => page.evaluate((expected) => Math.abs(window.scrollY - expected), peopleScrollY),
  ).toBeLessThan(24);
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
    await expect(page.getByText('候選名冊').or(page.getByText('公民投票資訊'))).toBeVisible();
    await expect(page.locator('[data-election-breadcrumb] li')).toHaveCount(4);
    await expect(page.locator('[data-election-breadcrumb] [aria-current="page"]')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(filteredEventUrl);
  }

  await expectNoHorizontalOverflow(page);
});
