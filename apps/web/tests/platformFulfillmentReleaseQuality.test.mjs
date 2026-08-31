import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyPlatformFulfillmentRelease } from '../../../scripts/platform-fulfillment-release-quality.mjs';

function claim(items, reviewStatus = 'auto_approved', platformText = '') {
  return {
    claim_json: {
      items,
      platformText,
      contentSplit: { method: 'numbered', reviewStatus },
    },
    claim_value: platformText,
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

test('still applies hard-safety filtering to explicitly reviewed splits', () => {
  const decision = classifyPlatformFulfillmentRelease(claim([
    '推動地方公共建設。',
    '更多政見請上 http://example.tw/',
    '落實居住正義，推動社會住宅-開南安居己動工',
  ], 'reviewed'));

  assert.equal(decision.releaseable, true);
  assert.deepEqual(decision.items, ['推動地方公共建設。']);
  assert.equal(decision.excludedItemCount, 2);
  assert.ok(decision.excludedReasonCodes.includes('web_promotion'));
  assert.ok(decision.excludedReasonCodes.includes('past_achievement'));
});

test('withholds explicitly reviewed splits with abnormal structure', () => {
  const decision = classifyPlatformFulfillmentRelease(claim([
    '推動地方公共建設。',
    '四師平台」，留住在地專業人才。',
  ], 'reviewed'));

  assert.equal(decision.releaseable, false);
  assert.deepEqual(decision.items, []);
  assert.ok(decision.reasonCodes.includes('abnormal_structure'));
});

test('withholds auto-approved text with a clearly unreadable script mix', () => {
  const corruptedFragment = 'ᑫӥНӥЎϯൺᑫၮ୏਒Шᑫ୔ࠔޜᇂ঵ྛׯ๓෧ໆ൨؃ᅿೀ౛';
  const corrupted = corruptedFragment + corruptedFragment;
  const decision = classifyPlatformFulfillmentRelease(claim(
    ['ᑫӥНӥЎϯൺᑫၮ୏'],
    'auto_approved',
    corrupted,
  ));

  assert.equal(decision.releaseable, false);
  assert.deepEqual(decision.items, []);
  assert.ok(decision.reasonCodes.includes('unreadable_text'));
});

test('withholds auto-approved items when explicit source sections were flattened', () => {
  const source = [
    '●升級中和交通',
    '1.增設轉運站。',
    '●照顧新住民權益',
    '1.成立新住民服務中心。',
  ].join('\n');
  const decision = classifyPlatformFulfillmentRelease(claim([
    '升級中和交通：增設轉運站。',
    '升級中和交通：成立新住民服務中心。',
  ], 'auto_approved', source));

  assert.equal(decision.releaseable, false);
  assert.deepEqual(decision.items, []);
  assert.ok(decision.reasonCodes.includes('section_heading_mismatch'));
});

test('releases auto-approved items when every explicit source section is preserved', () => {
  const source = [
    '●升級中和交通',
    '1.增設轉運站。',
    '●照顧新住民權益',
    '1.成立新住民服務中心。',
  ].join('\n');
  const items = [
    '升級中和交通：增設轉運站。',
    '照顧新住民權益：成立新住民服務中心。',
  ];
  const decision = classifyPlatformFulfillmentRelease(claim(items, 'auto_approved', source));

  assert.equal(decision.releaseable, true);
  assert.deepEqual(decision.items, items);
});
