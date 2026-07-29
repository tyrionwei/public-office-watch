import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSnapshot,
  parseCouncilorPage,
  parseMayorScript,
} from './build-dpp-2026-candidate-snapshot.mjs';

test('parses the DPP mayor data without executing remote JavaScript', () => {
  const records = parseMayorScript(`var mayor_data = [
    {"index":0,"city":"台北市","name":"測試市長","img":"img/mayor/a01.jpg"}
  ];
  globalThis.shouldNotRun = true;`);

  assert.deepEqual(records, [{
    sourceCandidateKey: 'dpp-2026-mayor-63000',
    personName: '測試市長',
    candidacyStatus: 'party_nominee',
    raceType: 'municipality_mayor',
    regionName: '台北市',
    districtName: null,
    nominationAnnouncedAt: null,
    profileUrl: 'https://teamtaiwan.dpp.org.tw/#mayor',
    photoUrl: 'https://teamtaiwan.dpp.org.tw/asset/types/election/img/mayor/a01.jpg',
  }]);
  assert.equal(globalThis.shouldNotRun, undefined);
  assert.throws(() => parseMayorScript(`var mayor_data = [
    {"index":0,"city":"台北市","name":"測試市長","img":"https://example.com/a01.jpg"}
  ];`), /Unexpected DPP mayor image URL/);
});

test('parses councilor cards and keeps indigenous district context', () => {
  const records = parseCouncilorPage(`
    <div class="councilor_name">王&amp;小明</div>
    <div class="councilor_area">
      <div class="councilor_city_label">台北市</div>
      第08選區 <!-- <br>(居住台北市之山地原住民) -->
    </div>
  `, '台北市');

  assert.equal(records.length, 1);
  assert.equal(records[0].personName, '王&小明');
  assert.equal(records[0].districtName, '第8選區｜山地原住民');
  assert.match(records[0].sourceCandidateKey, /^dpp-2026-councilor-63000-8-[a-f0-9]{12}$/);
});

test('builds a validator-compatible mayor snapshot from the official endpoint shape', async () => {
  const fetchImpl = async () => new Response(`var mayor_data = [
    {"index":0,"city":"嘉義市","name":"測試候選人","img":"img/mayor/a12.jpg","education":["測試學歷"],"experience":["測試經歷"]}
  ];`, { status: 200 });
  const snapshot = await buildSnapshot('mayors', {
    fetchImpl,
    retrievedAt: '2026-07-29T12:00:00+08:00',
  });

  assert.equal(snapshot.party, '民主進步黨');
  assert.equal(snapshot.records[0].raceType, 'county_mayor');
  assert.equal(snapshot.records[0].sourceCandidateKey, 'dpp-2026-mayor-10020');
});
