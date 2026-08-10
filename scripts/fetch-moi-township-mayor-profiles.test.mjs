import assert from 'node:assert/strict';
import test from 'node:test';

import {
  matchTargets,
  parseListCards,
  parseProfileDetail,
  targetRegion,
} from './fetch-moi-township-mayor-profiles.mjs';

test('parses MOI township mayor list cards and profile fields', () => {
  const cards = parseListCards(`
    <div class="block">
      <a href="/LocalOfficial_Content.aspx?n=580&amp;_PARENT_ID=MYR11112PF0014&amp;_TYP=MYR&amp;TYP=KND0006">
        <div class="caption"><span>林慧如</span></div>
        <div class="locate"><span>雲林縣</span></div>
        <div class="group"><span>民主進步黨</span></div>
      </a>
    </div>
  `);
  const detail = parseProfileDetail(`
    <div class="essay"><div class="caption">學歷</div><div class="p">國立政治大學<br>國際貿易學系</div></div>
    <div class="essay"><div class="caption">簡歷</div><div class="p"><ul><li>雲林縣議員</li><li>古坑鄉長</li></ul></div></div>
  `);

  assert.equal(cards.length, 1);
  assert.equal(cards[0].externalId, 'MYR11112PF0014');
  assert.equal(cards[0].region, '雲林縣');
  assert.equal(detail.education, '國立政治大學\n國際貿易學系');
  assert.equal(detail.experience, '雲林縣議員\n古坑鄉長');
});

test('matches only one exact current mayor in the same county or city', () => {
  const target = {
    personId: 'person-1',
    name: '林慧如',
    listStatus: 'current',
    currentOfficeLabel: '雲林縣古坑鄉鄉長',
  };
  const cards = [
    { name: '林慧如', region: '雲林縣' },
    { name: '林慧如', region: '嘉義縣' },
  ];

  assert.equal(targetRegion(target), '雲林縣');
  assert.equal(matchTargets(cards, [target]).matches.length, 1);
});
