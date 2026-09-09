import { expect, test } from '@playwright/test';
import { startStateFixture } from './fixtures/ui-state/server.mjs';
let fixture: Awaited<ReturnType<typeof startStateFixture>>;
declare global {
  interface Window {
    __metadataState: { people: Record<string, { person_id: string; name: string }> };
    __navigateMetadata: (path: string) => void;
  }
}
test.beforeAll(async () => { fixture = await startStateFixture(); });
test.afterAll(async () => { await fixture?.close(); });
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === fixture.origin ? route.continue() : route.abort());
});

test('server Person metadata survives same-path loading then is replaced by exactly one current entity', async ({ page }) => {
  await page.goto(fixture.origin + '/?metadata&route=/people/server-a');
  await expect(page.getByRole('heading', { name: 'Metadata fixture' })).toBeVisible();
  const structured = page.locator('script[type="application/ld+json"]');
  await expect(structured).toHaveCount(1);
  await expect.poll(() => structured.textContent()).toContain('Server Person A');
  await page.evaluate(() => {
    window.__metadataState.people['server-a'] = { person_id: 'server-a', name: 'Resolved Person A' };
    window.dispatchEvent(new Event('fixture-data-ready'));
  });
  await expect(structured).toHaveCount(1);
  await expect.poll(() => structured.textContent()).toContain('Resolved Person A');
  await expect(page.locator('#public-office-watch-server-structured-data')).toHaveCount(0);
});

test('client navigation removes stale server JSON-LD even while the next entity remains unresolved', async ({ page }) => {
  await page.goto(fixture.origin + '/?metadata&route=/people/server-a');
  await expect(page.getByRole('heading', { name: 'Metadata fixture' })).toBeVisible();
  await expect(page.locator('#public-office-watch-server-structured-data')).toHaveCount(1);
  await page.evaluate(() => window.__navigateMetadata('/people/person-b'));
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  await page.evaluate(() => {
    window.__metadataState.people['person-b'] = { person_id: 'person-b', name: 'Current Person B' };
    window.dispatchEvent(new Event('fixture-data-ready'));
  });
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  await expect.poll(() => page.locator('script[type="application/ld+json"]').textContent()).toContain('Current Person B');
  await page.evaluate(() => window.__navigateMetadata('/'));
  await expect.poll(() => page.locator('script[type="application/ld+json"]').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringContaining('Person A')]));
  await expect.poll(() => page.locator('script[type="application/ld+json"]').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringContaining('Current Person B')]));
});

test('a rejected lazy import shows a focused recovery screen; reload recovers and preserves preferences', async ({ page }) => {
  let failChunk = true;
  await page.route('**/lazy-page.jsx*', route => failChunk ? route.abort('failed') : route.continue());
  await page.addInitScript(() => localStorage.setItem('recovery-preference', 'keep-me'));
  await page.goto(fixture.origin + '/?boundary');
  const heading = page.getByRole('heading', { name: '頁面暫時無法載入' });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.getByRole('link', { name: '返回首頁' })).toHaveAttribute('href', '/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '重新載入頁面' })).toBeFocused();
  failChunk = false;
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Recovered lazy page' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('recovery-preference'))).toBe('keep-me');
});
