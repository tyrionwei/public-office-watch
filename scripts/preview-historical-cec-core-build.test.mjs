import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCoreComparisonPlan,
  buildHistoricalCecCorePreview,
  canonicalElectionName,
  canonicalElectionType,
  canonicalRaceTitle,
  canonicalRaceType,
  classifyHistoricalRole,
  classifySeatType,
  modernizeIdentityGeography,
  normalizeHistoricalGeography,
} from './preview-historical-cec-core-build.mjs';

function source(overrides) {
  return {
    id: overrides.id,
    source_person_key: `cec-historical:${overrides.id}`,
    raw_name: overrides.name,
    normalized_name: overrides.normalizedName ?? overrides.name,
    gender: overrides.gender ?? 'male',
    party: overrides.party ?? '無黨籍',
    position: overrides.position ?? '臺北縣議員候選人',
    district: overrides.district ?? '臺北縣第01選舉區議員',
    election_year: overrides.year ?? 2002,
    source_payload: {
      candidateNo: overrides.candidateNo ?? '01',
      districtCode: overrides.districtCode ?? '01',
      elected: overrides.elected ?? false,
      voteCount: overrides.voteCount ?? '1000',
      voteRate: overrides.voteRate ?? '10.5',
    },
  };
}

function review(sourcePersonId, reviewStatus) {
  return {
    source_person_id: sourcePersonId,
    review_status: reviewStatus,
    candidate_count: reviewStatus === 'needs_new_person_review' ? 0 : 1,
    best_match_score: reviewStatus === 'needs_new_person_review' ? 0 : 70,
  };
}

test('keeps historical jurisdictions separate from modern identity geography', () => {
  assert.equal(normalizeHistoricalGeography('臺北縣第01選舉區議員', '臺北縣議員候選人'), '臺北縣');
  assert.equal(normalizeHistoricalGeography('', '2018年臺北市議員選舉'), '臺北市');
  assert.equal(modernizeIdentityGeography('臺北縣'), '新北市');
  assert.equal(classifyHistoricalRole('第8屆立法委員候選人'), 'legislator');
});

test('previews only single-source new people and holds context-only cross-year identities', () => {
  const sources = [
    source({ id: 'safe', name: '王安全' }),
    source({ id: 'cross-1998', name: '李跨年', year: 1998 }),
    source({ id: 'cross-2002', name: '李跨年', year: 2002 }),
    source({ id: 'collision-a', name: '陳同屆', districtCode: '01' }),
    source({ id: 'collision-b', name: '陳同屆', district: '臺北縣第02選舉區議員', districtCode: '02' }),
    source({ id: 'missing-region', name: '林無區', position: '總統候選人', district: '' }),
    source({ id: 'existing-review', name: '張待配' }),
    source({ id: 'linked-claim', name: '周已有聲明' }),
    source({ id: 'matched', name: '吳已配對' }),
  ];
  const reviews = [
    review('safe', 'needs_new_person_review'),
    review('cross-1998', 'needs_new_person_review'),
    review('cross-2002', 'needs_new_person_review'),
    review('collision-a', 'needs_new_person_review'),
    review('collision-b', 'needs_new_person_review'),
    review('missing-region', 'needs_new_person_review'),
    review('existing-review', 'needs_identity_review'),
  ];
  const report = buildHistoricalCecCorePreview({
    sources,
    reviews,
    matches: [{ source_person_id: 'matched', match_status: 'auto_matched' }],
  }, { generatedAt: '2026-07-30T00:00:00.000Z' });

  assert.equal(report.summary.unmatchedSourceRows, 8);
  assert.equal(report.summary.safeNewPersonCount, 1);
  assert.equal(report.safeNewPeople[0].proposedPerson.name, '王安全');
  assert.equal(report.safeNewPeople[0].proposedPerson.isPublic, false);
  assert.equal(report.safeNewPeople[0].source.districtLabel, '臺北縣第1選舉區議員選舉');
  assert.deepEqual(
    Object.fromEntries(report.heldNewPeople.map((group) => [group.reason, group.sourceRowCount])),
    {
      cross_year_context_only: 2,
      same_year_collision: 2,
      missing_geography: 1,
    },
  );
  assert.equal(report.reviewStatusCounts.needs_identity_review, 1);
  assert.equal(report.reviewStatusCounts.linked_claim_or_excluded_from_queue, 1);
});

test('standardizes national, indigenous and numbered election contexts', () => {
  assert.equal(canonicalElectionType('president'), 'presidential');
  assert.equal(canonicalElectionName(2012, 'president'), '2012年總統副總統選舉');
  assert.equal(canonicalElectionName(1998, 'councilor'), '1998年直轄市及縣市議員選舉');
  assert.equal(classifySeatType('平地原住民', '第8屆立法委員候選人'), 'plain_indigenous');
  assert.equal(canonicalRaceType('legislator', 'plain_indigenous'), 'indigenous');
  assert.equal(canonicalRaceTitle({
    role: 'legislator',
    seatType: 'plain_indigenous',
    historicalGeography: null,
    districtNumber: null,
  }), '全國平地原住民立法委員選舉');
  assert.equal(canonicalRaceTitle({
    role: 'councilor',
    seatType: 'regional',
    historicalGeography: '臺北縣',
    districtNumber: 1,
  }), '臺北縣第1選舉區議員選舉');
});

test('compares canonical contexts with legacy election and race aliases', () => {
  const eventContexts = [
    {
      key: '2012|legislator|national',
      electionYear: 2012,
      role: 'legislator',
      historicalGeography: null,
      electionType: 'legislative',
      electionName: '2012年立法委員選舉',
    },
  ];
  const raceContexts = [
    {
      key: '2012|legislator|national|plain_indigenous|plain_indigenous',
      eventContextKey: '2012|legislator|national',
      electionYear: 2012,
      role: 'legislator',
      historicalGeography: null,
      districtNumber: null,
      seatType: 'plain_indigenous',
      raceType: 'indigenous',
      raceTitle: '全國平地原住民立法委員選舉',
      regionScope: 'national',
    },
  ];
  const plan = buildCoreComparisonPlan(eventContexts, raceContexts, {
    elections: [{
      id: 'election-legacy',
      external_id: 'cec-2012-legislative-yuan',
      name: '2012年第8屆立法委員選舉',
      year: 2012,
      election_type: 'legislative',
    }],
    races: [{
      id: 'race-legacy',
      external_id: 'cec-2012-plain-indigenous',
      election_id: 'election-legacy',
      region_id: 'region-plain',
      race_type: 'legislator',
      title: '平地原住民立法委員選舉',
    }],
    regions: [{ id: 'region-plain', name: '臺灣', region_type: 'country' }],
    electionCanonicalMap: [{
      election_id: 'election-legacy',
      canonical_election_id: 'election-legacy',
    }],
    raceCanonicalMap: [{ race_id: 'race-legacy', canonical_race_id: 'race-legacy' }],
  });

  assert.equal(plan.eventPlans[0].action, 'reuse_existing');
  assert.equal(plan.racePlans[0].action, 'reuse_existing');
});


test('preserves a broader canonical local election instead of renaming it as councilor-only', () => {
  const plan = buildCoreComparisonPlan([
    {
      key: '2018|councilor|national',
      electionYear: 2018,
      role: 'councilor',
      electionType: 'councilor',
      electionName: '2018年直轄市及縣市議員選舉',
      unmatchedSourceRowCount: 1,
    },
  ], [], {
    elections: [
      {
        id: 'aggregate',
        external_id: 'cec-2018-local-public-officials',
        name: '2018年地方公職人員選舉',
        year: 2018,
        election_type: 'local',
      },
      {
        id: 'councilor-source',
        external_id: 'votetw-2018-taipei-councilor',
        name: '2018年臺北市議員選舉',
        year: 2018,
        election_type: 'councilor',
      },
    ],
    races: [],
    regions: [],
    electionCanonicalMap: [
      { election_id: 'aggregate', canonical_election_id: 'aggregate' },
      { election_id: 'councilor-source', canonical_election_id: 'aggregate' },
    ],
    raceCanonicalMap: [],
  });

  assert.equal(plan.eventPlans[0].action, 'reuse_existing');
  assert.equal(plan.eventPlans[0].existingScope, 'aggregate');
  assert.equal(plan.eventPlans[0].existingCandidates[0].name, '2018年地方公職人員選舉');
});
