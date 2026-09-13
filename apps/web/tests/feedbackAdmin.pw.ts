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
      if (fail) { fail = false; item = { ...item, revision: item.revision + 1, review_note: '另一位管理員的新備註', management_summary: '另一位管理員的新摘要' }; return route.fulfill({ status: 409, json: { error: 'FEEDBACK_CONFLICT' } }); }
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
  for (const event of ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED']) {
    const refreshed = page.waitForResponse(response => response.url().endsWith('/__feedback') && response.request().postDataJSON().action === 'dashboard');
    await page.evaluate(event => (window as unknown as { __feedbackAuth: (event: string, id: string, sid: string, version: number) => void }).__feedbackAuth(event, 'admin', 'session-one', 2), event);
    await refreshed;
    await expect(dialog.getByLabel('處理備註', { exact: true })).toHaveValue('我的草稿必須保留');
  }
  fail = true;
  await dialog.getByRole('button', { name: '儲存處理', exact: true }).click();
  await expect(dialog.getByText('最新備註：另一位管理員的新備註')).toBeVisible();
  await expect(dialog.getByLabel('處理備註', { exact: true })).toHaveValue('我的草稿必須保留');
  await expect(dialog.getByRole('button', { name: '儲存處理', exact: true })).toBeDisabled();
  await expect(dialog.getByText('最新版本：另一位管理員的新摘要')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '套用合併結果，繼續編輯' })).toBeDisabled();
  await dialog.getByLabel('保留我的處理備註').check();
  await dialog.getByRole('button', { name: '套用合併結果，繼續編輯' }).click();
  await expect(dialog.getByLabel('管理摘要（不修改使用者原文）')).toHaveValue('另一位管理員的新摘要');
  await dialog.getByLabel('執行進度').selectOption('in_progress');
  await dialog.getByRole('button', { name: '儲存處理', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '儲存處理', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: '關閉', exact: true }).click();
  await expect(page.locator('#feedback-priority')).toContainText('我的草稿必須保留');
  expect(writes.at(-1)?.expectedRevision).toBe(4);
  expect(writes.at(-1)?.summary).toBe('另一位管理員的新摘要');
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

for (const pendingAction of ['detail', 'save', 'conflict-detail', 'history']) test(`sign-out discards delayed ${pendingAction} response`, async ({ page }) => {
  let delay = false;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const requested = new Promise<void>(resolve => { started = resolve; });
  let saves = 0;
  await page.route('**/*', route => new URL(route.request().url()).origin === fixture.origin ? route.continue() : route.abort());
  await page.route('**/__feedback', async route => {
    const { action } = route.request().postDataJSON();
    if (action === 'save') saves++;
    if (action === 'save' && pendingAction === 'conflict-detail') return route.fulfill({ status: 409, json: { error: 'FEEDBACK_CONFLICT' } });
    if (delay && action === (pendingAction === 'save' ? 'save' : 'detail')) { started(); await held; }
    if (action === 'detail') return route.fulfill({ json: { item: base, history: [], history_total: 30, history_page: 1 } });
    if (action === 'save') return route.fulfill({ json: { ...base, revision: 2 } });
    return route.fulfill({ json: { fetched_at: base.created_at, groups: Object.fromEntries(['pending', 'priority', 'normal', 'rejected'].map(key => [key, { total: key === 'pending' ? 1 : 0, completed: 0, unfinished: 1, page: 1, page_size: 10, items: key === 'pending' ? [base] : [] }])) } });
  });
  await page.goto(fixture.origin);
  await expect(page.locator('#feedback-pending')).toBeVisible();
  if (pendingAction === 'detail') delay = true;
  await page.getByRole('button', { name: '編輯處理', exact: true }).click();
  if (pendingAction !== 'detail') {
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible(); delay = true;
    if (pendingAction === 'history') {
      await dialog.getByText('操作與提交歷程（30）').click();
      await dialog.getByRole('button', { name: '較舊歷程' }).click();
    } else {
      await dialog.getByLabel('處理備註', { exact: true }).fill('等待中的儲存');
      await dialog.getByRole('button', { name: '儲存處理', exact: true }).click();
    }
  }
  await requested;
  await page.evaluate(() => (window as unknown as { __feedbackSignOut: () => void }).__feedbackSignOut());
  await expect(page.getByRole('button', { name: '寄送登入連結' })).toBeVisible();
  const completed = page.waitForResponse(response => response.url().endsWith('/__feedback'));
  release(); await completed;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#feedback-pending')).toHaveCount(0);
  await expect(page.getByText('合成測試人物', { exact: true })).toHaveCount(0);
  expect(saves).toBe(['save', 'conflict-detail'].includes(pendingAction) ? 1 : 0);
});

for (const [id, sid] of [['another-admin', 'another-session'], ['admin', 'new-session']]) test(`changed login ${id}/${sid} clears draft and ignores old detail`, async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const requested = new Promise<void>(resolve => { started = resolve; });
  let delay = false;
  await page.route('**/__feedback', async route => {
    const { action } = route.request().postDataJSON();
    if (action === 'detail') { if (delay) { started(); await held; } return route.fulfill({ json: { item: base, history: [], history_total: 30, history_page: 1 } }); }
    return route.fulfill({ json: { fetched_at: base.created_at, groups: Object.fromEntries(['pending', 'priority', 'normal', 'rejected'].map(key => [key, { total: key === 'pending' ? 1 : 0, completed: 0, unfinished: 1, page: 1, page_size: 10, items: key === 'pending' ? [base] : [] }])) } });
  });
  await page.goto(fixture.origin);
  await page.getByRole('button', { name: '編輯處理', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('處理備註', { exact: true }).fill('上一個登入的私人草稿');
  await dialog.getByText('操作與提交歷程（30）').click(); delay = true;
  await dialog.getByRole('button', { name: '較舊歷程' }).click(); await requested;
  await page.evaluate(({ id, sid }) => (window as unknown as { __feedbackAuth: (event: string, id: string, sid: string) => void }).__feedbackAuth('SIGNED_IN', id, sid), { id, sid });
  await expect(dialog).toHaveCount(0);
  const completed = page.waitForResponse(response => response.url().endsWith('/__feedback') && response.request().postDataJSON().action === 'detail');
  release(); await completed;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('上一個登入的私人草稿')).toHaveCount(0);
});
