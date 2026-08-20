import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEditableProfileClaimRevision,
  canUpdateProfileField,
  claimApprovalBlockReason,
} from '../build/internalClaimReview.ts';

test('blocks approval when a claim has no reviewed person link', () => {
  assert.match(
    claimApprovalBlockReason({ person_id: null, claim_type: 'education', candidate_id: null }) ?? '',
    /先完成身分比對/,
  );
});

test('blocks an election platform without an exact candidacy', () => {
  assert.match(
    claimApprovalBlockReason({ person_id: 'person-1', claim_type: 'platform', candidate_id: null }) ?? '',
    /參選紀錄/,
  );
});

test('allows an ordinary linked claim', () => {
  assert.equal(
    claimApprovalBlockReason({ person_id: 'person-1', claim_type: 'education', candidate_id: null }),
    null,
  );
});

test('normalizes and audits an edited education claim', () => {
  const revision = buildEditableProfileClaimRevision({
    claim_type: 'education',
    claim_value: '原始文字',
    claim_json: { sourcePersonKey: 'source-1' },
  }, '  修正後文字\r\n第二行  ', '2026-08-17T00:00:00.000Z');

  assert.equal(revision?.value, '修正後文字\n第二行');
  assert.equal(revision?.changed, true);
  assert.deepEqual(revision?.claimJson.reviewEdit, {
    version: 'internal-review-ui-profile-edit-v1',
    originalValue: '原始文字',
    reviewedValue: '修正後文字\n第二行',
    reviewedAt: '2026-08-17T00:00:00.000Z',
  });
});

test('rejects an empty edited profile claim', () => {
  assert.throws(() => buildEditableProfileClaimRevision({
    claim_type: 'experience',
    claim_value: '原始文字',
    claim_json: null,
  }, '   ', '2026-08-17T00:00:00.000Z'), /不能留空/);
});

test('updates an empty or unchanged profile field but preserves a different existing value', () => {
  assert.equal(canUpdateProfileField(null, '公報文字'), true);
  assert.equal(canUpdateProfileField('公報文字', '公報文字'), true);
  assert.equal(canUpdateProfileField('較新的資料', '公報文字'), false);
});
