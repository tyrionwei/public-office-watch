import { expect, test } from '@playwright/test';
import { startFeedbackFixture } from './fixtures/feedback-admin/server.mjs';
let fixture: Awaited<ReturnType<typeof startFeedbackFixture>>;
const base = { id: 'test-feedback', person_id: 'person', person_name: '合成測試人物', feedback_kind: 'problem_report', section_key: 'resume', problem_type: 'inaccurate', message: '這是合成測試資料：任職期間可能有誤，附來源請核對。', evidence_url: 'https://example.test/evidence', decision: 'pending', priority: 'normal', work_status: 'pending', management_summary: '', review_note: '', reviewed_by: null, reviewed_at: null, revision: 1, content_version: 1, previous_decision: null, submission_count: 1, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', waiting_since: '2026-09-01T00:00:00Z' };
test.beforeAll(async () => { fixture = await startFeedbackFixture(); });
test.afterAll(async () => { await fixture?.close(); });
for (const width of [390, 1280]) test(`four sections, save, reopen, notes and conflicts at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  let item = { ...base }; let fail = false; const writes: Record<string, unknown>[] = []; const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === fixture.origin ? route.continue() : route.abort());
  await page.route('**/__feedback', async route => {
    const { action, input } = route.request().postDataJSON();
    if (action === 'save') {
      writes.push(input);
      if (fail) { fail = false; item = { ...item, revision: item.revision + 1, review_note: '另一位管理員的新備註' }; return route.fulfill({ status: 409, json: { error: 'FEEDBACK_CONFLICT' } }); }
      item = { ...item, decision: input.decision, priority: input.priority, work_status: input.workStatus, management_summary: input.summary, review_note: input.note, revision: item.revision + 1 };
      return route.fulfill({ json: item });
    }
    if (action === 'detail') return route.fulfill({ json: { item, history: [], history_total: 0, history_page: 1 } });
    const bucket = item.decision === 'accepted' ? item.priority === 'high' ? 'priority' : 'normal' : item.decision;
    const groups = Object.fromEntries(['pending','priority','normal','rejected'].map(key => [key, { total: key === bucket ? 1 : 0, completed: key === bucket && item.work_status === 'completed' ? 1 : 0, unfinished: key === bucket && item.work_status !== 'completed' ? 1 : 0, oldest_waiting_at: null, page: 1, page_size: 10, items: key === bucket ? [item] : [] }]));
    return route.fulfill({ json: { fetched_at: '2026-09-12T00:00:00Z', groups } });
  });
  await page.goto(fixture.origin);
  for (const id of ['pending','priority','normal','rejected']) await expect(page.locator(`#feedback-${id}`)).toBeVisible();
  await page.getByRole('button', { name: '編輯處理', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('處理決定').selectOption('accepted');
  await dialog.getByLabel('優先程度').selectOption('high');
  await dialog.getByLabel('處理備註', { exact: true }).fill('已確認值得查證，優先核對來源。');
  await dialog.getByRole('button', { name: '儲存處理', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('優先處理');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('執行進度').selectOption('completed');
  await dialog.getByRole('button', { name: '儲存處理', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '儲存處理', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: '關閉', exact: true }).click();
  await expect(page.locator('#feedback-priority')).toContainText('已完成 1 件');
  await page.getByRole('button', { name: '編輯處理', exact: true }).click();
  await dialog.getByLabel('處理備註', { exact: true }).fill('我的草稿必須保留');
  fail = true;
  await dialog.getByRole('button', { name: '儲存處理', exact: true }).click();
  await expect(dialog.getByText('最新備註：另一位管理員的新備註')).toBeVisible();
  await expect(dialog.getByLabel('處理備註', { exact: true })).toHaveValue('我的草稿必須保留');
  await expect(dialog.getByRole('button', { name: '儲存處理', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: '已查看差異，保留草稿繼續編輯' }).click();
  await dialog.getByLabel('執行進度').selectOption('in_progress');
  await dialog.getByRole('button', { name: '儲存處理', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '儲存處理', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: '關閉', exact: true }).click();
  await expect(page.locator('#feedback-priority')).toContainText('我的草稿必須保留');
  expect(writes.at(-1)?.expectedRevision).toBe(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`feedback-${width}.png`), fullPage: true });
  expect(errors).toEqual([]);
});
test('signed-out page shows login without feedback reads', async ({ page }) => {
  let requests = 0; await page.route('**/__feedback', route => { requests++; return route.abort(); });
  await page.goto(fixture.origin + '/?auth=signed-out');
  await expect(page.getByRole('button', { name: '寄送登入連結' })).toBeVisible();
  await expect(page.locator('#feedback-pending')).toHaveCount(0); expect(requests).toBe(0);
});
