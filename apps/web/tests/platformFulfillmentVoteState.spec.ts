import { expect, test } from '@playwright/test';

test('votes reveal results automatically while non-voters can reveal one or all results', async ({ page }) => {
  const itemKey = 'b'.repeat(64);
  const itemKey2 = 'c'.repeat(64);
  let ownVote: string | null = null;
  let resultsAnnouncedOn = '2024-01-19';
  let votingOpensOn = '2025-01-19';
  let votingIsOpen = true;
  const submissions: Array<Record<string, unknown>> = [];

  await page.addInitScript(() => {
    window.localStorage.removeItem('public-office-watch-participation-clearance-v1');
    Object.defineProperty(window, 'turnstile', {
      configurable: true,
      value: {
        render(_container: HTMLElement, options: { callback(token: string): void }) {
          queueMicrotask(() => options.callback('platform-vote-turnstile-token'));
          return 'platform-vote-widget';
        },
        remove() {},
      },
    });
  });

  await page.route('**/rest/v1/rpc/platform_fulfillment_results', async (route) => {
    const fulfilledCount = 2 + (ownVote === 'fulfilled' ? 1 : 0);
    const inProgressCount = 1 + (ownVote === 'in_progress' ? 1 : 0);
    const notFulfilledCount = 1 + (ownVote === 'not_fulfilled' ? 1 : 0);
    const insufficientCount = ownVote === 'insufficient_information' ? 1 : 0;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        item_key: itemKey,
        display_order: 1,
        promise_text: '推動公共托育據點增設，降低青年家庭育兒負擔。',
        fulfilled_count: fulfilledCount,
        in_progress_count: inProgressCount,
        not_fulfilled_count: notFulfilledCount,
        insufficient_information_count: insufficientCount,
        total_count: 4 + (ownVote ? 1 : 0),
        results_announced_on: resultsAnnouncedOn,
        voting_opens_on: votingOpensOn,
        voting_is_open: votingIsOpen,
      }, {
        item_key: itemKey2,
        display_order: 2,
        promise_text: '改善公共運輸轉乘，提升通勤便利性。',
        fulfilled_count: 0,
        in_progress_count: 3,
        not_fulfilled_count: 1,
        insufficient_information_count: 0,
        total_count: 4,
        results_announced_on: resultsAnnouncedOn,
        voting_opens_on: votingOpensOn,
        voting_is_open: votingIsOpen,
      }]),
    });
  });

  await page.route('**/rest/v1/rpc/get_platform_fulfillment_votes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        ownVote ? [{ item_key: itemKey, vote_status: ownVote }] : [],
      ),
    });
  });

  await page.route('**/auth/v1/signup*', async (route) => {
    const now = new Date().toISOString();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'platform-vote-test-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'platform-vote-test-refresh-token',
        user: {
          id: '00000000-0000-4000-8000-000000000099',
          aud: 'authenticated',
          role: 'authenticated',
          email: '',
          phone: '',
          app_metadata: {
            provider: 'anonymous',
            providers: ['anonymous'],
          },
          user_metadata: {},
          identities: [],
          created_at: now,
          updated_at: now,
          is_anonymous: true,
        },
      }),
    });
  });

  await page.route('**/api/participation/challenge', async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      token: 'platform-vote-turnstile-token',
    });
    await route.fulfill({ status: 204 });
  });

  await page.route('**/api/participation/submit', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body).toMatchObject({ itemKey });
    submissions.push(body);

    if (body.action === 'platform-fulfillment') {
      expect(['in_progress', 'fulfilled']).toContain(body.voteStatus);
      ownVote = String(body.voteStatus);
    } else {
      expect(body).toMatchObject({
        action: 'platform-fulfillment-withdrawal',
        claimId: expect.any(String),
        itemKey,
      });
      expect(body).not.toHaveProperty('voteStatus');
      ownVote = null;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto(
    '/people/49a7d775-31da-413c-aa2a-f9e6190fcade',
  );
  const card = page
    .getByRole('heading', { name: '公開政見', exact: true })
    .first()
    .locator('xpath=ancestor::article[1]');
  const firstItem = card.locator('ol > li').first();
  const choices = firstItem.getByRole('group', {
    name: '你認為目前履行情況如何？',
  });

  await expect(choices.getByRole('button')).toHaveText([
    '已實現',
    '推進中',
    '尚未實現',
    '資訊不足',
  ]);
  const votingSchedule = card.getByTestId('fulfillment-voting-schedule');
  const votingRule = votingSchedule.getByText('選舉結果公布滿一年後才開放投票。', {
    exact: true,
  });
  const votingDates = votingSchedule.getByText(
    /結果公布：2024\/1\/19 · 投票開放：2025\/1\/19/u,
  );
  await expect(votingRule).toBeVisible();
  await expect(votingDates).toBeVisible();
  const ruleBox = await votingRule.boundingBox();
  const datesBox = await votingDates.boundingBox();
  expect(Math.abs((ruleBox?.y ?? 0) - (datesBox?.y ?? 0))).toBeLessThanOrEqual(1);
  expect(datesBox?.x ?? 0).toBeGreaterThan(ruleBox?.x ?? 0);

  const overallSummary = card.getByTestId('fulfillment-overall-summary');
  await expect(overallSummary).toBeVisible();
  await expect(overallSummary.getByText('整體社群判斷分布', { exact: true })).toBeVisible();
  await expect(overallSummary.getByText('0 / 2 項已達顯示門檻', { exact: true })).toBeVisible();
  await expect(overallSummary.getByText('整體結果尚未顯示；每項政見至少累積 20 票後才會產生整體分布。', { exact: true })).toBeVisible();
  await expect(
    overallSummary.getByRole('img', { name: /社群投票結果/u }),
  ).toHaveCount(0);

  await expect(
    firstItem.getByRole('img', { name: /社群投票結果/ }),
  ).toHaveCount(0);
  await expect(
    firstItem.getByTestId('fulfillment-result-placeholder'),
  ).toBeVisible();

  await card
    .getByRole('button', { name: '查看全部結果', exact: true })
    .click();
  await expect(
    firstItem.getByRole('img', { name: /社群投票結果/ }),
  ).toBeVisible();
  await expect(
    card.getByRole('button', { name: '收起全部結果', exact: true }),
  ).toBeVisible();
  await card
    .getByRole('button', { name: '收起全部結果', exact: true })
    .click();
  await expect(
    firstItem.getByRole('img', { name: /社群投票結果/ }),
  ).toHaveCount(0);
  await expect(overallSummary).toBeVisible();

  await firstItem
    .getByRole('button', { name: '看結果', exact: true })
    .click();
  await expect(
    firstItem.getByRole('img', { name: /已實現 50\.0%/ }),
  ).toBeVisible();
  await expect(firstItem.getByText('4 票', { exact: true })).toBeVisible();
  await firstItem
    .getByRole('button', { name: '收起結果', exact: true })
    .click();
  await expect(
    firstItem.getByRole('img', { name: /社群投票結果/ }),
  ).toHaveCount(0);

  await choices
    .getByRole('button', { name: '推進中', exact: true })
    .click();
  await expect(choices.getByRole('button')).toHaveCount(4);
  await expect(
    choices.getByRole('button', { name: '推進中', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    firstItem.getByRole('button', { name: '撤回投票', exact: true }),
  ).toBeVisible();
  await expect(
    firstItem.getByRole('img', { name: /推進中 40\.0%/ }),
  ).toBeVisible();
  await expect(
    firstItem.getByRole('button', { name: /看結果|收起結果/u }),
  ).toHaveCount(0);

  await choices
    .getByRole('button', { name: '已實現', exact: true })
    .click();
  await expect(
    choices.getByRole('button', { name: '已實現', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    choices.getByRole('button', { name: '推進中', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');

  await expect(
    firstItem.getByRole('img', { name: /已實現 60\.0%/ }),
  ).toBeVisible();
  await expect(firstItem.getByText('5 票', { exact: true })).toBeVisible();

  await firstItem
    .getByRole('button', { name: '撤回投票', exact: true })
    .click();
  await expect(
    firstItem.getByRole('button', { name: '撤回投票', exact: true }),
  ).toHaveCount(0);
  await expect(
    choices.getByRole('button', { name: '已實現', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await expect(
    firstItem.getByRole('img', { name: /社群投票結果/ }),
  ).toHaveCount(0);
  await expect(
    firstItem.getByRole('button', { name: '看結果', exact: true }),
  ).toBeVisible();

  resultsAnnouncedOn = '2026-01-19';
  votingOpensOn = '2027-01-19';
  votingIsOpen = false;
  await page.reload();

  await expect(card.getByText(/預計 2027\/1\/19 開放（目前尚未開放）/u)).toBeVisible();
  await expect(firstItem.getByRole('group', {
    name: '你認為目前履行情況如何？',
  })).toHaveCount(0);
  await expect(
    card.getByRole('button', { name: '查看全部結果', exact: true }),
  ).toHaveCount(0);
  await expect(card.getByLabel('社群履約投票圖例')).toHaveCount(0);
  await expect(card.getByTestId('fulfillment-overall-summary')).toHaveCount(0);
  await expect(
    firstItem.getByRole('button', { name: '看結果', exact: true }),
  ).toHaveCount(0);
  await expect(
    firstItem.getByRole('img', { name: /社群投票結果/ }),
  ).toHaveCount(0);
  const itemBox = await firstItem.boundingBox();
  const promiseBox = await firstItem.getByTestId('platform-promise').boundingBox();
  expect(promiseBox?.width ?? 0).toBeGreaterThan((itemBox?.width ?? 0) * 0.9);

  expect(submissions).toEqual([
    expect.objectContaining({
      action: 'platform-fulfillment',
      itemKey,
      voteStatus: 'in_progress',
    }),
    expect.objectContaining({
      action: 'platform-fulfillment',
      itemKey,
      voteStatus: 'fulfilled',
    }),
    expect.objectContaining({
      action: 'platform-fulfillment-withdrawal',
      itemKey,
    }),
  ]);
});
