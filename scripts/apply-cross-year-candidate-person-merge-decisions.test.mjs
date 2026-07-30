import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCoreCandidateRows,
  buildRows,
  renderMergeDecisionSql,
} from './apply-cross-year-candidate-person-merge-decisions.mjs';

test('builds canonical candidate context from core private tables', () => {
  const rows = buildCoreCandidateRows({
    candidates: [{
      id: 'candidate-raw',
      external_id: 'cec-historical-candidate-1234',
      person_id: 'person-raw',
      race_id: 'race-raw',
      party: '測試黨',
      candidate_no: '1',
      is_elected: false,
      vote_count: 10,
    }],
    people: [
      { id: 'person-raw', name: '舊名', party: '測試黨' },
      { id: 'person-canonical', name: '標準名', party: '測試黨' },
    ],
    races: [
      { id: 'race-raw', election_id: 'election-raw', region_id: 'region-1', title: '舊選區' },
      { id: 'race-canonical', election_id: 'election-canonical', region_id: 'region-1', title: '標準選區' },
    ],
    elections: [
      { id: 'election-raw', name: '舊選舉' },
      { id: 'election-canonical', name: '標準選舉' },
    ],
    regions: [{ id: 'region-1', name: '測試縣' }],
    personCanonicalMap: [{ person_id: 'person-raw', canonical_person_id: 'person-canonical' }],
    raceCanonicalMap: [{ race_id: 'race-raw', canonical_race_id: 'race-canonical' }],
    electionCanonicalMap: [{ election_id: 'election-canonical', canonical_election_id: 'election-canonical' }],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].person_id, 'person-canonical');
  assert.equal(rows[0].person_name, '標準名');
  assert.equal(rows[0].race_title, '標準選區');
  assert.equal(rows[0].election_name, '標準選舉');
  assert.equal(rows[0].is_historical_cec, true);
});

test('only proposes a cross-year merge when the group contains a historical CEC candidate', () => {
  const historical = {
    candidate_id: 'candidate-historical',
    candidate_external_id: 'cec-historical-candidate-a',
    person_id: 'person-historical',
    person_name: '測試人',
    election_name: '2012年立法委員選舉',
    race_title: '測試縣第1選舉區立法委員選舉',
    region_name: '測試縣',
    party: '測試黨',
    candidate_no: '1',
    is_historical_cec: true,
  };
  const current = {
    ...historical,
    candidate_id: 'candidate-current',
    candidate_external_id: 'current-candidate-a',
    person_id: 'person-current',
    election_name: '2016年立法委員選舉',
    candidate_no: '2',
    is_historical_cec: false,
  };
  const people = new Map([
    ['person-historical', { id: 'person-historical', external_id: 'cec-historical-unresolved-person-a', gender: 'male', is_public: false }],
    ['person-current', { id: 'person-current', external_id: 'cec-current-person-a', gender: 'male', is_public: true }],
  ]);
  const groupKey = '測試人|測試黨|legislator|測試縣第1選舉區';

  const withHistorical = buildRows(
    new Map([[groupKey, [historical, current]]]),
    people,
    new Map(),
    new Map(),
    [],
  );
  assert.equal(withHistorical.rows.length, 1);
  assert.equal(withHistorical.rows[0].canonical_person_id, 'person-current');

  const withoutHistorical = buildRows(
    new Map([[groupKey, [{ ...historical, is_historical_cec: false }, current]]]),
    people,
    new Map(),
    new Map(),
    [],
  );
  assert.equal(withoutHistorical.rows.length, 0);
});

test('renders an idempotent verified merge migration', () => {
  const sql = renderMergeDecisionSql([{
    duplicate_person_id: '00000000-0000-0000-0000-000000000001',
    canonical_person_id: '00000000-0000-0000-0000-000000000002',
    confidence_level: 'B',
    reason: "same candidate's history",
    evidence_json: { rule: 'test' },
    reviewed_by: 'system:test',
  }]);

  assert.match(sql, /Historical CEC person merge result mismatch/);
  assert.match(sql, /same candidate''s history/);
  assert.match(sql, /SELECT published\.promote\(NULL\)/);
});
