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
  isHistoricalCecAggregateResultRow,
  isHistoricalCecNationalResult,
  loadCurrentOfficeholders,
  scoreClaim,
  summarizeLiveSourceHealth,
  supabaseRequest,
} from './sync-real-public-data.mjs';

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
const sourceStatePath = path.join(sourceStateDir, 'source-health.json');
let invalidRosterFetches = 0;
const fixedNow = () => Date.parse('2026-09-04T10:00:00Z');
try {
  const options = {
    statePath: sourceStatePath,
    now: fixedNow,
    sleep: async () => {},
    fetchPayload: async () => {
      invalidRosterFetches += 1;
      return { dataList: [] };
    },
  };
  await assert.rejects(loadCurrentOfficeholders(currentOfficeholderSource, options), /no current legislators/);
  const sourceState = JSON.parse(fs.readFileSync(sourceStatePath, 'utf8'));
  assert.equal(sourceState.sources['ly-current-legislators'].status, 'blocked');
  assert.ok(sourceState.sources['ly-current-legislators'].nextCheckAt);
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
  '01-001-1',
);
assert.equal(
  historicalCecAggregateResultKey(indigenousResultRow, indigenousCouncilor),
  '01-001-1',
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
assert.equal(manuallyApprovedMediaProfile.review_status, 'verified');
assert.equal(manuallyApprovedMediaProfile.visibility, 'public');
assert.equal(manuallyApprovedMediaProfile.is_public, true);

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
