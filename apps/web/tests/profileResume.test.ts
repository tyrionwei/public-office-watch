import assert from 'node:assert/strict';
import test from 'node:test';
import { educationProfileItems, experienceProfileItems } from '../src/lib/profileResume.ts';

test('deduplicates generic, traditional, simplified and bilingual education labels', () => {
  assert.deepEqual(
    educationProfileItems('大學, 國立臺灣大學法律學系；国立台湾大学法律学系；National Taiwan University'),
    ['國立臺灣大學法律學系'],
  );
  assert.deepEqual(
    educationProfileItems('英國里茲大學（University of Leeds）；University of Leeds'),
    ['英國里茲大學（University of Leeds）'],
  );
});

test('shows university and higher education while hiding lower schools', () => {
  assert.deepEqual(
    educationProfileItems('某國小；某國中；某高中；某大學法律學士；某大學法律研究所碩士'),
    ['某大學法律學士', '某大學法律研究所碩士'],
  );
});

test('shows only the highest lower education or generic level', () => {
  assert.deepEqual(educationProfileItems('某國小；某國中；某高中'), ['某高中']);
  assert.deepEqual(educationProfileItems('國中；高中；專科'), ['專科']);
  assert.deepEqual(educationProfileItems('高中；大學；碩士'), ['碩士']);
});

test('splits newline, semicolon, bullet, numbered and sentence experience lists', () => {
  assert.deepEqual(
    experienceProfileItems('1.第一屆議員\n2.地方協會理事；●黨部主任。4.基金會顧問', '現任立法委員'),
    ['第一屆議員', '地方協會理事', '黨部主任', '基金會顧問'],
  );
});

test('deduplicates experience variants and removes the current role', () => {
  assert.deepEqual(
    experienceProfileItems('臺北市議員；台北市議員；地方協會理事；地方协会理事', '臺北市議員'),
    ['地方協會理事'],
  );
});

test('removes scraped navigation noise without dropping valid numbered roles after it', () => {
  assert.deepEqual(
    experienceProfileItems(
      '九、國有財產局辦事處課長\n上一頁\n瀏覽人次：56676\n市政新聞\n地址：新竹市中正路120號\n一、臺北市政府地政局局長',
      '公務員',
    ),
    ['國有財產局辦事處課長', '臺北市政府地政局局長'],
  );
});
