import assert from 'node:assert/strict';
import {
  parseListCards,
  parseProfileDetail,
} from './fetch-moi-local-official-profiles.mjs';

const cards = parseListCards(`
  <div class="block">
    <div class="caption"><span>山田摩衣</span></div>
    <div class="locate"><span>新北市</span></div>
    <div class="group"><span>民主進步黨</span></div>
    <a href="/LocalOfficial_Content.aspx?n=573&amp;_PARENT_ID=example">詳細資訊</a>
  </div>
`);
assert.deepEqual(cards, [{
  name: '山田摩衣',
  city: '新北市',
  party: '民主進步黨',
  sourceUrl: 'https://www.moi.gov.tw/LocalOfficial_Content.aspx?n=573&_PARENT_ID=example',
}]);

const detail = parseProfileDetail(`
  <div class="essay">
    <div class="caption">選舉屆次</div>
    <div class="p"><ul><li>111年度直轄市議員選舉</li></ul></div>
  </div>
  <div class="essay">
    <div class="caption">學歷</div>
    <div class="p"><ul><li>文化大學英國語文學系</li></ul></div>
  </div>
  <div class="essay">
    <div class="caption">簡歷</div>
    <div class="p"><ul><li>新北市黨部宣傳組組長<br>立法院國會辦公室副主任</li></ul></div>
  </div>
`);
assert.equal(detail.electionTerm, '111年度直轄市議員選舉');
assert.equal(detail.education, '文化大學英國語文學系');
assert.equal(detail.experience, '新北市黨部宣傳組組長\n立法院國會辦公室副主任');

console.log('fetch-moi-local-official-profiles tests passed');
