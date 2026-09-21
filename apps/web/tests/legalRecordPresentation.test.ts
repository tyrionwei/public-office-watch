import assert from 'node:assert/strict';
import test from 'node:test';
import { legalRecordPresentation as present, legalCaseClassification as classify } from '../src/lib/legalRecordPresentation.ts';
const criminal = { recordType: 'criminal', caseStage: 'criminal_judgment', judgmentDate: '2025-01-01' };

test('keeps principal fine, thousands separators and conversion conditions', () => {
  const result = present('公然侮辱罪罰金8,000元，得易服勞役，1,000元折算1日。', criminal);
  assert.deepEqual(result.offenses, ['公然侮辱罪']);
  assert.ok(result.penalties.includes('公然侮辱罪罰金8,000元'));
  assert.equal(result.showNarrative, false);
  assert.ok(result.penalties.includes('1,000元折算1日'));
});
test('retains individual sentences and execution total without inventing a sum', () => {
  const result = present('利用職務機會詐取財物罪（2罪），2罪各有期徒刑1年5月；應執行有期徒刑1年8月；緩刑3年，向公庫支付20萬元。', criminal);
  assert.ok(result.penalties.some(s => s.includes('各有期徒刑1年5月')));
  assert.ok(result.penalties.includes('應執行有期徒刑1年8月'));
  assert.ok(result.penalties.includes('緩刑3年'));
  assert.ok(result.penalties.includes('向公庫支付20萬元'));
});
test('retains reduction and probation rather than choosing the first duration', () => {
  const result = present('填製不實會計憑證罪，有期徒刑3月，減為有期徒刑1月15日；緩刑2年。', criminal);
  assert.ok(result.penalties.includes('減為有期徒刑1月15日'));
  assert.ok(result.penalties.includes('緩刑2年'));
});
test('does not label acquitted charges as convictions and preserves the qualification', () => {
  const result = present('撤銷原判，改依共同使公務員登載不實罪判有期徒刑6月；貪污部分不另為無罪諭知。', criminal);
  assert.deepEqual(result.offenses, ['使公務員登載不實罪']);
  assert.deepEqual(result.notes, ['貪污部分不另為無罪諭知']);
  assert.equal(result.action, 'revised');
});
test('keeps separate convertible and non-convertible parts', () => {
  const result = present('圖利及公司法等案，得易科罰金部分應執行有期徒刑6月，不得易科罰金部分應執行8年6月；另有被訴部分無罪。', criminal);
  assert.ok(result.penalties.includes('不得易科罰金部分應執行8年6月'));
  assert.deepEqual(result.notes, ['另有被訴部分無罪']);
});
test('does not promote historic overturned sentences or administrative penalties', () => {
  for (const [text, json] of [
    ['先前判刑7年，後發回更審。', criminal],
    ['判處有期徒刑7年，撤銷原判，改判無罪。', criminal],
    ['政治獻金遭裁罰20萬元。', { recordType: 'administrative', caseStage: 'administrative_sanction' }],
  ] as const) {
    const result = present(text, json);
    assert.equal(result.showNarrative, true);
    assert.deepEqual(result.offenses, []);
    assert.deepEqual(result.penalties, []);
  }
});
test('does not infer finality from the narrative and preserves original input', () => {
  const json = { ...criminal };
  const text = '誣告罪，有期徒刑3月；未確認是否定讞。';
  const before = JSON.stringify(json);
  const result = present(text, json);
  assert.equal(JSON.stringify(json), before);
  assert.equal('finality' in result, false);
  assert.equal(result.judgmentDate, '2025-01-01');
});

test('does not treat 裁判處理 as a sentence', () => {
  const result = present('法院所列裁判處理，填製不實會計憑證罪，有期徒刑3月，減為有期徒刑1月15日。', criminal);
  assert.ok(!result.penalties.includes('判處理'));
  assert.deepEqual(result.penalties, ['有期徒刑3月', '減為有期徒刑1月15日']);
});

test('separates procedural state from verdict without interpreting 20 elapsed days', () => {
  const cases = [
    ['indicted', 'indicted', 'notJudged'],
    ['deferred_prosecution', 'deferred', 'notJudged'],
    ['criminal_judgment_non_final', 'nonFinal', 'guilty'],
    ['criminal_judgment_final', 'final', 'guilty'],
    ['criminal_judgment', 'finalityUnknown', 'guilty'],
    ['criminal_acquittal_final', 'final', 'acquitted'],
    ['acquitted_non_final', 'nonFinal', 'acquitted'],
  ];
  for (const [caseStage, status, result] of cases) {
    const json = { recordType: 'criminal', caseStage, judgmentDate: '2000-01-01' };
    assert.deepEqual(classify(json, present('誣告罪，有期徒刑3月。', json)), { status, result });
  }
});
test('mixed and unknown results are never forced into a binary verdict', () => {
  const text = '使公務員登載不實罪判有期徒刑6月；貪污部分不另為無罪諭知。';
  assert.equal(classify(criminal, present(text, criminal)).result, 'mixed');
  assert.equal(classify(criminal, present('先前判刑後發回更審。', criminal)).result, 'unknown');
  const admin = { recordType: 'administrative', caseStage: 'administrative_sanction' };
  assert.deepEqual(classify(admin, present('裁罰20萬元。', admin)), { status: 'other', result: 'notApplicable' });
});

test('partial allegations not established remain visible in the verdict label', () => {
  for (const note of ['被訴貪污部分不成立', '貪污部分不構成']) {
    const view = present(`使公務員登載不實罪，有期徒刑1年；${note}。`, criminal);
    assert.equal(classify(criminal, view).result, 'mixed');
  }
  // A generic stage plus an ambiguous narrative is not enough to infer acquittal.
  assert.equal(classify(criminal, present('被告主張無罪。', criminal)).result, 'unknown');
});
