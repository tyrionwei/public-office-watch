import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { candidateIdentityEvidence, candidateNameEdgeEvidenceMatches, candidateNameMatchesExpected, cleanOcrText, districtHeadingEvidenceForRow, districtNumbersFromSourcePath, districtVerticalWindow, gridProfileTextExtraction, manualLocatorForEntry, parseOcrRocBirthDate, plausibleBirthDateForElection, profileTableNumberBox, selectCandidateNumberOcr, selectStrongestIdentityMatch, sourceDocumentFromUniqueBulletinCandidate } from './extract-cec-2022-councilor-profile-ocr-review.mjs';

test('manual locators require the exact person, race, candidate number, and official source digest', () => {
  const locator = {
    personName: '測試人',
    raceTitle: '測試選舉',
    candidateNo: '2',
    sourceSha256: 'official-digest',
    type: 'profile_row',
  };
  const entry = {
    person_name: '測試人',
    race_title: '測試選舉',
    candidate_no: 2,
    sourceDocument: { sha256: 'official-digest' },
  };
  assert.equal(manualLocatorForEntry(entry, [locator]), locator);
  assert.equal(manualLocatorForEntry({ ...entry, race_title: '其他選舉' }, [locator]), null);
  assert.equal(manualLocatorForEntry({ ...entry, sourceDocument: { sha256: 'other' } }, [locator]), null);
});

test('parses a vertical OCR ROC date with H misread for the final day marker', () => {
  assert.equal(parseOcrRocBirthDate('76\n年\n3\n月\n10\nH'), '1987-03-10');
  assert.equal(parseOcrRocBirthDate('76\n年\n3\n月\n10'), '1987-03-10');
  assert.equal(parseOcrRocBirthDate('76年3月'), null);
});

test('rejects OCR birth dates that would make a candidate under eighteen', () => {
  assert.equal(plausibleBirthDateForElection('1949-10-15', 2022), '1949-10-15');
  assert.equal(plausibleBirthDateForElection('2009-10-15', 2022), null);
  assert.equal(plausibleBirthDateForElection('1899-01-01', 2022), null);
  assert.equal(plausibleBirthDateForElection('1915-07-16', 2022), null);
});

test('removes OCR control and punctuation-only lines without changing content', () => {
  assert.equal(cleanOcrText('I\n國立大學 :\n管理學\n系\n現任議員\f'), '國立大學\n管理學系\n現任議員');
});

test('accepts only the first and last Han glyphs as secondary paged-table evidence', () => {
  assert.equal(candidateNameEdgeEvidenceMatches('林\n梅', '林蔡鳯梅'), true);
  assert.equal(candidateNameEdgeEvidenceMatches('林\n鳯', '林蔡鳯梅'), false);
  assert.equal(candidateNameEdgeEvidenceMatches('蔡\n梅', '林蔡鳯梅'), false);
  assert.equal(candidateNameEdgeEvidenceMatches('林', '林蔡鳯梅'), false);
  assert.equal(candidateNameEdgeEvidenceMatches('翁\n杰', '翁杰'), false);
  assert.equal(candidateNameEdgeEvidenceMatches('雜訊\n李及豐', '李茂豐'), true);
  assert.equal(candidateNameMatchesExpected('羅\n---\n平道', '羅平道'), false);
  assert.equal(candidateNameMatchesExpected('雜訊\n---\n羅平道', '羅平道'), true);
});

test('parses single, listed, and ranged districts only from an official-style source path', () => {
  assert.deepEqual(districtNumbersFromSourcePath('屏東縣第04選舉區.pdf'), [4]);
  assert.deepEqual(districtNumbersFromSourcePath('屏東縣第2、3、4、5、6選舉區.pdf'), [2, 3, 4, 5, 6]);
  assert.deepEqual(districtNumbersFromSourcePath('屏東縣第05-07選舉區.pdf'), [5, 6, 7]);
  assert.deepEqual(districtNumbersFromSourcePath('沒有選區的檔名.pdf'), []);
});

test('bounds a combined bulletin table by exact or neighboring district headings', () => {
  const headings = [
    { number: 2, yMin: 100, yMax: 140 },
    { number: 4, yMin: 800, yMax: 840 },
    { number: 5, yMin: 1100, yMax: 1140 },
  ];
  assert.deepEqual(districtVerticalWindow(headings, 2), {
    afterY: 140,
    beforeY: 840,
    exactHeading: headings[0],
    previousHeading: null,
    nextHeading: headings[1],
  });
  assert.deepEqual(districtVerticalWindow(headings, 3), {
    afterY: 140,
    beforeY: 840,
    exactHeading: null,
    previousHeading: headings[0],
    nextHeading: headings[1],
  });
  assert.equal(districtVerticalWindow([], 3), null);
});

test('associates a row only with a preceding or immediately following district heading', () => {
  const headings = [{ number: 6, yMin: 900, yMax: 940 }];
  assert.deepEqual(districtHeadingEvidenceForRow(headings, 5, [5, 6, 7], 200, 850), {
    number: 5,
    type: 'inferred_before_next_district_heading',
  });
  assert.equal(districtHeadingEvidenceForRow(headings, 6, [5, 6, 7], 200, 850), null);
  assert.deepEqual(districtHeadingEvidenceForRow(headings, 6, [5, 6, 7], 1000, 1200), {
    number: 6,
    type: 'preceding_exact_heading',
  });
});

test('allows number-only evidence only for one source district or an exact page heading', () => {
  const evidence = {
    candidateNumberRaw: '5',
    candidateNameRaw: '',
    expectedNumber: 5,
    expectedName: '王景山',
    sourceDistrictNumbers: [2],
    heading: null,
  };
  assert.equal(candidateIdentityEvidence(evidence), 'number_only');
  assert.equal(candidateIdentityEvidence({ ...evidence, sourceDistrictNumbers: [5, 6, 7] }), null);
  assert.equal(candidateIdentityEvidence({ ...evidence, sourceDistrictNumbers: [5, 6, 7], heading: { number: 5 } }), 'district_heading');
  assert.equal(candidateIdentityEvidence({ ...evidence, candidateNumberRaw: '6' }), null);
  assert.equal(candidateIdentityEvidence({
    ...evidence,
    expectedName: '林錫明',
    candidateNameRaw: '陳琬惠',
    heading: { number: 5 },
  }), null);
});

test('prefers the trimmed candidate-number OCR when it contains a digit', () => {
  assert.equal(selectCandidateNumberOcr(['1', '}']), '1');
  assert.equal(selectCandidateNumberOcr(['', '8', '}']), '8');
  assert.equal(selectCandidateNumberOcr(['', '12']), '12');
  assert.equal(selectCandidateNumberOcr(['}', '']), '}');
});

test('prefers one stronger name match over number-only table candidates', () => {
  const exact = { id: 'exact' };
  assert.equal(selectStrongestIdentityMatch([
    { identityEvidence: 'number_only', geometry: { id: 'first' } },
    { identityEvidence: 'edge_name', geometry: exact },
    { identityEvidence: 'number_only', geometry: { id: 'second' } },
  ]), exact);
  assert.equal(selectStrongestIdentityMatch([
    { identityEvidence: 'edge_name', geometry: { id: 'first' } },
    { identityEvidence: 'edge_name', geometry: { id: 'second' } },
  ]), null);
  assert.deepEqual(selectStrongestIdentityMatch([
    { identityEvidence: 'number_only', geometry: { id: 'fallback' } },
    { identityEvidence: 'district_heading', geometry: { id: 'heading' } },
  ]), { id: 'heading' });
});

test('locates the candidate number in ten- and eleven-field profile tables', () => {
  assert.deepEqual(profileTableNumberBox({ columns: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110] }), { xMin: 14, xMax: 16 });
  assert.deepEqual(profileTableNumberBox({ columns: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120] }), { xMin: 24, xMax: 26 });
  assert.deepEqual(profileTableNumberBox({ columns: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120] }, 0), { xMin: 14, xMax: 16 });
  assert.equal(profileTableNumberBox({ columns: [10, 20] }), null);
});

test('extracts a two-column grid profile only with an exact name and large candidate number', () => {
  const word = (text, xMin, yMin, xMax = xMin + 30, yMax = yMin + 15) => ({ text, xMin, yMin, xMax, yMax });
  const page = {
    page: 1,
    width: 1000,
    height: 1400,
    words: [
      word('號次', 50, 90), word('姓名', 150, 100), word('張世賢', 200, 100, 260, 120),
      word('3', 55, 125, 75, 160), word('性別', 280, 105), word('男', 330, 105),
      word('70年3月13日', 200, 150, 285, 165), word('中國國民黨', 300, 150, 390, 165),
      word('學', 400, 120), word('歷', 400, 145), word('國立商工畢業', 440, 130, 525, 145),
      word('經', 60, 260), word('歷', 60, 330), word('政', 250, 260), word('見', 250, 330),
      word('市議員', 100, 220, 150, 235), word('地方服務處主任', 100, 245, 205, 260),
      word('號次', 50, 600),
    ],
  };
  const extracted = gridProfileTextExtraction({ person_name: '張世賢', candidate_no: '3' }, [page]);
  assert.equal(extracted.education, '國立商工畢業');
  assert.equal(extracted.experience, '市議員\n地方服務處主任');
  assert.equal(extracted.birthDate, '1981-03-13');
  assert.equal(extracted.gender, '男');
  assert.equal(extracted.electionPartyRaw, '中國國民黨');
  assert.equal(gridProfileTextExtraction({ person_name: '張世賢 Tjakumay', candidate_no: '3' }, [page]).education, '國立商工畢業');
  assert.equal(gridProfileTextExtraction({ person_name: '張世賢', candidate_no: '4' }, [page]), null);
});

test('resolves one official bulletin candidate from the existing PDF cache', () => {
  const pdfDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cec-profile-source-'));
  try {
    const url = 'https://bulletin.cec.gov.tw/example.pdf';
    const cacheKey = crypto.createHash('sha256').update(url).digest('hex').slice(0, 24);
    const pdf = Buffer.from('%PDF-1.7\nprofile');
    fs.writeFileSync(path.join(pdfDir, `${cacheKey}.pdf`), pdf);
    const source = sourceDocumentFromUniqueBulletinCandidate({
      sourceDocument: null,
      bulletinCandidates: [{ url, decodedPath: '官方公報/example.pdf' }],
    }, pdfDir);
    assert.equal(source.url, url);
    assert.equal(source.decodedPath, '官方公報/example.pdf');
    assert.equal(source.bytes, pdf.length);
    assert.equal(source.sha256, crypto.createHash('sha256').update(pdf).digest('hex'));
    assert.equal(source.exactNameFound, false);
  } finally {
    fs.rmSync(pdfDir, { recursive: true, force: true });
  }
});

test('does not guess among multiple, non-official, missing, or invalid PDFs', () => {
  const pdfDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cec-profile-source-'));
  try {
    const official = { url: 'https://bulletin.cec.gov.tw/one.pdf', decodedPath: 'one.pdf' };
    assert.equal(sourceDocumentFromUniqueBulletinCandidate({ bulletinCandidates: [official, official] }, pdfDir), null);
    assert.equal(sourceDocumentFromUniqueBulletinCandidate({ bulletinCandidates: [{ url: 'https://example.com/one.pdf' }] }, pdfDir), null);
    assert.equal(sourceDocumentFromUniqueBulletinCandidate({ bulletinCandidates: [official] }, pdfDir), null);
    const cacheKey = crypto.createHash('sha256').update(official.url).digest('hex').slice(0, 24);
    fs.writeFileSync(path.join(pdfDir, `${cacheKey}.pdf`), 'not a pdf');
    assert.equal(sourceDocumentFromUniqueBulletinCandidate({ bulletinCandidates: [official] }, pdfDir), null);
  } finally {
    fs.rmSync(pdfDir, { recursive: true, force: true });
  }
});
