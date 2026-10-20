import { expect, test } from '@playwright/test';
import { startPersonClaimFixture } from './fixtures/person-claim-isolation/server.mjs';
let fixture: Awaited<ReturnType<typeof startPersonClaimFixture>>;
test.beforeAll(async () => { fixture = await startPersonClaimFixture(); });
test.afterAll(async () => { await fixture?.close(); });

test('one malformed platform claim leaves the person profile readable with source and retry', async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.origin === fixture.origin ? route.continue() : route.abort();
  });
  await page.goto(fixture.origin);
  await page.evaluate(async () => {
    const { mockPublicDataProvider } = await import('/src/lib/mockPublicDataProvider.ts');
    const original = mockPublicDataProvider.getPersonProfile.bind(mockPublicDataProvider);
    mockPublicDataProvider.getPersonProfile = (personId) => {
      const profile = original(personId);
      if (!profile || personId !== 'person-example-a') return profile;
      const candidate = profile.candidate_records[0];
      return {
        ...profile,
        person: { ...profile.person, role_label: '總統', display_position_label: '總統' },
        public_claims: [{
          claim_id: 'malformed-platform',
          person_id: personId,
          candidate_id: candidate?.candidate_id ?? null,
          claim_type: 'platform',
          claim_value: '不應顯示的原文',
          claim_json: { __publishedMalformedClaimJson: true },
          confidence_level: 'A',
          review_score: 100,
          source_name: '原始來源',
          source_url: 'https://example.test/source',
          observed_at: null,
          updated_at: '2026-10-01T00:00:00Z',
        }, {
          claim_id: 'throwing-platform',
          person_id: personId,
          candidate_id: candidate?.candidate_id ?? null,
          claim_type: 'platform',
          claim_value: '不可渲染的原文',
          claim_json: { get contentSplit() { throw new Error('broken claim'); } },
          confidence_level: 'A',
          review_score: 100,
          source_name: '另一來源',
          source_url: 'https://example.test/another-source',
          observed_at: null,
          updated_at: '2026-10-01T00:00:00Z',
        }, ...profile.public_claims],
      };
    };
    window.history.pushState({}, '', '/people/person-example-a');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  await expect(page.getByRole('heading', { name: '範例人物甲', exact: true })).toBeVisible();
  await expect(page.locator('[data-person-profile-hero] > div > p').filter({ hasText: '總統' })).toHaveCount(1);
  const failedClaim = page.locator('[data-claim-load-error]').first();
  await expect(page.locator('[data-claim-load-error]')).toHaveCount(2);
  await expect(failedClaim).toBeVisible();
  await expect(failedClaim.getByRole('link', { name: /原始來源/ })).toHaveAttribute('href', 'https://example.test/source');
  await expect(page.getByText('不應顯示的原文')).toHaveCount(0);
  await expect(page.getByText('不可渲染的原文')).toHaveCount(0);
  await expect(page.locator('[data-claim-load-error]').nth(1).getByRole('link', { name: /另一來源/ })).toHaveAttribute('href', 'https://example.test/another-source');
  await expect(page.getByRole('heading', { name: '參選紀錄' })).toBeVisible();
  await failedClaim.getByRole('button', { name: '重試顯示' }).click();
  await expect(page.locator('[data-claim-load-error]').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '範例人物甲', exact: true })).toBeVisible();
});


test('failed profile request can be retried without reloading the page', async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === fixture.origin ? route.continue() : route.abort());
  await page.goto(fixture.origin);
  await page.evaluate(async () => {
    const { mockPublicDataProvider } = await import('/src/lib/mockPublicDataProvider.ts');
    const profile = mockPublicDataProvider.getPersonProfile('person-example-a');
    let loaded = false;
    let attempts = 0;
    mockPublicDataProvider.getPersonProfile = () => loaded ? profile : null;
    mockPublicDataProvider.loadPersonProfiles = async (_ids, refresh) => {
      if (++attempts === 1) throw new Error('temporary public read failure');
      if (!refresh) throw new Error('retry must bypass cached profile');
      loaded = true;
      return [profile];
    };
    history.pushState({}, '', '/people/person-example-a');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByText('人物資料載入失敗，請稍後再試。')).toBeVisible();
  await page.getByRole('button', { name: '重新載入', exact: true }).click();
  await expect(page.getByRole('heading', { name: '範例人物甲', exact: true })).toBeVisible();
  await expect(page.getByText('人物資料載入失敗，請稍後再試。')).toHaveCount(0);
});

test('family cards link only matching displayed relationships and allow navigation to the relative', async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === fixture.origin ? route.continue() : route.abort());
  await page.goto(fixture.origin);
  await page.evaluate(async () => {
    const { mockPublicDataProvider } = await import('/src/lib/mockPublicDataProvider.ts');
    const original = mockPublicDataProvider.getPersonProfile.bind(mockPublicDataProvider);
    mockPublicDataProvider.getPersonProfile = (personId) => {
      const profile = original(personId);
      if (!profile || personId !== 'person-example-a') return profile;
      return { ...profile, public_claims: [{
        claim_id: 'family-approved', person_id: personId, candidate_id: null,
        claim_type: 'family_relation', claim_value: '已核對的親屬關係文字',
        claim_json: { familyPublicationPolicy: { version: 'family-publication-v1', decision: 'explicit_user_approved', eligible: true } },
        confidence_level: 'A', review_score: 100, source_name: '核對來源', source_url: 'https://example.test/family',
        observed_at: null, updated_at: '2026-10-17T00:00:00Z',
      }] };
    };
    mockPublicDataProvider.loadPersonFamilyLinks = async () => [
      { claim_id: 'family-approved', person_id: 'wrong-person', relative_person_id: 'wrong-person', relative_name: '不應顯示的連結' },
      { claim_id: 'hidden-claim', person_id: 'person-example-a', relative_person_id: 'wrong-person', relative_name: '未顯示關係' },
      { claim_id: 'family-approved', person_id: 'person-example-a', relative_person_id: 'person-example-b', relative_name: '範例人物乙' },
    ];
    history.pushState({}, '', '/people/person-example-a');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByText('已核對的親屬關係文字', { exact: true })).toBeVisible();
  const relativeLink = page.getByRole('link', { name: '查看人物頁：範例人物乙', exact: true });
  await expect(relativeLink).toHaveAttribute('href', '/people/person-example-b');
  await expect(page.getByRole('link', { name: /不應顯示的連結|未顯示關係/u })).toHaveCount(0);
  await relativeLink.click();
  await expect(page.getByRole('heading', { name: '範例人物乙', exact: true })).toBeVisible();
});

test('family link load failure retains relationship text and source with an explicit link error', async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === fixture.origin ? route.continue() : route.abort());
  await page.goto(fixture.origin);
  await page.evaluate(async () => {
    const { mockPublicDataProvider } = await import('/src/lib/mockPublicDataProvider.ts');
    const original = mockPublicDataProvider.getPersonProfile.bind(mockPublicDataProvider);
    mockPublicDataProvider.getPersonProfile = (personId) => {
      const profile = original(personId);
      if (!profile) return profile;
      return { ...profile, public_claims: [{
        claim_id: 'family-approved', person_id: personId, candidate_id: null,
        claim_type: 'family_relation', claim_value: '連結失敗仍保留的關係文字', claim_json: {},
        confidence_level: 'A', review_score: 100, source_name: '關係來源', source_url: 'https://example.test/family',
        observed_at: null, updated_at: '2026-10-17T00:00:00Z',
      }] };
    };
    mockPublicDataProvider.loadPersonFamilyLinks = async () => { throw new Error('temporary family link failure'); };
    history.pushState({}, '', '/people/person-example-a');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByText('連結失敗仍保留的關係文字', { exact: true })).toBeVisible();
  await expect(page.getByText('人物連結暫時無法載入，關係文字與來源仍可查看。', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '查看原始資料 ↗', exact: true })).toHaveAttribute('href', 'https://example.test/family');
  await expect(page.getByText('尚未收錄可公開的政治家族關係；不代表確認沒有相關關係。', { exact: true })).toHaveCount(0);
});
