import { expect, test, type Page } from '@playwright/test';
import { startStateFixture } from './fixtures/ui-state/server.mjs';

type PendingLoad = { id: string; done: boolean; resolve(): void; reject(): void };
declare global {
  interface Window {
    __uiState: {
      deferLoads: boolean;
      deferWrites: boolean;
      deferRegions: boolean;
      failRegions: boolean;
      loads: PendingLoad[];
      writes: Array<PendingLoad & { kind: string; itemKey: string; status?: string }>;
      regions: PendingLoad[];
    };
    __restoreStorage?: () => void;
    __rerenderVoting?: () => void;
    __closedVotingRevision?: number;
  }
}
const preferenceKey = 'public-office-watch.voting-region-preference.v1';
const savedPreference = {
  county: { id: 'taipei-city', name: '臺北市' },
  district: { id: 'district-63000020', name: '信義區' },
  village: { id: 'village-63000020001', name: '西村里' },
  neighborhood: 7,
  source: 'manual',
  confirmedAt: '2026-09-08T00:00:00.000Z',
};
let fixture: Awaited<ReturnType<typeof startStateFixture>>;
let pageErrors: string[];
let externalRequests: string[];

test.beforeAll(async () => { fixture = await startStateFixture(); });
test.afterAll(async () => { await fixture?.close(); });
test.beforeEach(async ({ page }) => {
  pageErrors = [];
  externalRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== fixture.origin) {
      externalRequests.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
});
test.afterEach(() => {
  expect(pageErrors, 'UI failures must be handled rather than become unhandled exceptions').toEqual([]);
  expect(externalRequests, 'Fixture may not contact a database or external site').toEqual([]);
});

async function switchParty(page: Page, party: 'a' | 'b') {
  await page.locator(`[data-party-result-row="${party}"] button`).click();
}
async function settleUi(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function loadCount(page: Page, count: number) {
  await expect.poll(() => page.evaluate(() => window.__uiState.loads.length)).toBe(count);
}
async function seedVotingArea(page: Page, preference = savedPreference) {
  await page.goto(fixture.origin + '/?voting');
  await page.evaluate(({ key, preference }) => localStorage.setItem(key, JSON.stringify(preference)), { key: preferenceKey, preference });
  await page.reload();
}
async function storedPreference(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), preferenceKey);
}
async function openEditor(page: Page) {
  await page.getByRole('button', { name: 'Open editor fixture' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function breakStorage(page: Page, method: 'setItem' | 'removeItem') {
  await page.evaluate(({ method, key }) => {
    const original = Storage.prototype[method];
    Storage.prototype[method] = function (name: string, value?: string) {
      if (name === key) throw new DOMException('Controlled storage failure', 'QuotaExceededError');
      return original.call(this, name, value!);
    };
    window.__restoreStorage = () => { Storage.prototype[method] = original; };
  }, { method, key: preferenceKey });
}

for (const unstable of [false, true]) {
  test(`voting keyboard focus survives parent rerender with ${unstable ? 'changing' : 'stable'} close callback`, async ({ page }) => {
    await page.goto(fixture.origin + '/?voting' + (unstable ? '&unstableClose' : ''));
    await openEditor(page);
    const county = page.getByRole('combobox').first();
    await expect(county).toBeEnabled();
    for (let index = 0; index < 5 && !await county.evaluate(element => element === document.activeElement); index += 1) {
      await page.keyboard.press('Tab');
    }
    await expect(county).toBeFocused();
    await page.evaluate(() => window.__rerenderVoting?.());
    await settleUi(page);
    await expect(county).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    if (unstable) expect(await page.evaluate(() => window.__closedVotingRevision)).toBe(1);
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  });
}

test('mobile panels return keyboard focus on dismiss and preserve the next dialog focus', async ({ page }) => {
  await page.goto(fixture.origin + '/?mobilePanels');
  const nav = page.locator('[data-mobile-bottom-nav]');
  for (const name of ['nav.mobileExplore', 'common.search', 'nav.mobileMore']) {
    const opener = nav.getByRole('button', { name, exact: true });
    for (let index = 0; index < 15 && !await opener.evaluate(element => element === document.activeElement); index += 1) await page.keyboard.press('Tab');
    await expect(opener).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(opener).toBeFocused();
    await page.keyboard.press('Enter');
    const close = page.getByRole('dialog').getByRole('button', { name: 'nav.mobileClose', exact: true });
    if (name === 'common.search') await page.keyboard.press('Shift+Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(opener).toBeFocused();
  }
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-next-dialog]')).toBeFocused();
});

for (const mode of ['party', 'person'] as const) {
  test(`${mode} identity switch hides previous policies while pending or failed and retries the current target`, async ({ page }) => {
    await page.goto(fixture.origin + (mode === 'person' ? '/?person' : '/'));
    const panel = page.locator(mode === 'person' ? '[data-person-fixture]' : '[data-party-list-roster]');
    await expect(panel).toContainText('RESULT-A ONLY POLICY');
    await page.evaluate(() => { window.__uiState.deferLoads = true; });
    if (mode === 'person') await page.getByRole('button', { name: 'Person B' }).click();
    else await switchParty(page, 'b');
    await loadCount(page, 2);
    await expect(panel).not.toContainText('RESULT-A ONLY POLICY');
    await expect(panel.getByRole('button', { name: 'person.fulfillment.fulfilled', exact: true })).toHaveCount(0);
    await page.evaluate(() => window.__uiState.loads[1].reject());
    await expect(panel.getByRole('alert')).toContainText('person.fulfillment.loadError');
    await expect(panel).not.toContainText('RESULT-A ONLY POLICY');
    await panel.getByRole('button', { name: 'app.retry', exact: true }).click();
    await loadCount(page, 3);
    await page.evaluate(() => window.__uiState.loads[2].resolve());
    await expect(panel).toContainText('RESULT-B ONLY POLICY');
    await page.evaluate(() => { window.__uiState.deferLoads = false; });
    await panel.getByRole('button', { name: 'person.fulfillment.fulfilled', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__uiState.writes.map(({ id, itemKey, kind }) => ({ id, itemKey, kind })))).toEqual([
      { id: 'result-b', itemKey: 'item-b', kind: 'submit' },
    ]);
  });
}

test('a late initial response cannot replace another target or a new visit to the same target', async ({ page }) => {
  await page.goto(fixture.origin + '/?defer');
  await loadCount(page, 1);
  await switchParty(page, 'b');
  await loadCount(page, 2);
  await page.evaluate(() => window.__uiState.loads[1].resolve());
  const panel = page.locator('[data-party-list-roster]');
  await expect(panel).toContainText('RESULT-B ONLY POLICY');
  await switchParty(page, 'a');
  await loadCount(page, 3);
  await page.evaluate(() => window.__uiState.loads[0].resolve());
  await settleUi(page);
  await expect(panel).not.toContainText('RESULT-A ONLY POLICY');
  await page.evaluate(() => window.__uiState.loads[2].resolve());
  await expect(panel).toContainText('RESULT-A ONLY POLICY');
});

for (const kind of ['submit', 'withdraw'] as const) {
  for (const outcome of ['resolve', 'reject'] as const) {
    test(`${kind} ${outcome} after target switch cannot change new controls or trigger an old refresh`, async ({ page }) => {
      await page.goto(fixture.origin + (kind === 'withdraw' ? '/?own' : '/'));
      const panel = page.locator('[data-party-list-roster]');
      await expect(panel).toContainText('RESULT-A ONLY POLICY');
      await page.evaluate(() => { window.__uiState.deferWrites = true; });
      await panel.getByRole('button', { name: kind === 'withdraw' ? 'person.fulfillment.withdraw' : 'person.fulfillment.fulfilled', exact: true }).click();
      await expect.poll(() => page.evaluate(() => window.__uiState.writes.length)).toBe(1);
      await switchParty(page, 'b');
      await expect(panel).toContainText('RESULT-B ONLY POLICY');
      await page.evaluate(outcome => window.__uiState.writes[0][outcome](), outcome);
      await settleUi(page);
      await expect(panel).toContainText('RESULT-B ONLY POLICY');
      await expect(panel.getByRole('alert')).toHaveCount(0);
      await expect(panel.getByRole('button', { name: 'person.fulfillment.fulfilled', exact: true })).toBeEnabled();
      await expect.poll(() => page.evaluate(() => window.__uiState.loads.map(load => load.id))).toEqual(['result-a', 'result-b']);
    });
  }
  test(`${kind} refresh already in flight cannot overwrite the next target`, async ({ page }) => {
    await page.goto(fixture.origin + (kind === 'withdraw' ? '/?own' : '/'));
    const panel = page.locator('[data-party-list-roster]');
    await expect(panel).toContainText('RESULT-A ONLY POLICY');
    await page.evaluate(() => { window.__uiState.deferLoads = true; });
    await panel.getByRole('button', { name: kind === 'withdraw' ? 'person.fulfillment.withdraw' : 'person.fulfillment.fulfilled', exact: true }).click();
    await loadCount(page, 2);
    await switchParty(page, 'b');
    await loadCount(page, 3);
    await page.evaluate(() => window.__uiState.loads[2].resolve());
    await expect(panel).toContainText('RESULT-B ONLY POLICY');
    await page.evaluate(() => window.__uiState.loads[1].resolve());
    await settleUi(page);
    await expect(panel).not.toContainText('RESULT-A ONLY POLICY');
    await expect(panel.getByRole('button', { name: 'person.fulfillment.fulfilled', exact: true })).toBeEnabled();
  });
}

test('saved county, district, village and neighborhood survive reopen while village loading is delayed', async ({ page }) => {
  await seedVotingArea(page);
  let release!: () => void;
  let finished!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const handled = new Promise<void>(resolve => { finished = resolve; });
  await page.route('**/taiwanVillageDirectory*', async route => { await gate; await route.continue(); finished(); });
  try {
    await openEditor(page);
    await expect(page.locator('[data-voting-village-trigger]')).toContainText('Loading villages');
    await expect(page.getByRole('button', { name: 'Save voting area', exact: true })).toBeDisabled();
    expect(await storedPreference(page)).toEqual(savedPreference);
  } finally { release(); await handled; }
  await expect(page.locator('[data-voting-village-trigger]')).toContainText('西村里');
  await page.getByRole('button', { name: 'Save voting area', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await storedPreference(page)).toMatchObject({ ...savedPreference, confirmedAt: expect.any(String) });
  await page.reload();
  await openEditor(page);
  await expect(page.locator('[data-voting-village-trigger]')).toContainText('西村里');
  expect((await storedPreference(page)).neighborhood).toBe(7);
});

test('failed village import preserves preference and offers a working page reload', async ({ page }) => {
  await seedVotingArea(page);
  let failed = false;
  await page.route('**/taiwanVillageDirectory*', route => {
    if (!failed) { failed = true; return route.abort('failed'); }
    return route.continue();
  });
  await openEditor(page);
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Villages could not be loaded');
  await expect(page.getByRole('button', { name: 'Save voting area', exact: true })).toBeDisabled();
  expect(await storedPreference(page)).toEqual(savedPreference);
  await page.getByRole('button', { name: 'Reload page', exact: true }).click();
  await openEditor(page);
  await expect(page.locator('[data-voting-village-trigger]')).toContainText('西村里');
  await expect(page.getByRole('button', { name: 'Save voting area', exact: true })).toBeEnabled();
  expect(await storedPreference(page)).toEqual(savedPreference);
});

test('directory failure is visible and cannot clear a saved voting area', async ({ page }) => {
  await seedVotingArea(page);
  await page.evaluate(() => { window.__uiState.failRegions = true; });
  await openEditor(page);
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Voting areas could not be loaded');
  await expect(page.locator('[data-voting-county]')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save voting area', exact: true })).toBeDisabled();
  expect(await storedPreference(page)).toEqual(savedPreference);
});

test('changing district explicitly removes the old village; late village completion uses the current district', async ({ page }) => {
  await seedVotingArea(page);
  let release!: () => void;
  let finished!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const handled = new Promise<void>(resolve => { finished = resolve; });
  await page.route('**/taiwanVillageDirectory*', async route => { await gate; await route.continue(); finished(); });
  try {
    await openEditor(page);
    await expect(page.locator('[data-voting-village-trigger]')).toContainText('Loading villages');
    await page.locator('[data-voting-district]').selectOption('district-63000010');
    await expect(page.getByRole('button', { name: 'Save voting area', exact: true })).toBeDisabled();
  } finally { release(); await handled; }
  await expect(page.getByRole('button', { name: 'Save voting area', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Save voting area', exact: true }).click();
  const preference = await storedPreference(page);
  expect(preference.district.id).toBe('district-63000010');
  expect(preference.village).toBeUndefined();
  expect(preference.neighborhood).toBeUndefined();
});

test('unmatched saved village requires an explicit replacement or no-village choice', async ({ page }) => {
  const unmatched = { ...savedPreference, village: { id: 'village-old-fixture', name: 'Removed fixture village' } };
  await seedVotingArea(page, unmatched);
  await openEditor(page);
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Your saved village is not in this list');
  await expect(page.getByRole('button', { name: 'Save voting area', exact: true })).toBeDisabled();
  expect(await storedPreference(page)).toEqual(unmatched);
  await page.locator('[data-voting-village-trigger]').click();
  await page.getByRole('listbox').getByRole('option', { name: 'Do not select a village', exact: true }).click();
  await page.getByRole('button', { name: 'Save voting area', exact: true }).click();
  expect((await storedPreference(page)).village).toBeUndefined();
});

for (const action of ['save', 'clear'] as const) {
  test(`storage ${action} failure keeps the editor and previous preference; retry succeeds`, async ({ page }) => {
    await seedVotingArea(page);
    await openEditor(page);
    await expect(page.locator('[data-voting-village-trigger]')).toContainText('西村里');
    if (action === 'save') {
      await page.locator('[data-voting-district]').selectOption('district-63000010');
      await expect(page.getByRole('button', { name: 'Save voting area', exact: true })).toBeEnabled();
    }
    await breakStorage(page, action === 'save' ? 'setItem' : 'removeItem');
    const button = page.getByRole('button', { name: action === 'save' ? 'Save voting area' : 'Clear saved area', exact: true });
    await button.click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(action === 'save' ? 'could not save' : 'could not clear');
    expect(await storedPreference(page)).toEqual(savedPreference);
    await expect(page.locator('[data-saved-preference]')).toHaveText(JSON.stringify(savedPreference));
    await page.evaluate(() => window.__restoreStorage!());
    await button.click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const after = await storedPreference(page);
    if (action === 'clear') expect(after).toBeNull();
    else expect(after.district.id).toBe('district-63000010');
  });
}

test('neighborhood persistence failure is visible and retries the same draft without pretending it was saved', async ({ page }) => {
  await seedVotingArea(page);
  await breakStorage(page, 'setItem');
  await page.locator('[data-polling-neighborhood]').fill('12');
  const panel = page.locator('[data-my-polling-place]');
  await expect(panel.getByRole('alert')).toContainText('Your neighborhood could not be saved');
  await expect(page.locator('[data-polling-neighborhood]')).toHaveValue('12');
  expect((await storedPreference(page)).neighborhood).toBe(7);
  await page.evaluate(() => window.__restoreStorage!());
  await panel.getByRole('button', { name: 'Retry saving', exact: true }).click();
  await expect(panel.getByRole('alert')).toHaveCount(0);
  expect((await storedPreference(page)).neighborhood).toBe(12);
});


test('one target serializes vote changes and withdrawals through their refresh', async ({ page }) => {
  await page.goto(fixture.origin + '/?own');
  const panel = page.locator('[data-party-list-roster]');
  await expect(panel).toContainText('RESULT-A ONLY POLICY');
  await page.evaluate(() => { window.__uiState.deferWrites = true; window.__uiState.deferLoads = true; });
  await panel.getByRole('button', { name: 'person.fulfillment.inProgress', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__uiState.writes.length)).toBe(1);
  await expect(panel.getByRole('button', { name: 'person.fulfillment.withdraw', exact: true })).toBeDisabled();
  await expect(panel.getByRole('button', { name: 'person.fulfillment.fulfilled', exact: true })).toBeDisabled();
  await page.evaluate(() => window.__uiState.writes[0].resolve());
  await loadCount(page, 2);
  await expect(panel.getByRole('button', { name: 'person.fulfillment.withdraw', exact: true })).toBeDisabled();
  await page.evaluate(() => window.__uiState.loads[1].resolve());
  await expect(panel.getByRole('button', { name: 'person.fulfillment.withdraw', exact: true })).toBeEnabled();
  await panel.getByRole('button', { name: 'person.fulfillment.withdraw', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__uiState.writes.length)).toBe(2);
  await expect(panel.getByRole('button', { name: 'person.fulfillment.fulfilled', exact: true })).toBeDisabled();
  await page.evaluate(() => window.__uiState.writes[1].resolve());
  await loadCount(page, 3);
  await page.evaluate(() => window.__uiState.loads[2].resolve());
  await expect(panel.getByRole('button', { name: 'person.fulfillment.withdraw', exact: true })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'person.fulfillment.fulfilled', exact: true })).toHaveAttribute('aria-pressed', 'false');
});
