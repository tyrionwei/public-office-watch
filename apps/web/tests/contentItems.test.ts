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

test('marks clearly corrupted mixed-script OCR as needs review', () => {
  const result = splitPlatformContent([
    'ᑫӥНӥЎϯൺᑫၮ୏਒Шᑫ୔ࠔޜᇂ!',
    '঵ྛׯ๓෧ໆ൨؃ᅿೀ౛ᑫӥНӥЎϯ!',
  ].join('\n'));

  assert.equal(result.splitConfidence, 85);
  assert.equal(result.reviewStatus, 'needs_review');
});
