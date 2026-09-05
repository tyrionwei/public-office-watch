import assert from 'node:assert/strict';
import test from 'node:test';
import { taiwanStageRegionNodes } from '../src/data/taiwanRegions.ts';
import { getCurrentCountyRegions, getCountyRegionLabel, isCurrentCountyRegion } from '../src/lib/countyRegions.ts';
import { isCurrentCountyName, toCurrentCountyName } from '../src/lib/taiwanText.ts';
import { selectHomeRegionId } from '../src/lib/homeRaceSelection.ts';

const historical = [
  ['historical-taipei-county', '臺北縣'],
  ['historical-taoyuan-county', '桃園縣'],
  ['historical-taichung-county', '臺中縣'],
  ['historical-tainan-county', '臺南縣'],
  ['historical-kaohsiung-county', '高雄縣'],
  ['historical-taichung-city', '臺中市'],
  ['historical-tainan-city', '臺南市'],
  ['historical-kaohsiung-city', '高雄市'],
].map(([id, label]) => ({ ...taiwanStageRegionNodes[0], id, label }));

test('current county name validation never upgrades a historical name', () => {
  for (const region of historical.slice(0, 5)) assert.equal(isCurrentCountyName(region.label), false);
  assert.equal(isCurrentCountyName('台北市'), true);
  assert.equal(isCurrentCountyName('台北縣'), false);
  assert.equal(toCurrentCountyName('台北縣'), '新北市');
});

test('historical rows never replace current county IDs, even with identical city names', () => {
  for (const regions of [
    [...historical, ...taiwanStageRegionNodes],
    [...taiwanStageRegionNodes, ...historical],
  ]) {
    assert.deepEqual(getCurrentCountyRegions(regions), taiwanStageRegionNodes);
    for (const old of historical) {
      assert.equal(isCurrentCountyRegion(old), false);
      assert.equal(selectHomeRegionId(regions, old.id), null);
    }
  }
  assert.deepEqual(getCurrentCountyRegions(historical), []);
});

test('unknown or mismatched IDs cannot masquerade as current counties', () => {
  assert.equal(isCurrentCountyRegion({ ...taiwanStageRegionNodes[0], id: 'unverified-taipei' }), false);
  assert.equal(isCurrentCountyRegion({ ...taiwanStageRegionNodes[0], label: '桃園市' }), false);
  assert.equal(selectHomeRegionId(taiwanStageRegionNodes, 'taichung-city'), 'taichung-city');
});

test('historical display labels retain original names without altering keys', () => {
  for (const old of historical) {
    const before = { ...old };
    assert.equal(getCountyRegionLabel(old), old.label + '（歷史行政區）');
    assert.equal(getCountyRegionLabel(old, 'en'), old.label + ' (historical area)');
    assert.deepEqual(old, before);
  }
  assert.equal(getCountyRegionLabel(taiwanStageRegionNodes[3]), '臺中市');
});
