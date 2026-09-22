import assert from 'node:assert/strict';
import test from 'node:test';
import { legalRecordPresentation as present, legalCaseClassification as classify } from '../src/lib/legalRecordPresentation.ts';
const context = { personId: 'person-a', sourceUrl: 'https://court.example.test/appeal' };
function fixture() {
  const text = '其他（被告甲部分，暨被告乙沒收部分）上訴駁回。';
  return { recordType: 'criminal', caseStage: 'criminal_judgment', judgmentDate: '2026-01-20',
    judgmentDisposition: { version: 2, section: '主文', reviewStatus: 'reviewed', ...context,
      text, result: 'unknown', caseNumber: '測試高院115年度上訴字第1號', judgmentDate: '2026-01-20',
      personScopeQuote: '被告甲部分', upheldJudgment: {
        reviewStatus: 'reviewed', relation: 'appeal_dismissed', scope: 'entire_person_disposition',
        personId: context.personId, currentCaseNumber: '測試高院115年度上訴字第1號',
        currentSourceUrl: context.sourceUrl, currentDispositionText: text, personScopeQuote: '被告甲部分',
        priorCaseNumber: '測試地院113年度訴字第1號', evidenceSourceUrl: context.sourceUrl,
        evidenceText: '不服測試地院113年度訴字第1號第一審判決，提起上訴。',
        prior: { version: 1, section: '主文', reviewStatus: 'reviewed', personId: context.personId,
          sourceUrl: 'https://court.example.test/first-main', sourceKind: 'court_published_main_text',
          caseNumber: '測試地院113年度訴字第1號', judgmentDate: '2024-06-01',
          text: '被告甲犯誣告罪，處有期徒刑3月。褫奪公權1年。', result: 'guilty' },
      } },
  };
}
function view(record = fixture()) { return present('原敘述曾記載其他被告刑期7年。', record, context); }
test('a reviewed appeal shows current action and separately sourced prior sentence', () => {
  const r = fixture(), v = view(r);
  assert.equal(v.action, 'dismissed');
  assert.equal(v.reviewedResult, 'guilty');
  assert.deepEqual(v.offenses, ['誣告罪']);
  assert.deepEqual(v.penalties, ['處有期徒刑3月', '褫奪公權1年']);
  assert.equal(v.basis?.sourceUrl, r.judgmentDisposition.upheldJudgment.prior.sourceUrl);
  assert.equal(v.narrative, r.judgmentDisposition.text);
  assert.equal(v.showNarrative, true);
  assert.equal(classify(r, v).status, 'finalityUnknown');
  assert.ok(!JSON.stringify(v).includes('7年'));
});
for (const [name, text] of [
  ['between action words', '被告甲上訴\n駁回。'],
  ['inside dismissal word', '被告甲上訴駁\n回。'],
] as const) test(`a layout newline ${name} preserves the reviewed appeal link`, () => {
  const r = fixture(), d = r.judgmentDisposition;
  d.text = text; d.personScopeQuote = '被告甲';
  Object.assign(d.upheldJudgment, { currentDispositionText: text, personScopeQuote: '被告甲' });
  const v = view(r);
  assert.equal(v.action, 'dismissed');
  assert.equal(v.reviewedResult, 'guilty');
  assert.deepEqual(v.offenses, ['誣告罪']);
  assert.deepEqual(v.penalties, ['處有期徒刑3月', '褫奪公權1年']);
  assert.equal(v.narrative, text);
});
test('a newline before another person dismissal cannot inherit the first person prior judgment', () => {
  const r = fixture(), d = r.judgmentDisposition;
  d.text = '被告甲上訴\n駁回被告乙之上訴。'; d.personScopeQuote = '被告甲';
  Object.assign(d.upheldJudgment, { currentDispositionText: d.text, personScopeQuote: '被告甲' });
  const v = view(r);
  assert.equal(v.action, null);
  assert.equal(v.reviewedResult, 'unknown');
  assert.equal(v.basis, null);
  assert.deepEqual(v.offenses, []);
  assert.deepEqual(v.penalties, []);
});
test('a comma-separated other-person dismissal cannot inherit the first person prior judgment', () => {
  const r = fixture(), d = r.judgmentDisposition;
  d.text = '被告甲部分另行審結，被告乙上訴駁回。';
  Object.assign(d.upheldJudgment, { currentDispositionText: d.text });
  const v = view(r);
  assert.equal(v.action, null);
  assert.equal(v.reviewedResult, 'unknown');
  assert.equal(v.basis, null);
  assert.deepEqual(v.offenses, []);
  assert.deepEqual(v.penalties, []);
});
test('unbalanced layout parentheses cannot join another person dismissal', () => {
  const r = fixture(), d = r.judgmentDisposition;
  d.text = '被告甲部分（另行審結，\n被告乙上訴駁回。';
  Object.assign(d.upheldJudgment, { currentDispositionText: d.text });
  const v = view(r);
  assert.equal(v.action, null);
  assert.equal(v.reviewedResult, 'unknown');
  assert.equal(v.basis, null);
  assert.deepEqual(v.offenses, []);
  assert.deepEqual(v.penalties, []);
});
test('an appeal-only main without a linked sentence still shows its verified action', () => {
  const r = fixture(); const d = { ...r.judgmentDisposition, version: 1 };
  const v = present('原敘述', { ...r, judgmentDisposition: d }, context);
  assert.equal(v.action, 'dismissed'); assert.equal(v.reviewedResult, 'unknown');
  assert.deepEqual(v.penalties, []); assert.equal(v.basis, null);
});
const failures: Array<[string, (r: ReturnType<typeof fixture>) => void]> = [
  ['pending relationship', r => { r.judgmentDisposition.upheldJudgment.reviewStatus = 'pending'; }],
  ['pending prior main', r => { r.judgmentDisposition.upheldJudgment.prior.reviewStatus = 'pending'; }],
  ['wrong linked person', r => { r.judgmentDisposition.upheldJudgment.personId = 'person-b'; }],
  ['wrong prior person', r => { r.judgmentDisposition.upheldJudgment.prior.personId = 'person-b'; }],
  ['partial appeal scope', r => { r.judgmentDisposition.upheldJudgment.scope = 'sentence_only'; }],
  ['incorrect relation', r => { r.judgmentDisposition.upheldJudgment.relation = 'remand'; }],
  ['wrong current court', r => { r.judgmentDisposition.upheldJudgment.currentCaseNumber = 'other'; }],
  ['wrong prior court', r => { r.judgmentDisposition.upheldJudgment.priorCaseNumber = 'other'; }],
  ['wrong evidence source', r => { r.judgmentDisposition.upheldJudgment.evidenceSourceUrl += '/other'; }],
  ['evidence does not identify prior', r => { r.judgmentDisposition.upheldJudgment.evidenceText = '僅記載上訴。'; }],
  ['root date differs from claim', r => { r.judgmentDate = '2026-02-01'; }],
  ['impossible prior date', r => { r.judgmentDisposition.upheldJudgment.prior.judgmentDate = '2024-02-30'; }],
  ['prior date not earlier', r => { r.judgmentDisposition.upheldJudgment.prior.judgmentDate = '2026-01-20'; }],
  ['unsafe prior URL', r => { r.judgmentDisposition.upheldJudgment.prior.sourceUrl = 'javascript:alert(1)'; }],
  ['unknown prior result', r => { r.judgmentDisposition.upheldJudgment.prior.result = 'unknown'; }],
  ['changed current quote', r => { r.judgmentDisposition.upheldJudgment.currentDispositionText = '上訴駁回。'; }],
  ['scope quote from someone else', r => { r.judgmentDisposition.personScopeQuote = '不存在之人'; }],
  ['root guilt is not a substitute for prior evidence', r => { r.judgmentDisposition.result = 'guilty'; }],
  ['a prior appeal is not recursively expanded', r => { r.judgmentDisposition.upheldJudgment.prior.text = '上訴駁回。'; }],
  ['prior reasons are rejected', r => { r.judgmentDisposition.upheldJudgment.prior.text += '\n理由如下\n另一人犯詐欺取財罪。'; }],
  ['current resentencing blocks inherited guilt', r => { r.judgmentDisposition.text = '原判決撤銷。上訴駁回。'; }],
];
for (const [name, change] of failures) test(`linked provenance fails closed: ${name}`, () => {
  const r = fixture(); change(r); const v = view(r);
  assert.equal(v.reviewedResult, 'unknown'); assert.equal(v.basis, null);
  assert.deepEqual(v.offenses, []); assert.deepEqual(v.penalties, []);
});
test('an acquittal-stage conflict suppresses inherited guilt', () => {
  const r = fixture(); r.caseStage = 'criminal_acquittal_final'; const v = view(r);
  assert.equal(v.dispositionConflict, true); assert.equal(classify(r, v).result, 'unknown');
  assert.deepEqual(v.penalties, []); assert.equal(v.basis, null);
});
test('a verified prior acquittal is not converted to guilt by appeal dismissal', () => {
  const r = fixture(); Object.assign(r.judgmentDisposition.upheldJudgment.prior, { text: '被告甲無罪。', result: 'acquitted' });
  const v = view(r); assert.equal(classify(r, v).result, 'acquitted'); assert.deepEqual(v.penalties, []);
});
test('no mutation of records, public flags or reviewed metadata', () => {
  const r = fixture(), before = JSON.stringify(r); view(r); assert.equal(JSON.stringify(r), before);
});

import { legalRecordDisplay } from '../src/lib/legalRecordPresentation.ts';
test('legacy display hides blank offense, sentence and unknown verdict rows', () => {
  const r = { recordType: 'criminal', caseStage: 'criminal_judgment', judgmentDate: '2026-01-20' };
  const v = present('裁判日期：2026-01-20。保留原紀錄。', r, context);
  assert.deepEqual(legalRecordDisplay(v, classify(r, v)), {
    showOffense: false, showSentence: false, showResult: false, showDate: false, notice: 'legacy',
  });
});
for (const [name, r] of [
  ['indictment', { recordType: 'criminal', caseStage: 'indicted' }],
  ['deferred prosecution', { recordType: 'criminal', caseStage: 'deferred_prosecution' }],
  ['administrative sanction', { recordType: 'administrative', caseStage: 'administrative_sanction' }],
] as const) test(`${name} does not request a judgment-main backfill`, () => {
  const v = present('保留原紀錄。', r, context);
  assert.equal(legalRecordDisplay(v, classify(r, v)).notice, null);
});
test('no blind date replacement and no loss of the source text', () => {
  const r = { recordType: 'criminal', caseStage: 'criminal_judgment', judgmentDate: '2026-01-20' };
  const text = '另次裁判日期：2026-01-20。'; const v = present(text, r, context);
  assert.equal(legalRecordDisplay(v, classify(r, v)).showDate, true);
  assert.equal(v.narrative, text);
});
test('complete linked evidence renders structured fields and retains current date', () => {
  const r = fixture(), v = view(r);
  assert.deepEqual(legalRecordDisplay(v, classify(r, v)), {
    showOffense: true, showSentence: true, showResult: true, showDate: true, notice: null,
  });
});
test('a sentence-only subject quote cannot claim whole-person inheritance', () => {
  const r = fixture(), d = r.judgmentDisposition;
  d.personScopeQuote = '被告甲之刑部分'; d.text = '被告甲之刑部分上訴駁回。';
  Object.assign(d.upheldJudgment, { personScopeQuote:d.personScopeQuote, currentDispositionText:d.text });
  assert.equal(view(r).reviewedResult, 'unknown'); assert.deepEqual(view(r).penalties, []);
});
