import assert from 'node:assert/strict';
import { assessLegalRecordMatch } from './legal-record-review-policy.mjs';

const strongIdentity = {
  exactOfficeAndDistrict: true,
  newsIdentityBridge: true,
  caseNarrativeBridge: true,
};
const completeCase = {
  officialDocumentUrlConfirmed: true,
  caseNumberConfirmed: true,
  judgmentDateConfirmed: true,
  offenseConfirmed: true,
  caseStageConfirmed: true,
  outcomeConfirmed: true,
  finalityChecked: true,
  isFinal: true,
};

const verified = assessLegalRecordMatch({
  normalizedNameMatch: true,
  sourceType: 'court_document',
  sourceUrl: 'https://judgment.judicial.gov.tw/example',
  scope: 'criminal',
  subjectRole: 'defendant',
  identityEvidence: strongIdentity,
  caseEvidence: completeCase,
  incidentYear: 2018,
  judgmentYear: 2024,
});
assert.equal(verified.decision, 'auto_verified');
assert.equal(verified.overallScore, 100);
assert.equal(verified.publicationApproved, false);

const nameOnly = assessLegalRecordMatch({
  normalizedNameMatch: true,
  sourceType: 'court_document',
  sourceUrl: 'https://judgment.judicial.gov.tw/example',
  scope: 'criminal',
  subjectRole: 'defendant',
  caseEvidence: completeCase,
});
assert.equal(nameOnly.identityScore, 35);
assert.equal(nameOnly.decision, 'needs_more_evidence');

const nonFinal = assessLegalRecordMatch({
  normalizedNameMatch: true,
  sourceType: 'court_document',
  sourceUrl: 'https://judgment.judicial.gov.tw/example',
  scope: 'criminal',
  subjectRole: 'defendant',
  identityEvidence: strongIdentity,
  caseEvidence: { ...completeCase, isFinal: false },
});
assert.equal(nonFinal.decision, 'manual_review');

const mediaOnly = assessLegalRecordMatch({
  normalizedNameMatch: true,
  sourceType: 'media_guide',
  sourceUrl: 'https://example.com/news',
  scope: 'criminal',
  subjectRole: 'defendant',
  identityEvidence: strongIdentity,
  caseEvidence: completeCase,
});
assert.equal(mediaOnly.caseEvidenceScore, 45);
assert.equal(mediaOnly.decision, 'needs_more_evidence');

const thirdParty = assessLegalRecordMatch({
  normalizedNameMatch: true,
  sourceType: 'court_document',
  sourceUrl: 'https://judgment.judicial.gov.tw/example',
  scope: 'criminal',
  subjectRole: 'assistant',
  identityEvidence: strongIdentity,
  caseEvidence: completeCase,
});
assert.equal(thirdParty.decision, 'rejected_or_hold');
assert.ok(thirdParty.blockers.includes('person is not the defendant'));

const impossibleDate = assessLegalRecordMatch({
  normalizedNameMatch: true,
  sourceType: 'court_document',
  sourceUrl: 'https://judgment.judicial.gov.tw/example',
  scope: 'criminal',
  subjectRole: 'defendant',
  identityEvidence: strongIdentity,
  caseEvidence: completeCase,
  incidentYear: 2020,
  judgmentYear: 2019,
});
assert.equal(impossibleDate.decision, 'rejected_or_hold');
assert.ok(impossibleDate.blockers.includes('judgment predates incident-year lower bound'));

console.log('legal record review policy tests passed');
