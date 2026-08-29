import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyPlatformFulfillmentRelease } from '../../../scripts/platform-fulfillment-release-quality.mjs';

function claim(items, reviewStatus = 'auto_approved') {
  return {
    claim_json: {
      items,
      contentSplit: { method: 'numbered', reviewStatus },
    },
  };
}

test('keeps actionable auto-approved promises and excludes election metadata', () => {
  const decision = classifyPlatformFulfillmentRelease(claim([
    '2022 年議員選舉，新竹市，第 10 選舉區：北區',
    '爭取增設公共托育中心。',
  ]));

  assert.equal(decision.releaseable, true);
  assert.deepEqual(decision.items, ['爭取增設公共托育中心。']);
  assert.equal(decision.excludedItemCount, 1);
});

test('removes clear non-platform items without withholding the remaining promises', () => {
  const samples = [
    ['更多政見請上 http://bigear.tw/', 'web_promotion'],
    ['我是無懼聽損、堅持服務的候選人。', 'candidate_introduction'],
    ['【經歷】新竹市議員。', 'resume_content'],
    ['任內完成活動中心整建。', 'past_achievement'],
    ['觀光要盈：交通要盈', 'heading_or_slogan'],
    ['農漁', 'heading_or_slogan'],
  ];

  for (const [item, expectedReason] of samples) {
    const decision = classifyPlatformFulfillmentRelease(claim([
      '推動地方公共建設。',
      item,
    ]));
    assert.equal(decision.releaseable, true, item);
    assert.ok(decision.excludedReasonCodes.includes(expectedReason), item);
    assert.deepEqual(decision.items, ['推動地方公共建設。']);
  }
});

test('withholds the whole split when an item has abnormal structure', () => {
  const decision = classifyPlatformFulfillmentRelease(claim([
    '推動地方公共建設。',
    '四師平台」，留住在地專業人才。',
  ]));

  assert.equal(decision.releaseable, false);
  assert.ok(decision.reasonCodes.includes('abnormal_structure'));
  assert.deepEqual(decision.items, []);
});

test('does not auto-release source splits that already need review', () => {
  const decision = classifyPlatformFulfillmentRelease(claim(
    ['推動地方公共建設。'],
    'needs_review',
  ));

  assert.equal(decision.releaseable, false);
  assert.deepEqual(decision.reasonCodes, ['source_needs_review']);
});

test('preserves explicitly reviewed splits as the human override', () => {
  const reviewedItems = ['忠義誠信、愛鄉土。'];
  const decision = classifyPlatformFulfillmentRelease(claim(reviewedItems, 'reviewed'));

  assert.equal(decision.releaseable, true);
  assert.deepEqual(decision.items, reviewedItems);
});
