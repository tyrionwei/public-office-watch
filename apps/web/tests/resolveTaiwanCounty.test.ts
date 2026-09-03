import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTaiwanCounty, resolveTaiwanLocation } from '../src/lib/resolveTaiwanCounty.ts';

test('resolves coordinates inside Taiwan county boundaries', () => {
  assert.deepEqual(resolveTaiwanCounty(25.033, 121.5654), {
    id: 'county-63000',
    name: '臺北市',
  });
  assert.deepEqual(resolveTaiwanCounty(22.6273, 120.3014), {
    id: 'county-64000',
    name: '高雄市',
  });
});

test('does not guess a Taiwan voting county for an overseas coordinate', () => {
  assert.equal(resolveTaiwanCounty(35.6762, 139.6503), null);
  assert.equal(resolveTaiwanLocation(35.6762, 139.6503), null);
});

test('resolves county and district on-device without inferring a village', () => {
  assert.deepEqual(resolveTaiwanLocation(25.033, 121.5654), {
    county: { id: 'county-63000', name: '臺北市' },
    district: { id: 'district-63000020', name: '信義區' },
  });
  assert.deepEqual(resolveTaiwanLocation(22.6273, 120.3014), {
    county: { id: 'county-64000', name: '高雄市' },
    district: { id: 'district-64000070', name: '前金區' },
  });
});
