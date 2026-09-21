import { expect, test } from '@playwright/test';
import jsQR from 'jsqr';
import { startCryptoSupportFixture } from './fixtures/crypto-support/server.mjs';

let fixture: Awaited<ReturnType<typeof startCryptoSupportFixture>>;
let externalRequests: string[];
let pageErrors: string[];

test.beforeAll(async () => { fixture = await startCryptoSupportFixture(); });
test.afterAll(async () => { await fixture?.close(); });
test.beforeEach(async ({ page }) => {
  externalRequests = [];
  pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { window.__copiedAddress = value; } } });
  });
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === fixture.origin) return route.continue();
    externalRequests.push(route.request().url());
    return route.abort();
  });
});
test.afterEach(() => {
  expect(pageErrors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

declare global { interface Window { __copiedAddress?: string; __cryptoSupportChallenge?: number; } }

async function decodedQr(page: import('@playwright/test').Page) {
  const image = page.getByRole('img');
  await expect(image).toBeVisible();
  const pixels = await image.evaluate(async (element) => {
    const imageElement = element as HTMLImageElement;
    if (!imageElement.complete) await new Promise<void>(resolve => imageElement.addEventListener('load', () => resolve(), { once: true }));
    const canvas = document.createElement('canvas');
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;
    canvas.getContext('2d')!.drawImage(imageElement, 0, 0);
    return { data: [...canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data], width: canvas.width, height: canvas.height };
  });
  return jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height)?.data;
}

test('zero configured networks shows preparation only', async ({ page }) => {
  await page.goto(fixture.origin + '/?networks=0');
  await expect(page.getByText('USDT 支持方式準備中，開放後會更新於本頁。', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '送出留言', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
});

test('English empty state uses the translated copy', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('public-office-watch-language', 'en'));
  await page.goto(fixture.origin + '/?networks=0');
  await expect(page.getByText('USDT support is being prepared. This page will be updated when it opens.', { exact: true })).toBeVisible();
});

test('one network selects its complete address, QR code, and copy action', async ({ page }) => {
  await page.goto(fixture.origin + '/?networks=1');
  const address = '0x1234567890abcdef1234567890ABCDEF12345678';
  await expect(page.getByLabel('本站收款地址', { exact: true })).toHaveValue(address);
  await expect(page.getByLabel('轉帳網路', { exact: true })).toBeDisabled();
  expect(await decodedQr(page)).toBe(address);
  await page.getByRole('button', { name: '複製地址', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('已複製收款地址。');
  expect(await page.evaluate(() => window.__copiedAddress)).toBe(address);
});

test('network switch replaces address, QR code, and form target', async ({ page }) => {
  const writes: unknown[] = [];
  await page.route('**/api/participation/support', async route => {
    writes.push(route.request().postDataJSON());
    await route.fulfill({ json: { id: '4d4a9d0a-cd07-4fea-9240-3073d7e5c123' } });
  });
  await page.goto(fixture.origin + '/?networks=2');
  await page.getByLabel('轉帳網路', { exact: true }).selectOption('tron');
  const address = 'TQ9e5fR5D5V3HhQGQxA8t2L9WZQJdo5y1A';
  await expect(page.getByLabel('本站收款地址', { exact: true })).toHaveValue(address);
  expect(await decodedQr(page)).toBe(address);
  await page.getByLabel('交易編號或付款錢包地址', { exact: true }).fill('a'.repeat(64));
  await page.getByRole('button', { name: '送出留言', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('已收到你的留言，謝謝你支持本站！');
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ networkId: 'tron', receivingAddress: address, reference: 'a'.repeat(64) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('rejects malformed and receiving-address references before sending', async ({ page }) => {
  let writes = 0;
  await page.route('**/api/participation/support', route => { writes += 1; return route.fulfill({ json: { id: '4d4a9d0a-cd07-4fea-9240-3073d7e5c123' } }); });
  await page.goto(fixture.origin + '/?networks=1');
  const reference = page.getByLabel('交易編號或付款錢包地址', { exact: true });
  await reference.fill('0x1234');
  await page.getByRole('button', { name: '送出留言', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('請填寫完整且符合所選網路格式');
  await reference.fill('0x1234567890abcdef1234567890ABCDEF12345678');
  await page.getByRole('button', { name: '送出留言', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('請改填付款地址或 TxID');
  expect(writes).toBe(0);
});

test('failed submission keeps fields and retry retains request ID', async ({ page }) => {
  const requestIds: string[] = [];
  let attempt = 0;
  await page.route('**/api/participation/support', async route => {
    requestIds.push(route.request().postDataJSON().requestId);
    attempt += 1;
    await route.fulfill(attempt === 1 ? { status: 503, json: { error: 'SUPPORT_UNAVAILABLE' } } : { json: { id: '4d4a9d0a-cd07-4fea-9240-3073d7e5c123' } });
  });
  await page.goto(fixture.origin + '/?networks=1');
  const reference = page.getByLabel('交易編號或付款錢包地址', { exact: true });
  await reference.fill('0x' + 'a'.repeat(64));
  await page.getByLabel('暱稱（選填）', { exact: true }).fill('測試暱稱');
  await page.getByRole('button', { name: '送出留言', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('留言暫時無法送出');
  await expect(reference).toHaveValue('0x' + 'a'.repeat(64));
  await page.getByRole('button', { name: '送出留言', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('已收到你的留言，謝謝你支持本站！');
  expect(requestIds).toHaveLength(2);
  expect(requestIds[0]).toBe(requestIds[1]);
});

test('a malformed 200 response keeps form data and never shows success', async ({ page }) => {
  await page.route('**/api/participation/support', route => route.fulfill({ json: { id: 'not-a-server-id' } }));
  await page.goto(fixture.origin + '/?networks=1');
  const reference = page.getByLabel('交易編號或付款錢包地址', { exact: true });
  await reference.fill('0x' + 'b'.repeat(64));
  await page.getByRole('button', { name: '送出留言', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('留言暫時無法送出');
  await expect(reference).toHaveValue('0x' + 'b'.repeat(64));
  await expect(page.getByText('已收到你的留言，謝謝你支持本站！', { exact: true })).toHaveCount(0);
});

test('security challenge happens only after the server asks for it', async ({ page }) => {
  let writes = 0;
  await page.route('**/api/participation/support', route => {
    writes += 1;
    return route.fulfill(writes === 1
      ? { status: 403, json: { error: 'PARTICIPATION_CHALLENGE_REQUIRED' } }
      : { json: { id: '4d4a9d0a-cd07-4fea-9240-3073d7e5c123' } });
  });
  await page.goto(fixture.origin + '/?networks=1');
  await page.getByLabel('交易編號或付款錢包地址', { exact: true }).fill('0x' + 'c'.repeat(64));
  await page.getByRole('button', { name: '送出留言', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('已收到你的留言，謝謝你支持本站！');
  expect(writes).toBe(2);
  expect(await page.evaluate(() => window.__cryptoSupportChallenge)).toBe(1);
});

test('clipboard failure leaves complete selectable address and keyboard form access', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
  await page.goto(fixture.origin + '/?networks=1');
  const address = page.getByLabel('本站收款地址', { exact: true });
  await page.getByRole('button', { name: '複製地址', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('手動');
  await expect(address).toHaveValue('0x1234567890abcdef1234567890ABCDEF12345678');
  await address.focus();
  await page.keyboard.press('ControlOrMeta+A');
  const selected = await address.evaluate(el => (el as HTMLTextAreaElement).selectionEnd - (el as HTMLTextAreaElement).selectionStart);
  expect(selected).toBe(42);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '複製地址', exact: true })).toBeFocused();
});

test('pending submission disables editing and repeated click while a new message gets a new ID', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const ids: string[] = [];
  await page.route('**/api/participation/support', async route => {
    ids.push(route.request().postDataJSON().requestId);
    if (ids.length === 1) await held;
    await route.fulfill({ json: { id: '4d4a9d0a-cd07-4fea-9240-3073d7e5c123' } });
  });
  await page.goto(fixture.origin);
  const reference = page.getByLabel('交易編號或付款錢包地址', { exact: true });
  await reference.fill('0x' + 'b'.repeat(40));
  await page.getByRole('button', { name: '送出留言', exact: true }).click();
  await expect(reference).toBeDisabled();
  await expect(page.getByRole('combobox')).toBeDisabled();
  await expect.poll(() => ids.length).toBe(1);
  release();
  await expect(page.getByText('已收到你的留言，謝謝你支持本站！', { exact: true })).toBeVisible();
  await reference.fill('0x' + 'b'.repeat(40));
  await page.getByRole('button', { name: '送出留言', exact: true }).click();
  await expect.poll(() => ids.length).toBe(2);
  expect(ids[1]).not.toBe(ids[0]);
});

for (const theme of ['light', 'dark']) test(`support address and controls remain usable in ${theme} theme`, async ({ page }) => {
  await page.goto(fixture.origin + '/?networks=2');
  await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
  await expect(page.getByLabel('本站收款地址', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '送出留言', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await decodedQr(page)).toBe('0x1234567890abcdef1234567890ABCDEF12345678');
});
