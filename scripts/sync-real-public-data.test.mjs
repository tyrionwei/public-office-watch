import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  applyReviewedCandidateResultOverride,
  buildCurrentOfficeholders,
  buildPartyRegistryProfile,
  buildEnrichmentPartyAffiliationRows,
  buildSourcePersonRows,
  buildPersonEnrichmentClaimRows,
  buildLegalRecordLeadRows,
  classifyHistoricalCecCandidateEntry,
  darkGuideFamilyReferenceNames,
  describeFetchError,
  historicalCecAggregateResultKey,
  buildHistoricalCecAggregateResultIndex,
  isHistoricalCecAggregateResultRow,
  isHistoricalCecNationalResult,
  loadCurrentOfficeholders,
  scoreClaim,
  summarizeLiveSourceHealth,
  supabaseRequest,
} from './sync-real-public-data.mjs';
import { sourceHealthStatePath } from './monitor-source-retry.mjs';

const realPublicDataSeed = JSON.parse(fs.readFileSync('data-sources/real-public-data.seed.json', 'utf8'));
const moiPartyRegistry = realPublicDataSeed.sources.find((source) => source.id === 'moi-party-registry');
assert.equal(moiPartyRegistry.url, 'https://data.gov.tw/dataset/163038');
assert.match(moiPartyRegistry.downloadUrl, /^https:\/\/opdadm\.moi\.gov\.tw\//);

const officialPartyProfile = buildPartyRegistryProfile({
  Political_party_no: '001',
  Political_party_name: '民主進步黨',
  Political_party_leader: '測試主席',
  Date_of_establishment: '1986-09-28',
  Date_of_approval: '1986-11-10',
  Main_office_address: '測試地址',
  Tel: '02-12345678',
}, '民主進步黨');
assert.equal(officialPartyProfile.registryNo, '001');
assert.equal(officialPartyProfile.foundedDateText, '1986-09-28');
assert.equal(officialPartyProfile.filedDateText, '1986-11-10');
assert.equal(officialPartyProfile.headquartersAddress, '測試地址');
assert.equal(officialPartyProfile.contactPhone, '02-12345678');
assert.equal(officialPartyProfile.chairpersonName, '測試主席');

const transportError = new TypeError('fetch failed', {
  cause: Object.assign(new Error('unsafe legacy renegotiation disabled'), {
    code: 'ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED',
  }),
});
assert.match(describeFetchError(transportError), /ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED/);
assert.match(describeFetchError(transportError), /unsafe legacy renegotiation disabled/);

assert.deepEqual(
  summarizeLiveSourceHealth([
    { name: 'MOI party registry', result: { status: 'ok' } },
    { name: 'LY current officeholders', result: { status: 'fallback', error: 'TLS failed' } },
  ]),
  {
    status: 'degraded',
    needsAttention: true,
    degradedSourceCount: 1,
    degradedSources: [{ name: 'LY current officeholders', status: 'fallback', error: 'TLS failed' }],
  },
);

const currentOfficeholderSource = {
  id: 'ly-current-legislators',
  url: 'https://www.ly.gov.tw/',
  downloadUrl: 'https://example.test/legislators.json',
};
assert.throws(
  () => buildCurrentOfficeholders({ dataList: [] }, currentOfficeholderSource),
  /no current legislators/,
);

const sourceStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-current-officeholders-'));
const sourceStateDirectory = path.join(sourceStateDir, 'source-health');
let invalidRosterFetches = 0;
const fixedNow = () => Date.parse('2026-09-04T10:00:00Z');
try {
  const options = {
    stateDirectory: sourceStateDirectory,
    legacyStatePath: path.join(sourceStateDir, 'legacy-source-health.json'),
    now: fixedNow,
    sleep: async () => {},
    fetchPayload: async () => {
      invalidRosterFetches += 1;
      return { dataList: [] };
    },
  };
  await assert.rejects(loadCurrentOfficeholders(currentOfficeholderSource, options), /no current legislators/);
  const sourceState = JSON.parse(fs.readFileSync(
    sourceHealthStatePath(sourceStateDirectory, 'ly-current-legislators'),
    'utf8',
  )).source;
  assert.equal(sourceState.status, 'blocked');
  assert.ok(sourceState.nextCheckAt);
  await assert.rejects(loadCurrentOfficeholders(currentOfficeholderSource, options), /deferred/);
  assert.equal(invalidRosterFetches, 1);
} finally {
  fs.rmSync(sourceStateDir, { recursive: true, force: true });
}

const originalFetch = globalThis.fetch;
let publishedRpcRequest;
globalThis.fetch = async (_url, options) => {
  publishedRpcRequest = options;
  return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
};
try {
  await supabaseRequest(
    { url: 'https://example.test', serviceKey: 'test-key' },
    'rpc/refresh_person_demographics',
    { method: 'POST', rows: {}, schema: 'published' },
  );
} finally {
  globalThis.fetch = originalFetch;
}
assert.equal(publishedRpcRequest.headers['content-profile'], 'published');

const [reviewedVoteTwAffiliation] = buildEnrichmentPartyAffiliationRows([{
  claim_key: 'votetw-person-enrichment:test:party_affiliation:1',
  person_id: '00000000-0000-0000-0000-000000000001',
  claim_type: 'party_affiliation',
  claim_value: '民主進步黨',
  claim_json: {
    sourceId: 'votetw-person-enrichment',
    electionRecords: [{ party: '民主進步黨', election: '2022年測試選舉' }],
  },
  confidence_level: 'B',
  review_status: 'verified',
  visibility: 'public',
  is_public: true,
  source_name: 'VoteTW',
  source_url: 'https://example.com/votetw',
}], '2026-08-14T00:00:00.000Z');
assert.equal(reviewedVoteTwAffiliation.observed_year, 2022);
assert.equal(reviewedVoteTwAffiliation.is_current, false);
assert.equal(reviewedVoteTwAffiliation.review_status, 'verified');
assert.equal(reviewedVoteTwAffiliation.is_public, true);
assert.equal(reviewedVoteTwAffiliation.source_payload.precedence, 'reviewed-claim-without-explicit-date');

const [pendingDatedAffiliation] = buildEnrichmentPartyAffiliationRows([{
  claim_key: 'wikidata:test:party_affiliation:1',
  person_id: '00000000-0000-0000-0000-000000000001',
  claim_type: 'party_affiliation',
  claim_value: '中國國民黨',
  claim_json: {
    sourceId: 'wikidata-person-enrichment',
    startDate: '+2020-01-01T00:00:00Z',
    endDate: null,
  },
  confidence_level: 'C',
  review_status: 'pending',
  visibility: 'private',
  is_public: false,
  source_name: 'Wikidata 人物補充資料',
  source_url: 'https://www.wikidata.org/wiki/Q1',
}], '2026-08-14T00:00:00.000Z');
assert.equal(pendingDatedAffiliation.observed_year, 2020);
assert.equal(pendingDatedAffiliation.start_date, '2020-01-01');
assert.equal(pendingDatedAffiliation.is_current, true);
assert.equal(pendingDatedAffiliation.review_status, 'pending');
assert.equal(pendingDatedAffiliation.is_public, false);
assert.equal(pendingDatedAffiliation.source_payload.precedence, 'wiki-secondary-explicit-date');

const root = 'votedata/votedata/voteData';

const officialRosterRows = buildSourcePersonRows(
  {
    sources: [{ id: 'test-official-roster', name: '測試市政府', url: 'https://example.com/roster' }],
    people: [
      {
        externalId: 'test-current-deputy',
        sourceId: 'test-official-roster',
        sourceType: 'official_officeholder',
        name: '現任副市長',
        position: '副市長',
        district: '測試市',
        sourcePayload: { roleOrigin: 'appointed' },
      },
      {
        externalId: 'test-former-head',
        sourceId: 'test-official-roster',
        sourceType: 'official_officeholder',
        name: '卸任局長',
        position: '局長',
        district: '測試市',
        sourcePayload: { roleOrigin: 'appointed', isCurrent: false },
      },
    ],
  },
  '2026-08-12T00:00:00.000Z',
  'test-batch',
);
assert.equal(officialRosterRows[0].source_payload.isCurrent, true);
assert.equal(officialRosterRows[1].source_payload.isCurrent, false);

assert.deepEqual(
  classifyHistoricalCecCandidateEntry(`${root}/1998直轄市議員/區域/elcand.csv`),
  { year: 1998, kind: 'local-councilor-regional', roleLabel: '議員' },
);
assert.deepEqual(
  classifyHistoricalCecCandidateEntry(`${root}/1998直轄市議員/原住民/elcand.csv`),
  { year: 1998, kind: 'local-councilor-indigenous', districtLabel: '原住民', roleLabel: '議員' },
);
assert.deepEqual(
  classifyHistoricalCecCandidateEntry(`${root}/2002縣市議員/山原/elcand.csv`),
  { year: 2002, kind: 'local-councilor-mountain-indigenous', districtLabel: '山地原住民', roleLabel: '議員' },
);
assert.deepEqual(
  classifyHistoricalCecCandidateEntry(`${root}/20091205-縣市長縣市議員及鄉鎮長/平地議員/elcand.csv`),
  { year: 2009, kind: 'local-councilor-plain-indigenous', districtLabel: '平地原住民', roleLabel: '議員' },
);
assert.deepEqual(
  classifyHistoricalCecCandidateEntry(`${root}/20101127-五都市長議員及里長/區域議員/elcand.csv`),
  { year: 2010, kind: 'local-councilor-regional', roleLabel: '議員' },
);
assert.deepEqual(
  classifyHistoricalCecCandidateEntry(`${root}/2014-103年地方公職人員選舉/直轄市山原議員/elcand.csv`),
  { year: 2014, kind: 'local-councilor-mountain-indigenous', districtLabel: '山地原住民', roleLabel: '議員' },
);
assert.deepEqual(
  classifyHistoricalCecCandidateEntry(`${root}/2018-107年地方公職人員選舉/縣市平原議員/elcand.csv`),
  { year: 2018, kind: 'local-councilor-plain-indigenous', districtLabel: '平地原住民', roleLabel: '議員' },
);
assert.equal(
  classifyHistoricalCecCandidateEntry(`${root}/1994台灣省議員/區域/elcand.csv`),
  null,
);

const regionalCouncilor = { kind: 'local-councilor-regional' };
const indigenousCouncilor = { kind: 'local-councilor-indigenous' };
const indigenousLegislator = { kind: 'legislator-plain-indigenous' };
const candidateRow = ['01', '001', '00', '000', '0000', '1'];
const regionalCandidateRow = ['01', '001', '01', '000', '0000', '1'];
const regionalResultRow = ['01', '001', '01', '000', '0000', '0000', '1'];
const indigenousResultRow = ['01', '001', '01', '000', '0000', '0', '1'];

assert.equal(isHistoricalCecAggregateResultRow(regionalResultRow), true);
assert.equal(isHistoricalCecAggregateResultRow(indigenousResultRow), true);
assert.equal(isHistoricalCecNationalResult(indigenousCouncilor), false);
assert.equal(isHistoricalCecNationalResult(indigenousLegislator), true);
assert.equal(
  historicalCecAggregateResultKey(candidateRow, indigenousCouncilor, candidateRow[5]),
  '01-001-00-1',
);
assert.equal(
  historicalCecAggregateResultKey(indigenousResultRow, indigenousCouncilor),
  '01-001-01-1',
);
assert.equal(
  historicalCecAggregateResultKey(regionalCandidateRow, regionalCouncilor, regionalCandidateRow[5]),
  historicalCecAggregateResultKey(regionalResultRow, regionalCouncilor),
);
assert.equal(
  historicalCecAggregateResultKey(regionalResultRow, regionalCouncilor),
  '01-001-01-1',
);
assert.equal(historicalCecAggregateResultKey(indigenousResultRow, indigenousLegislator), '1');

const mountainCouncilor = { kind: 'local-councilor-mountain-indigenous' };
const districtCandidate = (district, name) => ['10', '014', district, '000', '0000', '1', name];
const districtResult = (district, count, rate) => ['10', '014', district, '000', '0000', '0', '1', String(count), String(rate), ' '];
const district12 = districtCandidate('12', '測試甲');
const district16 = districtCandidate('16', '測試乙');
const result12 = districtResult('12', 813, 34.5);
const result16 = districtResult('16', 339, 18.47);
for (const resultRows of [[result12, result16], [result16, result12]]) {
  const index = buildHistoricalCecAggregateResultIndex({ candidateRows: [district12, district16], resultRows, classification: mountainCouncilor });
  assert.equal(index.get(historicalCecAggregateResultKey(district12, mountainCouncilor, '1')).voteCount, 813);
  assert.equal(index.get(historicalCecAggregateResultKey(district16, mountainCouncilor, '1')).voteCount, 339);
}
const legacyCandidate = [...candidateRow, '測試丙'];
const legacyResult = [...indigenousResultRow, '100', '50', '*'];
const legacyIndex = buildHistoricalCecAggregateResultIndex({ candidateRows: [legacyCandidate], resultRows: [legacyResult], classification: indigenousCouncilor });
assert.equal(legacyIndex.get('01-001-00-1').voteCount, 100);
const ambiguousIndex = buildHistoricalCecAggregateResultIndex({ candidateRows: [legacyCandidate, [...legacyCandidate.slice(0, 2), '02', ...legacyCandidate.slice(3)]], resultRows: [legacyResult], classification: indigenousCouncilor });
assert.equal(ambiguousIndex.has('01-001-00-1'), false);
const duplicateIndex = buildHistoricalCecAggregateResultIndex({ candidateRows: [district12], resultRows: [result12, result12], classification: mountainCouncilor });
assert.equal(duplicateIndex.has('10-014-12-1'), false);
const unrelatedIndex = buildHistoricalCecAggregateResultIndex({ candidateRows: [district12], resultRows: [result16], classification: mountainCouncilor });
assert.equal(unrelatedIndex.has('10-014-12-1'), false);
const reverseCandidate = [...legacyCandidate.slice(0, 2), '01', ...legacyCandidate.slice(3)];
const reverseResult = [...legacyResult.slice(0, 2), '00', ...legacyResult.slice(3)];
assert.equal(buildHistoricalCecAggregateResultIndex({ candidateRows: [reverseCandidate], resultRows: [reverseResult], classification: indigenousCouncilor }).get('01-001-01-1').voteCount, 100);
const multipleResults = buildHistoricalCecAggregateResultIndex({ candidateRows: [legacyCandidate], resultRows: [legacyResult, [...legacyResult.slice(0, 2), '02', ...legacyResult.slice(3)]], classification: indigenousCouncilor });
assert.equal(multipleResults.has('01-001-00-1'), false);
const nationalIndex = buildHistoricalCecAggregateResultIndex({ candidateRows: [legacyCandidate], resultRows: [legacyResult, ['00', '000', '00', '000', '0000', '0', '1', '200', '60', '*']], classification: indigenousLegislator });
assert.deepEqual(nationalIndex.get('1'), { voteCount: 200, voteRate: 60, elected: true });



assert.deepEqual(
  applyReviewedCandidateResultOverride({
    external_id: 'votetw-candidate-eaa98ca6e1255bff',
    vote_count: 236,
    vote_rate: 50,
    is_elected: false,
    candidacy_status: 'qualified',
    election_result: 'not_elected',
    registration_status: 'not_elected',
    source_name: 'VoteTW',
    source_url: 'https://votetw.com/',
  }),
  {
    external_id: 'votetw-candidate-eaa98ca6e1255bff',
    vote_count: 236,
    vote_rate: 50,
    is_elected: true,
    candidacy_status: 'qualified',
    election_result: 'elected',
    registration_status: 'elected',
    source_name: '嘉義縣選舉委員會',
    source_url: 'https://web.cec.gov.tw/api/file/33e69d9d-e0bd-41ba-bfe3-6d12be8a5b28.pdf',
  },
);

assert.equal(
  applyReviewedCandidateResultOverride({ external_id: 'unreviewed-candidate', is_elected: false }).is_elected,
  false,
);

// 缺少全選區結果列時仍保留已交叉核對的結果，不改人物綁定或可見性。
for (const voteCount of [null, 856]) {
  const result = applyReviewedCandidateResultOverride({
    external_id: 'cec-historical-candidate-ce49033ddcca9d7a',
    vote_count: voteCount, is_elected: false, person_id: 'existing-person', is_public: false,
    candidacy_status: 'disqualified', source_name: 'reviewed-source', source_url: 'https://example.org/review',
  });
  assert.equal(result.vote_count, 1794);
  assert.equal(result.vote_rate, 100);
  assert.equal(result.is_elected, true);
  assert.equal(result.election_result, 'elected');
  assert.equal(result.registration_status, 'elected');
  assert.equal(result.person_id, 'existing-person');
  assert.equal(result.is_public, false);
  assert.equal(result.candidacy_status, 'disqualified');
  assert.equal(result.source_name, 'reviewed-source');
  assert.equal(result.source_url, 'https://example.org/review');
}

assert.equal(
  scoreClaim({
    claimType: 'birth_date',
    sourceType: 'official_election',
    confidenceLevel: 'A',
    hasMatchedPerson: true,
  }).score,
  95,
);

const [manuallyApprovedMediaProfile] = buildPersonEnrichmentClaimRows(
  {
    personEnrichmentClaims: [{
      claimKey: 'media-profile:test-person:education',
      personId: '00000000-0000-0000-0000-000000000002',
      personName: '測試候選人',
      claimType: 'education',
      claimValue: '測試大學',
      claimJson: {
        manualReview: {
          status: 'approved',
          reviewedAt: '2026-08-10',
        },
      },
      confidenceLevel: 'B',
      reviewStatus: 'verified',
      visibility: 'public',
      sourceId: 'reputable-media-profile',
      sourceName: '可信媒體',
      sourceUrl: 'https://example.com/profile',
      observedAt: '2026-08-10',
    }],
  },
  [{
    id: '00000000-0000-0000-0000-000000000002',
    external_id: null,
    name: '測試候選人',
  }],
  '2026-08-10T00:00:00.000Z',
);
assert.equal(manuallyApprovedMediaProfile.review_score, 50);
assert.equal(manuallyApprovedMediaProfile.review_status, 'archived');
assert.equal(manuallyApprovedMediaProfile.visibility, 'private');
assert.equal(manuallyApprovedMediaProfile.is_public, false);

assert.deepEqual(
  darkGuideFamilyReferenceNames({
    found: [{ mentionedName: '王小明' }],
    ambiguousSameName: [{ mentionedName: '陳大華' }],
    notFound: [{ mentionedName: '王小明' }, { mentionedName: ' 林小美 ' }],
  }),
  ['王小明', '林小美', '陳大華'],
);

const [reviewOnlyLegalLead] = buildLegalRecordLeadRows(
  {
    legalRecordLeads: [{
      leadKey: 'media-only:test-person',
      sourceId: 'trusted-news',
      sourceType: 'media_report',
      sourceName: '可信媒體',
      sourceUrl: 'https://example.com/report',
      caseNumber: null,
      judgmentDate: null,
      caseType: '刑事',
      reason: '案件報導',
      rawName: '測試人物',
      normalizedName: '測試人物',
      confidenceLevel: 'C',
      sourcePayload: {
        reviewEvidence: {
          scope: 'criminal',
          subjectRole: 'defendant',
          identityEvidence: { newsIdentityBridge: true },
          caseEvidence: {},
        },
      },
    }],
  },
  [{
    id: '00000000-0000-0000-0000-000000000001',
    name: '測試人物',
    party: '測試黨',
    position: '議員',
    district: '測試市第1選舉區',
  }],
  '2026-08-09T00:00:00.000Z',
);
assert.equal(reviewOnlyLegalLead.matched_person_id, '00000000-0000-0000-0000-000000000001');
assert.equal(reviewOnlyLegalLead.review_status, 'pending');
assert.deepEqual(
  reviewOnlyLegalLead.source_payload.candidatePersonIds,
  ['00000000-0000-0000-0000-000000000001'],
);
assert.equal(reviewOnlyLegalLead.is_public, false);

console.log('sync-real-public-data tests passed');
