import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNeighborhoods, validatePollingAssignments } from './polling-place-normalization.mjs';
test('expands official ranges and fullwidth punctuation', () => {
  assert.deepEqual(parseNeighborhoods('１－４鄰、14～17鄰').neighborhoods, [1,2,3,4,14,15,16,17]);
  assert.deepEqual(parseNeighborhoods('1-7.14-16').neighborhoods, [1,2,3,4,5,6,7,14,15,16]);
  assert.equal(parseNeighborhoods('全里').coverage_kind, 'whole_village');
  assert.equal(parseNeighborhoods('未分鄰').coverage_kind, 'unpartitioned');
});
test('address and household exceptions never become exact neighborhood matches', () => {
  for (const raw of ['8-10 (8鄰僅含逕遷戶口)', '18-19（20，中山路2段403至411號單號）', '']) {
    assert.deepEqual(parseNeighborhoods(raw), { coverage_kind: 'ambiguous', neighborhoods: [] });
  }
  assert.throws(() => parseNeighborhoods('8-2'));
});
test('conflicting official assignments fail instead of choosing a station', () => {
  const place = { village_code:'65000100001', station_no:'0001', ...parseNeighborhoods('1-4') };
  assert.throws(() => validatePollingAssignments([place,{...place,station_no:'0002',...parseNeighborhoods('4-6')}]));
  assert.throws(() => validatePollingAssignments([place,{...place,station_no:'0002',...parseNeighborhoods('全里')}]));
  assert.doesNotThrow(() => validatePollingAssignments([place,{...place,station_no:'0002',...parseNeighborhoods('5-6')}]));
});
