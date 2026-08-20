import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractExecutivePdfLinks,
  isOfficialBulletinUrl,
  matchBulletin,
  parseArgs,
  parseRaceScope,
} from './fetch-cec-elected-platforms.mjs';

const sitemap = `
  <a href='111/15宜蘭縣/03鄉鎮市長/三星鄉鄉長選舉公報/三星鄉鄉長選舉公報.pdf'>三星</a>
  <a href='111/15宜蘭縣/01縣長/宜蘭縣縣長選舉公報.pdf'>宜蘭縣長</a>
  <a href='111/15宜蘭縣/02縣議員/宜蘭縣第01選舉區.pdf'>議員</a>
  <a href='111/09苗栗縣/04鄉鎮市民代表/苗栗市/第一選舉區/正面.pdf'>苗栗合併公報</a>
  <a href='111/04桃園市/03原住民區長/1桃園市復興鄉第一選區選舉公報(正面).pdf'>復興區長</a>
  <a href='107/15宜蘭縣/鄉鎮市長/三星鄉鄉長.pdf'>舊年度</a>
  <a href='https://example.com/111/15宜蘭縣/03鄉鎮市長/惡意.pdf'>外部</a>
`;

test('extractExecutivePdfLinks keeps 2022 official PDFs for combined-bulletin fallback', () => {
  const links = extractExecutivePdfLinks(sitemap, 2022);
  assert.equal(links.length, 5);
  assert.ok(links.every((link) => isOfficialBulletinUrl(link.url)));
  assert.ok(links.some((link) => link.decodedPath.includes('三星鄉')));
  assert.ok(links.some((link) => link.decodedPath.includes('01縣長')));
});

test('parseRaceScope distinguishes local chiefs and township mayors', () => {
  assert.deepEqual(parseRaceScope('宜蘭縣三星鄉鄉長選舉'), {
    office: 'township_mayor',
    jurisdiction: '宜蘭縣',
    area: '三星鄉',
  });
  assert.deepEqual(parseRaceScope('臺北市市長選舉'), {
    office: 'local_chief',
    jurisdiction: '台北市',
    area: '台北市',
  });
  assert.deepEqual(parseRaceScope('高雄市桃源區區長選舉'), {
    office: 'district_chief',
    jurisdiction: '高雄市',
    area: '桃源區',
  });
  assert.equal(parseRaceScope('宜蘭縣第01選舉區議員選舉'), null);
});

test('matchBulletin requires one jurisdiction, office and area match', () => {
  const links = extractExecutivePdfLinks(sitemap, 2022);
  const sanxing = matchBulletin({ race_title: '宜蘭縣三星鄉鄉長選舉' }, links);
  assert.equal(sanxing.status, 'matched');
  assert.equal(sanxing.matches.length, 1);
  assert.equal(sanxing.selected.decodedPath.includes('三星鄉'), true);
  assert.deepEqual(sanxing.fallbackMatches, []);
  assert.equal(matchBulletin({ race_title: '宜蘭縣縣長選舉' }, links).status, 'matched');
  assert.equal(matchBulletin({ race_title: '苗栗縣苗栗市市長選舉' }, links).status, 'matched');
  assert.equal(matchBulletin({ race_title: '桃園市復興區區長選舉' }, links).status, 'matched');
  assert.equal(matchBulletin({ race_title: '宜蘭縣冬山鄉鄉長選舉' }, links).status, 'missing_bulletin');
});

test('matchBulletin does not collapse multiple official PDFs silently', () => {
  const links = extractExecutivePdfLinks(`${sitemap}
    <a href='111/15宜蘭縣/03鄉鎮市長/三星鄉第二份/三星鄉.pdf'>重複</a>`, 2022);
  assert.equal(matchBulletin({ race_title: '宜蘭縣三星鄉鄉長選舉' }, links).status, 'matched_repeated_section');
});

test('matchBulletin prefers the exact race file inside a repeated section', () => {
  const links = extractExecutivePdfLinks(`${sitemap}
    <a href='111/15宜蘭縣/03鄉鎮市長/南澳鄉鄉長選舉公報/大同鄉長選舉公報/大同鄉長選舉公報.pdf'>錯誤巢狀公報</a>
    <a href='111/15宜蘭縣/03鄉鎮市長/南澳鄉鄉長選舉公報/南澳鄉鄉長選舉公報.pdf'>南澳鄉長</a>`, 2022);
  const match = matchBulletin({ race_title: '宜蘭縣南澳鄉鄉長選舉' }, links);
  assert.equal(match.status, 'matched_repeated_section');
  assert.equal(match.selected.decodedPath.endsWith('/南澳鄉鄉長選舉公報.pdf'), true);
});

test('parseArgs refuses an unverified archive layout', () => {
  assert.throws(() => parseArgs(['--year', '2018']), /Only the verified 2022 archive layout/);
});
