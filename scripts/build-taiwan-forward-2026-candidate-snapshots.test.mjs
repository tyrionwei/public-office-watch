import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSnapshots,
  parseDetail,
  parseOverview,
  parseRace,
} from './build-taiwan-forward-2026-candidate-snapshots.mjs';

const profileUrl = 'https://taiwangogo.tw/test-candidate/';

function capturedRecord(overrides = {}) {
  return {
    slug: 'test-candidate',
    profileUrl,
    overviewParty: '時代力量',
    overviewRegion: '臺北市',
    overviewArea: '士林、北投',
    overviewOffice: '市議員候選人',
    personName: '測試候選人',
    detailPersonName: '測試候選人',
    jobTitle: '台北市市議員候選人（第1選區 士林、北投）',
    affiliations: ['時代力量', '台灣前進'],
    photoUrl: 'https://taiwangogo.tw/assets/share/test.jpg',
    education: ['測試學歷'],
    experience: ['測試經歷'],
    platform: ['測試政見'],
    socialLinks: ['https://www.facebook.com/example'],
    ...overrides,
  };
}

test('parses overview candidate cards', () => {
  const records = parseOverview(`
    <a class="cl-cd" href="/test-candidate/" data-city="台北市" data-party="小歐盟">
      <img src="/assets/faces/clean/test.webp" alt="測試候選人">
      <span class="nm">測試候選人</span>
      <span class="ar">台北市<br>中山、大同</span>
      <span class="lv">市議員候選人</span>
    </a>
  `);
  assert.equal(records.length, 1);
  assert.equal(records[0].profileUrl, profileUrl);
  assert.equal(records[0].overviewParty, '小歐盟');
  assert.equal(records[0].overviewRegion, '臺北市');
  assert.equal(records[0].personName, '測試候選人');
});

test('parses structured profile fields, background and platform', () => {
  const detail = parseDetail(`
    <script type="application/ld+json">{
      "@context":"https://schema.org",
      "@type":"Person",
      "name":"測試候選人",
      "url":"${profileUrl}",
      "image":"https://taiwangogo.tw/assets/share/test.jpg",
      "affiliation":[{"name":"時代力量"},{"name":"台灣前進"}],
      "jobTitle":"台北市市議員候選人（第1選區 士林、北投）",
      "sameAs":["https://www.facebook.com/example"]
    }</script>
    <section><div class="cv-plist">
      <article class="cv-pcard"><h3>交通安全</h3><div class="cv-pbody"><p>改善危險路口</p></div></article>
    </div></section>
    <section><div class="cv-biocard">
      <div><h4>學 歷</h4><ul><li>測試大學</li></ul></div>
      <div><h4>經 歷</h4><ul><li>測試工作</li></ul></div>
    </div></div></section>
  `, profileUrl);

  assert.equal(detail.personName, '測試候選人');
  assert.deepEqual(detail.education, ['測試大學']);
  assert.deepEqual(detail.experience, ['測試工作']);
  assert.deepEqual(detail.platform, ['交通安全：改善危險路口']);
  assert.deepEqual(detail.socialLinks, ['https://www.facebook.com/example']);
});

test('reads district number and indigenous subtype from official job title', () => {
  assert.deepEqual(parseRace('台北市市議員候選人（第1選區 士林、北投）'), {
    raceType: 'city_councilor',
    regionName: '臺北市',
    districtName: '第1選區',
  });
  assert.deepEqual(parseRace('台北市市議員候選人（第7選區 平地原住民）'), {
    raceType: 'city_councilor',
    regionName: '臺北市',
    districtName: '第7選區｜平地原住民',
  });
});

test('builds separate validator-compatible snapshots for supported parties', () => {
  const { snapshots, skipped } = buildSnapshots({
    schemaVersion: 1,
    retrievedAt: '2026-07-29T12:00:00+08:00',
    records: [
      capturedRecord(),
      capturedRecord({
        slug: 'obasan-candidate',
        profileUrl: 'https://taiwangogo.tw/obasan-candidate/',
        overviewParty: '小歐盟',
        affiliations: ['小民參政歐巴桑聯盟', '台灣前進'],
        personName: '小歐盟候選人',
        detailPersonName: '小歐盟候選人',
        jobTitle: '新北市市議員候選人（第3選區 新莊）',
        overviewRegion: '新北市',
      }),
      capturedRecord({
        slug: 'representative',
        profileUrl: 'https://taiwangogo.tw/representative/',
        personName: '代表候選人',
        detailPersonName: '代表候選人',
        jobTitle: '新竹縣竹北市市民代表候選人',
        overviewRegion: '新竹縣',
      }),
      capturedRecord({
        slug: 'independent',
        profileUrl: 'https://taiwangogo.tw/independent/',
        overviewParty: '台灣前進',
        affiliations: ['台灣前進'],
        personName: '無黨籍候選人',
        detailPersonName: '無黨籍候選人',
      }),
    ],
  });

  assert.equal(snapshots.get('時代力量').records.length, 1);
  assert.equal(snapshots.get('小民參政歐巴桑聯盟').records.length, 1);
  assert.equal(skipped.length, 2);
  assert.deepEqual(skipped.map((row) => row.reason).sort(), ['party_not_supported', 'race_not_supported']);
});

test('rejects candidate pages outside the official Taiwan Forward domain', () => {
  assert.throws(
    () => parseOverview('<a class="cl-cd" href="https://example.com/a" data-city="台北市" data-party="時代力量"><span class="nm">測試</span></a>'),
    /Unexpected Taiwan Forward URL/,
  );
});
