import { expect, test } from '@playwright/test';

const expectedSupabaseOrigin = new URL(process.env.VITE_SUPABASE_URL ?? '').origin;

test('production routes load real public data without Supabase failures', async ({ page }) => {
  const apiRequests: string[] = [];
  const apiFailures: string[] = [];

  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin !== expectedSupabaseOrigin) return;
    apiRequests.push(url.pathname);
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

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '公職資料觀測站' })).toBeVisible();

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
  await expect(searchResults.getByText(/台北/).first()).toBeVisible();

  await page.waitForTimeout(500);
  expect(apiRequests.length).toBeGreaterThan(0);
  expect(apiFailures).toEqual([]);
});
