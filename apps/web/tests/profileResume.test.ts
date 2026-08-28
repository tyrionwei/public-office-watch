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

test('keeps every explicit school while omitting generic levels', () => {
  assert.deepEqual(
    educationProfileItems('某國小；某大學法律學士；某高中；某大學法律博士；某國中；某大學法律研究所碩士'),
    ['某大學法律博士', '某大學法律研究所碩士', '某大學法律學士', '某高中', '某國中', '某國小'],
  );

  assert.deepEqual(
    educationProfileItems('某國民小學；某國民中學；羅東高級工業學校；南開科技大學附設高中部；某專科學校副學士；某大學'),
    ['某大學', '某專科學校副學士', '羅東高級工業學校', '南開科技大學附設高中部', '某國民中學', '某國民小學'],
  );
});

test('keeps explicit lower schools and shows only the highest generic level', () => {
  assert.deepEqual(educationProfileItems('某國小；某國中；某高中'), ['某高中', '某國中', '某國小']);
  assert.deepEqual(educationProfileItems('國中；高中；專科'), ['專科']);
  assert.deepEqual(educationProfileItems('高中；大學；碩士'), ['碩士']);
});

test('splits newline, semicolon, bullet, numbered and sentence experience lists', () => {
  assert.deepEqual(
    experienceProfileItems('1.第一屆議員\n2.地方協會理事；●黨部主任。4.基金會顧問', '現任立法委員'),
    ['第一屆議員', '地方協會理事', '黨部主任', '基金會顧問'],
  );
});

test('splits Hou You-yi experience roles separated only by spaces', () => {
  assert.deepEqual(
    experienceProfileItems(
      '新北市副市長 中央警察大學校長 內政部警政署署長 內政部警政署刑事警察局局長 桃園縣政府警察局局長；新北市市長；大學校長；政治人物；2024年總統選舉',
      '新北市市長',
    ),
    ['新北市副市長', '中央警察大學校長', '內政部警政署署長', '內政部警政署刑事警察局局長', '桃園縣政府警察局局長'],
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

test('repairs OCR-wrapped education degrees before splitting schools', () => {
  assert.deepEqual(
    educationProfileItems('東海大學政治學研究所碩\n士\n輔仁大學歷史學系\n嘉華高中'),
    ['東海大學政治學研究所碩士', '輔仁大學歷史學系', '嘉華高中'],
  );
});

test('splits abbreviated universities and girls high schools at source line boundaries', () => {
  assert.deepEqual(
    educationProfileItems(
      '美國賓州大學法律碩士\n美國波士頓大學法律碩士\n台大法律系司法組\n北一女中',
    ),
    ['美國賓州大學法律碩士', '美國波士頓大學法律碩士', '台大法律系司法組', '北一女中'],
  );
});

test('splits comma-separated experience roles without splitting ordinal ranges', () => {
  assert.deepEqual(
    experienceProfileItems(
      '桃園市議會第一屆市議員、桃園縣議會第十五、十六、十七屆議員、觀音鄉民代表會第十五屆副主席、草漯國小教育事務基金會董事長',
      '立法委員',
    ),
    [
      '桃園市議會第一屆市議員',
      '桃園縣議會第十五、十六、十七屆議員',
      '觀音鄉民代表會第十五屆副主席',
      '草漯國小教育事務基金會董事長',
    ],
  );
});

test('splits numbered and OCR-decorated school lines with varied school suffixes', () => {
  assert.deepEqual(
    educationProfileItems(
      '一、中國文化大學新聞系學士\n二、中正國防幹部預備學校畢業\n三、復興工專\n四、六和高工\n五、屏大附小',
    ),
    ['中國文化大學新聞系學士', '復興工專', '中正國防幹部預備學校畢業', '六和高工', '屏大附小'],
  );
  assert.deepEqual(
    educationProfileItems('◎新埔國小 ◎光仁國中\n“ 建國中學\n+ 育達商職'),
    ['建國中學', '育達商職', '光仁國中', '新埔國小'],
  );
});

test('repairs institution names split between 大學 and 學院 characters', () => {
  assert.deepEqual(
    educationProfileItems('崇右技術學院\n陽明交通大\n學碩士(原\n交通大學)\n國立體育學\n院體育學學士'),
    ['陽明交通大學碩士(原交通大學)', '崇右技術學院', '國立體育學院體育學學士'],
  );
});

test('splits flattened education lists at school, sentence and inline-number boundaries', () => {
  assert.deepEqual(
    educationProfileItems('東吳大學會計系武陵高中仁美國中宋屋國小'),
    ['東吳大學會計系', '武陵高中', '仁美國中', '宋屋國小'],
  );
  assert.deepEqual(
    educationProfileItems('美國南加州大學法學碩士 輔仁大學法學士 薇閣高中'),
    ['美國南加州大學法學碩士', '輔仁大學法學士', '薇閣高中'],
  );
  assert.deepEqual(
    educationProfileItems('會稽國小。文昌國中。復旦高級中學。國立政治大學碩士2.中原大學學士'),
    ['國立政治大學碩士', '中原大學學士', '復旦高級中學', '文昌國中', '會稽國小'],
  );
});

test('keeps university college names within the same education item', () => {
  assert.deepEqual(educationProfileItems('中原大學商學院企業管理學系碩士'), ['中原大學商學院企業管理學系碩士']);
  assert.deepEqual(
    educationProfileItems('國立臺灣大學管理學院碩士在職專班'),
    ['國立臺灣大學管理學院碩士在職專班'],
  );
});

test('handles real-world OCR wraps without splitting inside one institution', () => {
  assert.deepEqual(
    educationProfileItems('中國科技大學企業管理研究所畢業臺灣省立中\n壢中學高中'),
    ['中國科技大學企業管理研究所畢業', '臺灣省立中壢中學高中'],
  );
  assert.deepEqual(
    educationProfileItems('南開科技大學附設高中部畢業'),
    ['南開科技大學附設高中部畢業'],
  );
  assert.deepEqual(
    educationProfileItems('國立東華大學 ( 原花蓮教育大學)'),
    ['國立東華大學 ( 原花蓮教育大學)'],
  );
  assert.deepEqual(
    educationProfileItems('新竹中學/培英國中/曙光國小'),
    ['新竹中學', '培英國中', '曙光國小'],
  );
});
