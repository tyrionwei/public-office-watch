import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chooseManualOverrideCrop,
  choosePlatformCrop,
  cropCacheStem,
  evidenceCacheStem,
  findPhraseMatches,
  isEligibleEntry,
  parseBboxPages,
  tableGeometryPage,
} from './extract-cec-elected-platform-review.mjs';

const bbox = `
<doc><page width="1000" height="1400">
  <word xMin="200" yMin="100" xMax="220" yMax="120">政</word>
  <word xMin="225" yMin="100" xMax="245" yMax="120">見</word>
  <word xMin="100" yMin="150" xMax="120" yMax="170">王</word>
  <word xMin="125" yMin="150" xMax="145" yMax="170">小</word>
  <word xMin="150" yMin="150" xMax="170" yMax="170">明</word>
  <word xMin="210" yMin="160" xMax="300" yMax="180">第一項政見</word>
  <word xMin="100" yMin="300" xMax="170" yMax="320">李大華</word>
  <word xMin="700" yMin="100" xMax="745" yMax="120">政見</word>
</page></doc>`;

test('parseBboxPages reads page dimensions and words', () => {
  const pages = parseBboxPages(bbox);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].width, 1000);
  assert.equal(pages[0].words.length, 8);
});

test('findPhraseMatches joins spaced words on the same line', () => {
  const [page] = parseBboxPages(bbox);
  assert.deepEqual(findPhraseMatches(page, '王小明'), [{
    page: 1,
    xMin: 100,
    yMin: 150,
    xMax: 170,
    yMax: 170,
  }]);
  assert.equal(findPhraseMatches(page, '政見').length, 2);
});

test('choosePlatformCrop uses the matching platform header and next candidate row', () => {
  const pages = parseBboxPages(bbox);
  const evidence = choosePlatformCrop({
    person_name: '王小明',
    raceCandidates: [
      { personName: '王小明', candidateNo: '1' },
      { personName: '李大華', candidateNo: '2' },
    ],
  }, pages);
  assert.equal(evidence.status, 'ocr_ready');
  assert.equal(evidence.crop.page, 1);
  assert.equal(evidence.selectedHeader.xMin, 200);
  assert.equal(evidence.crop.yMax, 285);
  assert.ok(evidence.crop.xMax < 700);
});

test('choosePlatformCrop stops when no candidate-specific platform header is found', () => {
  const evidence = choosePlatformCrop({ person_name: '不存在', raceCandidates: [] }, parseBboxPages(bbox));
  assert.equal(evidence.status, 'needs_manual_localization');
  assert.equal(evidence.nameMatchCount, 0);
});

test('table geometry uses only a single-page source or a unique candidate page', () => {
  assert.equal(tableGeometryPage([{ page: 1 }], {}), 1);
  assert.equal(tableGeometryPage([{ page: 1 }, { page: 2 }], { nameMatchPages: [2] }), 2);
  assert.equal(tableGeometryPage(
    [{ page: 1 }, { page: 2 }],
    { nameMatchPages: [1, 2] },
  ), null);
});

test('evidenceCacheStem changes when the official source changes', () => {
  const first = evidenceCacheStem({
    candidate_id: 'candidate-1',
    sourceDocument: { sha256: 'aaaaaaaaaaaaaaaa1111111111111111' },
  });
  const second = evidenceCacheStem({
    candidate_id: 'candidate-1',
    sourceDocument: { sha256: 'bbbbbbbbbbbbbbbb2222222222222222' },
  });
  assert.equal(first, 'candidate-1-aaaaaaaaaaaaaaaa');
  assert.notEqual(first, second);
});

test('chooseManualOverrideCrop only accepts the reviewed source hash', () => {
  const entry = {
    candidate_id: 'candidate-1',
    sourceDocument: { sha256: 'source-a' },
  };
  const pages = [{ page: 1, width: 1000, height: 2000 }];
  const overrides = {
    'candidate-1': {
      sourceSha256: 'source-a',
      page: 1,
      imageSize: { width: 500, height: 1000 },
      crop: { xMin: 100, yMin: 200, xMax: 400, yMax: 800 },
    },
  };
  assert.deepEqual(chooseManualOverrideCrop(entry, pages, overrides), {
    status: 'ocr_ready_manual_geometry',
    geometry: {
      status: 'manual_override',
      sourceSha256: 'source-a',
      page: 1,
      imageSize: { width: 500, height: 1000 },
      crop: { xMin: 100, yMin: 200, xMax: 400, yMax: 800 },
    },
    crop: { page: 1, xMin: 200, yMin: 400, xMax: 800, yMax: 1600 },
  });
  assert.equal(chooseManualOverrideCrop({
    ...entry,
    sourceDocument: { sha256: 'source-b' },
  }, pages, overrides).geometryStatus, 'manual_override_source_mismatch');
});

test('cropCacheStem changes when reviewed crop coordinates change', () => {
  const entry = {
    candidate_id: 'candidate-1',
    sourceDocument: { sha256: 'aaaaaaaaaaaaaaaa1111111111111111' },
  };
  const first = cropCacheStem(entry, { page: 1, xMin: 1, yMin: 2, xMax: 3, yMax: 4 });
  const second = cropCacheStem(entry, { page: 1, xMin: 2, yMin: 2, xMax: 3, yMax: 4 });
  assert.match(first, /^candidate-1-aaaaaaaaaaaaaaaa-[a-f0-9]{12}$/);
  assert.notEqual(first, second);
});

test('extraction accepts only entries with verified local source evidence', () => {
  assert.equal(isEligibleEntry({ sourceDocument: { file: 'tmp/source.pdf' }, matchStatus: 'matched_unique_name' }), true);
  assert.equal(isEligibleEntry({ sourceDocument: { file: 'tmp/source.pdf' }, matchStatus: 'matched_unique_path_name_unverified' }), true);
  assert.equal(isEligibleEntry({ matchStatus: 'missing_bulletin' }), false);
});
