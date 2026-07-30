import assert from 'node:assert/strict';
import {
  bestEvidenceExcerpt,
  candidateIdentityKey,
  candidateNameCityKey,
  cecBulletinEvidence,
  combinedCandidateHistory,
  compareClaimToEvidence,
  derivedElectionEvidence,
  evidenceTier,
  eligibleNameCityHistory,
  externalFindingEvidence,
  externalFindingCanAutoReview,
  historicalSourceHistoryRow,
  moiLocalOfficialEvidence,
  normalizeText,
  originalSourceEvidence,
  researchStatus,
  stableOrderForTable,
} from './build-tnl-dark-guide-source-research.mjs';

assert.equal(
  candidateIdentityKey('王威元', '中國國民黨', 'nwt'),
  candidateIdentityKey(' 王威元 ', '中國國民黨', 'nwt'),
);

assert.equal(
  candidateIdentityKey('王威元', '中國國民黨', 'nwt'),
  candidateIdentityKey('王威元', '國民黨', 'nwt'),
);
assert.equal(
  candidateIdentityKey('張志豪', '民主進步黨', 'nwt'),
  candidateIdentityKey('張志豪', '民進黨', 'nwt'),
);

assert.equal(candidateNameCityKey(' 李婉鈺 ', 'NWT'), '李婉鈺|nwt');
assert.equal(candidateNameCityKey('', 'nwt'), null);

const nameCityHistory = [{ election_year: 2014 }, { election_year: 2018 }];
const eligibleCrossPartyHistory = eligibleNameCityHistory(
  'person-li',
  nameCityHistory,
  new Set(['person-li']),
);
assert.equal(eligibleCrossPartyHistory.length, 2);
assert.ok(eligibleCrossPartyHistory.every((row) => row.identityInferred === true));
assert.deepEqual(
  eligibleNameCityHistory('person-li', nameCityHistory, new Set(['person-li', 'person-other'])),
  [],
);
assert.deepEqual(
  eligibleNameCityHistory('person-li', nameCityHistory, new Set(['person-other'])),
  [],
);

assert.equal(stableOrderForTable('candidates'), 'id.asc');
assert.equal(stableOrderForTable('person_canonical_map'), 'person_id.asc');
assert.equal(stableOrderForTable('person_identity_matches'), 'source_person_id.asc,person_id.asc');

const combinedHistory = combinedCandidateHistory([{
  election_year: 2018,
  raceType: 'councilor',
  is_elected: true,
  party: '民主進步黨',
  cityCode: 'nwt',
  area: 4,
}], [{
  election_year: 2014,
  raceType: 'councilor',
  is_elected: true,
  party: '民進黨',
  cityCode: 'nwt',
  area: 4,
}, {
  election_year: 2018,
  raceType: 'councilor',
  is_elected: true,
  party: '民進黨',
  cityCode: 'nwt',
  area: 4,
}]);
assert.deepEqual(combinedHistory.map((row) => row.election_year), [2018, 2014]);
assert.equal(combinedHistory[0].identityInferred, undefined);
assert.equal(combinedHistory[1].identityInferred, true);

assert.equal(normalizeText('曾任 臺北市議員（第 12 屆）'), '曾任台北市議員第12屆');
assert.equal(compareClaimToEvidence('曾任謝長廷辦公室幕僚', '謝長廷辦公室幕僚；立委服務處主任'), 1);
assert.ok(compareClaimToEvidence('曾任立委服務處主任', '立法委員地方服務處主任') >= 0.45);
assert.equal(
  bestEvidenceExcerpt('曾任謝長廷辦公室幕僚', '外交部科長\n謝長廷辦公室幕僚\n立委服務處主任').text,
  '謝長廷辦公室幕僚',
);

const parsedCecProfiles = new Map([['guide-1', {
  guideId: 'guide-1',
  year: 2022,
  city: '台北市',
  mappingMode: 'parsed_exact',
  education: '國立政治大學公共行政學系畢業',
  experience: '立法委員服務處主任\n台北市政府顧問',
  sourceUrl: 'https://bulletin.cec.gov.tw/example.pdf',
  sourcePage: 2,
}]]);
const cecExperience = cecBulletinEvidence({
  category: '政治工作',
  text: '曾任台北市政府顧問',
  occurrences: [{ guideId: 'guide-1' }],
}, parsedCecProfiles);
assert.equal(cecExperience.length, 1);
assert.equal(cecExperience[0].claimType, 'candidate_reported_experience');
assert.equal(cecExperience[0].matchScore, 1);
assert.equal(cecExperience[0].reviewStatus, 'candidate_self_reported_text_match');
assert.equal(researchStatus('政治工作', cecExperience), 'auto_reviewable');

const cecEducation = cecBulletinEvidence({
  category: '其他',
  text: '國立政治大學公共行政學系畢業',
  occurrences: [{ guideId: 'guide-1' }],
}, parsedCecProfiles);
assert.equal(cecEducation.length, 1);
assert.equal(cecEducation[0].claimType, 'candidate_reported_education');
assert.equal(researchStatus('其他', cecEducation), 'auto_reviewable');

assert.deepEqual(cecBulletinEvidence({
  category: '政治家族',
  text: '父親曾任議員',
  occurrences: [{ guideId: 'guide-1' }],
}, parsedCecProfiles), []);
assert.deepEqual(cecBulletinEvidence({
  category: '涉案紀錄',
  text: '法院審理中',
  occurrences: [{ guideId: 'guide-1' }],
}, parsedCecProfiles), []);
assert.deepEqual(cecBulletinEvidence({
  category: '政治工作',
  text: '未出現在公報的經歷',
  occurrences: [{ guideId: 'guide-1' }],
}, parsedCecProfiles), []);
const cecPossibleRoleMatch = cecBulletinEvidence({
  category: '政治工作',
  text: '曾任台北市政府副顧問',
  occurrences: [{ guideId: 'guide-1' }],
}, parsedCecProfiles);
assert.equal(cecPossibleRoleMatch.length, 1);
assert.equal(cecPossibleRoleMatch[0].claimType, 'candidate_reported_experience_possible_match');
assert.equal(cecPossibleRoleMatch[0].reviewStatus, 'candidate_self_reported_possible_match');
assert.equal(researchStatus('政治工作', cecPossibleRoleMatch), 'manual_review');

const locatorOnlyCecProfiles = new Map([['guide-2', {
  guideId: 'guide-2',
  year: 2022,
  city: '台北市',
  mappingMode: 'source_locator_only',
  education: '',
  experience: '',
  sourceUrl: 'https://bulletin.cec.gov.tw/locator.pdf',
  sourcePage: null,
}]]);
const cecLocator = cecBulletinEvidence({
  category: '其他',
  text: '某項學歷',
  occurrences: [{ guideId: 'guide-2' }],
}, locatorOnlyCecProfiles);
assert.equal(cecLocator.length, 1);
assert.equal(cecLocator[0].claimType, 'candidate_bulletin_manual_locator');
assert.equal(cecLocator[0].matchScore, 0);
assert.equal(cecLocator[0].reviewStatus, 'candidate_self_reported_unparsed');
assert.equal(researchStatus('其他', cecLocator), 'manual_review');

const moiProfiles = new Map([['guide-1', {
  name: '山田摩衣',
  city: '新北市',
  education: '文化大學英國語文學系',
  experience: '民主進步黨新北市黨部宣傳組組長\n立法院國會辦公室副主任',
  sourceUrl: 'https://www.moi.gov.tw/LocalOfficial_Content.aspx?example=1',
  guideIds: ['guide-1'],
}]]);
const moiExperience = moiLocalOfficialEvidence({
  category: '政治工作',
  text: '曾任民主進步黨新北市黨部宣傳組組長',
  occurrences: [{ guideId: 'guide-1' }],
}, moiProfiles);
assert.equal(moiExperience.length, 1);
assert.equal(moiExperience[0].claimType, 'official_profile_experience');
assert.equal(moiExperience[0].reviewStatus, 'official_profile_text_match');
assert.equal(researchStatus('政治工作', moiExperience), 'auto_reviewable');

const moiEducation = moiLocalOfficialEvidence({
  category: '其他',
  text: '文化大學英國語文學系',
  occurrences: [{ guideId: 'guide-1' }],
}, moiProfiles);
assert.equal(moiEducation.length, 1);
assert.equal(moiEducation[0].claimType, 'official_profile_education');
assert.deepEqual(moiLocalOfficialEvidence({
  category: '政治家族',
  text: '父親曾任議員',
  occurrences: [{ guideId: 'guide-1' }],
}, moiProfiles), []);
assert.deepEqual(moiLocalOfficialEvidence({
  category: '涉案紀錄',
  text: '法院審理中',
  occurrences: [{ guideId: 'guide-1' }],
}, moiProfiles), []);

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

const identityInferredElectionEvidence = derivedElectionEvidence({
  category: '政治工作',
  text: '2018年當選議員',
}, [{
  raceType: 'councilor',
  is_elected: true,
  election_year: 2018,
  source_name: '中央選舉委員會選舉資料庫：公開資料包',
  source_url: 'https://db.cec.gov.tw/',
  identityInferred: true,
}]);
assert.equal(identityInferredElectionEvidence[0].tier, 'official');
assert.equal(identityInferredElectionEvidence[0].reviewStatus, 'identity_inferred');
assert.match(identityInferredElectionEvidence[0].claimValue, /身分推定/);
assert.equal(researchStatus('政治工作', identityInferredElectionEvidence), 'manual_review');

const directEvidenceWinsOverInferredDuplicate = derivedElectionEvidence({
  category: '政治工作',
  text: '2018年當選議員',
}, [{
  raceType: 'councilor',
  is_elected: true,
  election_year: 2018,
  source_name: '中央選舉委員會選舉資料庫',
  source_url: 'https://db.cec.gov.tw/',
}, {
  raceType: 'councilor',
  is_elected: true,
  election_year: 2018,
  source_name: '中央選舉委員會選舉資料庫：公開資料包',
  source_url: 'https://data.gov.tw/dataset/13119',
  identityInferred: true,
}]);
assert.equal(directEvidenceWinsOverInferredDuplicate[0].reviewStatus, 'verified');
assert.equal(researchStatus('政治工作', directEvidenceWinsOverInferredDuplicate), 'auto_reviewable');

const matchedHistoricalWinner = historicalSourceHistoryRow({
  source_type: 'official_election',
  source_name: '中央選舉委員會選舉資料庫：公開資料包',
  source_url: 'https://data.gov.tw/dataset/13119',
  raw_name: '王淑慧',
  party: '民主進步黨',
  position: '新北市議員',
  district: '新北市第4選舉區',
  election_year: 2014,
}, { person_id: 'person-wang', match_status: 'probable_match', score: 90 });
assert.equal(matchedHistoricalWinner.raceType, 'councilor');
assert.equal(matchedHistoricalWinner.is_elected, true);
assert.equal(matchedHistoricalWinner.cityCode, 'nwt');
assert.equal(matchedHistoricalWinner.identityInferred, true);

const matchedHistoricalLoser = historicalSourceHistoryRow({
  source_type: 'official_election',
  source_name: '中央選舉委員會選舉資料庫：公開資料包',
  raw_name: '王淑慧',
  party: '民主進步黨',
  position: '新北市議員候選人',
  district: '新北市第4選舉區',
  election_year: 2014,
}, { person_id: 'person-wang', match_status: 'probable_match', score: 90 });
assert.equal(matchedHistoricalLoser.is_elected, false);

const conflictingTerms = derivedElectionEvidence({
  category: '政治工作',
  text: '1998年後曾任1屆議員',
  occurrences: [{ year: 2022 }],
}, [{
  raceType: 'councilor',
  is_elected: true,
  election_year: 2005,
  source_name: '中央選舉委員會選舉資料庫：公開資料包',
  identityInferred: true,
}, {
  raceType: 'councilor',
  is_elected: true,
  election_year: 2018,
  source_name: '中央選舉委員會選舉資料庫',
}]);
assert.equal(conflictingTerms[0].claimType, 'derived_election_history_conflict');
assert.equal(conflictingTerms[0].reviewStatus, 'identity_conflict');
assert.match(conflictingTerms[0].claimValue, /暗公報敘述1屆/);
assert.match(conflictingTerms[0].claimValue, /2005、2018/);
assert.equal(researchStatus('政治工作', conflictingTerms), 'manual_review');

const partialTerms = derivedElectionEvidence({
  category: '政治工作',
  text: '曾任3屆議員',
  occurrences: [{ year: 2022 }],
}, [{
  raceType: 'councilor',
  is_elected: true,
  election_year: 2014,
  source_name: '中央選舉委員會選舉資料庫：公開資料包',
  identityInferred: true,
}, {
  raceType: 'councilor',
  is_elected: true,
  election_year: 2018,
  source_name: '中央選舉委員會選舉資料庫',
}]);
assert.equal(partialTerms[0].claimType, 'derived_election_history_partial');
assert.equal(partialTerms[0].reviewStatus, 'identity_partial');
assert.match(partialTerms[0].claimValue, /聲稱3屆/);
assert.match(partialTerms[0].claimValue, /目前找到2個當選年份/);
assert.equal(researchStatus('政治工作', partialTerms), 'manual_review');

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

const directExternalFinding = {
  outcome: 'source_found_manual_review',
  sources: [{
    tier: 'official',
    name: '臺灣臺南地方法院',
    url: 'https://example.gov.tw/case',
    supports: '案件一審判決內容',
  }],
};
const externalEvidence = externalFindingEvidence(directExternalFinding, {
  text: '貪污／法院審理中',
});
assert.equal(externalEvidence[0].tier, 'official');
assert.equal(externalEvidence[0].reviewStatus, 'external_manual_review');
assert.equal(externalFindingCanAutoReview(directExternalFinding), true);
assert.equal(researchStatus('涉案紀錄', externalEvidence, directExternalFinding), 'auto_reviewable');

const suspiciousFinding = {
  outcome: 'source_found_manual_review',
  sources: [{
    tier: 'other',
    name: '網友整理頁',
    url: 'https://example.com/untrusted',
  }],
};
assert.equal(externalFindingCanAutoReview(suspiciousFinding), false);
assert.equal(
  researchStatus('政治工作', externalFindingEvidence(suspiciousFinding, { text: '曾任助理' }), suspiciousFinding),
  'manual_review',
);

const partialFinding = {
  outcome: 'source_found_partial_manual_review',
  sources: [{
    tier: 'official',
    name: '政府資料',
    url: 'https://example.gov.tw/profile',
  }],
};
assert.equal(externalFindingCanAutoReview(partialFinding), false);
assert.equal(
  researchStatus('政治工作', externalFindingEvidence(partialFinding, { text: '曾任助理' }), partialFinding),
  'manual_review',
);

assert.equal(researchStatus('涉案紀錄', [], {
  outcome: 'not_found_after_stop_loss',
}), 'not_found_after_stop_loss');

assert.equal(researchStatus('政治家族', [{
  matchScore: 1,
  tier: 'official',
  reviewStatus: 'verified',
}]), 'auto_reviewable');

console.log('build-tnl-dark-guide-source-research tests passed');
