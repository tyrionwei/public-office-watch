import assert from 'node:assert/strict';
import {
  compareClaimToEvidence,
  derivedElectionEvidence,
  evidenceTier,
  externalFindingEvidence,
  normalizeText,
  originalSourceEvidence,
  researchStatus,
} from './build-tnl-dark-guide-source-research.mjs';

assert.equal(normalizeText('曾任 臺北市議員（第 12 屆）'), '曾任台北市議員第12屆');
assert.equal(compareClaimToEvidence('曾任謝長廷辦公室幕僚', '謝長廷辦公室幕僚；立委服務處主任'), 1);
assert.ok(compareClaimToEvidence('曾任立委服務處主任', '立法委員地方服務處主任') >= 0.45);

const officialClaim = {
  source_name: '中央選舉委員會選舉資料庫：公開資料包',
  source_url: 'https://db.cec.gov.tw/',
};
assert.equal(evidenceTier(officialClaim, { source_type: 'official_election' }), 'official');
assert.equal(evidenceTier({ source_name: 'VoteTW' }, { source_type: 'public_reference' }), 'secondary');

assert.equal(researchStatus('政治工作', [{
  matchScore: 1,
  tier: 'official',
  reviewStatus: 'verified',
}]), 'auto_reviewable');
assert.equal(researchStatus('政治家族', [{
  matchScore: 0.7,
  tier: 'secondary',
  reviewStatus: 'verified',
}]), 'manual_review');
assert.equal(researchStatus('涉案紀錄', []), 'external_search_needed');

const linkedJudgment = originalSourceEvidence({
  text: '曾涉及案件',
  originalSourceUrl: 'https://law.judicial.gov.tw/FJUD/data.aspx?id=test',
});
assert.equal(linkedJudgment[0].tier, 'official');
assert.equal(linkedJudgment[0].reviewStatus, 'linked_unverified');
assert.equal(researchStatus('涉案紀錄', linkedJudgment), 'manual_review');

const electedYearEvidence = derivedElectionEvidence({
  category: '政治工作',
  text: '2018年當選議員',
}, [{
  raceType: 'councilor',
  is_elected: true,
  election_year: 2018,
  source_name: '中央選舉委員會選舉資料庫：公開資料包',
  source_url: 'https://db.cec.gov.tw/',
}]);
assert.equal(electedYearEvidence[0].tier, 'official');
assert.equal(electedYearEvidence[0].reviewStatus, 'verified');
assert.equal(researchStatus('政治工作', electedYearEvidence), 'auto_reviewable');

const electedYearWithoutOfficeEvidence = derivedElectionEvidence({
  category: '政治工作',
  text: '2018年當選',
}, [{
  raceType: 'councilor',
  is_elected: true,
  election_year: 2018,
  source_name: '中央選舉委員會選舉資料庫：公開資料包',
  source_url: 'https://db.cec.gov.tw/',
}]);
assert.equal(electedYearWithoutOfficeEvidence[0].tier, 'official');

const derivedTerms = derivedElectionEvidence({
  category: '政治工作',
  text: '1998年後曾任2屆議員',
  occurrences: [{ year: 2022 }],
}, [{
  raceType: 'councilor',
  is_elected: true,
  election_year: 2014,
  source_name: 'VoteTW',
  source_url: 'https://votetw.com/',
}, {
  raceType: 'councilor',
  is_elected: true,
  election_year: 2018,
  source_name: 'VoteTW',
  source_url: 'https://votetw.com/',
}, {
  raceType: 'councilor',
  is_elected: true,
  election_year: 2022,
  source_name: '中央選舉委員會選舉資料庫：公開資料包',
  source_url: 'https://db.cec.gov.tw/',
}]);
assert.equal(derivedTerms[0].tier, 'secondary');
assert.equal(derivedTerms[0].reviewStatus, 'derived_secondary');
assert.equal(researchStatus('政治工作', derivedTerms), 'manual_review');

const countyCouncilTerms = derivedElectionEvidence({
  category: '政治工作',
  text: '曾任2屆縣議員',
  occurrences: [{ year: 2018 }],
}, [{
  raceType: 'councilor',
  is_elected: true,
  election_year: 2009,
  source_name: '中央選舉委員會選舉資料庫：公開資料包',
  source_url: 'https://db.cec.gov.tw/',
}, {
  raceType: 'councilor',
  is_elected: true,
  election_year: 2014,
  source_name: '中央選舉委員會選舉資料庫：公開資料包',
  source_url: 'https://db.cec.gov.tw/',
}]);
assert.equal(countyCouncilTerms[0].tier, 'official');

const externalEvidence = externalFindingEvidence({
  outcome: 'source_found_manual_review',
  sources: [{
    tier: 'official',
    name: '臺灣臺南地方法院',
    url: 'https://example.gov.tw/case',
    supports: '案件一審判決內容',
  }],
}, {
  text: '貪污／法院審理中',
});
assert.equal(externalEvidence[0].tier, 'official');
assert.equal(externalEvidence[0].reviewStatus, 'external_manual_review');
assert.equal(researchStatus('涉案紀錄', externalEvidence), 'manual_review');

assert.equal(researchStatus('涉案紀錄', [], {
  outcome: 'not_found_after_stop_loss',
}), 'not_found_after_stop_loss');

assert.equal(researchStatus('政治家族', [{
  matchScore: 1,
  tier: 'official',
  reviewStatus: 'verified',
}]), 'manual_review');

console.log('build-tnl-dark-guide-source-research tests passed');
