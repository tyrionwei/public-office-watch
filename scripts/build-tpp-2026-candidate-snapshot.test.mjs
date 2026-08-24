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
  assert.deepEqual(parseDistrict('臺北市｜第七選區（松山區、信義區｜山地原住民）', '市議員'), {
    regionName: '臺北市',
    districtName: '第七選區｜山地原住民',
    localityName: null,
    villageName: null,
  });
});

test('parses township representative, township mayor, and village locations', () => {
  assert.deepEqual(parseDistrict('屏東縣｜屏東市（第四選區）', '市民代表'), {
    regionName: '屏東縣',
    districtName: '第四選區',
    localityName: '屏東市',
    villageName: null,
  });
  assert.deepEqual(parseDistrict('高雄市｜第八選區（桃源區、山地原住民）', '區長'), {
    regionName: '高雄市',
    districtName: '第八選區｜山地原住民',
    localityName: '桃源區',
    villageName: null,
  });
  assert.deepEqual(parseDistrict('臺南市｜安平區（華平里）', '里長'), {
    regionName: '臺南市',
    districtName: null,
    localityName: '安平區',
    villageName: '華平里',
  });
  assert.deepEqual(parseDistrict('金門縣（金城鎮）', '鎮民代表'), {
    regionName: '金門縣',
    districtName: null,
    localityName: '金城鎮',
    villageName: null,
  });
  assert.deepEqual(parseDistrict('臺北市（文山區興豐里）', '里長'), {
    regionName: '臺北市',
    districtName: null,
    localityName: '文山區',
    villageName: '興豐里',
  });
});

test('classifies supported upper-level and grassroots races', () => {
  assert.equal(classifyRace('嘉義市長', '嘉義市', null), 'county_mayor');
  assert.equal(classifyRace('市議員', '基隆市', '第一選區'), 'city_councilor');
  assert.equal(classifyRace('議員', '彰化縣', '第一選區'), 'county_councilor');
  assert.equal(classifyRace('議員', '新竹市', null), null);
  assert.equal(classifyRace('竹北市長', '新竹縣', null, '竹北市'), 'township_mayor');
  assert.equal(classifyRace('鎮民代表', '新竹縣', '第四選區', '竹東鎮'), 'township_representative_district');
  assert.equal(classifyRace('里長', '臺北市', null, '松山區', '安平里'), 'village_chief');
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
        officeTitle: '未知職位',
        districtText: '新竹縣｜未知地區',
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
  assert.equal(skipped[0].officeTitle, '未知職位');
});

test('builds grassroots records and preserves incumbency evidence', () => {
  const { snapshot, skipped } = buildSnapshot({
    schemaVersion: 1,
    retrievedAt: '2026-08-24T03:46:41+08:00',
    records: [capturedRecord({
      cid: '222',
      profileUrl: 'https://www.tpp.org.tw/election2026/candidatedetail.php?cid=222',
      personName: '吳俊民',
      officeTitle: '鎮民代表',
      districtText: '新竹縣｜竹東鎮（第四選區）',
      isIncumbent: true,
      incumbencyEvidence: '中選會：111年鄉鎮市民代表選舉 - 區域當選',
      cecQueryUrl: 'https://db.cec.gov.tw/query/api/v1/elections/candidates/query?cand_name=%E5%90%B3%E4%BF%8A%E6%B0%91',
      districtTextOriginal: '新竹縣｜吳俊民',
      districtVerificationSource: '台灣民眾黨：現任黨公職',
      districtVerificationUrl: 'https://www.tpp.org.tw/memberdetail/example',
    })],
  });

  assert.equal(skipped.length, 0);
  assert.equal(snapshot.records[0].raceType, 'township_representative_district');
  assert.equal(snapshot.records[0].localityName, '竹東鎮');
  assert.equal(snapshot.records[0].districtName, '第四選區');
  assert.equal(snapshot.records[0].isIncumbent, true);
  assert.match(snapshot.records[0].locationEvidence, /原始欄位/);
  assert.match(snapshot.records[0].locationEvidenceUrl, /^https:\/\/www\.tpp\.org\.tw\//);
  assert.match(snapshot.records[0].incumbencyEvidence, /當選/);
  assert.match(snapshot.records[0].incumbencySourceUrl, /^https:\/\/db\.cec\.gov\.tw\//);
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
