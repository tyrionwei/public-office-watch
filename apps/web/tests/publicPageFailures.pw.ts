import { expect, test, type Page } from '@playwright/test';
import { startStateFixture } from './fixtures/ui-state/server.mjs';

declare global {
  interface Window {
    __navigateFailurePage: (path: string) => void;
    __pageFailures: {
      failures: string[];
      deferred: string[];
      empty: string[];
      elections: unknown[];
      financeSummaries: Array<{ party_id: string; report_year: number; income_total: number; business_donation_total: number }>;
      calls: Array<{ method: string; args: unknown[]; done: boolean; resolve(value?: unknown): void; reject(): void }>;
    };
  }
}
let fixture: Awaited<ReturnType<typeof startStateFixture>>;
let errors: string[];
let external: string[];
test.beforeAll(async () => { fixture = await startStateFixture(); });
test.afterAll(async () => { await fixture?.close(); });
test.beforeEach(async ({ page }) => {
  errors = []; external = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === fixture.origin) return route.continue();
    external.push(route.request().url()); return route.abort();
  });
});
test.afterEach(() => { expect(errors).toEqual([]); expect(external).toEqual([]); });
async function open(page: Page, route: string, fail = '') {
  await page.goto(fixture.origin + '/?' + new URLSearchParams({ pageFailures: '', route, fail }));
}
async function navigate(page: Page, path: string) {
  await page.evaluate(path => window.__navigateFailurePage(path), path);
  await expect(page.locator('[data-failure-route]')).toHaveText(path);
}
async function settle(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

test('election index distinguishes failure from empty and retries without claiming zero', async ({ page }) => {
  await open(page, '/elections', 'index');
  await expect(page.getByRole('alert')).toHaveText('app.loadError');
  await expect(page.getByText('elections.emptyBody', { exact: true })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('elections.eventCount 0');
  await page.evaluate(() => { window.__pageFailures.failures = []; });
  await page.getByRole('button', { name: 'app.retry', exact: true }).click();
  await expect(page.locator('main a[href^="/elections/events/"]')).toHaveCount(2);
  await page.evaluate(() => { window.__pageFailures.elections = []; });
  await navigate(page, '/parties');
  await navigate(page, '/elections');
  await expect(page.getByText('elections.emptyBody', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

for (const method of ['index', 'facets']) {
  test(`event ${method} failure is retryable and successful missing is a distinct state`, async ({ page }) => {
    const path = '/elections/events/2026-2026-11-28-local?q=fixture';
    await open(page, path, method);
    await expect(page.getByRole('alert')).toHaveText('app.loadError');
    await expect(page.getByText('event.notFoundBody', { exact: true })).toHaveCount(0);
    await page.evaluate(() => { window.__pageFailures.failures = []; });
    await page.getByRole('button', { name: 'app.retry', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('[data-failure-route]')).toHaveText(path);
    await navigate(page, '/elections/events/missing');
    await expect(page.getByText('event.notFoundBody', { exact: true })).toBeVisible();
  });
}

test('comparison errors hide missing-data rows and sharing, preserve IDs, and recover', async ({ page }) => {
  const path = '/elections/races/fixture?compare=a,b';
  await open(page, path, 'profiles');
  const panel = page.locator('[data-candidate-comparison]');
  await expect(panel.getByRole('alert')).toHaveText('app.loadError');
  await expect(panel).not.toContainText('race.compareNoData');
  await expect(panel).not.toContainText('race.compareTodo');
  await expect(panel.getByRole('button', { name: 'Share fixture' })).toHaveCount(0);
  await page.evaluate(() => { window.__pageFailures.failures = []; });
  await panel.getByRole('button', { name: 'app.retry', exact: true }).click();
  await expect(panel).toContainText('EDUCATION a');
  await expect(panel.getByRole('button', { name: 'Share fixture' })).toBeVisible();
  expect(await page.evaluate(() => window.__pageFailures.calls.filter(row => row.method === 'profiles').map(row => row.args))).toEqual([[['a', 'b']], [['a', 'b']]]);
  await expect(page.locator('[data-failure-route]')).toHaveText(path);
  await page.evaluate(() => { window.__pageFailures.empty = ['profiles']; });
  await navigate(page, '/elections/races/fixture?compare=a,c');
  await expect(panel.getByText('race.compareNoData', { exact: true }).first()).toBeVisible();
  await expect(panel.getByRole('alert')).toHaveCount(0);
});

test('comparison selection hides old results while pending and rejects late responses', async ({ page }) => {
  await open(page, '/elections/races/fixture?compare=a,b');
  const panel = page.locator('[data-candidate-comparison]');
  await expect(panel).toContainText('EDUCATION b');
  await page.evaluate(() => { window.__pageFailures.deferred = ['profiles']; });
  await navigate(page, '/elections/races/fixture?compare=a,c');
  await expect(panel).not.toContainText('EDUCATION b');
  await expect(panel.getByRole('button', { name: 'Share fixture' })).toHaveCount(0);
  await navigate(page, '/elections/races/fixture?compare=b,c');
  await page.evaluate(() => window.__pageFailures.calls.filter(row => row.method === 'profiles').at(-1)!.resolve());
  await expect(panel).toContainText('EDUCATION b');
  await page.evaluate(() => window.__pageFailures.calls.filter(row => row.method === 'profiles' && !row.done).forEach(row => row.reject()));
  await settle(page);
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(panel).toContainText('EDUCATION c');
});

for (const fail of ['directory', 'finance', 'counts', 'finance,counts']) {
  test(`party directory ${fail} failure does not claim zero or complete tracking`, async ({ page }) => {
    await open(page, '/parties', fail);
    await expect(page.getByRole('alert')).toHaveText('app.loadError');
    await expect(page.locator('main dl').first()).not.toContainText('$0');
    await expect(page.locator('main')).not.toContainText('parties.registrySummary');
    if (fail !== 'directory') {
      await page.locator('summary').click();
      await expect(page.getByRole('link', { name: /PARTY A/ })).toBeVisible();
    }
    await page.evaluate(() => { window.__pageFailures.failures = []; window.__pageFailures.empty = ['counts']; });
    await page.getByRole('button', { name: 'app.retry', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('main dl').first()).toContainText('$0');
    await expect(page.locator('main')).toContainText('parties.registrySummary 2 2');
  });
}

test('party switch and pagination never display the previous company while pending or failed', async ({ page }) => {
  await open(page, '/parties/a');
  await expect(page.getByRole('heading', { name: 'COMPANY A PAGE 1', exact: true })).toBeVisible();
  await page.evaluate(() => { window.__pageFailures.deferred = ['companies']; });
  await navigate(page, '/parties/b');
  await expect(page.getByRole('heading', { name: /COMPANY A/ })).toHaveCount(0);
  await page.evaluate(() => window.__pageFailures.calls.filter(row => row.method === 'companies' && !row.done).forEach(row => row.reject()));
  await expect(page.getByRole('alert')).toHaveText('app.loadError');
  await expect(page.getByText('partyDetail.noCompanySummaries', { exact: true })).toHaveCount(0);
  await page.evaluate(() => { window.__pageFailures.deferred = []; });
  await page.getByRole('button', { name: 'app.retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'COMPANY B PAGE 1', exact: true })).toBeVisible();
  await page.evaluate(() => { window.__pageFailures.failures = ['companies']; });
  await navigate(page, '/parties/b?contributionPage=2');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: /COMPANY B/ })).toHaveCount(0);
  await page.evaluate(() => { window.__pageFailures.failures = []; });
  await page.getByRole('button', { name: 'app.retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'COMPANY B PAGE 2', exact: true })).toBeVisible();
  const last = await page.evaluate(() => window.__pageFailures.calls.filter(row => row.method === 'companies').slice(-2).map(row => row.args.slice(0, 2)));
  expect(last).toEqual([['b', 2], ['b', 1]]);
});


test('party finance retry restores nonzero totals and tracked party cards', async ({ page }) => {
  await open(page, '/parties', 'finance');
  await expect(page.getByRole('alert')).toHaveText('app.loadError');
  await page.evaluate(() => {
    window.__pageFailures.financeSummaries = [{ party_id: 'a', report_year: 2025, income_total: 123456, business_donation_total: 5000 }];
    window.__pageFailures.failures = [];
  });
  await page.getByRole('button', { name: 'app.retry', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('main dl').first()).toContainText('123,456');
  await expect(page.locator('main a[href="/parties/a"]').first()).toContainText('5,000');
  await expect(page.locator('main')).toContainText('parties.registrySummary 2 0');
});
