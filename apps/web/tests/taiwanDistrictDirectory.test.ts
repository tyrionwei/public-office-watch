import assert from 'node:assert/strict';
import test from 'node:test';
import { taiwanDistrictsByCountyCode } from '../src/data/generated/taiwanDistrictDirectory.ts';

test('contains a complete, unique Taiwan district directory', () => {
  const counties = Object.values(taiwanDistrictsByCountyCode);
  const districts = counties.flat();

  assert.equal(counties.length, 22);
  assert.equal(districts.length, 368);
  assert.equal(new Set(districts.map((district) => district.code)).size, districts.length);
});

test('maps Taipei to its twelve official districts', () => {
  const taipeiDistricts = taiwanDistrictsByCountyCode['63000'];

  assert.equal(taipeiDistricts.length, 12);
  assert.ok(taipeiDistricts.some((district) => district.name === '信義區'));
});
