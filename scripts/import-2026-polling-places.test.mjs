import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  applyReviewedPdfTranscriptions,
  villageFromStationName,
  readReviewedPdfRows,
  main,
  buildPollingPlaceSyncSql,
  parseOdsPollingPlaces,
  validatePdfSourceExpectations,
  validatePollingPlaceExpectations,
} from './import-2026-polling-places.mjs';

const tainan = JSON.parse(fs.readFileSync(new URL('../data-sources/2026-polling-places.json', import.meta.url)))
  .counties.find((county) => county.county_code === '67000');

test('Tainan image cells retain the original PDF address and all reviewed village identities', () => {
  const sheets = [{ rows: [
    ['投開票所編號', '投開票所名稱', '投開票所地址', '一般選舉人所屬村里', '一般選舉人所屬鄰別'],
    ...tainan.reviewed_pdf_transcriptions.map((review) => review.extracted_row),
  ] }];
  const before = structuredClone(sheets);
  const repaired = applyReviewedPdfTranscriptions(sheets, tainan);
  const places = parseOdsPollingPlaces(repaired, tainan);
  assert.deepEqual(sheets, before);
  assert.equal(places.length, 10);
  const station = places.find((place) => place.station_no === '0366');
  assert.equal(station.address, '臺南市西港區永樂里４鄰大塭寮５９之３５號');
  assert.deepEqual(station.neighborhoods, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(places.find((place) => place.station_no === '1561').village_code, '67000300008');
  assert.equal(places.find((place) => place.station_no === '1561').station_name, '石𥕢里民活動中心');
  assert.equal(places.find((place) => place.station_no === '0359').village_code, '67000140004');
});

test('reviewed PDF transcriptions reject changed hashes, rows and duplicate or missing stations', () => {
  const review = tainan.reviewed_pdf_transcriptions[0];
  const source = { ...tainan, reviewed_pdf_transcriptions: [review] };
  const sheets = [{ rows: [review.extracted_row] }];
  assert.throws(() => applyReviewedPdfTranscriptions(sheets, { ...source, source_hash: '0'.repeat(64) }), /Invalid reviewed/);
  assert.throws(() => applyReviewedPdfTranscriptions([{ rows: [[...review.extracted_row.slice(0, 4), 'changed']] }], source), /no longer matches/);
  assert.throws(() => applyReviewedPdfTranscriptions([{ rows: [] }], source), /no longer matches/);
  assert.throws(() => applyReviewedPdfTranscriptions([{ rows: [review.extracted_row, review.extracted_row] }], source), /no longer matches/);
  assert.throws(() => applyReviewedPdfTranscriptions(sheets, { ...source, reviewed_pdf_transcriptions: [review, review] }), /Invalid reviewed/);
});

test('PDF rows without villages fail closed instead of silently omitting a station', () => {
  const sheets = [{ rows: [
    ['投開票所編號', '投開票所名稱', '投開票所地址', '一般選舉人所屬村里', '一般選舉人所屬鄰別'],
    ['臺南市西港區第0359投開票所', '松林國小', '', '', '1-6'],
  ] }];
  assert.throws(() => parseOdsPollingPlaces(sheets, tainan), /Missing PDF village assignment/);
});

test('normalized PDF output must still include every official station after parsing', () => {
  const source = { adapter: 'cec-pdf-layout-2026', name: '測試縣', expected_station_count: 2, expected_last_station_no: '0002' };
  assert.doesNotThrow(() => validatePollingPlaceExpectations([{ station_no: '0001' }, { station_no: '0002' }], source));
  assert.throws(() => validatePollingPlaceExpectations([{ station_no: '0001' }], source), /sequence is incomplete/);
  assert.throws(() => validatePollingPlaceExpectations([{ station_no: '0001' }, { station_no: '0003' }], source), /sequence is incomplete/);
});

const source = {
  county_code: '10007',
  name: '彰化縣',
  source_name: '彰化縣選舉委員會',
  source_url: 'https://web.cec.gov.tw/chec/article/64324',
  published_on: '2026-08-31',
  source_hash: 'a'.repeat(64),
  format: 'ods',
  district_aliases: { 線西線: '線西鄉' },
};
const directories = {
  districtsByCountyCode: { '10007': [{ code: '10007190', name: '線西鄉' }] },
  villagesByDistrictCode: { '10007190': [{ code: '10007190001', name: '磚[磘]村' }] },
};

test('reviewed PDF sources require an independently verified count and last station', () => {
  const reviewed = {
    adapter: 'cec-pdf-layout-2026',
    name: '測試縣',
    expected_station_count: 540,
    expected_last_station_no: '0540',
  };
  assert.doesNotThrow(() => validatePdfSourceExpectations(reviewed));
  assert.throws(
    () => validatePdfSourceExpectations({ ...reviewed, expected_station_count: undefined }),
    /Missing expected PDF station count/,
  );
  assert.throws(
    () => validatePdfSourceExpectations({ ...reviewed, expected_last_station_no: undefined }),
    /Missing expected PDF last station number/,
  );
  assert.throws(
    () => validatePdfSourceExpectations({ ...reviewed, expected_last_station_no: '0539' }),
    /count and last station number disagree/,
  );
});

test('parses repeated headers, reviewed district typos and bracketed village variants', () => {
  const sheets = [{ rows: [
    ['投開票所編號', '投開票所名稱', '投開票所地址', '一般選舉人\\n所屬村里', '一般選舉人\\n所屬鄰別'],
    ['彰化縣線西線第\\n0492投開票所', '活動中心', '彰化縣線西鄉測試路1號', '磚磘村', '1-4'],
    ['投開票所編號', '投開票所名稱', '投開票所地址', '一般選舉人\\n所屬村里', '一般選舉人\\n所屬鄰別'],
  ] }];
  const places = parseOdsPollingPlaces(sheets, source, directories);
  assert.equal(places.length, 1);
  assert.equal(places[0].district_code, '10007190');
  assert.equal(places[0].village_code, '10007190001');
  assert.deepEqual(places[0].neighborhoods, [1, 2, 3, 4]);
});

test('fails closed when the official file lacks village assignment columns', () => {
  const sheets = [{ rows: [
    ['投開票所編號', '投開票所名稱', '投開票所地址'],
    ['第0001投開票所', '活動中心', '測試路1號'],
  ] }];
  assert.throws(() => parseOdsPollingPlaces(sheets, source, directories), /missing required columns/);
});

test('same-source reimport deletes the prior snapshot before inserting the verified replacement', () => {
  const place = {
    id: 'b'.repeat(32), source_id: 'a'.repeat(32), district_code: '10007190',
    village_code: '10007190001', village_name: '磚磘村', station_no: '0492',
    station_name: '活動中心', address: '彰化縣線西鄉測試路1號',
    coverage_kind: 'neighborhoods', raw_neighborhoods: '1-2', source_row: 2,
    neighborhoods: [1, 2],
  };
  const sql = buildPollingPlaceSyncSql(
    { event_key: '2026-local-general-election-day', voting_date: '2026-11-28' },
    [{ source, places: [place], fetchedAt: '2026-09-06T00:00:00.000Z' }],
    { apply: true },
  );
  const deletion = sql.indexOf("DELETE FROM public.polling_places WHERE source_id='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'::uuid");
  const insertion = sql.indexOf('INSERT INTO public.polling_places(');
  assert.ok(deletion > 0 && insertion > deletion);
  assert.match(sql, /Neighborhood count mismatch/);
  assert.doesNotMatch(sql, /ON CONFLICT DO NOTHING/);
  assert.match(sql, /COMMIT;$/);
});

test("merges one station repeated across official continuation rows", () => {
  const sheets = [{ rows: [
    ["投開票所編號", "投開票所名稱", "投開票所地址", "一般選舉人所屬村里", "一般選舉人所屬鄰別"],
    ["彰化縣線西線第0492投開票所", "活動中心", "彰化縣線西鄉測試路1號", "磚磘村", "1-2"],
    ["彰化縣線西線第0492投開票所", "活動中心", "彰化縣線西鄉測試路1號", "磚磘村", "3-4"],
  ] }];
  const places = parseOdsPollingPlaces(sheets, source, directories);
  assert.equal(places.length, 1);
  assert.deepEqual(places[0].neighborhoods, [1, 2, 3, 4]);
  assert.equal(places[0].raw_neighborhoods, "1-2；3-4");
});

test("reviewed duplicate-neighborhood stations remain ambiguous instead of exact", () => {
  const ambiguousSource = { ...source, ambiguous_station_numbers: ["0492", "0493"] };
  const sheets = [{ rows: [
    ["投開票所編號", "投開票所名稱", "投開票所地址", "一般選舉人所屬村里", "一般選舉人所屬鄰別"],
    ["彰化縣線西線第0492投開票所", "活動中心甲", "彰化縣線西鄉測試路1號", "磚磘村", "2"],
    ["彰化縣線西線第0493投開票所", "活動中心乙", "彰化縣線西鄉測試路2號", "磚磘村", "2"],
  ] }];
  const places = parseOdsPollingPlaces(sheets, ambiguousSource, directories);
  assert.equal(places.length, 2);
  assert.ok(places.every((place) => place.coverage_kind === "ambiguous"));
  assert.ok(places.every((place) => place.neighborhoods.length === 0));
});

test("PDF conflicts fail closed to possible venues without discarding locations", () => {
  const pdfSource = { ...source, adapter: "cec-pdf-layout-2026" };
  const sheets = [{ rows: [
    ["投開票所編號", "投開票所名稱", "投開票所地址", "一般選舉人所屬村里", "一般選舉人所屬鄰別"],
    ["彰化縣線西線第0492投開票所", "活動中心甲", "彰化縣線西鄉測試路1號", "磚磘村", "2"],
    ["彰化縣線西線第0493投開票所", "活動中心乙", "彰化縣線西鄉測試路2號", "磚磘村", "2"],
  ] }];
  const places = parseOdsPollingPlaces(sheets, pdfSource, directories);
  assert.equal(places.length, 2);
  assert.ok(places.every((place) => place.coverage_kind === "ambiguous"));
  assert.ok(places.every((place) => place.neighborhoods.length === 0));
  assert.deepEqual(places.map((place) => place.station_name), ["活動中心甲", "活動中心乙"]);
});


test("keeps the official PDF text for audit but shows a readable review label", () => {
  const pdfSource = { ...source, adapter: "cec-pdf-layout-2026" };
  const sheets = [{ rows: [
    ["投開票所編號", "投開票所名稱", "投開票所地址", "一般選舉人所屬村里", "一般選舉人所屬鄰別"],
    ["彰化縣線西線第0492投開票所", "活動中心", "彰化縣線西鄉測試路1號", "磚磘村", "需覆核:1-3，"],
  ] }];
  const [place] = parseOdsPollingPlaces(sheets, pdfSource, directories);
  assert.equal(place.coverage_kind, "ambiguous");
  assert.deepEqual(place.neighborhoods, []);
  assert.equal(place.raw_neighborhoods, "官方鄰別條件需人工覆核");
  assert.equal(place.source_raw_neighborhoods, "需覆核:1-3，");
});


test("fails when a reviewed official PDF regression row changes", () => {
  const places = [{
    station_no: "1501",
    station_name: "中興活動中心",
    raw_neighborhoods: "1,6-7,15-18,22",
  }];
  const reviewedSource = {
    name: "臺中市",
    regression_expectations: [{
      station_no: "1501",
      station_name: "中興活動中心",
      raw_neighborhoods: "1,6-7,15-18,22",
    }],
  };
  assert.doesNotThrow(() => validatePollingPlaceExpectations(places, reviewedSource));
  places[0].raw_neighborhoods = "19,23,27-281,6-7,15-18,22";
  assert.throws(
    () => validatePollingPlaceExpectations(places, reviewedSource),
    /Polling-place regression/,
  );
});

test('reviewed Lienchiang PDF covers all 22 villages and shared venues without guessing address villages', () => {
  const source = JSON.parse(fs.readFileSync(new URL('../data-sources/2026-polling-places.json', import.meta.url)))
    .counties.find((county) => county.county_code === '09007');
  const review = JSON.parse(fs.readFileSync(new URL('../' + source.reviewed_rows_path, import.meta.url)));
  const places = parseOdsPollingPlaces(readReviewedPdfRows(review, source), source);
  validatePollingPlaceExpectations(places, source);
  assert.equal(places.length, 23);
  assert.equal(new Set(places.map((place) => place.station_no)).size, 12);
  assert.equal(new Set(places.map((place) => place.village_code)).size, 22);
  const jieshou = places.filter((place) => place.village_name === '介壽村');
  assert.deepEqual(jieshou.map((place) => place.station_no), ['0001', '0002']);
  assert.deepEqual(jieshou.map((place) => place.neighborhoods), [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12, 13, 14, 15, 16]]);
  const fuwo = places.find((place) => place.village_name === '福沃村');
  assert.equal(fuwo.station_no, '0004');
  assert.equal(fuwo.station_name, '連江縣介壽國中小學禮堂');
  assert.equal(fuwo.address, '南竿鄉介壽村13號');
  assert.equal(fuwo.coverage_kind, 'whole_village');
  assert.deepEqual(places.filter((place) => place.station_no === '0009').map((place) => place.village_name), ['坂里村', '白沙村', '芹壁村', '橋仔村']);
  assert.equal(places.find((place) => place.station_no === '0012').station_name, '連江縣東引國民中小學(涵藝樓)');
  assert.throws(() => validatePollingPlaceExpectations(places.filter((place) => place.village_name !== '橋仔村'), source), /village count mismatch/);
  assert.throws(() => validatePollingPlaceExpectations(places.filter((place) => place.station_no !== '0012'), source), /sequence is incomplete/);
});

test('reviewed PDF rows reject mismatched sources and unreviewed or incomplete cells', () => {
  const source = { adapter: 'cec-reviewed-pdf-2026', name: '測試縣', source_hash: 'a'.repeat(64), file_url: 'https://example.gov.tw/a.pdf', source_url: 'https://example.gov.tw/announcement' };
  const review = { ...source, review_status: 'human_approved', reviewed_on: '2026-09-27', pages: [{ page: 1, rows: [['測試縣測試鄉第0001投開票所', '活動中心', '測試路1號', '測試村', '全村']] }] };
  assert.equal(readReviewedPdfRows(review, source)[0].rows.length, 2);
  assert.throws(() => readReviewedPdfRows({ ...review, review_status: 'needs_human_review' }, source), /requires human approval/);
  for (const key of ['source_hash', 'file_url', 'source_url', 'reviewed_on']) {
    assert.throws(() => readReviewedPdfRows({ ...review, [key]: 'changed' }, source), /provenance mismatch/);
  }
  assert.throws(() => readReviewedPdfRows({ ...review, pages: [review.pages[0], review.pages[0]] }, source), /Invalid reviewed PDF page/);
  const broken = structuredClone(review);
  broken.pages[0].rows[0][2] = '';
  assert.throws(() => readReviewedPdfRows(broken, source), /Invalid reviewed PDF row/);
});


test('non-ready sources cannot be applied through the county import command', async () => {
  await assert.rejects(main(['--county-code', '10009', '--apply-local']), /No ready polling-place source/);
});


test('human-reviewed Hsinchu covers 492 stations and preserves address subdivision ambiguity', () => {
  const source = JSON.parse(fs.readFileSync(new URL('../data-sources/2026-polling-places.json', import.meta.url)))
    .counties.find((county) => county.county_code === '10004');
  const review = JSON.parse(fs.readFileSync(new URL('../' + source.reviewed_rows_path, import.meta.url)));
  const places = parseOdsPollingPlaces(readReviewedPdfRows(review, source), source);
  validatePollingPlaceExpectations(places, source);
  assert.equal(places.length, 492);
  assert.equal(new Set(places.map((place) => place.village_code)).size, 193);
  assert.equal(new Set(places.map((place) => place.district_code)).size, 13);
  assert.deepEqual(places.filter((p) => p.coverage_kind === 'ambiguous').map((p) => p.station_no),
    ['0210', '0211', '0212', '0213', '0214', '0216', '0217', '0218', '0219']);
  for (const n of ['0212', '0213', '0214', '0217']) {
    const p = places.find((p) => p.station_no === n);
    assert.deepEqual(p.neighborhoods, []);
    assert.equal(p.raw_neighborhoods, p.source_raw_neighborhoods);
  }
  assert.match(places.find((p) => p.station_no === '0213').raw_neighborhoods, /雙號部分/);
  assert.equal(places.find((p) => p.station_no === '0235').village_name, '旱坑里');
  assert.equal(places.find((p) => p.station_no === '0297').raw_neighborhoods, '1-8鄰');
  assert.equal(places.find((p) => p.station_no === '0467').station_name, '交通部觀光署參山國家風景區管理處獅山遊客中心');
});


test('village-only station suffixes are stripped without changing village names', () => {
  for (const [raw, expected] of [['砂子里一','砂子里'], ['砂子里二','砂子里'], ['砂子里十一','砂子里'], ['新富里(一)','新富里'], ['新富里（三）','新富里'], ['友一里二','友一里'], ['友二里','友二里']]) {
    assert.equal(villageFromStationName(raw), expected);
  }
  assert.throws(() => villageFromStationName('新富里活動中心'), /Unrecognized/);
});

test('village-only assignments use station names, never venue address neighborhoods', () => {
  const sheets = [{rows:[['投開票所編號','投開票所名稱','投開票所地址'],
    ['基隆市中正區第0009投開票所','新富里一','基隆市中正區新富里18鄰某路1號'],
    ['基隆市中正區第0011投開票所','新富里三','基隆市中正區新豐里1鄰新豐街100號']]}];
  const source = {county_code:'10017',name:'基隆市',source_hash:'a'.repeat(64),assignment_mode:'station_name_village_only'};
  const places = parseOdsPollingPlaces(sheets, source);
  assert.equal(places.length, 2);
  for (const p of places) {
    assert.equal(p.village_name,'新富里');
    assert.equal(p.coverage_kind,'ambiguous');
    assert.deepEqual(p.neighborhoods,[]);
    assert.match(p.raw_neighborhoods,/未提供鄰別/);
  }
  assert.equal(places[1].station_name,'新富里三');
  assert.match(places[1].address,/新豐里1鄰/);
  assert.throws(() => parseOdsPollingPlaces(sheets, {...source,assignment_mode:undefined}), /missing required columns/);
});
