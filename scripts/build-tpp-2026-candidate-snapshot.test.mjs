import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSnapshot,
  classifyRace,
  parseDistrict,
} from './build-tpp-2026-candidate-snapshot.mjs';

function capturedRecord(overrides = {}) {
  return {
    cid: '190',
    profileUrl: 'https://www.tpp.org.tw/election2026/candidatedetail.php?cid=190',
    personName: '林廷翰',
    officeTitle: '市議員',
    districtText: '基隆市｜第一選區（中正區）',
    photoUrl: 'https://www.tpp.org.tw/aimg/candidate.png',
    education: ['測試學歷'],
    experience: ['測試經歷'],
    platform: ['測試政見'],
    socialLinks: ['https://www.facebook.com/example'],
    ...overrides,
  };
}

test('parses TPP district labels and indigenous subtype', () => {
  assert.deepEqual(parseDistrict('臺北市｜第七選區（松山區、信義區｜山地原住民）'), {
    regionName: '臺北市',
    districtName: '第七選區｜山地原住民',
  });
});

test('classifies only currently supported mayor and councilor races', () => {
  assert.equal(classifyRace('嘉義市長', '嘉義市', null), 'county_mayor');
  assert.equal(classifyRace('市議員', '基隆市', '第一選區'), 'city_councilor');
  assert.equal(classifyRace('議員', '彰化縣', '第一選區'), 'county_councilor');
  assert.equal(classifyRace('議員', '新竹市', null), null);
  assert.equal(classifyRace('竹北市長', '新竹縣', null), null);
  assert.equal(classifyRace('里長', '臺北市', null), null);
});

test('builds a validator-compatible snapshot and preserves enrichment fields', () => {
  const { snapshot, skipped } = buildSnapshot({
    schemaVersion: 1,
    sourceUrl: 'https://www.tpp.org.tw/election2026/index.php',
    retrievedAt: '2026-07-29T12:00:00+08:00',
    records: [
      capturedRecord(),
      capturedRecord({
        cid: '218',
        profileUrl: 'https://www.tpp.org.tw/election2026/candidatedetail.php?cid=218',
        personName: '測試鎮長',
        officeTitle: '竹北市長',
        districtText: '新竹縣｜竹北市',
      }),
    ],
  });

  assert.equal(snapshot.party, '台灣民眾黨');
  assert.equal(snapshot.records.length, 1);
  assert.equal(snapshot.records[0].raceType, 'city_councilor');
  assert.deepEqual(snapshot.records[0].education, ['測試學歷']);
  assert.deepEqual(snapshot.records[0].experience, ['測試經歷']);
  assert.deepEqual(snapshot.records[0].platform, ['測試政見']);
  assert.deepEqual(snapshot.records[0].socialLinks, ['https://www.facebook.com/example']);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].officeTitle, '竹北市長');
});

test('rejects candidate profiles outside the official TPP election site', () => {
  assert.throws(() => buildSnapshot({
    schemaVersion: 1,
    retrievedAt: '2026-07-29T12:00:00+08:00',
    records: [capturedRecord({
      profileUrl: 'https://example.com/election2026/candidatedetail.php?cid=190',
    })],
  }), /Unexpected TPP candidate profile URL/);
});
