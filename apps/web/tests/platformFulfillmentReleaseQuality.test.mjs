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

test('keeps short actionable promises instead of treating them as headings', () => {
  const promises = [
    '公托公幼海線倍增',
    '力促新莊第二運動中心成立。',
    '訂定中共代理人法，嚇阻中國滲透。',
    '合理化大眾運輸月票價格',
  ];

  for (const promise of promises) {
    const decision = classifyPlatformFulfillmentRelease(claim([promise]));
    assert.equal(decision.releaseable, true, promise);
    assert.deepEqual(decision.items, [promise]);
  }
});

test('keeps future commitments that share an item with past achievements', () => {
  const mixedItems = [
    '成功爭取設立 YouBike 據點，持續爭取廣設據點，串聯大眾運輸工具。',
    '過去進度落後，未來將完成捷運建設。',
    '已完成可行性評估，爭取工程經費。',
    '改善道路，已完成可行性評估。',
    '已完成可行性評估，改善道路。',
    '成功爭取第一期預算，要求編列第二期經費。',
  ];

  for (const mixedItem of mixedItems) {
    const decision = classifyPlatformFulfillmentRelease(claim([mixedItem]));
    assert.equal(decision.releaseable, true, mixedItem);
    assert.deepEqual(decision.items, [mixedItem]);
    assert.ok(!decision.excludedReasonCodes.includes('past_achievement'));
  }
});

test('keeps commitment main clauses when a nested or later clause reports progress', () => {
  const mixedItems = [
    '督促縣府爭取158乙永光路拓寬工程經費（已完成可行性評估，約7.5億）',
    '督促市府4年任內完成8千户社會住宅，地點平均分配、讓年輕人有房子住，宜居宜業，不再為高房價煩惱。',
    '爭取南屯區國中小全面設置智慧教室。(成功爭取永春、大墩國小，大墩、大業國中)。',
  ];

  for (const reviewStatus of ['reviewed', 'auto_approved']) {
    for (const mixedItem of mixedItems) {
      const decision = classifyPlatformFulfillmentRelease(claim([mixedItem], reviewStatus));
      assert.equal(decision.releaseable, true, `${reviewStatus}: ${mixedItem}`);
      assert.deepEqual(decision.items, [mixedItem]);
      assert.ok(!decision.excludedReasonCodes.includes('past_achievement'));
    }
  }
});

test('excludes pure past achievements even when the achievement phrase contains an action verb', () => {
  const achievements = [
    '二十四年成績單：成功推動「五股、泰山輕軌捷運」並獲得國家發展研究院審核通過。',
    '養得起孩子／完成：成功推動台中市公托公幼倍增。',
    '二十四年成績單：成功推動林口交流道立體化，增設引道紓解龜山、林口車流。',
  ];

  for (const achievement of achievements) {
    const decision = classifyPlatformFulfillmentRelease(claim([achievement]));
    assert.equal(decision.releaseable, false, achievement);
    assert.deepEqual(decision.items, []);
    assert.ok(decision.excludedReasonCodes.includes('past_achievement'));
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
    '已完成改善工程。',
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

test('keeps ambiguous mixed action clauses for reviewed and automatic splits', () => {
  for (const status of ['reviewed', 'auto_approved']) {
    for (const item of ['改善道路，已完成可行性評估。', '已完成可行性評估，改善道路。', '落實居住正義，推動社會住宅-開南安居己動工']) {
      assert.deepEqual(classifyPlatformFulfillmentRelease(claim([item], status)).items, [item]);
    }
    for (const item of ['成功爭取工程經費。', '已完成改善工程。', '成功爭取預算，已完成改善工程。']) {
      assert.deepEqual(classifyPlatformFulfillmentRelease(claim([item], status)).items, []);
    }
  }
});
