import { expect, test, type Page } from '@playwright/test';
import { startStateFixture } from './fixtures/ui-state/server.mjs';

declare global {
  interface Window {
    __publicFlows: {
      navigations: number;
      searchMode: 'success' | 'empty' | 'error';
      deferSearch: boolean;
      searches: Array<{ query: string; resolve(): void; reject(): void }>;
      failPeople: boolean;
      deferPeople: boolean;
      peopleLoads: Array<{
        filters: Record<string, string>; page: number; size: number;
        resolve(): void; reject(): void; rejectRange(): void;
      }>;
    };
  }
}

let fixture: Awaited<ReturnType<typeof startStateFixture>>;
let pageErrors: string[];
let outsideRequests: string[];

test.beforeAll(async () => { fixture = await startStateFixture(); });
test.afterAll(async () => { await fixture?.close(); });
test.beforeEach(async ({ page }) => {
  pageErrors = [];
  outsideRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== fixture.origin) {
      outsideRequests.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
});
test.afterEach(() => {
  expect(pageErrors).toEqual([]);
  expect(outsideRequests, 'All data is synthetic and must remain inside the fixture').toEqual([]);
});

const input = (page: Page) => page.getByRole('searchbox');
const results = (page: Page) => page.getByTestId('global-search-results');
const location = (page: Page) => page.locator('[data-fixture-location]');
const people = (page: Page) => page.locator('main a[href^="/people/"]');
async function search(page: Page, query = 'Alpha') {
  await input(page).fill(query);
  await expect(results(page).getByRole('link').first()).toHaveText(new RegExp(query + ' result 1'));
}
async function openPeople(page: Page, route: string, flags = '') {
  await page.goto(fixture.origin + '/?people&route=' + encodeURIComponent(route) + flags);
}

test('search keeps Tab and Shift+Tab inside results and Enter opens the focused result', async ({ page }) => {
  await page.goto(fixture.origin + '/?search');
  await search(page);
  await input(page).press('Tab');
  await page.waitForTimeout(250); // Exceeds the old blur timer that removed the focused link.
  await expect(results(page).getByRole('link').first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(input(page)).toBeFocused();
  await expect(results(page)).toBeVisible();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(location(page)).toHaveText('/people/Alpha1');
  await expect(results(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.__publicFlows.navigations)).toBe(1);
});

test('Escape returns search focus, typing reopens results, and leaving closes them', async ({ page }) => {
  await page.goto(fixture.origin + '/?search');
  await search(page);
  await input(page).press('Tab');
  await page.keyboard.press('Escape');
  await expect(input(page)).toBeFocused();
  await expect(results(page)).toHaveCount(0);
  await search(page, 'Beta');
  await page.getByRole('button', { name: 'Outside search' }).click();
  await expect(results(page)).toHaveCount(0);
  await input(page).focus();
  await expect(results(page)).toBeVisible();
  await results(page).getByRole('link').nth(1).click();
  await expect(location(page)).toHaveText('/people/Beta2');
});

test('search failure has a retry action and retries the same query without showing an empty result', async ({ page }) => {
  await page.goto(fixture.origin + '/?search');
  await page.evaluate(() => { window.__publicFlows.searchMode = 'error'; });
  await input(page).fill('Alpha');
  await expect(results(page).getByRole('alert')).toContainText('search.loadError');
  await expect(results(page)).not.toContainText('search.noResults');
  await page.evaluate(() => { window.__publicFlows.searchMode = 'success'; });
  await results(page).getByRole('button', { name: 'search.retry' }).click();
  await expect(results(page).getByRole('link').first()).toContainText('Alpha result 1');
  await expect(input(page)).toBeFocused();
  expect(await page.evaluate(() => window.__publicFlows.searches.map(load => load.query))).toEqual(['Alpha', 'Alpha']);
});

test('successful empty search and short queries remain distinct from a failed search', async ({ page }) => {
  await page.goto(fixture.origin + '/?search');
  await page.evaluate(() => { window.__publicFlows.searchMode = 'empty'; });
  await input(page).fill('Empty');
  await expect(results(page)).toContainText('search.noResults');
  await expect(results(page).getByRole('alert')).toHaveCount(0);
  await input(page).fill('A');
  await expect(results(page)).toContainText('search.minChars');
  expect(await page.evaluate(() => window.__publicFlows.searches.length)).toBe(1);
  await input(page).fill('');
  await expect(page.getByTestId('global-search-examples')).toBeVisible();
});

test('late search failure cannot replace the current successful query', async ({ page }) => {
  await page.goto(fixture.origin + '/?search');
  await page.evaluate(() => { window.__publicFlows.deferSearch = true; });
  await input(page).fill('Alpha');
  await expect.poll(() => page.evaluate(() => window.__publicFlows.searches.length)).toBe(1);
  await input(page).fill('Beta');
  await expect.poll(() => page.evaluate(() => window.__publicFlows.searches.length)).toBe(2);
  await page.evaluate(() => { window.__publicFlows.searches[1].resolve(); });
  await expect(results(page).getByRole('link').first()).toContainText('Beta result 1');
  await page.evaluate(() => { window.__publicFlows.searches[0].reject(); });
  await expect(results(page)).not.toContainText('Alpha');
  await expect(results(page).getByRole('alert')).toHaveCount(0);
  await expect(results(page).getByRole('link').first()).toContainText('Beta result 1');
});

test('late search success cannot conceal the current query failure or change its retry', async ({ page }) => {
  await page.goto(fixture.origin + '/?search');
  await page.evaluate(() => { window.__publicFlows.deferSearch = true; });
  await input(page).fill('Alpha');
  await expect.poll(() => page.evaluate(() => window.__publicFlows.searches.length)).toBe(1);
  await input(page).fill('Beta');
  await expect.poll(() => page.evaluate(() => window.__publicFlows.searches.length)).toBe(2);
  await page.evaluate(() => { window.__publicFlows.searches[1].reject(); window.__publicFlows.searches[0].resolve(); });
  await expect(results(page).getByRole('alert')).toContainText('search.loadError');
  await expect(results(page).getByRole('link')).toHaveCount(0);
  await results(page).getByRole('button', { name: 'search.retry' }).click();
  await expect.poll(() => page.evaluate(() => window.__publicFlows.searches.length)).toBe(3);
  expect(await page.evaluate(() => window.__publicFlows.searches[2].query)).toBe('Beta');
  await page.evaluate(() => { window.__publicFlows.searches[2].resolve(); });
  await expect(results(page).getByRole('link').first()).toContainText('Beta result 1');
});

for (const mode of ['range-error', 'empty-range'] as const) {
  test(`people restores a valid page after ${mode}, preserving every filter`, async ({ page }) => {
    await openPeople(page, '/people?party=TEST&status=current&q=Person&page=99', mode === 'empty-range' ? '&empty-range' : '');
    await expect(people(page)).toHaveCount(20);
    await expect(location(page)).toHaveText('/people?party=TEST&status=current&q=Person');
    await expect(page.getByRole('alert')).toHaveCount(0);
    const loads = await page.evaluate(() => window.__publicFlows.peopleLoads.map(({ filters, page }) => ({ filters, page })));
    expect(loads.map(load => load.page)).toEqual([99, 1]);
    expect(loads[0].filters).toEqual(loads[1].filters);
    expect(loads[1].filters).toMatchObject({ party: 'TEST', status: 'current', query: 'Person' });
  });
}

test('people with zero matches recovers once and displays a valid empty state', async ({ page }) => {
  await openPeople(page, '/people?q=Nobody&page=99', '&zero');
  await expect(page.getByText('people.noResults', { exact: true })).toBeVisible();
  await expect(location(page)).toHaveText('/people?q=Nobody');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => window.__publicFlows.peopleLoads.map(load => load.page))).toEqual([99, 1]);
});

test('an ordinary people service error retains the requested page and retries it', async ({ page }) => {
  await openPeople(page, '/people?status=current&page=2', '&people-error');
  await expect(page.getByRole('alert')).toContainText('people.loadError');
  await expect(location(page)).toHaveText('/people?status=current&page=2');
  await page.evaluate(() => { window.__publicFlows.failPeople = false; });
  await page.getByRole('button', { name: 'people.retry' }).click();
  await expect(people(page)).toHaveCount(20);
  await expect(people(page).first()).toContainText('Person 21');
  expect(await page.evaluate(() => window.__publicFlows.peopleLoads.map(load => load.page))).toEqual([2, 2]);
});

test('a late out-of-range response cannot reset the newly selected people page', async ({ page }) => {
  await openPeople(page, '/people?party=TEST&page=99', '&defer-people');
  await expect.poll(() => page.evaluate(() => window.__publicFlows.peopleLoads.length)).toBe(1);
  await page.getByRole('button', { name: 'People page 2' }).click();
  await expect.poll(() => page.evaluate(() => window.__publicFlows.peopleLoads.length)).toBe(2);
  await page.evaluate(() => { window.__publicFlows.peopleLoads[1].resolve(); });
  await expect(people(page).first()).toContainText('Person 21');
  await page.evaluate(() => { window.__publicFlows.peopleLoads[0].rejectRange(); });
  await expect(location(page)).toHaveText('/people?status=current&page=2');
  await expect(people(page).first()).toContainText('Person 21');
  expect(await page.evaluate(() => window.__publicFlows.peopleLoads.length)).toBe(2);
});

test('normal people pagination and browser back preserve the filtered page', async ({ page }) => {
  await openPeople(page, '/people?status=current');
  await expect(people(page).first()).toContainText('Person 1');
  await page.getByRole('button', { name: 'people.next', exact: true }).click();
  await expect(location(page)).toHaveText('/people?status=current&page=2');
  await expect(people(page).first()).toContainText('Person 21');
  await page.getByRole('button', { name: 'Browser back fixture' }).click();
  await expect(location(page)).toHaveText('/people?status=current');
  await expect(people(page).first()).toContainText('Person 1');
});
