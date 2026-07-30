import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chineseNumberToInteger,
  districtDescriptor,
  planPartyCandidateImport,
  validateSnapshot,
} from './import-party-candidate-snapshot.mjs';
import { normalizeElectionDistrict } from './normalize-election-district.mjs';

function snapshot(overrides = {}) {
  return validateSnapshot({
    schemaVersion: 1,
    electionYear: 2026,
    sourceType: 'official_party_nomination',
    party: '民主進步黨',
    source: {
      name: '民主進步黨 2026 選舉官網',
      url: 'https://teamtaiwan.dpp.org.tw/',
      publishedAt: null,
      retrievedAt: '2026-07-29T12:00:00+08:00',
    },
    records: [{
      sourceCandidateKey: 'dpp-2026-taipei-mayor-example',
      personName: '測試人物',
      candidacyStatus: 'party_nominee',
      raceType: 'municipality_mayor',
      regionName: '台北市',
      districtName: null,
      nominationAnnouncedAt: '2026-07-01',
      profileUrl: null,
      photoUrl: null,
    }],
    ...overrides,
  });
}

test('accepts official party sources and rejects lookalike domains', () => {
  assert.equal(snapshot().party, '民主進步黨');
  assert.throws(() => snapshot({
    source: {
      name: 'Lookalike',
      url: 'https://dpp.org.tw.example.com/candidates',
      retrievedAt: '2026-07-29T12:00:00+08:00',
    },
  }), /not an official 民主進步黨 domain/);
});

test('only party nominees are accepted and ballot numbers are forbidden', () => {
  assert.throws(() => snapshot({
    records: [{
      sourceCandidateKey: 'dpp-2026-example',
      personName: '測試人物',
      candidacyStatus: 'registered',
      raceType: 'municipality_mayor',
      regionName: '台北市',
      districtName: null,
      candidateNo: 1,
    }],
  }), /candidacyStatus must be party_nominee/);
});

test('normalizes Chinese district numbers and indigenous district types', () => {
  assert.equal(chineseNumberToInteger('二十一'), 21);
  assert.deepEqual(districtDescriptor('第十二選區｜山地原住民'), {
    number: 12,
    subtype: 'mountain_indigenous',
  });
  assert.deepEqual(districtDescriptor('第12選舉區平地原住民議員選舉'), {
    number: 12,
    subtype: 'plain_indigenous',
  });
});

test('normalizes leading-zero districts before validation and matching', () => {
  const input = snapshot({
    records: [{
      sourceCandidateKey: 'dpp-2026-taipei-councilor-example',
      personName: '測試人物',
      candidacyStatus: 'party_nominee',
      raceType: 'city_councilor',
      regionName: '台北市',
      districtName: '第01選區',
    }],
  });

  assert.equal(input.records[0].districtName, '第1選區');
  assert.equal(districtDescriptor('第01選區').number, 1);
  assert.equal(normalizeElectionDistrict('01'), '1');
  assert.equal(normalizeElectionDistrict('臺北市第 02 選舉區'), '臺北市第2選舉區');
  assert.equal(normalizeElectionDistrict('2026年地方公職人員選舉'), '2026年地方公職人員選舉');
  assert.equal(normalizeElectionDistrict('第10選舉區'), '第10選舉區');
  assert.equal(normalizeElectionDistrict('平地原住民選舉區'), '平地原住民選舉區');
});

test('matches a mayor race while keeping same-name people for identity review', () => {
  const input = snapshot();
  const plan = planPartyCandidateImport(input, {
    elections: [{ id: 'election-1', external_id: 'planned-2026-local-public-officials' }],
    regions: [{ id: 'region-1', name: '臺北市' }],
    races: [{
      id: 'race-1',
      election_id: 'election-1',
      region_id: 'region-1',
      race_type: 'municipality_mayor',
      title: '臺北市市長選舉',
      is_public: true,
    }],
    people: [
      { id: 'person-1', name: '測試人物' },
      { id: 'person-2', name: '測試人物' },
    ],
    candidates: [],
  });

  assert.equal(plan.blocking.length, 0);
  assert.equal(plan.matched.length, 1);
  assert.equal(plan.identityReview.length, 1);
  assert.equal(plan.identityReview[0].people.length, 2);
});

test('uses canonical identity, party and historical district for one high-confidence suggestion', () => {
  const input = snapshot({
    records: [{
      sourceCandidateKey: 'dpp-2026-new-taipei-4-example',
      personName: '同名人物',
      candidacyStatus: 'party_nominee',
      raceType: 'city_councilor',
      regionName: '新北市',
      districtName: '第4選區',
    }],
  });
  const plan = planPartyCandidateImport(input, {
    elections: [{ id: 'election-1', external_id: 'planned-2026-local-public-officials' }],
    regions: [{ id: 'region-1', name: '新北市' }],
    races: [{
      id: 'race-4',
      election_id: 'election-1',
      region_id: 'region-1',
      race_type: 'city_councilor',
      title: '新北市第4選舉區議員選舉',
      is_public: true,
    }],
    historyRaces: [
      { id: 'history-4', region_id: 'region-1', race_type: 'city_councilor', title: '新北市第4選舉區議員選舉' },
      { id: 'history-5', region_id: 'region-1', race_type: 'city_councilor', title: '新北市第5選舉區議員選舉' },
    ],
    people: [
      { id: 'person-a1', name: '同名人物', party: '民主進步黨', position: '市議員', district: '新北市第4選舉區' },
      { id: 'person-a2', name: '同名人物', party: '民主進步黨', position: '市議員', district: '新北市第4選舉區' },
      { id: 'person-b', name: '同名人物', party: '中國國民黨', position: '市議員', district: '新北市第5選舉區' },
    ],
    canonicalMap: [
      { person_id: 'person-a1', canonical_person_id: 'canonical-a' },
      { person_id: 'person-a2', canonical_person_id: 'canonical-a' },
      { person_id: 'person-b', canonical_person_id: 'canonical-b' },
    ],
    candidates: [
      { id: 'candidate-a', person_id: 'person-a1', race_id: 'history-4', party: '民主進步黨' },
      { id: 'candidate-b', person_id: 'person-b', race_id: 'history-5', party: '中國國民黨' },
    ],
  });

  assert.equal(plan.highConfidenceMatch.length, 1);
  assert.equal(plan.probableMatch.length, 0);
  assert.equal(plan.identityReview.length, 0);
  assert.equal(plan.highConfidenceMatch[0].canonicalGroups.length, 2);
  assert.equal(plan.highConfidenceMatch[0].selectedGroup.canonicalPersonId, 'canonical-a');
});

test('matches councilor districts without guessing a different district', () => {
  const input = snapshot({
    records: [{
      sourceCandidateKey: 'dpp-2026-new-taipei-4-example',
      personName: '測試人物',
      candidacyStatus: 'party_nominee',
      raceType: 'city_councilor',
      regionName: '新北市',
      districtName: '第四選區｜蘆洲、三重',
    }],
  });
  const plan = planPartyCandidateImport(input, {
    elections: [{ id: 'election-1', external_id: 'planned-2026-local-public-officials' }],
    regions: [{ id: 'region-1', name: '新北市' }],
    races: [
      { id: 'race-4', election_id: 'election-1', region_id: 'region-1', race_type: 'city_councilor', title: '新北市第4選舉區議員選舉', is_public: true },
      { id: 'race-5', election_id: 'election-1', region_id: 'region-1', race_type: 'city_councilor', title: '新北市第5選舉區議員選舉', is_public: true },
    ],
    people: [],
    candidates: [],
  });

  assert.equal(plan.blocking.length, 0);
  assert.equal(plan.matched[0].race.id, 'race-4');
  assert.equal(plan.newPersonReview.length, 1);
});

test('blocks records when the target race is missing', () => {
  const plan = planPartyCandidateImport(snapshot(), {
    elections: [{ id: 'election-1', external_id: 'planned-2026-local-public-officials' }],
    regions: [],
    races: [],
    people: [],
    candidates: [],
  });

  assert.equal(plan.blocking.length, 1);
  assert.equal(plan.blocking[0].reason, 'race_not_found');
});
