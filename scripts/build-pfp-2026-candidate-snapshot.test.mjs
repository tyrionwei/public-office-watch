import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSnapshot,
  normalizeCandidate,
  parseCandidatePayloads,
  parseDistrict,
} from './build-pfp-2026-candidate-snapshot.mjs';

function candidate(overrides = {}) {
  return {
    id: 'pfp2026-001',
    name: '楊秀玉',
    district: '基隆市 第七選區 (七堵)',
    pos: '市議員參選人',
    photo: 'photo/pfp2026-001.jpg?2',
    fb_url: 'https://www.facebook.com/example',
    exp: [{ year: '現任', title: '第 19 屆基隆市議員', content: '' }],
    platform: [{ no: '01', title: '交通建設', content: '<p>改善通勤安全</p>' }],
    ...overrides,
  };
}

test('parses candidate JSON without executing page scripts', () => {
  const payloads = parseCandidatePayloads(`
    <div class="candidate-card" onclick='showCandidate(${JSON.stringify(candidate())})'>
      <div class="name">楊秀玉</div>
    </div>
  `);
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].id, 'pfp2026-001');
  assert.equal(payloads[0].name, '楊秀玉');
});

test('normalizes Chinese district numbers and indigenous subtype', () => {
  assert.deepEqual(parseDistrict('宜蘭縣 第十二選區 (山地原住民)', '縣議員參選人'), {
    raceType: 'county_councilor',
    regionName: '宜蘭縣',
    districtName: '第十二選區｜山地原住民',
  });
  assert.deepEqual(parseDistrict('台中市 第四選區 (豐原、后里)', '市議員參選人'), {
    raceType: 'city_councilor',
    regionName: '臺中市',
    districtName: '第四選區',
  });
});

test('keeps public profile data but omits contact and bank account fields', () => {
  const record = normalizeCandidate(candidate({
    phone: '02-12345678',
    address: '測試地址',
    account_num: '測試帳號',
    line_url: 'https://line.me/R/ti/p/example',
  }));
  assert.equal(record.nominationAnnouncedAt, '2026-05-26');
  assert.equal(record.profileUrl, 'https://youth.pfpnext.com/2026/candidate-detail.php?id=pfp2026-001');
  assert.deepEqual(record.education, []);
  assert.deepEqual(record.experience, ['現任：第 19 屆基隆市議員']);
  assert.deepEqual(record.platform, ['交通建設：改善通勤安全']);
  assert.deepEqual(record.socialLinks, [
    'https://www.facebook.com/example',
    'https://line.me/R/ti/p/example',
  ]);
  assert.equal(Object.hasOwn(record, 'phone'), false);
  assert.equal(Object.hasOwn(record, 'address'), false);
  assert.equal(Object.hasOwn(record, 'account_num'), false);
});

test('builds a validator-compatible PFP snapshot', () => {
  const second = candidate({
    id: 'pfp2026-007',
    name: '黃朝淵',
    district: '台中市 第四選區 (豐原、后里)',
    photo: 'photo/pfp2026-007.jpg',
  });
  const snapshot = buildSnapshot(`
    <div onclick='showCandidate(${JSON.stringify(candidate())})'></div>
    <div onclick='showCandidate(${JSON.stringify(second)})'></div>
  `, '2026-07-29T12:00:00+08:00');
  assert.equal(snapshot.party, '親民黨');
  assert.equal(snapshot.records.length, 2);
  assert.equal(snapshot.records[1].nominationAnnouncedAt, null);
});

test('rejects duplicate ids and unofficial campaign assets', () => {
  assert.throws(() => buildSnapshot(`
    <div onclick='showCandidate(${JSON.stringify(candidate())})'></div>
    <div onclick='showCandidate(${JSON.stringify(candidate())})'></div>
  `), /Duplicate PFP candidate id/);
  assert.throws(
    () => normalizeCandidate(candidate({ photo: 'https://example.com/photo.jpg' })),
    /Unexpected PFP campaign URL/,
  );
});
