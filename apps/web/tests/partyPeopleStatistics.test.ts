import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPartyPeopleStatistics } from '../src/lib/partyPeopleStatistics.ts';

test('party people statistics keep unknown data in every denominator', () => {
  const people = [
    {
      person_id: 'person-current',
      party: '民主進步黨',
      gender: 'male',
      current_office_label: '立法委員',
      education: '國立臺灣大學法學博士',
    },
    {
      person_id: 'person-former',
      party: '民主進步黨',
      gender: 'female',
      current_office_label: null,
      education: '政治大學碩士',
    },
    {
      person_id: 'person-unknown',
      party: '民主進步黨',
      gender: null,
      current_office_label: null,
      education: null,
    },
    {
      person_id: 'person-other-party',
      party: '中國國民黨',
      gender: 'male',
      current_office_label: '議員',
      education: '某大學',
    },
  ] as never[];
  const claims = [
    { person_id: 'person-current', claim_type: 'birth_date', claim_value: '1990-01-01' },
    { person_id: 'person-former', claim_type: 'birth_date', claim_value: '1980-01-01' },
    { person_id: 'person-unknown', claim_type: 'birth_date', claim_value: '1970-01-01' },
    { person_id: 'person-unknown', claim_type: 'birth_date', claim_value: '1971-01-01' },
  ] as never[];

  const rows = buildPartyPeopleStatistics(
    '民主進步黨',
    people,
    claims,
    new Date('2026-08-11T00:00:00+08:00'),
  );
  const count = (dimension: string, bucket: string) => rows.find(
    (row) => row.dimension_key === dimension && row.bucket_key === bucket,
  )?.people_count;

  assert.equal(rows.length, 19);
  assert.ok(rows.every((row) => row.total_people === 3));
  assert.equal(count('current_status', 'current'), 1);
  assert.equal(count('gender', 'male'), 1);
  assert.equal(count('gender', 'female'), 1);
  assert.equal(count('gender', 'unknown'), 1);
  assert.equal(count('age', 'under_40'), 1);
  assert.equal(count('age', '40_49'), 1);
  assert.equal(count('age', 'unknown'), 1);
  assert.equal(count('education', 'doctorate'), 1);
  assert.equal(count('education', 'master'), 1);
  assert.equal(count('education', 'unknown'), 1);
});
