import { expect, test } from '@playwright/test';

const personId = 'a86bf49e-1d29-43b0-a0d2-bf0e423fd9a2';
const sourceUrl = 'https://judgment.example.test/person-scoped-fixture';
const priorSourceUrl = 'https://judgment.example.test/prior-person-scoped-fixture';
const original = '測試原文：被告甲無罪。理由曾引述其他人因詐欺取財罪判處有期徒刑三年。';
const main = '測試本人犯公然侮辱罪，處罰金8,000元。';
type Claim = { claim_type: string; claim_value: string; person_id: string; source_url: string; claim_json: Record<string, unknown> };

for (const scenario of ['legacy', 'reviewed', 'unknown', 'linked'] as const) {
  test(`person legal record preserves original and expands details with keyboard: ${scenario}`, async ({ page }) => {
    // Only substitute the browser response. No review, claim or database writes.
    await page.route('**/api/participation/**', route => route.abort());
    await page.route('**/rest/v1/rpc/person_profiles_for', async route => {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      const rows = await response.json() as Array<{ payload: { claim_rows: Claim[] } }>;
      const claims = rows[0].payload.claim_rows;
      const claim = claims.find(row => row.claim_type === 'legal_case');
      expect(claim).toBeDefined();
      claim!.claim_value = original;
      claim!.source_url = sourceUrl;
      claim!.claim_json = { recordType: 'criminal', caseStage: 'criminal_judgment_non_final', judgmentDate: '2026-01-20' };
      if (scenario === 'linked') claim!.claim_json.judgmentDisposition = {
        version: 2, section: '主文', reviewStatus: 'reviewed', personId: claim!.person_id, sourceUrl,
        text: '被告甲上訴\n駁回。', result: 'unknown', caseNumber: '測試高院115年度上訴字第1號',
        judgmentDate: '2026-01-20', personScopeQuote: '被告甲', upheldJudgment: {
          reviewStatus: 'reviewed', relation: 'appeal_dismissed', scope: 'entire_person_disposition',
          personId: claim!.person_id, currentCaseNumber: '測試高院115年度上訴字第1號',
          currentSourceUrl: sourceUrl, currentDispositionText: '被告甲上訴\n駁回。', personScopeQuote: '被告甲',
          priorCaseNumber: '測試地院113年度訴字第1號', evidenceSourceUrl: sourceUrl,
          evidenceText: '不服測試地院113年度訴字第1號第一審判決，提起上訴。',
          prior: { version: 1, section: '主文', reviewStatus: 'reviewed', personId: claim!.person_id,
            sourceUrl: priorSourceUrl, sourceKind: 'court_judgment', caseNumber: '測試地院113年度訴字第1號',
            judgmentDate: '2024-06-01', text: '被告甲犯誣告罪，處有期徒刑3月。褫奪公權1年。', result: 'guilty' },
        },
      };
      else if (scenario !== 'legacy') claim!.claim_json.judgmentDisposition = {
        version: 1, section: '主文', reviewStatus: 'reviewed', personId: claim!.person_id, sourceUrl,
        text: scenario === 'reviewed' ? main : '上訴駁回。', result: scenario === 'reviewed' ? 'guilty' : 'unknown',
      };
      rows[0].payload.claim_rows = claims.filter(row => row.claim_type !== 'legal_case' || row === claim);
      await route.fulfill({ response, json: rows });
    });
    await page.goto(`/people/${personId}`);
    const summary = page.locator('[data-legal-summary]').first();
    await expect(summary).toBeVisible();
    if (scenario === 'reviewed') {
      await expect(summary).toContainText('公然侮辱罪');
      await expect(summary).toContainText('8,000元');
      await expect(summary).toContainText('有罪');
      await expect(summary).not.toContainText('詐欺取財罪');
    } else if (scenario === 'linked') {
      await expect(summary).toContainText('駁回上訴');
      await expect(summary).toContainText('誣告罪');
      await expect(summary).toContainText('有期徒刑3月');
      await expect(summary).toContainText('褫奪公權1年');
      const basis = summary.locator('[data-legal-prior-basis]');
      await expect(basis).toContainText('測試地院113年度訴字第1號');
      await expect(basis.locator(`a[href="${priorSourceUrl}"]`)).toBeVisible();
      await expect(summary.locator('[data-legal-summary-notice]')).toHaveCount(0);
    } else {
      await expect(summary.locator('[data-legal-summary-notice]')).toHaveText(scenario === 'legacy'
        ? '逐人主文摘要尚未整理；以下保留原紀錄。'
        : '本次主文未載明完整結果或刑度，尚待核對相關主文。');
      await expect(summary).not.toContainText('結果待確認');
      await expect(summary).not.toContainText('詳見下方案件說明');
      if (scenario === 'unknown') await expect(summary).toContainText('駁回上訴');
      await expect(summary).toContainText(scenario === 'legacy' ? original : '上訴駁回。');
    }
    const card = summary.locator('xpath=ancestor::article[1]');
    const details = card.locator('details');
    await page.evaluate(() => document.fonts.ready);
    await details.locator('summary').evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await details.locator('summary').focus();
    await expect(details.locator('summary')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open', '');
    await expect(card.getByText(original, { exact: true })).toBeVisible();
    await expect(card.locator(`a[href="${sourceUrl}"]`)).toBeVisible();
  });
}
