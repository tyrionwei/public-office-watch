import { expect, test } from '@playwright/test';

const expectedSupabaseOrigin = new URL(process.env.VITE_SUPABASE_URL ?? '').origin;
const knownPersonPath = '/people/e5e573d6-00f5-47b1-8e3b-55480e25fced';
const knownRacePath = '/elections/races/af72236d-da9b-42c4-bdb0-98f69c60b539';
const staleFallbackText = [
  'Loading public data...',
  'Load failed',
  'Region not found',
  'Race not found',
  '載入失敗',
  '找不到此選舉',
];

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test('production routes load real public data without application failures', async ({
  page,
  request,
}) => {
  const apiRequests: string[] = [];
  const apiFailures: string[] = [];
  const browserFailures: string[] = [];
  const requestStartedAt = new Map<string, number>();
  const homePageLatencies: number[] = [];

  page.on('pageerror', (error) => {
    browserFailures.push(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserFailures.push(`console: ${message.text()}`);
    }
  });
  page.on('request', (request) => {
    if (new URL(request.url()).origin === expectedSupabaseOrigin) {
      requestStartedAt.set(request.url(), Date.now());
    }
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin !== expectedSupabaseOrigin) return;
    apiRequests.push(url.pathname);
    if (url.pathname.endsWith('/rpc/home_page_for')) {
      const startedAt = requestStartedAt.get(response.url());
      if (startedAt !== undefined) homePageLatencies.push(Date.now() - startedAt);
    }
    if (response.status() >= 400) {
      apiFailures.push(`${response.status()} ${url.pathname}${url.search}`);
    }
  });
  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    const failure = request.failure()?.errorText ?? 'request failed';
    if (url.origin === expectedSupabaseOrigin && failure !== 'net::ERR_ABORTED') {
      apiFailures.push(`${failure} ${url.pathname}${url.search}`);
    }
  });

  const homeApiResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.origin === expectedSupabaseOrigin &&
      url.pathname.endsWith('/rpc/home_page_for')
    );
  });
  const homeResponse = await page.goto('/');
  expect(homeResponse).not.toBeNull();
  const homeHeaders = homeResponse?.headers() ?? {};
  expect(homeHeaders['content-security-policy']).toContain("default-src 'self'");
  expect(homeHeaders['strict-transport-security']).toBe('max-age=31536000');
  expect(homeHeaders['permissions-policy']).toBe('camera=(), geolocation=(self), microphone=(), payment=(), usb=()');
  await expect(page.getByRole('heading', { name: '公職資料觀測站' })).toBeVisible();
  const homeApiResponse = await homeApiResponsePromise;
  expect(homeApiResponse.ok()).toBe(true);
  for (let sample = 1; sample < 3; sample += 1) {
    const reloadedApiResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.origin === expectedSupabaseOrigin &&
        url.pathname.endsWith('/rpc/home_page_for')
      );
    });
    await page.reload();
    const reloadedApiResponse = await reloadedApiResponsePromise;
    expect(reloadedApiResponse.ok()).toBe(true);
  }

  await page.goto('/regions/taipei-city');
  await expect(page.locator('main').first()).toContainText(/臺北市|台北市/);

  await page.goto('/elections');
  await expect(page.getByRole('heading', { name: '依年份選擇大選' })).toBeVisible();
  await expect(page.locator('main a[href^="/elections/events/"]').first()).toBeVisible();

  await page.goto('/elections/events/2022-2022-11-26-local');
  await expect(page.getByRole('heading', { name: '大選總覽' })).toBeVisible();

  await page.goto(knownRacePath);
  const raceBadgeLabels = await page.locator('[data-race-badges] > span').allTextContents();
  expect(raceBadgeLabels.length).toBeGreaterThan(1);
  expect(new Set(raceBadgeLabels).size).toBe(raceBadgeLabels.length);

  await page.goto('/people');
  const profileLinks = page.locator('main a[href^="/people/"]');
  await expect(profileLinks.first()).toBeVisible();
  const profileHref = await profileLinks.first().getAttribute('href');
  expect(profileHref).toBeTruthy();

  await page.goto(profileHref ?? '/people');
  await expect(page.locator('main h1, main h2').first()).toBeVisible();

  await page.goto('/parties');
  await expect(page.locator('main a[href^="/parties/"]').first()).toBeVisible();

  const searchInput = page.getByPlaceholder('搜尋人物、公司、政黨、選舉、地區');
  await searchInput.fill('台北');
  const searchResults = page.getByTestId('global-search-results').or(
    page.locator('#global-search').locator('xpath=../following-sibling::div'),
  );
  await expect(searchResults).toBeVisible();
  await expect(searchResults.getByText(/臺北|台北/).first()).toBeVisible();
  const regionSearchLinks = searchResults.locator('a[href^="/regions/"]');
  await expect(regionSearchLinks.first()).toHaveAttribute('href', '/regions/taipei-city');
  expect(await regionSearchLinks.count()).toBeLessThanOrEqual(4);
  await regionSearchLinks.first().click();
  await expect(page.locator('main h1')).toHaveText(/臺北市|台北市/);
  await expect(page.getByRole('heading', { name: '找不到地區' })).toHaveCount(0);

  for (const path of [knownPersonPath, knownRacePath]) {
    const response = await request.get(path, {
      headers: { accept: 'text/html' },
    });
    const html = await response.text();

    expect(response.status()).toBe(200);
    expect(html).toContain('data-server-rendered-fallback="true"');
    for (const staleText of staleFallbackText) {
      expect(html).not.toContain(staleText);
    }
  }

  for (const path of [
    '/people/00000000-0000-0000-0000-000000000000',
    '/elections/races/00000000-0000-0000-0000-000000000000',
  ]) {
    const response = await request.get(path, {
      headers: { accept: 'text/html' },
    });
    const html = await response.text();

    expect(response.status()).toBe(404);
    expect(html).toContain('content="noindex,nofollow"');
  }

  await page.waitForTimeout(500);
  expect(apiRequests.length).toBeGreaterThan(0);
  expect(apiFailures).toEqual([]);
  expect(browserFailures).toEqual([]);
  expect(homePageLatencies.length).toBeGreaterThanOrEqual(3);
  const sortedHomePageLatencies = [...homePageLatencies].sort((left, right) => left - right);
  expect(sortedHomePageLatencies[Math.floor(sortedHomePageLatencies.length / 2)]).toBeLessThan(1_000);
  expect(Math.max(...sortedHomePageLatencies)).toBeLessThan(2_500);
});


test('production mobile voting area maps a neighborhood without sending it to Supabase', async ({ page }) => {
  const pollingRequests: Array<{ url: string; payload: Record<string, unknown> }> = [];
  const apiFailures: string[] = [];
  const browserFailures: string[] = [];

  page.on('pageerror', (error) => {
    browserFailures.push(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserFailures.push(`console: ${message.text()}`);
    }
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== expectedSupabaseOrigin) return;
    if (url.pathname.endsWith('/rpc/polling_places_for_village')) {
      pollingRequests.push({
        url: request.url(),
        payload: request.postDataJSON() as Record<string, unknown>,
      });
    }
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === expectedSupabaseOrigin && response.status() >= 400) {
      apiFailures.push(`${response.status()} ${url.pathname}${url.search}`);
    }
  });
  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    const failure = request.failure()?.errorText ?? 'request failed';
    if (url.origin === expectedSupabaseOrigin && failure !== 'net::ERR_ABORTED') {
      apiFailures.push(`${failure} ${url.pathname}${url.search}`);
    }
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => {
    window.localStorage.setItem('public-office-watch-chat-nudge-seen-at-v1', String(Date.now()));
  });
  await page.goto('/');

  const onboarding = page.locator('[data-voting-region-onboarding]');
  await onboarding.getByRole('button', { name: '手動設定戶籍投票地區' }).click();
  const dialog = page.getByRole('dialog', { name: '我的投票地區' });
  await dialog.locator('[data-voting-county]').selectOption({ label: '新北市' });
  await dialog.locator('[data-voting-district]').selectOption({ label: '石門區' });
  const villageTrigger = dialog.locator('[data-voting-village-trigger]');
  await villageTrigger.click();
  await dialog.locator('[data-voting-village-search]').fill('老梅');
  await dialog.getByRole('option', { name: '老梅里', exact: true }).click();
  await dialog.getByRole('button', { name: '儲存投票地區' }).click();

  const dashboard = page.locator('[data-mobile-my-election]');
  await expect(dashboard).toBeVisible();
  await expect(page.locator('[data-voting-region-summary]')).toContainText('新北市 石門區 老梅里');
  const pollingPlaceButton = dashboard.getByRole('button', { name: '查看投開票所' });
  await pollingPlaceButton.click();
  const pollingPlacePanel = dashboard.locator('[data-my-polling-place]');
  await expect(pollingPlacePanel).toBeVisible();

  const neighborhoodInput = pollingPlacePanel.locator('[data-polling-neighborhood]');
  await neighborhoodInput.fill('15');
  await expect(pollingPlacePanel.getByText('第 0004 投開票所', { exact: true })).toBeVisible();
  await expect(pollingPlacePanel.getByText('第 0003 投開票所', { exact: true })).toHaveCount(0);
  await expect.poll(() => pollingRequests.length).toBeGreaterThan(0);
  for (const request of pollingRequests) {
    expect(request.url).not.toContain('neighborhood');
    expect(Object.keys(request.payload).sort()).toEqual(['p_event_key', 'p_village_code']);
  }

  const savedPreference = await page.evaluate(() => (
    window.localStorage.getItem('public-office-watch.voting-region-preference.v1')
  ));
  expect(savedPreference).not.toBeNull();
  expect(JSON.parse(savedPreference!).neighborhood).toBe(15);

  await page.reload();
  await expect(dashboard).toBeVisible();
  await dashboard.getByRole('button', { name: '查看投開票所' }).click();
  await expect(dashboard.locator('[data-polling-neighborhood]')).toHaveValue('15');
  await expect(dashboard.getByText('第 0004 投開票所', { exact: true })).toBeVisible();

  const storedBeforeBrowse = await page.evaluate(() => (
    window.localStorage.getItem('public-office-watch.voting-region-preference.v1')
  ));
  await page.goto('/?region=taipei-city');
  await expect(page.locator('[data-mobile-my-election]')).toHaveCount(0);
  await expect(page.locator('[data-mobile-region-browser]')).toContainText('正在瀏覽 臺北市');
  expect(await page.evaluate(() => (
    window.localStorage.getItem('public-office-watch.voting-region-preference.v1')
  ))).toBe(storedBeforeBrowse);
  await expectNoHorizontalOverflow(page);

  expect(apiFailures).toEqual([]);
  expect(browserFailures).toEqual([]);
});
