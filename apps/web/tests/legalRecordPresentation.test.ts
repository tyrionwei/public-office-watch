import assert from 'node:assert/strict';
import test from 'node:test';
import { legalRecordPresentation as present, legalCaseClassification as classify, extractJudgmentMainText, type DispositionResult } from '../src/lib/legalRecordPresentation.ts';
const criminal = { recordType: 'criminal', caseStage: 'criminal_judgment', judgmentDate: '2025-01-01' };
const context = { personId: 'person-a', sourceUrl: 'https://court.example.test/current-judgment' };
function data(text: string, result: DispositionResult = 'guilty', json: Record<string, unknown> = criminal): Record<string, unknown> {
  return { ...json, judgmentDisposition: {
    version: 1, section: '主文', reviewStatus: 'reviewed', ...context, text, result,
  } };
}
function reviewed(text: string, result: DispositionResult = 'guilty', json: Record<string, unknown> = criminal) {
  return present(text, data(text, result, json), context);
}
// Existing sentencing assertions now use explicitly reviewed per-person main text.
// Unscoped legacy narratives are separately tested below and must never infer guilt.


test('keeps principal fine, thousands separators and conversion conditions', () => {
  const result = reviewed('公然侮辱罪罰金8,000元，得易服勞役，1,000元折算1日。');
  assert.deepEqual(result.offenses, ['公然侮辱罪']);
  assert.ok(result.penalties.includes('公然侮辱罪罰金8,000元'));
  assert.equal(result.showNarrative, false);
  assert.ok(result.penalties.includes('1,000元折算1日'));
});
test('retains individual sentences and execution total without inventing a sum', () => {
  const result = reviewed('利用職務機會詐取財物罪（2罪），2罪各有期徒刑1年5月；應執行有期徒刑1年8月；緩刑3年，向公庫支付20萬元。');
  assert.ok(result.penalties.some(s => s.includes('各有期徒刑1年5月')));
  assert.ok(result.penalties.includes('應執行有期徒刑1年8月'));
  assert.ok(result.penalties.includes('緩刑3年'));
  assert.ok(result.penalties.includes('向公庫支付20萬元'));
});
test('retains reduction and probation rather than choosing the first duration', () => {
  const result = reviewed('填製不實會計憑證罪，有期徒刑3月，減為有期徒刑1月15日；緩刑2年。');
  assert.ok(result.penalties.includes('減為有期徒刑1月15日'));
  assert.ok(result.penalties.includes('緩刑2年'));
});
test('does not label acquitted charges as convictions and preserves the qualification', () => {
  const result = reviewed('撤銷原判，改依共同使公務員登載不實罪判有期徒刑6月；貪污部分不另為無罪諭知。');
  assert.deepEqual(result.offenses, ['使公務員登載不實罪']);
  assert.deepEqual(result.notes, ['貪污部分不另為無罪諭知']);
  assert.equal(result.action, 'revised');
});
test('keeps separate convertible and non-convertible parts', () => {
  const result = reviewed('圖利及公司法等案，得易科罰金部分應執行有期徒刑6月，不得易科罰金部分應執行8年6月；另有被訴部分無罪。', 'mixed');
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
  assert.deepEqual(result.penalties, []);
  assert.equal(result.narrative, '法院所列裁判處理，填製不實會計憑證罪，有期徒刑3月，減為有期徒刑1月15日。');
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
    const text = result === 'acquitted' ? '被告甲無罪。' : '被告甲犯誣告罪，處有期徒刑3月。';
    const record = data(text, result === 'acquitted' ? 'acquitted' : 'guilty', json);
    assert.deepEqual(classify(record, present(text, record, context)), { status, result });
  }
});
test('mixed and unknown results are never forced into a binary verdict', () => {
  const text = '被告甲犯使公務員登載不實罪，處有期徒刑6月；另被訴詐欺取財部分無罪。';
  assert.equal(classify(criminal, reviewed(text, 'mixed')).result, 'mixed');
  assert.equal(classify(criminal, present('先前判刑後發回更審。', criminal)).result, 'unknown');
  const admin = { recordType: 'administrative', caseStage: 'administrative_sanction' };
  assert.deepEqual(classify(admin, present('裁罰20萬元。', admin)), { status: 'other', result: 'notApplicable' });
});

test('partial allegations not established remain visible in the verdict label', () => {
  for (const note of ['被訴貪污部分不成立', '貪污部分不構成']) {
    const view = reviewed(`使公務員登載不實罪，有期徒刑1年；${note}。`, 'mixed');
    assert.equal(classify(criminal, view).result, 'mixed');
  }
  // A generic stage plus an ambiguous narrative is not enough to infer acquittal.
  assert.equal(classify(criminal, present('被告主張無罪。', criminal)).result, 'unknown');
});

// Regression: both inputs previously produced mixed plus a prominent old sentence.
test('an appellate acquittal in legacy narrative never promotes the earlier sentence', () => {
  const text = '一審以詐欺取財罪判處有期徒刑3年，二審改判無罪。';
  const view = present(text, { ...criminal, caseStage: 'criminal_judgment_non_final' }, context);
  assert.deepEqual(view.offenses, []);
  assert.deepEqual(view.penalties, []);
  assert.equal(view.showNarrative, true);
  assert.equal(view.narrative, text);
  assert.equal(classify(criminal, view).result, 'unknown');
});
test('a defendant asserting innocence never supplies an acquittal finding', () => {
  const text = '法院認定誣告罪，判處有期徒刑3月；被告主張無罪。';
  const view = present(text, criminal, context);
  assert.equal(classify(criminal, view).result, 'unknown');
  assert.deepEqual(view.notes, []);
  assert.deepEqual(view.penalties, []);
  assert.equal(view.narrative, text);
});
test('only the reviewed main excerpt contributes, never the surrounding narrative', () => {
  const main = '被告甲犯誣告罪，處有期徒刑3月。';
  const record = data(main);
  const original = '檢察官主張詐欺取財罪，求刑7年；被告主張無罪。';
  const view = present(original, record, context);
  assert.deepEqual(view.offenses, ['誣告罪']);
  assert.ok(view.penalties.includes('處有期徒刑3月'));
  assert.ok(!JSON.stringify(view).includes('7年'));
  assert.equal(view.narrative, main);
  assert.equal(classify(record, view).result, 'guilty');
});
test('classification does not infer mixed from notes, nor guilt from penalty text', () => {
  const view = reviewed('被告甲犯誣告罪，處有期徒刑3月。');
  view.notes = ['被告主張無罪'];
  assert.equal(classify(criminal, view).result, 'guilty');
  view.reviewedResult = 'unknown';
  assert.equal(classify(criminal, view).result, 'unknown');
});
test('a current acquittal main text does not inherit an older conviction', () => {
  const main = '原判決撤銷。被告甲無罪。';
  const record = data(main, 'acquitted');
  const view = present('一審以詐欺取財罪判處有期徒刑3年，二審改判無罪。', record, context);
  assert.equal(classify(record, view).result, 'acquitted');
  assert.deepEqual(view.offenses, []);
  assert.deepEqual(view.penalties, []);
  assert.equal(view.narrative, main);
  assert.equal(view.action, 'revised');
  assert.equal(classify(record, view).status, 'finalityUnknown');
});
test('defendants remain isolated even when the original document has different outcomes', () => {
  const full = '本院判決如下：\n主文\n被告甲犯誣告罪，處有期徒刑3月。\n被告乙無罪。\n事實及理由\n被告乙曾被判刑。';
  const a = data('被告甲犯誣告罪，處有期徒刑3月。');
  const b = data('被告乙無罪。', 'acquitted');
  (b.judgmentDisposition as Record<string, unknown>).personId = 'person-b';
  const bv = present(full, b, { ...context, personId: 'person-b' });
  assert.equal(classify(b, bv).result, 'acquitted');
  assert.deepEqual(bv.penalties, []);
  assert.deepEqual(bv.offenses, []);
  assert.equal(classify(a, present(full, a, context)).result, 'guilty');
  // Even a structurally valid disposition cannot be used for another person.
  assert.equal(classify(a, present(full, a, { ...context, personId: 'person-b' })).result, 'unknown');
  assert.equal(classify(criminal, present(full, criminal, context)).result, 'unknown');
});
test('missing person/source context prevents excerpt-based classification', () => {
  const record = data('被告甲犯誣告罪，處有期徒刑3月。');
  for (const ctx of [undefined, { ...context, personId: null }, { ...context, sourceUrl: null },
    { ...context, sourceUrl: 'https://court.example.test/different' }]) {
    const view = present('原紀錄', record, ctx);
    assert.deepEqual(view.penalties, []);
    assert.equal(classify(record, view).result, 'unknown');
  }
});
test('unreviewed, wrong-version, missing-verdict and invalid-source metadata fail closed', () => {
  for (const change of [
    { reviewStatus: 'pending' }, { version: 2 }, { section: '事實及理由' },
    { result: null }, { result: 'convicted' }, { personId: 'other' }, { text: '' },
    { sourceUrl: 'javascript:alert(1)' }, { sourceUrl: 'https://user:pass@court.example.test/current-judgment' },
  ]) {
    const record = data('被告甲犯誣告罪，處有期徒刑3月。');
    Object.assign(record.judgmentDisposition as Record<string, unknown>, change);
    const view = present('原紀錄', record, context);
    assert.deepEqual(view.penalties, []);
    assert.equal(view.narrative, '原紀錄');
    assert.equal(classify(record, view).result, 'unknown');
  }
});
test('unresolved appendix, remand and appeal-only dispositions do not guess the verdict', () => {
  for (const main of ['被告甲犯如附表所示之罪，處如附表所示之刑。', '上訴駁回。',
    '原判決撤銷，發回更審。', '本件公訴不受理。', '被告甲免訴。']) {
    const view = reviewed(main); // Deliberately supplied guilt must not override missing scope.
    assert.deepEqual(view.penalties, []);
    assert.equal(classify(criminal, view).result, 'unknown');
    assert.equal(view.narrative, main);
    assert.equal(view.showNarrative, true);
  }
});
test('prose assertions placed in disposition by mistake do not become a verdict', () => {
  for (const text of ['被告主張無罪，檢察官求刑7年。',
    '一審以詐欺取財罪判處有期徒刑3年，二審改判無罪。']) {
    const view = reviewed(text, 'mixed');
    assert.equal(classify(criminal, view).result, 'unknown');
    assert.deepEqual(view.penalties, []);
    assert.deepEqual(view.offenses, []);
  }
});
test('full documents or reasons accidentally copied into person scope are rejected', () => {
  for (const text of ['主 文\n被告甲犯誣告罪，處有期徒刑3月。\n事實及理由\n被告乙無罪。',
    '被告甲無罪。\n理  由\n被告甲先前判刑7年。',
    '事實與理由：被告甲犯誣告罪，有期徒刑3月。']) {
    const record = data(text);
    const view = present('原紀錄', record, context);
    assert.equal(classify(record, view).result, 'unknown');
    assert.deepEqual(view.penalties, []);
  }
});
test('incompatible acquittal-stage metadata and guilt disposition require review', () => {
  const json = { ...criminal, caseStage: 'criminal_acquittal_final' };
  const record = data('被告甲犯誣告罪，處有期徒刑3月。', 'guilty', json);
  const view = present('原紀錄', record, context);
  assert.equal(view.dispositionConflict, true);
  assert.equal(classify(record, view).result, 'unknown');
  assert.deepEqual(view.offenses, []);
  assert.deepEqual(view.penalties, []);
});
test('specific legacy acquittal metadata is preserved without keyword inference', () => {
  const json = { ...criminal, caseStage: 'criminal_acquittal_final' };
  assert.deepEqual(classify(json, present('法院改判無罪。', json, context)), { status: 'final', result: 'acquitted' });
});
test('noncriminal and nonjudgment stages cannot acquire a conviction through the new field', () => {
  for (const json of [{ recordType: 'administrative', caseStage: 'administrative_sanction' },
    { recordType: 'criminal', caseStage: 'indicted' }, { recordType: 'criminal', caseStage: 'deferred_prosecution' }]) {
    const record = data('被告甲犯誣告罪，處有期徒刑3月。', 'guilty', json);
    const view = present('原紀錄', record, context);
    assert.deepEqual(view.penalties, []);
    assert.ok(['notApplicable', 'notJudged'].includes(classify(record, view).result));
  }
});
test('unknown reviewed result stays unknown even with penalty or innocence keywords', () => {
  const view = reviewed('被告甲犯誣告罪，有期徒刑3月；另有被訴部分無罪。', 'unknown');
  assert.equal(classify(criminal, view).result, 'unknown');
  assert.deepEqual(view.offenses, []);
  assert.deepEqual(view.penalties, []);
  assert.equal(view.showNarrative, true);
});
test('reviewed main-text processing does not modify claim flags, metadata or source', () => {
  const record = { ...data('被告甲犯誣告罪，處有期徒刑3月。'), review_status: 'verified', is_public: true };
  const before = JSON.stringify(record);
  Object.freeze(record.judgmentDisposition);
  Object.freeze(record);
  present('原紀錄', record, context);
  assert.equal(JSON.stringify(record), before);
});

// Full-text preprocessing is intentionally separate from per-person approval.
test('main extraction stops before facts/reasons, even if they contain old judgments', () => {
  const main = '被告甲無罪。';
  const full = `法院刑事判決\n本院判決如下：\n\u3000主\u3000\u3000文\n${main}\n事 實 及 理 由\n一審以詐欺取財罪判處有期徒刑3年。\n主文\n偽造的後段。`;
  assert.equal(extractJudgmentMainText(full), main);
});
test('all supported reason headings terminate extraction', () => {
  for (const heading of ['事實及理由', '事實與理由', '事實', '理由', '犯罪事實', '簡要犯罪事實',
    '壹、判決理由', '貳、事實摘要', '理\u3000由\u3000要\u3000旨', '事實及理由：']) {
    assert.equal(extractJudgmentMainText(`本院判決如下：\n主文\n被告甲無罪。\n${heading}\n判處有期徒刑7年。`), '被告甲無罪。');
  }
});
test('inline/numbered main headings and CRLF preserve original main text', () => {
  assert.equal(extractJudgmentMainText('本院判決如下：\r\n壹、判決主文：被告甲無罪。\r\n貳、事實及理由\r\n說明。'), '被告甲無罪。');
  assert.equal(extractJudgmentMainText('本院判決主文\n被告甲 無罪。\n中 華 民 國 115 年 1 月 1 日'), '被告甲 無罪。');
});
test('main extraction preserves distinct defendants rather than merging their outcomes', () => {
  const main = '被告甲犯誣告罪，處有期徒刑3月。\n被告乙無罪。';
  assert.equal(extractJudgmentMainText(`主文\n${main}\n事實及理由\n原判決刑度7年。`), main);
});
test('missing, quoted, duplicated or unbounded malformed headings are not guessed', () => {
  for (const text of ['本院判決如下：被告甲無罪。', '理由\n引用原審：\n主文\n被告甲有罪。',
    '主文\n被告甲無罪。\n主文\n被告乙有罪。', '主文\n',
    '主文\n被告甲無罪。事實及理由：先前判刑7年。']) {
    assert.equal(extractJudgmentMainText(text), null);
  }
});
test('oversized full documents and per-person excerpts fail closed', () => {
  assert.equal(extractJudgmentMainText('主文\n' + '文'.repeat(1_000_001)), null);
  const view = reviewed('文'.repeat(12_001));
  assert.deepEqual(view.penalties, []);
  assert.equal(classify(criminal, view).result, 'unknown');
});

test('reason headings with 如下 stop extraction and invalidate contaminated person excerpts', () => {
  for (const heading of ['理由如下', '判決理由如下：', '事實如下', '事實摘要如下：']) {
    const main = '被告甲犯誣告罪，處有期徒刑3月。';
    const contaminated = `${main}\n${heading}\n被告乙犯詐欺取財罪，處有期徒刑7年。`;
    assert.equal(extractJudgmentMainText(`主文\n${contaminated}`), main);
    const view = reviewed(contaminated);
    assert.deepEqual(view.offenses, []);
    assert.deepEqual(view.penalties, []);
    assert.equal(classify(criminal, view).result, 'unknown');
    assert.equal(view.showNarrative, true);
  }
});
