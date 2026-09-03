import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCecPollingPlaceLookupUrl } from '../src/lib/cecPollingPlaceLookup.ts';
import type { VotingRegionPreference } from '../src/votingRegion.tsx';

const baseUrl = 'https://info.cec.gov.tw/vote2026/voteSearch/';

function preference(
  countyName: string,
  districtName?: string,
  village?: VotingRegionPreference['village'],
): VotingRegionPreference {
  return {
    county: { id: 'saved-county', name: countyName },
    ...(districtName ? { district: { id: 'saved-district', name: districtName } } : {}),
    ...(village ? { village } : {}),
    source: 'manual',
    confirmedAt: '2026-09-03T00:00:00.000Z',
  };
}

test('preselects the saved county, district and official village in the CEC polling-place lookup', () => {
  const url = new URL(buildCecPollingPlaceLookupUrl(baseUrl, preference(
    '臺北市',
    '信義區',
    { id: 'village-63000020001', name: '西村里' },
  )));
  assert.equal(url.searchParams.get('mode'), 'tbox');
  assert.equal(url.searchParams.get('prvCityCode'), '63000');
  assert.equal(url.searchParams.get('deptCode'), '020');
  assert.equal(url.searchParams.get('liCode'), '001');
  assert.equal(url.searchParams.get('voter'), '01');
});

test('does not send legacy free text or a village outside the selected district', () => {
  const legacyUrl = new URL(buildCecPollingPlaceLookupUrl(baseUrl, preference(
    '臺北市',
    '信義區',
    { id: 'manual-village:taipei-city:西村里', name: '西村里' },
  )));
  const mismatchedUrl = new URL(buildCecPollingPlaceLookupUrl(baseUrl, preference(
    '臺北市',
    '信義區',
    { id: 'village-65000010001', name: '其他里' },
  )));

  assert.equal(legacyUrl.searchParams.get('liCode'), null);
  assert.equal(mismatchedUrl.searchParams.get('liCode'), null);
});

test('preselects only the county when no confirmed district is available', () => {
  const url = new URL(buildCecPollingPlaceLookupUrl(baseUrl, preference('南投縣')));
  assert.equal(url.searchParams.get('mode'), 'tbox');
  assert.equal(url.searchParams.get('prvCityCode'), '10008');
  assert.equal(url.searchParams.get('deptCode'), null);
});

test('leaves the official URL unchanged when the saved county is unknown', () => {
  assert.equal(buildCecPollingPlaceLookupUrl(baseUrl, preference('未知地區', '未知行政區')), baseUrl);
});
