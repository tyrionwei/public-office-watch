import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReviewCanonicalPersonQuery,
  buildReviewPersonContextQueries,
  mapReviewBirthDates,
  mapReviewCandidates,
  mapReviewPeople,
} from '../build/internalReviewPersonContext.ts';

test('reads private review context from base tables instead of public views', () => {
  const canonicalQuery = buildReviewCanonicalPersonQuery(['person-id']);
  const queries = buildReviewPersonContextQueries(['person-id']);

  assert.match(canonicalQuery, /^person_canonical_map\?/);
  assert.match(queries.people, /^people\?/);
  assert.match(queries.birthDates, /^person_claims\?/);
  assert.match(queries.genders, /^person_claims\?/);
  assert.match(queries.candidates, /^candidates\?/);
  assert.doesNotMatch([canonicalQuery, ...Object.values(queries)].join(' '), /public_/);
});

test('maps base person and candidate rows to the review page shape', () => {
  assert.deepEqual(mapReviewPeople([{
    id: 'person-id',
    name: '測試人物',
    alias: null,
    gender: null,
    party: '測試黨',
    position: '議員',
    district: '第一選區',
    education: '測試大學',
    experience: '測試經歷',
  }])[0], {
    person_id: 'person-id',
    name: '測試人物',
    alias: null,
    gender: null,
    party: '測試黨',
    position: '議員',
    district: '第一選區',
    education: '測試大學',
    experience: '測試經歷',
    current_office_label: null,
    upcoming_candidate_label: null,
  });

  assert.deepEqual(mapReviewCandidates([{
    id: 'candidate-id',
    person_id: 'person-id',
    party: '測試黨',
    candidate_no: '1',
    election_result: 'elected',
    race: {
      title: '第一選區',
      election: { year: 2022, name: '2022 測試選舉' },
      region: { name: '測試市' },
    },
  }])[0], {
    candidate_id: 'candidate-id',
    person_id: 'person-id',
    election_year: 2022,
    election_name: '2022 測試選舉',
    race_title: '第一選區',
    region_name: '測試市',
    party: '測試黨',
    candidate_no: '1',
    election_result: 'elected',
  });
});

test('uses the canonical person while preserving the source claim id', () => {
  const canonicalRows = [{
    person_id: 'source-id',
    canonical_person_id: 'canonical-id',
  }];
  const people = mapReviewPeople([{
    id: 'canonical-id',
    name: '主人物',
    alias: null,
    gender: 'unknown',
    party: '測試黨',
    position: '議員',
    district: '第一選區',
    education: '主人物學歷',
    experience: '主人物經歷',
  }], ['source-id'], canonicalRows, [{
    person_id: 'source-id',
    claim_value: '男',
  }]);

  assert.equal(people[0]?.person_id, 'source-id');
  assert.equal(people[0]?.name, '主人物');
  assert.equal(people[0]?.gender, 'male');
});

test('does not guess gender when verified claims conflict', () => {
  const people = mapReviewPeople([{
    id: 'person-id',
    name: '測試人物',
    alias: null,
    gender: 'unknown',
    party: null,
    position: null,
    district: null,
    education: null,
    experience: null,
  }], ['person-id'], [], [
    { person_id: 'person-id', claim_value: '男' },
    { person_id: 'person-id', claim_value: '女' },
  ]);

  assert.equal(people[0]?.gender, 'unknown');
});

test('rekeys canonical birth dates and election records to the source claim id', () => {
  const canonicalRows = [{
    person_id: 'source-id',
    canonical_person_id: 'canonical-id',
  }];

  assert.deepEqual(
    mapReviewBirthDates(
      [{ person_id: 'canonical-id', claim_value: '1980-01-02' }],
      ['source-id'],
      canonicalRows,
    ),
    [{ person_id: 'source-id', claim_value: '1980-01-02' }],
  );

  assert.equal(mapReviewCandidates([{
    id: 'candidate-id',
    person_id: 'canonical-id',
    party: '測試黨',
    candidate_no: '2',
    election_result: 'elected',
    race: {
      title: '第二選區',
      election: { year: 2022, name: '2022 測試選舉' },
      region: { name: '測試市' },
    },
  }], ['source-id'], canonicalRows)[0]?.person_id, 'source-id');
});
