import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePublicUpdateDraft, normalizePublicUpdateReview } from '../../../supabase/functions/_shared/publicUpdateAdmin.ts';

test('normalizes a valid internal update draft', () => {
  const draft = normalizePublicUpdateDraft({
    updateType: 'person',
    title: ' 人物資料完成補充 ',
    summary: ' 已核對官方來源。 ',
    entityType: 'person',
    entityId: 'person-1',
    entityHref: '/people/person-1',
    sourceName: '官方資料',
    sourceUrl: 'https://example.com/source',
  });
  assert.equal(draft?.title, '人物資料完成補充');
  assert.equal(draft?.entityHref, '/people/person-1');
});

test('rejects unsafe links and entity ids without a type', () => {
  assert.equal(normalizePublicUpdateDraft({ updateType: 'site', title: 'a', summary: 'b', entityHref: '/internal/secret' }), null);
  assert.equal(normalizePublicUpdateDraft({ updateType: 'site', title: 'a', summary: 'b', entityId: 'orphan' }), null);
});

test('requires an audit reason for rejection and withdrawal', () => {
  const updateId = '10000000-0000-4000-8000-000000000001';
  assert.equal(normalizePublicUpdateReview({ reviewAction: 'reject', updateId, reason: '' }), null);
  assert.equal(normalizePublicUpdateReview({ reviewAction: 'withdraw', updateId, reason: 'x' }), null);
  assert.deepEqual(normalizePublicUpdateReview({ reviewAction: 'approve', updateId }), { action: 'approve', updateId, reason: null });
});
