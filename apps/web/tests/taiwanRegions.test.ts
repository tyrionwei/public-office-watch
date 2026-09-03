import assert from 'node:assert/strict';
import test from 'node:test';
import { taiwanRegions } from '../src/data/taiwanRegions.ts';

test('contains exactly the current 22 Taiwan counties and cities', () => {
  const names = new Set(taiwanRegions.map((region) => region.name));
  const obsoleteNames = ['臺北縣', '桃園縣', '臺中縣', '臺南縣', '高雄縣'];

  assert.equal(taiwanRegions.length, 22);
  assert.equal(names.size, 22);
  assert.equal(new Set(taiwanRegions.map((region) => region.code)).size, 22);
  assert.equal(new Set(taiwanRegions.map((region) => region.slug)).size, 22);
  assert.ok(obsoleteNames.every((name) => !names.has(name)));
});
