import assert from 'node:assert/strict';
import test from 'node:test';
import {
  candidateNameMatchesExpected,
  districtHeadingsFromTsv,
  districtNumberFromOcrText,
  parseChineseNumber,
  parseProfileCardBirthDate,
} from './extract-cec-2022-councilor-profile-ocr-review.mjs';

test('parses Arabic and Chinese district numbers', () => {
  assert.equal(parseChineseNumber('8'), 8);
  assert.equal(parseChineseNumber('十'), 10);
  assert.equal(parseChineseNumber('十二'), 12);
  assert.equal(parseChineseNumber('二十一'), 21);
});

test('locates two district headings that share one OCR line', () => {
  const header = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
  const rows = [
    ['5', '1', '1', '1', '6', '1', '100', '100', '30', '20', '95', '第'],
    ['5', '1', '1', '1', '6', '2', '135', '100', '30', '20', '95', '八'],
    ['5', '1', '1', '1', '6', '3', '170', '100', '70', '20', '95', '選舉'],
    ['5', '1', '1', '1', '6', '4', '245', '100', '30', '20', '95', '區'],
    ['5', '1', '1', '1', '6', '5', '600', '100', '30', '20', '95', '第'],
    ['5', '1', '1', '1', '6', '6', '635', '100', '30', '20', '95', '十'],
    ['5', '1', '1', '1', '6', '7', '670', '100', '70', '20', '95', '選舉'],
    ['5', '1', '1', '1', '6', '8', '745', '100', '30', '20', '95', '區'],
  ].map((fields) => fields.join('\t'));
  const headings = districtHeadingsFromTsv([header, ...rows].join('\n'));
  assert.deepEqual(headings.map((heading) => heading.number), [8, 10]);
  assert.ok(headings[0].xMax < headings[1].xMin);
});

test('accepts a large OCR heading with 弟 misread for 第 and a missing 區 glyph', () => {
  const header = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
  const rows = [
    ['5', '1', '1', '1', '6', '1', '100', '100', '60', '100', '95', '弟'],
    ['5', '1', '1', '1', '6', '2', '165', '100', '50', '90', '95', '十'],
    ['5', '1', '1', '1', '6', '3', '220', '100', '50', '90', '95', '六'],
    ['5', '1', '1', '1', '6', '4', '275', '100', '120', '90', '95', '選舉'],
  ].map((fields) => fields.join('\t'));
  assert.deepEqual(districtHeadingsFromTsv([header, ...rows].join('\n')).map((heading) => heading.number), [16]);
  rows[0] = ['5', '1', '1', '1', '6', '1', '100', '100', '20', '20', '95', '弟'].join('\t');
  assert.deepEqual(districtHeadingsFromTsv([header, ...rows].join('\n')), []);
});

test('requires the complete expected Chinese name for the name-column fallback', () => {
  assert.equal(candidateNameMatchesExpected('張\n利\n惠', '張利惠'), true);
  assert.equal(candidateNameMatchesExpected('張\n利', '張利惠'), false);
  assert.equal(candidateNameMatchesExpected('Hani Kacaw', '哈尼．噶照Hani Kacaw'), false);
});

test('parses strict profile-card district and birth evidence', () => {
  assert.equal(districtNumberFromOcrText('宜蘭縣議員選舉第六選舉區候選人'), 6);
  assert.equal(districtNumberFromOcrText('宜蘭縣議員候選人'), null);
  assert.equal(parseProfileCardBirthDate('個人資料\n出生年月日：48年1月19日\n性別：男'), '1959-01-19');
});
