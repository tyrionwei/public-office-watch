import { classifyPlatformFulfillmentRelease } from '../../../scripts/platform-fulfillment-release-quality.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';

import { splitPlatformContent } from '../src/lib/contentItems.ts';

test('keeps numbered promises under their explicit bullet section headings', () => {
  const result = splitPlatformContent([
    '中和再升級 服務再延續',
    '',
    '●升級中和交通',
    '1.增設轉運站。',
    '2.改善道路壅塞。',
    '',
    '●照顧新住民權益',
    '1.成立新住民服務中心。',
  ].join('\n'));

  assert.equal(result.splitMethod, 'section');
  assert.equal(result.reviewStatus, 'auto_approved');
  assert.deepEqual(result.items, [
    '升級中和交通：增設轉運站。',
    '升級中和交通：改善道路壅塞。',
    '照顧新住民權益：成立新住民服務中心。',
  ]);
});

test('recognizes short plain headings followed by bullet promises', () => {
  const result = splitPlatformContent([
    '老有所依',
    '•愛心廚房弱勢共餐',
    '•長照升級',
    '幼有所養',
    '•課後托育',
    '•增設非營利幼兒園',
  ].join('\n'));

  assert.equal(result.splitMethod, 'section');
  assert.deepEqual(result.items, [
    '老有所依：愛心廚房弱勢共餐',
    '老有所依：長照升級',
    '幼有所養：課後托育',
    '幼有所養：增設非營利幼兒園',
  ]);
});

test('recognizes angle-bracket section headings without releasing the headings as items', () => {
  const result = splitPlatformContent([
    '長照>',
    '爭取爬梯機免費使用。',
    '社區發展>',
    '督促公共空間再利用。',
  ].join('\n'));

  assert.deepEqual(result.items, [
    '長照：爭取爬梯機免費使用。',
    '社區發展：督促公共空間再利用。',
  ]);
});

test('keeps bullet promises under numbered Chinese section headings', () => {
  const result = splitPlatformContent([
    '一、發展大武',
    '• 改善道路基礎建設。',
    '• 提升觀光價值。',
    '二、幸福大武',
    '• 推動銀髮族福利政策。',
  ].join('\n'));

  assert.deepEqual(result.items, [
    '發展大武：改善道路基礎建設。',
    '發展大武：提升觀光價值。',
    '幸福大武：推動銀髮族福利政策。',
  ]);
});

test('preserves inline multiplication within a section bullet', () => {
  assert.deepEqual(splitPlatformContent('### 教育福利\n* 每月補助 1000 元 * 12 個月。\n### 交通改善\n* 改善道路。').items, [
    '教育福利：每月補助 1000 元 * 12 個月。', '交通改善：改善道路。',
  ]);
});

test('splits markdown headings and repeated star bullets into platform items', () => {
  const result = splitPlatformContent([
    '### 教育品質提升',
    '* 發展特色教育。 * 推動幼老共園。',
    '### 社福政策落實',
    '* 提升心理衛教資源。 * 整合關懷據點。',
  ].join('\n'));

  assert.deepEqual(result.items, [
    '教育品質提升：發展特色教育。',
    '教育品質提升：推動幼老共園。',
    '社福政策落實：提升心理衛教資源。',
    '社福政策落實：整合關懷據點。',
  ]);
});

test('keeps short numbered commitments that begin with action verbs', () => {
  const result = splitPlatformContent([
    '一、全力爭取鄉親權益',
    '二、專業監督政府施政',
    '三、督促政府發展產業',
    '四、爭取實列原鄉預算',
    '五、推展原鄉傳統文化',
    '六、協助扶持培力青年',
  ].join('\n'));

  assert.equal(result.reviewStatus, 'auto_approved');
  assert.deepEqual(result.items, [
    '全力爭取鄉親權益',
    '專業監督政府施政',
    '督促政府發展產業',
    '爭取實列原鄉預算',
    '推展原鄉傳統文化',
    '協助扶持培力青年',
  ]);
});

test('marks clearly corrupted mixed-script OCR as needs review', () => {
  const result = splitPlatformContent([
    'ᑫӥНӥЎϯൺᑫၮ୏਒Шᑫ୔ࠔޜᇂ!',
    '঵ྛׯ๓෧ໆ൨؃ᅿೀ౛ᑫӥНӥЎϯ!',
  ].join('\n'));

  assert.equal(result.splitConfidence, 85);
  assert.equal(result.reviewStatus, 'needs_review');
});

test('parser and release gate share section heading recognition', () => {
  for (const headings of [['一、教育', '二、交通'], ['## 教育', '## 交通'], ['教育', '交通'], ['教育＞', '交通＞']]) {
    const source = [headings[0], '• 增設資源。', headings[1], '• 改善道路。'].join('\n');
    const parsed = splitPlatformContent(source);
    assert.deepEqual(parsed.items, ['教育：增設資源。', '交通：改善道路。']);
    const check = (items: string[]) => classifyPlatformFulfillmentRelease({
      claim_json: { platformText: source, items, contentSplit: { reviewStatus: 'auto_approved' } },
    });
    assert.equal(check(parsed.items).releaseable, true);
    assert.ok(check(['增設資源。', '改善道路。']).reasonCodes.includes('section_heading_mismatch'));
  }
});
