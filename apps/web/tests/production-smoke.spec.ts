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
