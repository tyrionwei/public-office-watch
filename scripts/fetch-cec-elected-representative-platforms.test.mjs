import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractDistrictNumbers,
  isOfficialBulletinUrl,
  isScopeTarget,
  matchBulletinCandidates,
  parseArgs,
  parseOfficialPdfLinks,
  parseRepresentativeScope,
  selectKnownOfficialPublication,
  scopeLinks,
} from './fetch-cec-elected-representative-platforms.mjs';

const sitemap = `
  <a href='01選舉公報/05直轄市議員/111年/02新北市/12-新北市選舉公報-第十二、十三選區.pdf'>新北合併</a>
  <a href='01選舉公報/06縣市議員/111年/13屏東縣/屏東縣第05-07選舉區.pdf'>屏東合併</a>
  <a href='01選舉公報/02立法委員/113年第11屆/02區域立法委員/02臺北市/第7選舉區/臺北市立委第7選舉區.pdf'>臺北立委</a>
  <a href='01選舉公報/02立法委員/113年第11屆/03平地原住民立法委員/平地原住民立法委員.pdf'>平原</a>
  <a href='01選舉公報/02立法委員/113年第11屆/04山地原住民立法委員/山地原住民立法委員.pdf'>山原</a>
  <a href='https://example.com/01選舉公報/02立法委員/113年第11屆/惡意.pdf'>外部</a>
`;

test('official sitemap parser accepts only bulletin.cec.gov.tw PDFs', () => {
  const links = parseOfficialPdfLinks(sitemap);
  assert.equal(links.length, 5);
  assert.ok(links.every((link) => isOfficialBulletinUrl(link.url)));
});

test('district parser expands Arabic and Chinese combined districts', () => {
  assert.deepEqual([...extractDistrictNumbers('第05-07選舉區')], [5, 6, 7]);
  assert.deepEqual([...extractDistrictNumbers('第十二、十三選區')], [12, 13]);
  assert.deepEqual([...extractDistrictNumbers('第8、13-16選舉區')], [8, 13, 14, 15, 16]);
  assert.deepEqual([...extractDistrictNumbers('第十二及第十三選舉區')], [12, 13]);
});

test('representative scope separates council, regional and indigenous races', () => {
  assert.deepEqual(parseRepresentativeScope({
    race_title: '新北市第13選舉區議員選舉',
    election_year: 2022,
  }), { office: 'councilor', jurisdiction: '新北市', districtNumber: 13 });
  assert.deepEqual(parseRepresentativeScope({
    race_title: '臺北市第7選舉區立法委員選舉',
    election_year: 2024,
  }), { office: 'regional_legislator', jurisdiction: '台北市', districtNumber: 7 });
  assert.deepEqual(parseRepresentativeScope({
    race_title: '高雄市第14選舉區山地原住民議員選舉',
    election_year: 2022,
  }), { office: 'councilor', jurisdiction: '高雄市', districtNumber: 14 });
  assert.equal(parseRepresentativeScope({
    race_title: '平地原住民選舉區',
    election_year: 2024,
  }).office, 'plain_indigenous_legislator');
});

test('scope and race matching retain combined council bulletins', () => {
  const links = scopeLinks('2022-councilor', parseOfficialPdfLinks(sitemap));
  const match = matchBulletinCandidates({
    race_title: '新北市第13選舉區議員選舉',
    election_year: 2022,
  }, links);
  assert.equal(match.status, 'matched_path');
  assert.equal(match.matches[0].decodedPath.includes('十二、十三'), true);
});

test('2024 matching selects regional and indigenous bulletins', () => {
  const links = scopeLinks('2024-legislator', parseOfficialPdfLinks(sitemap));
  assert.equal(matchBulletinCandidates({
    race_title: '臺北市第7選舉區',
    election_year: 2024,
  }, links).matches.length, 1);
  assert.equal(matchBulletinCandidates({
    race_title: '山地原住民選舉區',
    election_year: 2024,
  }, links).matches.length, 1);
  assert.equal(matchBulletinCandidates({
    race_title: '新竹市第1選舉區立法委員選舉',
    election_year: 2024,
  }, [{
    url: 'https://bulletin.cec.gov.tw/新竹市.pdf',
    decodedPath: '113年第11屆/02區域立法委員/新竹市/新竹市.pdf',
  }]).matches.length, 1);
  assert.equal(scopeLinks('2024-legislator', [{
    url: 'https://bulletin.cec.gov.tw/新竹市投開票所.pdf',
    decodedPath: '01選舉公報/02立法委員/113年第11屆/02區域立法委員/新竹市投開票所.pdf',
  }]).length, 0);
});

test('arguments require an explicit verified scope', () => {
  assert.throws(() => parseArgs([]), /--scope must be/);
  assert.equal(parseArgs(['--scope', '2024-legislator']).scope, '2024-legislator');
  assert.equal(
    parseArgs(['--scope', '2022-councilor', '--include-existing-platforms']).includeExistingPlatforms,
    true,
  );
  assert.equal(
    parseArgs(['--scope', '2022-councilor', '--include-non-elected']).includeNonElected,
    true,
  );
});

test('non-elected representative candidates are included only when explicitly requested', () => {
  const councilor = {
    election_year: 2022,
    election_result: 'not_elected',
    is_elected: false,
    race_title: '臺北市第1選舉區議員選舉',
  };
  const legislator = {
    election_year: 2024,
    election_result: 'not_elected',
    election_name: '第11屆立法委員選舉',
    is_elected: false,
  };

  assert.equal(isScopeTarget('2022-councilor', councilor), false);
  assert.equal(isScopeTarget('2022-councilor', councilor, { includeNonElected: true }), true);
  assert.equal(isScopeTarget('2024-legislator', legislator), false);
  assert.equal(isScopeTarget('2024-legislator', legislator, { includeNonElected: true }), true);
});

test('known official split and duplicate layouts select the candidate-bearing bulletin', () => {
  const pingtungAttempts = ['屏東縣第01選舉區1.pdf', '屏東縣第01選舉區2.pdf']
    .map((decodedPath) => ({ link: { decodedPath }, downloaded: {} }));
  assert.equal(selectKnownOfficialPublication({
    race_title: '屏東縣第1選舉區議員選舉',
    election_year: 2022,
    candidate_no: '20',
  }, pingtungAttempts).link.decodedPath.endsWith('1.pdf'), true);
  assert.equal(selectKnownOfficialPublication({
    race_title: '屏東縣第1選舉區議員選舉',
    election_year: 2022,
    candidate_no: '21',
  }, pingtungAttempts).link.decodedPath.endsWith('2.pdf'), true);

  const taitungAttempts = ['臺東縣第1、8、16選舉區.pdf', '臺東縣第1、7、14選舉區.pdf']
    .map((decodedPath) => ({ link: { decodedPath }, downloaded: {} }));
  const selected = selectKnownOfficialPublication({
    race_title: '臺東縣第1選舉區議員選舉',
    election_year: 2022,
  }, taitungAttempts);
  assert.equal(selected.link.decodedPath, '臺東縣第1、7、14選舉區.pdf');
  assert.equal(selected.matchMethod, 'verified_official_bulletin_layout');
});
