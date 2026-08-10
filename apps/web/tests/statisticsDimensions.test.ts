import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getEducationStatisticsDimension,
  getStatisticsPartyLabel,
  getStatisticsRaceCategory,
} from '../src/lib/statisticsDimensions.ts';

test('normalizes party aliases before grouping statistics', () => {
  assert.equal(getStatisticsPartyLabel('臺灣民眾黨'), '台灣民眾黨');
  assert.equal(getStatisticsPartyLabel('基進黨'), '台灣基進');
  assert.equal(getStatisticsPartyLabel('臺灣團結聯盟'), '台聯黨');
  assert.equal(getStatisticsPartyLabel('無黨籍及未經政黨推薦'), '無黨籍');
  assert.equal(getStatisticsPartyLabel('無'), '無黨籍');
});

test('uses the existing election race categories for statistics', () => {
  assert.equal(getStatisticsRaceCategory('president').key, 'presidential');
  assert.equal(getStatisticsRaceCategory('county_councilor').key, 'councilor');
  assert.equal(getStatisticsRaceCategory('township_representative_district').key, 'township_representative');
  assert.equal(getStatisticsRaceCategory('village_chief').key, 'village_chief');
});

test('groups education by the highest confirmed level', () => {
  assert.equal(
    getEducationStatisticsDimension('某高中；國立政治大學學士；國立臺灣大學政治學研究所碩士').key,
    'master',
  );
  assert.equal(getEducationStatisticsDimension('National Taiwan University').key, 'university');
  assert.equal(getEducationStatisticsDimension('專科').key, 'junior_college');
  assert.equal(getEducationStatisticsDimension('高中(職)').key, 'high_school');
});

test('keeps ambiguous education labels separate instead of inventing precision', () => {
  assert.equal(getEducationStatisticsDimension('高中(職)以下').key, 'secondary_or_below');
  assert.equal(getEducationStatisticsDimension('大專').key, 'tertiary_unspecified');
  assert.equal(getEducationStatisticsDimension('其他').key, 'other');
  assert.equal(getEducationStatisticsDimension('  ').key, 'unknown');
});
