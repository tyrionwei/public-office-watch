import assert from 'node:assert/strict';
import test from 'node:test';
import { taiwanVillagesByDistrictCode } from '../src/data/generated/taiwanVillageDirectory.ts';

test('contains the official named villages for every district', () => {
  const districtEntries = Object.entries(taiwanVillagesByDistrictCode);
  const villages = districtEntries.flatMap(([, entries]) => entries);

  assert.equal(districtEntries.length, 368);
  assert.ok(villages.length >= 7_000);
  assert.ok(villages.length <= 8_500);
  assert.equal(new Set(villages.map((village) => village.code)).size, villages.length);
  assert.ok(districtEntries.every(([districtCode, entries]) => entries.every((village) => (
    village.code.startsWith(districtCode) && village.name.length > 0
  ))));
});

test('includes Taipei Xinyi District villages and their official code', () => {
  const xinyiVillages = taiwanVillagesByDistrictCode['63000020'];

  assert.equal(xinyiVillages.length, 41);
  assert.ok(xinyiVillages.some((village) => village.code === '63000020001' && village.name === '西村里'));
});
