import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  findNumberedTableHeaders,
  findProfileSection,
  largeCandidateNumberMatches,
  selectCandidateNumberLocator,
} from './extract-cec-2022-councilor-profile-review.mjs';
import { findPhraseMatches, groupWordsIntoLines, parseBboxPages } from './extract-cec-elected-platform-review.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultReviewPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2022-councilor', 'review.json');
const defaultProfilePath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2022-councilor', 'profile-review.json');
const defaultOutputPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2022-councilor', 'profile-ocr-review.json');
const defaultArtifactDir = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2022-councilor', 'profile-ocr');
const defaultPdfDir = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2022-councilor', 'pdfs');
const defaultManualLocatorPath = path.join(repoRoot, 'scripts', 'data', 'cec-2022-councilor-profile-manual-locators.json');

function parseArgs(argv) {
  const options = {
    reviewPath: defaultReviewPath,
    profilePath: defaultProfilePath,
    outputPath: defaultOutputPath,
    artifactDir: defaultArtifactDir,
    unsafeTextOnly: false,
    personName: null,
    racePrefix: null,
    offset: 0,
    limit: Number.POSITIVE_INFINITY,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--review') options.reviewPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--profile') options.profilePath = path.resolve(argv[++index] ?? '');
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--artifact-dir') options.artifactDir = path.resolve(argv[++index] ?? '');
    else if (arg === '--unsafe-text-only') options.unsafeTextOnly = true;
    else if (arg === '--person-name') options.personName = argv[++index] ?? '';
    else if (arg === '--race-prefix') options.racePrefix = argv[++index] ?? '';
    else if (arg === '--offset') options.offset = Number.parseInt(argv[++index] ?? '', 10);
    else if (arg === '--limit') options.limit = Number.parseInt(argv[++index] ?? '', 10);
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (!Number.isInteger(options.offset) || options.offset < 0) throw new Error('--offset must be a non-negative integer');
  if (!(options.limit > 0)) throw new Error('--limit must be a positive integer');
  return options;
}

function run(command, args, label, maxBuffer = 32 * 1024 * 1024) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer });
  if (result.status !== 0) throw new Error(`${label}: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout;
}

function centerY(match) {
  return (match.yMin + match.yMax) / 2;
}

function profileGeometry(entry, pages) {
  const locator = selectCandidateNumberLocator(entry, pages);
  if (!locator) return null;
  const { page, match: numberMatch } = locator;
  const headers = findNumberedTableHeaders(page, numberMatch);
  if (!headers) return null;
  const candidateNumbers = [...new Set([
    String(entry.candidate_no ?? '').trim(),
    ...(entry.raceCandidates ?? []).map((candidate) => String(candidate.candidateNo ?? '').trim()),
  ].filter((value) => /^\d+$/u.test(value)))];
  const alignedNumbers = candidateNumbers
    .flatMap((number) => largeCandidateNumberMatches(page, number))
    .filter((match) => Math.abs(((match.xMin + match.xMax) / 2) - ((numberMatch.xMin + numberMatch.xMax) / 2)) < page.width * 0.03)
    .sort((left, right) => left.yMin - right.yMin);
  const targetIndex = alignedNumbers.findIndex((match) => Math.abs(match.yMin - numberMatch.yMin) < 1 && Math.abs(match.xMin - numberMatch.xMin) < 1);
  if (targetIndex < 0) return null;
  const previous = alignedNumbers[targetIndex - 1] ?? null;
  const next = alignedNumbers[targetIndex + 1] ?? null;
  const targetCenter = centerY(numberMatch);
  const estimatedGap = next
    ? centerY(next) - targetCenter
    : previous ? targetCenter - centerY(previous) : page.height * 0.12;
  const headerBottom = Math.max(headers.experience.yMax, headers.platform.yMax, headers.party.yMax, headers.birthplace.yMax);
  const rowTop = previous
    ? (centerY(previous) + targetCenter) / 2
    : Math.max(headerBottom + 2, targetCenter - (estimatedGap / 2));
  const rowBottom = next
    ? (targetCenter + centerY(next)) / 2
    : Math.min(page.height - 8, targetCenter + (estimatedGap / 2));
  const profileLeft = headers.party.xMax + Math.max(2, page.width * 0.002);
  const profileRight = headers.experience.xMax + ((headers.platform.xMin - headers.experience.xMax) * 0.5);
  const profileMiddle = headers.education
    ? (((headers.education.xMin + headers.education.xMax) / 2) + ((headers.experience.xMin + headers.experience.xMax) / 2)) / 2
    : (headers.experience.xMin + headers.experience.xMax) - profileRight;
  const birthplaceCenter = (headers.birthplace.xMin + headers.birthplace.xMax) / 2;
  const partyCenter = (headers.party.xMin + headers.party.xMax) / 2;
  const basicStep = partyCenter - birthplaceCenter;
  if (rowBottom - rowTop < 20 || profileMiddle <= profileLeft + 10 || profileRight <= profileMiddle + 10 || basicStep <= 4) return null;
  const centers = [birthplaceCenter - (2 * basicStep), birthplaceCenter - basicStep, birthplaceCenter, partyCenter];
  const basicBox = (index) => ({
    xMin: index === 0 ? centers[0] - (basicStep / 2) : (centers[index - 1] + centers[index]) / 2,
    xMax: index === centers.length - 1 ? profileLeft : (centers[index] + centers[index + 1]) / 2,
    yMin: rowTop,
    yMax: rowBottom,
  });
  return {
    page: page.page,
    pageWidth: page.width,
    pageHeight: page.height,
    rowTop,
    rowBottom,
    boxes: {
      education: { xMin: profileLeft, xMax: profileMiddle, yMin: rowTop, yMax: rowBottom },
      experience: { xMin: profileMiddle, xMax: profileRight, yMin: rowTop, yMax: rowBottom },
      birth: basicBox(0),
      gender: basicBox(1),
      party: basicBox(3),
    },
  };
}

function cleanOcrText(value) {
  const lines = String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '')
    .split(/\r?\n/u)
    .map((line) => line.trim().replace(/[|!,:;，。：；.\-]+$/u, '').trim())
    .filter((line) => line && !/^[|!,:;，。：；.\-]+$/u.test(line) && !/^[A-Za-z]{1,2}$/u.test(line));
  const merged = [];
  for (const line of lines) {
    if (/^[\p{Script=Han}]{1,2}$/u.test(line) && merged.length > 0 && /[\p{Script=Han})）]$/u.test(merged.at(-1))) {
      merged[merged.length - 1] += line;
    } else merged.push(line);
  }
  return merged.join('\n');
}

function cleanProfileField(value, heading) {
  const lines = cleanOcrText(value)
    .split(/\r?\n/u)
    .filter((line) => line.replace(/[\s:：]/gu, '') !== heading);
  const cleaned = lines.join('\n');
  const hanCount = [...cleaned.matchAll(/\p{Script=Han}/gu)].length;
  return hanCount >= 2 ? cleaned : '';
}

function textLayerLineText(words) {
  return words.map((word) => word.text).join(' ').replace(/[\s\u00a0\u3000]+/gu, ' ').trim();
}

function textLayerTextInBox(page, box) {
  const words = page.words.filter((word) => {
    const x = (word.xMin + word.xMax) / 2;
    const y = (word.yMin + word.yMax) / 2;
    return x >= box.xMin && x <= box.xMax && y >= box.yMin && y <= box.yMax;
  });
  return groupWordsIntoLines(words, 3)
    .map((line) => textLayerLineText(line.words))
    .filter(Boolean)
    .join('\n');
}

function verticalTextLayerLabel(page, first, second, predicate) {
  const firstMatches = findPhraseMatches(page, first).filter(predicate);
  const secondMatches = findPhraseMatches(page, second).filter(predicate);
  const pairs = firstMatches.flatMap((top) => secondMatches
    .filter((bottom) => bottom.yMin > top.yMin
      && bottom.yMin - top.yMax <= page.height * 0.08
      && Math.abs(((bottom.xMin + bottom.xMax) / 2) - ((top.xMin + top.xMax) / 2)) <= page.width * 0.015)
    .map((bottom) => ({ top, bottom })));
  return pairs.sort((left, right) => left.top.yMin - right.top.yMin || left.top.xMin - right.top.xMin)[0] ?? null;
}

function gridProfileTextExtraction(entry, pages) {
  let nameEvidence = 'exact_full_name';
  let nameMatches = pages.flatMap((page) => findPhraseMatches(page, entry.person_name).map((match) => ({ page, match })));
  if (nameMatches.length === 0) {
    const value = String(entry.person_name ?? '');
    const expectedHan = [...value.matchAll(/\p{Script=Han}/gu)].map((match) => match[0]).join('');
    const runs = [...value.matchAll(/\p{Script=Han}{2,}/gu)].map((match) => match[0]).sort((left, right) => right.length - left.length);
    for (const fallbackName of [...new Set([expectedHan, ...runs])].filter((name) => name.length >= 2)) {
      const fallbackMatches = pages.flatMap((page) => findPhraseMatches(page, fallbackName).map((match) => ({ page, match })));
      if (fallbackMatches.length === 1) {
        nameEvidence = fallbackName === expectedHan ? 'exact_han_name' : 'unique_han_name_run';
        nameMatches = fallbackMatches;
        break;
      }
    }
  }
  if (nameMatches.length !== 1) return null;
  const { page, match: name } = nameMatches[0];
  const number = String(entry.candidate_no ?? '').trim();
  if (!/^\d+$/u.test(number)) return null;

  const rowHeaders = findPhraseMatches(page, '號次')
    .filter((match) => match.xMin < name.xMin && Math.abs(match.yMin - name.yMin) <= page.height * 0.035)
    .sort((left, right) => right.xMin - left.xMin);
  const rowHeader = rowHeaders[0];
  if (!rowHeader) return null;
  const allHeaders = findPhraseMatches(page, '號次');
  const sameRowHeaders = allHeaders
    .filter((match) => Math.abs(match.yMin - rowHeader.yMin) <= page.height * 0.01)
    .sort((left, right) => left.xMin - right.xMin);
  const nextPanel = sameRowHeaders.find((match) => match.xMin > rowHeader.xMin + page.width * 0.08);
  const panelStart = Math.max(0, rowHeader.xMin - page.width * 0.015);
  const panelEnd = nextPanel ? nextPanel.xMin - page.width * 0.008 : Math.min(page.width, panelStart + page.width * 0.48);
  const panelWidth = panelEnd - panelStart;
  if (panelWidth < page.width * 0.3) return null;
  const columnHeaders = allHeaders
    .filter((match) => Math.abs(match.xMin - rowHeader.xMin) <= page.width * 0.02)
    .sort((left, right) => left.yMin - right.yMin);
  const nextRow = columnHeaders.find((match) => match.yMin > rowHeader.yMin + page.height * 0.05);
  const rowTop = Math.max(0, rowHeader.yMin - 2);
  const rowBottom = nextRow ? nextRow.yMin - 2 : Math.min(page.height, rowTop + page.height * 0.22);
  if (rowBottom - rowTop < page.height * 0.1) return null;

  const candidateNumbers = findPhraseMatches(page, number).filter((match) => (
    match.yMax - match.yMin >= page.height * 0.012
    && (match.xMin + match.xMax) / 2 >= panelStart
    && (match.xMin + match.xMax) / 2 <= panelEnd
    && (match.yMin + match.yMax) / 2 >= rowTop
    && (match.yMin + match.yMax) / 2 <= rowTop + page.height * 0.09
  ));
  if (candidateNumbers.length !== 1) return null;

  const basicBottom = Math.min(rowBottom, rowTop + page.height * 0.067);
  const inBasicPanel = (match) => match.xMin >= name.xMax
    && match.xMax <= panelEnd
    && match.yMin >= rowTop
    && match.yMax <= basicBottom;
  const educationLabel = verticalTextLayerLabel(page, '學', '歷', inBasicPanel);
  if (!educationLabel) return null;
  const education = cleanProfileField(textLayerTextInBox(page, {
    xMin: educationLabel.top.xMax + page.width * 0.004,
    xMax: panelEnd - page.width * 0.004,
    yMin: name.yMin - 2,
    yMax: basicBottom,
  }), '學歷');

  const inLowerPanel = (match) => match.xMin >= panelStart
    && match.xMax <= panelEnd
    && match.yMin >= basicBottom - page.height * 0.01
    && match.yMax <= rowBottom;
  const experienceLabel = verticalTextLayerLabel(page, '經', '歷', inLowerPanel);
  const platformLabel = verticalTextLayerLabel(page, '政', '見', inLowerPanel);
  if (!experienceLabel || !platformLabel || platformLabel.top.xMin <= experienceLabel.top.xMax) return null;
  const experience = cleanProfileField(textLayerTextInBox(page, {
    xMin: experienceLabel.top.xMax + page.width * 0.004,
    xMax: platformLabel.top.xMin - page.width * 0.004,
    yMin: basicBottom,
    yMax: rowBottom,
  }), '經歷');
  if (!education && !experience) return null;

  const basicText = textLayerTextInBox(page, { xMin: panelStart, xMax: panelEnd, yMin: rowTop, yMax: basicBottom });
  const birthDateRaw = basicText.match(/\d{1,3}\s*年\s*\d{1,2}\s*[年月]\s*\d{1,2}\s*日/u)?.[0] ?? '';
  const gender = /(?:^|\s)男(?:\s|$)/u.test(basicText) ? '男' : /(?:^|\s)女(?:\s|$)/u.test(basicText) ? '女' : null;
  const knownParty = ['無黨團結聯盟', '台灣團結聯盟', '民主進步黨', '中國國民黨', '台灣民眾黨', '社會民主黨', '時代力量', '台灣基進', '親民黨', '綠黨', '新黨', '無']
    .find((party) => basicText.includes(party)) ?? '';
  return {
    page: page.page,
    locator: `official_pdf_text_grid_${nameEvidence}_and_candidate_number`,
    candidateNumber: candidateNumbers[0],
    education,
    experience,
    birthDateRaw,
    birthDate: parseOcrRocBirthDate(birthDateRaw),
    gender,
    electionPartyRaw: knownParty,
    geometry: { panelStart, panelEnd, rowTop, rowBottom, basicBottom },
  };
}

function parseOcrRocBirthDate(value) {
  const compact = String(value ?? '')
    .normalize('NFKC')
    .replace(/[\s\u00a0\u3000]+/gu, '')
    .replace(/[Hh]$/u, '日');
  const match = compact.match(/(\d{1,3})年(\d{1,2})月(\d{1,2})(?:日)?$/u);
  if (!match) return null;
  const year = Number(match[1]) + 1911;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function plausibleBirthDateForElection(value, electionYear) {
  if (!value) return null;
  const birthYear = Number(String(value).slice(0, 4));
  return Number.isInteger(birthYear) && Number.isInteger(Number(electionYear))
    && birthYear <= Number(electionYear) - 18
    && birthYear >= Number(electionYear) - 100
    ? value
    : null;
}

function renderPage(pdfPath, sourceSha, pageNumber, artifactDir) {
  const pagesDir = path.join(artifactDir, 'pages');
  fs.mkdirSync(pagesDir, { recursive: true });
  const prefix = path.join(pagesDir, `${sourceSha.slice(0, 16)}-p${pageNumber}-200dpi`);
  const imagePath = `${prefix}.png`;
  if (!fs.existsSync(imagePath)) {
    run('pdftoppm', ['-f', String(pageNumber), '-l', String(pageNumber), '-r', '200', '-singlefile', '-png', pdfPath, prefix], 'Render bulletin page');
  }
  return imagePath;
}

function pngSize(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.toString('ascii', 1, 4) !== 'PNG') throw new Error(`Not a PNG image: ${filePath}`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function parseTsvPage(tsv, pageNumber, imagePath) {
  const size = pngSize(imagePath);
  const words = [];
  for (const line of tsv.split(/\r?\n/u).slice(1)) {
    const fields = line.split('\t');
    if (fields.length < 12 || Number(fields[0]) !== 5) continue;
    const text = fields.slice(11).join('\t').trim();
    if (!text) continue;
    const left = Number(fields[6]);
    const top = Number(fields[7]);
    const width = Number(fields[8]);
    const height = Number(fields[9]);
    if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) continue;
    words.push({ text, xMin: left, yMin: top, xMax: left + width, yMax: top + height });
  }
  return { page: pageNumber, width: size.width, height: size.height, words };
}


function parseChineseNumber(value) {
  const normalized = String(value ?? '').normalize('NFKC').replace(/[^0-9一二三四五六七八九十]/gu, '');
  if (/^\d+$/u.test(normalized)) return Number(normalized);
  if (!normalized) return null;
  const digits = new Map([['一', 1], ['二', 2], ['三', 3], ['四', 4], ['五', 5], ['六', 6], ['七', 7], ['八', 8], ['九', 9]]);
  if (normalized === '十') return 10;
  if (normalized.startsWith('十')) return 10 + (digits.get(normalized.at(1)) ?? 0);
  if (normalized.endsWith('十')) return (digits.get(normalized.at(0)) ?? 0) * 10;
  if (normalized.includes('十')) {
    const [tens, ones] = normalized.split('十');
    return ((digits.get(tens) ?? 0) * 10) + (digits.get(ones) ?? 0);
  }
  return digits.get(normalized) ?? null;
}

function districtNumberFromRace(entry) {
  const match = String(entry.race_title ?? '').normalize('NFKC').match(/第\s*([0-9一二三四五六七八九十]+)\s*選舉區/u);
  return match ? parseChineseNumber(match[1]) : null;
}

function districtNumbersFromSourcePath(value) {
  const normalized = String(value ?? '').normalize('NFKC').replace(/\s+/gu, '');
  const match = normalized.match(/第(\d{1,2}(?:[、,，.．-]\d{1,2})*)選舉區/u);
  if (!match) return [];
  const values = match[1].split(/[、,，.．]/u).flatMap((part) => {
    const range = part.match(/^(\d{1,2})-(\d{1,2})$/u);
    if (!range) return [Number(part)];
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (start > end || end - start > 20) return [];
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  });
  return [...new Set(values.filter((number) => Number.isInteger(number) && number > 0))];
}

function districtHeadingsFromTsv(tsv) {
  const lines = new Map();
  for (const rawLine of String(tsv ?? '').split(/\r?\n/u).slice(1)) {
    const fields = rawLine.split('\t');
    if (fields.length < 12 || Number(fields[0]) !== 5) continue;
    const text = fields.slice(11).join('\t').trim();
    if (!text) continue;
    const key = fields.slice(1, 5).join(':');
    const word = {
      text,
      order: Number(fields[5]),
      xMin: Number(fields[6]),
      yMin: Number(fields[7]),
      xMax: Number(fields[6]) + Number(fields[8]),
      yMax: Number(fields[7]) + Number(fields[9]),
    };
    if (![word.order, word.xMin, word.yMin, word.xMax, word.yMax].every(Number.isFinite)) continue;
    const words = lines.get(key) ?? [];
    words.push(word);
    lines.set(key, words);
  }
  const headings = [];
  for (const words of lines.values()) {
    words.sort((left, right) => left.order - right.order);
    for (let start = 0; start < words.length; start += 1) {
      const markerText = words[start].text.normalize('NFKC').replace(/^弟/u, '第');
      if (!markerText.includes('第')) continue;
      let numberText = markerText.slice(markerText.indexOf('第') + 1);
      let end = -1;
      for (let index = start + 1; index < Math.min(words.length, start + 7); index += 1) {
        const text = words[index].text.normalize('NFKC');
        if (text.includes('選舉')) {
          const districtIndex = words.slice(index, Math.min(words.length, index + 3)).findIndex((word) => word.text.includes('區'));
          if (districtIndex >= 0) end = index + districtIndex;
          else if (
            words[start].yMax - words[start].yMin >= 50
            && words[index].yMax - words[index].yMin >= 50
            && /^[0-9一二三四五六七八九十]+$/u.test(numberText)
          ) end = index;
          break;
        }
        numberText += text;
      }
      const number = parseChineseNumber(numberText);
      if (!number || end < 0) continue;
      const range = words.slice(start, end + 1);
      headings.push({
        number,
        xMin: Math.min(...range.map((word) => word.xMin)),
        xMax: Math.max(...range.map((word) => word.xMax)),
        yMin: Math.min(...range.map((word) => word.yMin)),
        yMax: Math.max(...range.map((word) => word.yMax)),
      });
    }
  }
  return headings;
}

function districtVerticalWindow(headings, districtNumber) {
  const sorted = [...headings]
    .filter((heading) => Number.isFinite(heading.number) && Number.isFinite(heading.yMin) && Number.isFinite(heading.yMax))
    .sort((left, right) => left.number - right.number);
  const exactHeading = sorted.find((heading) => heading.number === districtNumber) ?? null;
  const previousHeading = [...sorted].reverse().find((heading) => heading.number < districtNumber) ?? null;
  const nextHeading = sorted.find((heading) => heading.number > districtNumber) ?? null;
  const afterY = exactHeading?.yMax ?? previousHeading?.yMax ?? null;
  const beforeY = nextHeading?.yMax ?? null;
  if (!Number.isFinite(afterY) && !Number.isFinite(beforeY)) return null;
  if (Number.isFinite(afterY) && Number.isFinite(beforeY) && beforeY <= afterY) return null;
  return { afterY, beforeY, exactHeading, previousHeading, nextHeading };
}

function districtHeadingEvidenceForRow(headings, districtNumber, sourceDistrictNumbers, rowTop, rowBottom) {
  const sorted = [...headings].sort((left, right) => left.yMin - right.yMin);
  const preceding = sorted.filter((heading) => heading.yMax <= rowTop + 5).at(-1) ?? null;
  const following = sorted.find((heading) => heading.yMin >= rowBottom - 5) ?? null;
  if (preceding?.number === districtNumber) return { number: districtNumber, type: 'preceding_exact_heading' };
  const sourceIndex = sourceDistrictNumbers.indexOf(districtNumber);
  if (!preceding && sourceIndex >= 0 && sourceDistrictNumbers[sourceIndex + 1] === following?.number) {
    return { number: districtNumber, type: 'inferred_before_next_district_heading' };
  }
  return null;
}

function psm6Layout(imagePath) {
  const tsvPath = imagePath.replace(/\.png$/u, '.psm6.tsv');
  if (fs.existsSync(tsvPath)) return fs.readFileSync(tsvPath, 'utf8');
  const tsv = run('tesseract', [imagePath, 'stdout', '-l', 'chi_tra+eng', '--psm', '6', 'tsv'], 'OCR district headings', 64 * 1024 * 1024);
  fs.writeFileSync(tsvPath, tsv);
  return tsv;
}

function psm11Layout(imagePath) {
  const tsvPath = imagePath.replace(/\.png$/u, '.layout.tsv');
  if (fs.existsSync(tsvPath)) return fs.readFileSync(tsvPath, 'utf8');
  const tsv = run('tesseract', [imagePath, 'stdout', '-l', 'chi_tra+eng', '--psm', '11', 'tsv'], 'OCR bulletin page layout', 64 * 1024 * 1024);
  fs.writeFileSync(tsvPath, tsv);
  return tsv;
}

function districtHeadingsForImage(imagePath) {
  const headings = [
    ...districtHeadingsFromTsv(psm6Layout(imagePath)),
    ...districtHeadingsFromTsv(psm11Layout(imagePath)),
  ];
  const unique = new Map();
  for (const heading of headings) {
    const key = `${heading.number}:${Math.round(heading.yMin / 10)}`;
    if (!unique.has(key)) unique.set(key, heading);
  }
  return [...unique.values()];
}

function candidateNameMatchesExpected(value, expectedName) {
  const expectedHan = [...String(expectedName ?? '').matchAll(/\p{Script=Han}/gu)].map((match) => match[0]).join('');
  const recognizedCandidates = String(value ?? '').split(/\n---\n/u)
    .map((candidate) => [...candidate.matchAll(/\p{Script=Han}/gu)].map((match) => match[0]).join(''));
  return expectedHan.length >= 2 && recognizedCandidates.some((recognizedHan) => recognizedHan.includes(expectedHan));
}

function candidateNameEdgeEvidenceMatches(value, expectedName) {
  const expectedHan = [...String(expectedName ?? '').matchAll(/\p{Script=Han}/gu)].map((match) => match[0]).join('');
  const variants = String(value ?? '').split(/\n---\n/u);
  const recognizedCandidates = variants.flatMap((variant) => [variant, ...variant.split(/\r?\n/u)])
    .map((line) => [...line.matchAll(/\p{Script=Han}/gu)].map((match) => match[0]).join(''));
  return expectedHan.length >= 3 && recognizedCandidates.some((recognizedHan) => (
    recognizedHan.length >= 2
    && recognizedHan.at(0) === expectedHan.at(0)
    && recognizedHan.at(-1) === expectedHan.at(-1)
  ));
}

function candidateNameClearlyConflicts(value, expectedName) {
  const expectedHan = [...String(expectedName ?? '').matchAll(/\p{Script=Han}/gu)].map((match) => match[0]).join('');
  const recognizedCandidates = String(value ?? '').split(/\n---\n/u)
    .flatMap((variant) => [variant, ...variant.split(/\r?\n/u)])
    .map((line) => [...line.matchAll(/\p{Script=Han}/gu)].map((match) => match[0]).join(''))
    .filter(Boolean);
  return expectedHan.length >= 2 && recognizedCandidates.some((recognizedHan) => (
    recognizedHan.length === expectedHan.length
    && recognizedHan !== expectedHan
  ));
}

function candidateIdentityEvidence({ candidateNumberRaw, candidateNameRaw, expectedNumber, expectedName, sourceDistrictNumbers, heading }) {
  const recognizedNumber = Number(String(candidateNumberRaw ?? '').replace(/\D/gu, ''));
  if (recognizedNumber !== expectedNumber) return null;
  if (candidateNameMatchesExpected(candidateNameRaw, expectedName)) return 'full_name';
  if (candidateNameEdgeEvidenceMatches(candidateNameRaw, expectedName)) return 'edge_name';
  if (candidateNameClearlyConflicts(candidateNameRaw, expectedName)) return null;
  if (heading) return 'district_heading';
  return sourceDistrictNumbers.length === 1 ? 'number_only' : null;
}

function selectStrongestIdentityMatch(matches) {
  const ranked = [...matches].map((match) => ({
    ...match,
    rank: { number_only: 1, district_heading: 2, edge_name: 3, full_name: 4 }[match.identityEvidence] ?? 0,
  }));
  const highestRank = Math.max(0, ...ranked.map((match) => match.rank));
  const strongest = ranked.filter((match) => match.rank === highestRank);
  return strongest.length === 1 ? strongest[0].geometry : null;
}

function geometryFromImagePanel(located, panel, pageNumber, locatorEvidence, columnOffset = null) {
  if (!panel || ![11, 12].includes(panel.columns.length)) return null;
  const columns = panel.columns;
  const offset = columnOffset ?? (columns.length === 12 ? 1 : 0);
  if (![0, 1].includes(offset) || 9 + offset >= columns.length) return null;
  const fieldBox = (leftIndex, rightIndex) => ({
    xMin: columns[leftIndex] + 4,
    xMax: columns[rightIndex] - 4,
    yMin: located.rowTop,
    yMax: located.rowBottom,
  });
  return {
    page: pageNumber,
    pageWidth: located.imageSize.width,
    pageHeight: located.imageSize.height,
    rowTop: located.rowTop,
    rowBottom: located.rowBottom,
    locatorEvidence,
    panelIndex: panel.index,
    boxes: {
      name: fieldBox(2 + offset, 3 + offset),
      education: fieldBox(7 + offset, 8 + offset),
      experience: fieldBox(8 + offset, 9 + offset),
      birth: fieldBox(3 + offset, 4 + offset),
      gender: fieldBox(4 + offset, 5 + offset),
      party: fieldBox(6 + offset, 7 + offset),
    },
  };
}

function profileTableNumberBox(panel, columnOffset = null) {
  if (!panel || ![11, 12].includes(panel.columns.length)) return null;
  const offset = columnOffset ?? (panel.columns.length === 12 ? 1 : 0);
  if (![0, 1].includes(offset) || offset + 1 >= panel.columns.length) return null;
  return {
    xMin: panel.columns[offset] + 4,
    xMax: panel.columns[offset + 1] - 4,
  };
}

function imageTableGeometry(entry, pdfPath, pdfPages, artifactDir, layoutCache) {
  const districtNumber = districtNumberFromRace(entry);
  const candidateNumber = Number(entry.candidate_no);
  const candidateCount = Math.max(...(entry.raceCandidates ?? []).map((candidate) => Number(candidate.candidateNo)).filter(Number.isFinite));
  if (!districtNumber || !Number.isInteger(candidateNumber) || !(candidateCount > 0)) return null;
  const sourceDistrictNumbers = districtNumbersFromSourcePath(entry.sourceDocument.decodedPath);
  const isCombinedDistrictSource = sourceDistrictNumbers.length > 1;
  const nameMatches = [];
  for (const pdfPage of pdfPages) {
    const imagePath = renderPage(pdfPath, entry.sourceDocument.sha256, pdfPage.page, artifactDir);
    const headings = districtHeadingsForImage(imagePath);
    const heading = headings.find((item) => item.number === districtNumber) ?? null;
    const districtWindow = isCombinedDistrictSource ? districtVerticalWindow(headings, districtNumber) : null;
    if (isCombinedDistrictSource && !districtWindow) continue;
    const windowKey = districtWindow
      ? `${Math.round(districtWindow.afterY ?? -1)}-${Math.round(districtWindow.beforeY ?? -1)}`
      : 'all';
    const layoutKey = `${imagePath}:${candidateCount}:${windowKey}`;
    const layoutPath = imagePath.replace(/\.png$/u, `.profile-table-v8-${candidateCount}-${windowKey}.json`);
    let located = layoutCache.get(layoutKey);
    if (!located && fs.existsSync(layoutPath)) located = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
    if (!located) {
      const geometryArgs = [
        path.join(repoRoot, 'scripts', 'cec-profile-table-geometry.py'),
        imagePath,
        '--candidate-number', '1',
        '--candidate-count', String(candidateCount),
      ];
      if (Number.isFinite(districtWindow?.afterY)) geometryArgs.push('--after-y', String(districtWindow.afterY));
      if (Number.isFinite(districtWindow?.beforeY)) geometryArgs.push('--before-y', String(districtWindow.beforeY));
      located = JSON.parse(run('python3', geometryArgs, 'Locate bulletin profile table'));
      fs.writeFileSync(layoutPath, JSON.stringify(located));
    }
    layoutCache.set(layoutKey, located);
    if (located.status !== 'located') continue;
    if (isCombinedDistrictSource && ![10, 11].includes(located.profileColumnCount)) continue;
    const rowTop = located.table[candidateNumber - 1]?.yMax + 4;
    const rowBottom = located.table[candidateNumber]?.yMin - 4;
    if (!Number.isFinite(rowTop) || !Number.isFinite(rowBottom) || rowBottom <= rowTop) continue;
    located = { ...located, rowTop, rowBottom };
    if (isCombinedDistrictSource) {
      for (const panel of located.panels) {
        const geometry = geometryFromImagePanel(located, panel, pdfPage.page, null);
        const numberColumn = profileTableNumberBox(panel);
        if (!geometry || !numberColumn) continue;
        const number = {
          ...numberColumn,
          yMin: rowTop,
          yMax: rowBottom,
        };
        const evidenceEntry = { ...entry, candidate_id: `combined-evidence-${entry.candidate_id}` };
        const cropDir = cropRegions(imagePath, evidenceEntry, { ...geometry, boxes: { number, name: geometry.boxes.name } }, artifactDir);
        const candidateNumberRaw = ocrCandidateNumber(cropDir);
        const candidateNameRaw = ocrCandidateName(cropDir, entry.person_name);
        const identityEvidence = candidateIdentityEvidence({
          candidateNumberRaw,
          candidateNameRaw,
          expectedNumber: candidateNumber,
          expectedName: entry.person_name,
          sourceDistrictNumbers: [],
          heading: null,
        });
        if (!identityEvidence) continue;
        nameMatches.push({
          ...geometry,
          locatorEvidence: {
            type: `combined_district_window_number_and_${identityEvidence}_ocr`,
            districtNumber,
            sourceDistrictNumbers,
            districtWindow,
            candidateNumberRaw,
            candidateNameRaw,
          },
        });
      }
      continue;
    }
    if (heading) {
      const headingCenter = (heading.xMin + heading.xMax) / 2;
      const panel = located.panels.find((item) => headingCenter >= item.xMin && headingCenter <= item.xMax);
      const geometry = geometryFromImagePanel(located, panel, pdfPage.page, { type: 'district_heading', heading });
      if (geometry) return geometry;
    }
    for (const panel of located.panels) {
      const geometry = geometryFromImagePanel(located, panel, pdfPage.page, { type: 'candidate_name_ocr' });
      if (!geometry) continue;
      const cropDir = cropRegions(imagePath, entry, { ...geometry, boxes: { name: geometry.boxes.name } }, artifactDir);
      const candidateNameRaw = ocrCandidateName(cropDir, entry.person_name);
      if (candidateNameMatchesExpected(candidateNameRaw, entry.person_name)) {
        nameMatches.push({ ...geometry, locatorEvidence: { type: 'candidate_name_ocr', candidateNameRaw } });
      }
    }
  }
  return nameMatches.length === 1 ? nameMatches[0] : null;
}

function pagedImageTableGeometry(entry, pdfPath, pdfPages, artifactDir, layoutCache) {
  const districtNumber = districtNumberFromRace(entry);
  const candidateNumber = Number(entry.candidate_no);
  if (!districtNumber || !Number.isInteger(candidateNumber)) return null;
  const sourceDistrictNumbers = districtNumbersFromSourcePath(entry.sourceDocument.decodedPath);
  const matches = new Map();
  for (const pdfPage of pdfPages) {
    const imagePath = renderPage(pdfPath, entry.sourceDocument.sha256, pdfPage.page, artifactDir);
    const headings = districtHeadingsForImage(imagePath);
    const heading = headings.find((item) => item.number === districtNumber);
    if (!heading && !sourceDistrictNumbers.includes(districtNumber)) continue;
    for (let rowCount = 2; rowCount <= 8; rowCount += 1) {
      const layoutKey = `${imagePath}:profile-table-page-v4:${rowCount}`;
      const layoutPath = imagePath.replace(/\.png$/u, `.profile-table-page-v4-${rowCount}.json`);
      let located = layoutCache.get(layoutKey);
      if (!located && fs.existsSync(layoutPath)) located = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
      if (!located) {
        located = JSON.parse(run('python3', [
          path.join(repoRoot, 'scripts', 'cec-profile-table-geometry.py'),
          imagePath,
          '--candidate-number', '1',
          '--candidate-count', String(rowCount),
        ], 'Locate paged bulletin profile table'));
        fs.writeFileSync(layoutPath, JSON.stringify(located));
      }
      layoutCache.set(layoutKey, located);
      if (located.status !== 'located') continue;
      const evidenceKey = `${layoutKey}:evidence-v14`;
      const evidencePath = imagePath.replace(/\.png$/u, `.profile-table-page-v14-${rowCount}-evidence.json`);
      let evidence = layoutCache.get(evidenceKey);
      if (!evidence && fs.existsSync(evidencePath)) evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
      if (!evidence) {
        evidence = [];
        for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
          const rowTop = located.table[rowIndex]?.yMax + 4;
          const rowBottom = located.table[rowIndex + 1]?.yMin - 4;
          if (!Number.isFinite(rowTop) || !Number.isFinite(rowBottom) || rowBottom <= rowTop) continue;
          for (const panel of located.panels) {
            const columnOffsets = panel.columns.length === 12 ? [0, 1] : [0];
            for (const columnOffset of columnOffsets) {
              const geometry = geometryFromImagePanel({ ...located, rowTop, rowBottom }, panel, pdfPage.page, null, columnOffset);
              const numberColumn = profileTableNumberBox(panel, columnOffset);
              if (!geometry || !numberColumn) continue;
              const number = { ...numberColumn, yMin: rowTop, yMax: rowBottom };
              const evidenceEntry = { ...entry, candidate_id: `page-evidence-${entry.sourceDocument.sha256.slice(0, 16)}-p${pdfPage.page}-r${rowIndex}-c${panel.index}-o${columnOffset}` };
              const cropDir = cropRegions(imagePath, evidenceEntry, { ...geometry, boxes: { number, name: geometry.boxes.name } }, artifactDir);
              evidence.push({
                rowIndex,
                panelIndex: panel.index,
                columnOffset,
                candidateNumberRaw: ocrCandidateNumber(cropDir),
                candidateNameRaw: ocrCandidateName(cropDir, entry.person_name),
              });
            }
          }
        }
        fs.writeFileSync(evidencePath, JSON.stringify(evidence));
      }
      layoutCache.set(evidenceKey, evidence);
      for (const item of evidence) {
        const requireNameEvidence = sourceDistrictNumbers.length > 1;
        const rowTop = located.table[item.rowIndex]?.yMax + 4;
        const rowBottom = located.table[item.rowIndex + 1]?.yMin - 4;
        if (!Number.isFinite(rowTop) || !Number.isFinite(rowBottom) || rowBottom <= rowTop) continue;
        const rowHeading = districtHeadingEvidenceForRow(headings, districtNumber, sourceDistrictNumbers, rowTop, rowBottom);
        const identityEvidence = candidateIdentityEvidence({
          candidateNumberRaw: item.candidateNumberRaw,
          candidateNameRaw: item.candidateNameRaw,
          expectedNumber: candidateNumber,
          expectedName: entry.person_name,
          sourceDistrictNumbers: requireNameEvidence ? [] : sourceDistrictNumbers,
          heading: rowHeading,
        });
        if (!identityEvidence) continue;
        const panel = located.panels.find((value) => value.index === item.panelIndex);
        if (!panel) continue;
        const key = `${pdfPage.page}:${rowTop}:${rowBottom}:${panel.index}:${item.columnOffset ?? 'default'}`;
        matches.set(key, {
          identityEvidence,
          geometry: geometryFromImagePanel({ ...located, rowTop, rowBottom }, panel, pdfPage.page, {
            type: `paged_table_district_number_and_${identityEvidence}_ocr`,
            heading: rowHeading,
            sourceDistrictNumbers,
            candidateNumberRaw: item.candidateNumberRaw,
            candidateNameRaw: item.candidateNameRaw,
          }, item.columnOffset),
        });
      }
    }
  }
  return selectStrongestIdentityMatch(matches.values());
}

function districtNumberFromOcrText(value) {
  const normalized = String(value ?? '').normalize('NFKC').replace(/[\s_]+/gu, '');
  const match = normalized.match(/第([0-9一二三四五六七八九十]+)選舉區/u);
  return match ? parseChineseNumber(match[1]) : null;
}

function parseProfileCardBirthDate(value) {
  const normalized = String(value ?? '').normalize('NFKC');
  const match = normalized.match(/出生年月日\s*[:：]?\s*(\d{1,3}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日?)/u);
  return match ? parseOcrRocBirthDate(match[1]) : null;
}

function geometryFromProfileCard(located, card, pageNumber) {
  return {
    page: pageNumber,
    pageWidth: located.imageSize.width,
    pageHeight: located.imageSize.height,
    basicCombined: true,
    cardIndex: card.index,
    boxes: {
      name: card.boxes.identity,
      number: card.boxes.number,
      heading: card.boxes.heading,
      education: card.boxes.education,
      experience: card.boxes.experience,
      personal: card.boxes.personal,
    },
  };
}

function manualLocatorForEntry(entry, locators) {
  return (locators ?? []).find((locator) => (
    locator.personName === entry.person_name
    && locator.raceTitle === entry.race_title
    && String(locator.candidateNo) === String(entry.candidate_no)
    && locator.sourceSha256 === entry.sourceDocument?.sha256
  )) ?? null;
}

function verifiedProfileFieldsForEntry(entry, locators) {
  const locator = manualLocatorForEntry(entry, locators);
  if (locator?.type !== 'verified_profile_fields') return null;
  if (!locator.verifiedEducation && !locator.verifiedExperience) return null;
  return locator;
}

function manualProfileGeometry(entry, pdfPath, pdfPages, artifactDir, layoutCache, locators) {
  const locator = manualLocatorForEntry(entry, locators);
  if (!locator) return null;
  if (!pdfPages.some((page) => page.page === locator.page)) throw new Error(`Manual profile locator page missing for ${entry.person_name}`);
  const imagePath = renderPage(pdfPath, entry.sourceDocument.sha256, locator.page, artifactDir);
  if (locator.type === 'profile_card') {
    if (locator.boxes) {
      const size = pngSize(imagePath);
      return {
        page: locator.page,
        pageWidth: size.width,
        pageHeight: size.height,
        basicCombined: true,
        boxes: locator.boxes,
        locatorEvidence: { type: 'manual_official_pdf_card_locator', locator },
      };
    }
    const layoutPath = imagePath.replace(/\.png$/u, '.profile-cards-v3.json');
    let located = layoutCache.get(layoutPath);
    if (!located && fs.existsSync(layoutPath)) located = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
    if (!located) {
      located = JSON.parse(run('python3', [path.join(repoRoot, 'scripts', 'cec-profile-card-geometry.py'), imagePath], 'Locate manual bulletin profile card'));
      fs.writeFileSync(layoutPath, JSON.stringify(located));
    }
    layoutCache.set(layoutPath, located);
    if (located.status !== 'located') throw new Error(`Manual profile card layout unavailable for ${entry.person_name}`);
    const card = located.cards.find((item) => item.index === locator.cardIndex);
    if (!card) throw new Error(`Manual profile card index unavailable for ${entry.person_name}`);
    return {
      ...geometryFromProfileCard(located, card, locator.page),
      locatorEvidence: { type: 'manual_official_pdf_card_locator', locator },
    };
  }
  if (locator.type === 'profile_row') {
    if (locator.boxes) {
      const size = pngSize(imagePath);
      return {
        page: locator.page,
        pageWidth: size.width,
        pageHeight: size.height,
        basicCombined: false,
        boxes: locator.boxes,
        locatorEvidence: { type: 'manual_official_pdf_row_locator', locator },
      };
    }
    const cacheKey = `${imagePath}:manual-row:${locator.rowTopY}:${locator.rowBottomY}`;
    const layoutPath = imagePath.replace(/\.png$/u, `.manual-row-${locator.rowTopY}-${locator.rowBottomY}.json`);
    let located = layoutCache.get(cacheKey);
    if (!located && fs.existsSync(layoutPath)) located = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
    if (!located) {
      located = JSON.parse(run('python3', [
        path.join(repoRoot, 'scripts', 'cec-profile-table-geometry.py'),
        imagePath,
        '--candidate-number', '1',
        '--candidate-count', '1',
        '--row-top-y', String(locator.rowTopY),
        '--row-bottom-y', String(locator.rowBottomY),
      ], 'Locate manual bulletin profile row'));
      fs.writeFileSync(layoutPath, JSON.stringify(located));
    }
    layoutCache.set(cacheKey, located);
    if (located.status !== 'located') throw new Error(`Manual profile row layout unavailable for ${entry.person_name}: ${located.status}`);
    const panel = located.panels.find((item) => item.index === (locator.panelIndex ?? 0));
    if (!panel) throw new Error(`Manual profile row panel unavailable for ${entry.person_name}`);
    return geometryFromImagePanel(located, panel, locator.page, {
      type: 'manual_official_pdf_row_locator',
      locator,
    }, locator.columnOffset ?? null);
  }
  throw new Error(`Unsupported manual profile locator type: ${locator.type}`);
}

function profileCardGeometry(entry, pdfPath, pdfPages, artifactDir, layoutCache) {
  const districtNumber = districtNumberFromRace(entry);
  const candidateNumber = Number(entry.candidate_no);
  if (!districtNumber || !Number.isInteger(candidateNumber)) return null;
  const sourceDistrictNumbers = districtNumbersFromSourcePath(entry.sourceDocument.decodedPath);
  const matches = [];
  for (const pdfPage of pdfPages) {
    const imagePath = renderPage(pdfPath, entry.sourceDocument.sha256, pdfPage.page, artifactDir);
    const layoutKey = `${imagePath}:profile-cards-v3`;
    const layoutPath = imagePath.replace(/\.png$/u, '.profile-cards-v3.json');
    let located = layoutCache.get(layoutKey);
    if (!located && fs.existsSync(layoutPath)) located = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
    if (!located) {
      located = JSON.parse(run('python3', [path.join(repoRoot, 'scripts', 'cec-profile-card-geometry.py'), imagePath], 'Locate bulletin profile cards'));
      fs.writeFileSync(layoutPath, JSON.stringify(located));
    }
    layoutCache.set(layoutKey, located);
    if (located.status !== 'located') continue;
    const evidenceKey = `${imagePath}:profile-card-evidence-v11`;
    const evidencePath = imagePath.replace(/\.png$/u, '.profile-card-evidence-v11.json');
    let evidence = layoutCache.get(evidenceKey);
    if (!evidence && fs.existsSync(evidencePath)) evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    if (!evidence) {
      evidence = located.cards.map((card) => {
        const geometry = geometryFromProfileCard(located, card, pdfPage.page);
        const evidenceEntry = { ...entry, candidate_id: `card-evidence-${entry.sourceDocument.sha256.slice(0, 16)}-p${pdfPage.page}-c${card.index}` };
        const cropDir = cropRegions(imagePath, evidenceEntry, geometry, artifactDir);
        return {
          cardIndex: card.index,
          headingRaw: ocrFile(path.join(cropDir, 'heading.png'), 'chi_tra+eng', 6),
          candidateNameRaw: ocrCandidateName(cropDir, entry.person_name),
          candidateNumberRaw: ocrCandidateNumber(cropDir),
        };
      });
      fs.writeFileSync(evidencePath, JSON.stringify(evidence));
    }
    layoutCache.set(evidenceKey, evidence);
    for (const item of evidence) {
      const recognizedDistrict = districtNumberFromOcrText(item.headingRaw);
      const heading = recognizedDistrict === districtNumber ? { number: recognizedDistrict } : null;
      if (!heading && !(sourceDistrictNumbers.length === 1 && sourceDistrictNumbers.includes(districtNumber))) continue;
      const identityEvidence = candidateIdentityEvidence({
        candidateNumberRaw: item.candidateNumberRaw,
        candidateNameRaw: item.candidateNameRaw,
        expectedNumber: candidateNumber,
        expectedName: entry.person_name,
        sourceDistrictNumbers,
        heading,
      });
      if (!identityEvidence) continue;
      const card = located.cards.find((value) => value.index === item.cardIndex);
      if (!card) continue;
      matches.push({
        identityEvidence,
        geometry: {
          ...geometryFromProfileCard(located, card, pdfPage.page),
          locatorEvidence: {
            type: `profile_card_district_number_and_${identityEvidence}_ocr`,
            headingRaw: item.headingRaw,
            candidateNumberRaw: item.candidateNumberRaw,
            candidateNameRaw: item.candidateNameRaw,
          },
        },
      });
    }
  }
  return selectStrongestIdentityMatch(matches);
}

function fullPageOcrLayout(pdfPath, sourceSha, pdfPages, artifactDir) {
  const pages = [];
  for (const pdfPage of pdfPages) {
    const imagePath = renderPage(pdfPath, sourceSha, pdfPage.page, artifactDir);
    const tsv = psm11Layout(imagePath);
    pages.push(parseTsvPage(tsv, pdfPage.page, imagePath));
  }
  return pages;
}

function cropRegions(imagePath, entry, geometry, artifactDir) {
  const outputDir = path.join(artifactDir, 'crops', entry.candidate_id);
  const args = [
    path.join(repoRoot, 'scripts', 'cec-profile-ocr-crop.py'),
    imagePath,
    outputDir,
    '--pdf-width', String(geometry.pageWidth),
    '--pdf-height', String(geometry.pageHeight),
  ];
  const nameGlyphCount = [...String(entry.person_name ?? '').matchAll(/\p{Script=Han}/gu)].length;
  if (geometry.boxes.name && !geometry.basicCombined && nameGlyphCount >= 2 && nameGlyphCount <= 5) {
    args.push('--name-glyph-count', String(nameGlyphCount));
  }
  if (geometry.boxes.name && geometry.basicCombined) args.push('--candidate-card-name-band');
  for (const [name, box] of Object.entries(geometry.boxes)) {
    args.push('--crop', `${name}:${box.xMin}:${box.yMin}:${box.xMax}:${box.yMax}`);
  }
  run('python3', args, 'Crop bulletin profile fields');
  return outputDir;
}

function ocrFile(file, language, pageSegmentationMode) {
  return cleanOcrText(run('tesseract', [file, 'stdout', '-l', language, '--psm', String(pageSegmentationMode)], `OCR ${path.basename(file)}`));
}

function ocrProfileField(file) {
  const primary = ocrFile(file, 'chi_tra+eng', 6);
  return primary || ocrFile(file, 'chi_tra+eng', 11) || '';
}

function ocrCandidateNumber(cropDir) {
  const glyphFile = path.join(cropDir, 'number-glyph.png');
  const candidates = [
    fs.existsSync(glyphFile)
      ? cleanOcrText(run('tesseract', [glyphFile, 'stdout', '-l', 'eng', '--psm', '6', '-c', 'tessedit_char_whitelist=0123456789'], `OCR ${path.basename(glyphFile)}`))
      : '',
    fs.existsSync(glyphFile)
      ? cleanOcrText(run('tesseract', [glyphFile, 'stdout', '-l', 'eng', '--psm', '13', '-c', 'tessedit_char_whitelist=0123456789'], `OCR ${path.basename(glyphFile)}`))
      : '',
    ocrFile(path.join(cropDir, 'number.png'), 'eng', 10),
  ];
  return selectCandidateNumberOcr(candidates);
}

function selectCandidateNumberOcr(candidates) {
  return candidates.find((value) => /\d/u.test(value)) ?? candidates[0] ?? '';
}

function ocrCandidateName(cropDir, expectedName, wholeColumnPsm = 6) {
  const wholeColumnRaw = ocrFile(path.join(cropDir, 'name.png'), 'chi_tra+eng', wholeColumnPsm);
  const traditionalOnlyRaw = ocrFile(path.join(cropDir, 'name.png'), 'chi_tra', wholeColumnPsm);
  const sparseTraditionalRaw = ocrFile(path.join(cropDir, 'name.png'), 'chi_tra', 12);
  const nameBandFile = path.join(cropDir, 'name-band.png');
  const nameBandRaw = fs.existsSync(nameBandFile) ? ocrFile(nameBandFile, 'chi_tra', 6) : '';
  const singleLineNameBandRaw = fs.existsSync(nameBandFile) ? ocrFile(nameBandFile, 'chi_tra', 13) : '';
  const expectedGlyphCount = [...String(expectedName ?? '').matchAll(/\p{Script=Han}/gu)].length;
  const glyphFiles = Array.from({ length: expectedGlyphCount }, (_, index) => path.join(cropDir, `name-glyph-${index + 1}.png`));
  const glyphRaw = glyphFiles.every((file) => fs.existsSync(file))
    ? glyphFiles.map((file) => ocrFile(file, 'chi_tra', 10)).join('\n')
    : '';
  const candidates = [wholeColumnRaw, traditionalOnlyRaw, sparseTraditionalRaw, nameBandRaw, singleLineNameBandRaw, glyphRaw];
  return candidates.filter(Boolean).join('\n---\n');
}

function relativeArtifact(file) {
  return path.relative(repoRoot, file).replaceAll(path.sep, '/');
}

function sourceDocumentFromUniqueBulletinCandidate(entry, pdfDir = defaultPdfDir) {
  if (entry?.sourceDocument?.file) return entry.sourceDocument;
  if (entry?.bulletinCandidates?.length !== 1) return null;
  const [candidate] = entry.bulletinCandidates;
  let url;
  try {
    url = new URL(candidate.url);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'bulletin.cec.gov.tw') return null;
  const cacheKey = crypto.createHash('sha256').update(candidate.url).digest('hex').slice(0, 24);
  const filePath = path.join(pdfDir, `${cacheKey}.pdf`);
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size < 5) return null;
  const file = fs.readFileSync(filePath);
  if (file.subarray(0, 5).toString('ascii') !== '%PDF-') return null;
  return {
    file: relativeArtifact(filePath),
    url: candidate.url,
    decodedPath: candidate.decodedPath,
    sha256: crypto.createHash('sha256').update(file).digest('hex'),
    bytes: stat.size,
    exactNameFound: false,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const review = JSON.parse(fs.readFileSync(options.reviewPath, 'utf8'));
  const profile = JSON.parse(fs.readFileSync(options.profilePath, 'utf8'));
  const reviewByCandidate = new Map(review.entries.map((entry) => [entry.candidate_id, entry]));
  const manualLocators = fs.existsSync(defaultManualLocatorPath)
    ? JSON.parse(fs.readFileSync(defaultManualLocatorPath, 'utf8')).entries ?? []
    : [];
  const selected = profile.entries
    .filter((entry) => options.unsafeTextOnly
      ? entry.extraction?.status === 'extracted_text_layer'
        && entry.extraction?.publicationAssessment?.status !== 'passed'
      : entry.extraction?.status !== 'extracted_text_layer')
    .filter((entry) => !options.personName || entry.personName === options.personName)
    .filter((entry) => !options.racePrefix || entry.raceTitle?.startsWith(options.racePrefix))
    .slice(options.offset, options.offset + options.limit);
  const pageCache = new Map();
  const fullPageOcrCache = new Map();
  const imageTableLayoutCache = new Map();
  const entries = [];
  for (const [index, pending] of selected.entries()) {
    console.error(`[${index + 1}/${selected.length}] ${pending.personName}`);
    const originalEntry = reviewByCandidate.get(pending.candidateId);
    const sourceDocument = sourceDocumentFromUniqueBulletinCandidate(originalEntry);
    const entry = originalEntry && sourceDocument ? { ...originalEntry, sourceDocument } : originalEntry;
    if (!entry?.sourceDocument?.file) {
      entries.push({ ...pending, ocr: { status: 'source_document_missing' } });
      continue;
    }
    const pdfPath = path.join(repoRoot, entry.sourceDocument.file);
    let pages = pageCache.get(pdfPath);
    if (!pages) {
      const bbox = run('pdftotext', ['-bbox-layout', pdfPath, '-'], 'Read bulletin layout', 128 * 1024 * 1024);
      pages = parseBboxPages(bbox);
      pageCache.set(pdfPath, pages);
    }
    const directText = findProfileSection(entry, pages);
    if (!options.unsafeTextOnly && directText.status === 'extracted_text_layer') {
      entries.push({
        candidateId: entry.candidate_id,
        personId: entry.person_id,
        personName: entry.person_name,
        raceTitle: entry.race_title,
        matchStatus: entry.matchStatus,
        sourceUrl: entry.sourceDocument.url,
        sourceDocument: entry.sourceDocument,
        ocr: {
          status: 'ocr_ready_private_review',
          page: directText.page,
          locator: `official_pdf_text_${directText.locator}`,
          geometrySource: 'official_pdf_text_layer',
          geometry: directText.bounds ?? null,
          educationRaw: directText.education,
          education: directText.education,
          experienceRaw: directText.experience,
          experience: directText.experience,
          birthDateRaw: directText.birthDateRaw,
          birthDate: directText.birthDate,
          genderRaw: directText.gender ?? '',
          gender: directText.gender,
          electionPartyRaw: directText.electionPartyRaw,
          electionParty: null,
          cropFiles: {},
          publicationAssessment: {
            status: 'private_review_required',
            reasons: ['text_layer_derived_from_official_bulletin', 'candidate_identity_revalidated_in_official_text_layer', 'election_party_text_requires_review'],
          },
        },
      });
      continue;
    }
    const textGrid = gridProfileTextExtraction(entry, pages);
    if (textGrid) {
      entries.push({
        candidateId: entry.candidate_id,
        personId: entry.person_id,
        personName: entry.person_name,
        raceTitle: entry.race_title,
        matchStatus: entry.matchStatus,
        sourceUrl: entry.sourceDocument.url,
        sourceDocument: entry.sourceDocument,
        ocr: {
          status: 'ocr_ready_private_review',
          page: textGrid.page,
          locator: textGrid.locator,
          geometrySource: 'official_pdf_text_layer_grid',
          geometry: textGrid.geometry,
          educationRaw: textGrid.education,
          education: textGrid.education,
          experienceRaw: textGrid.experience,
          experience: textGrid.experience,
          birthDateRaw: textGrid.birthDateRaw,
          birthDate: textGrid.birthDate,
          genderRaw: textGrid.gender ?? '',
          gender: textGrid.gender,
          electionPartyRaw: textGrid.electionPartyRaw,
          electionParty: null,
          cropFiles: {},
          publicationAssessment: {
            status: 'private_review_required',
            reasons: [
              'text_layer_derived_from_official_bulletin',
              textGrid.locator.includes('exact_full_name') ? 'exact_name_and_candidate_number_revalidated' : 'exact_han_name_and_candidate_number_revalidated',
              'election_party_text_requires_review',
            ],
          },
        },
      });
      continue;
    }
    const verifiedProfile = verifiedProfileFieldsForEntry(entry, manualLocators);
    if (verifiedProfile) {
      entries.push({
        candidateId: entry.candidate_id,
        personId: entry.person_id,
        personName: entry.person_name,
        raceTitle: entry.race_title,
        matchStatus: entry.matchStatus,
        sourceUrl: entry.sourceDocument.url,
        sourceDocument: entry.sourceDocument,
        ocr: {
          status: 'ocr_ready_private_review',
          page: null,
          locator: 'manual_official_pdf_verified_fields',
          geometrySource: 'official_pdf_text_layer_manual_columns',
          geometry: null,
          educationRaw: verifiedProfile.verifiedEducation ?? '',
          education: verifiedProfile.verifiedEducation ?? '',
          experienceRaw: verifiedProfile.verifiedExperience ?? '',
          experience: verifiedProfile.verifiedExperience ?? '',
          birthDateRaw: verifiedProfile.verifiedBirthDate ?? '',
          birthDate: verifiedProfile.verifiedBirthDate ?? null,
          genderRaw: verifiedProfile.verifiedGender ?? '',
          gender: verifiedProfile.verifiedGender ?? null,
          electionPartyRaw: verifiedProfile.verifiedPartyRaw ?? '',
          electionParty: null,
          cropFiles: {},
          publicationAssessment: {
            status: 'private_review_required',
            reasons: ['text_layer_derived_from_official_bulletin', 'manual_fields_revalidated_in_official_bulletin', 'election_party_text_requires_review'],
          },
        },
      });
      continue;
    }
    let geometry = manualProfileGeometry(entry, pdfPath, pages, options.artifactDir, imageTableLayoutCache, manualLocators);
    let geometrySource = geometry ? geometry.locatorEvidence?.type : 'pdf_text_layer';
    if (!geometry) geometry = profileGeometry(entry, pages);
    if (!geometry) {
      geometry = imageTableGeometry(entry, pdfPath, pages, options.artifactDir, imageTableLayoutCache);
      geometrySource = geometry?.locatorEvidence?.type === 'candidate_name_ocr'
        ? 'image_table_lines_candidate_number_and_name_ocr'
        : 'image_table_lines_and_district_heading';
    }
    if (!geometry) {
      geometry = profileCardGeometry(entry, pdfPath, pages, options.artifactDir, imageTableLayoutCache);
      if (geometry) geometrySource = geometry.locatorEvidence.type;
    }
    if (!geometry) {
      geometry = pagedImageTableGeometry(entry, pdfPath, pages, options.artifactDir, imageTableLayoutCache);
      if (geometry) geometrySource = geometry.locatorEvidence.type.replace('paged_table_', 'paged_image_table_');
    }
    if (!geometry) {
      let ocrPages = fullPageOcrCache.get(pdfPath);
      if (!ocrPages) {
        ocrPages = fullPageOcrLayout(pdfPath, entry.sourceDocument.sha256, pages, options.artifactDir);
        fullPageOcrCache.set(pdfPath, ocrPages);
      }
      geometry = profileGeometry(entry, ocrPages);
      geometrySource = 'full_page_ocr';
    }
    if (!geometry) {
      entries.push({ ...pending, ocr: { status: 'needs_manual_layout', reason: 'candidate number and profile table geometry not found' } });
      continue;
    }
    try {
      const pageImage = renderPage(pdfPath, entry.sourceDocument.sha256, geometry.page, options.artifactDir);
      const cropDir = cropRegions(pageImage, entry, geometry, options.artifactDir);
      const educationRaw = ocrProfileField(path.join(cropDir, 'education.png'));
      const experienceRaw = ocrProfileField(path.join(cropDir, 'experience.png'));
      const education = cleanProfileField(educationRaw, '學歷');
      const experience = cleanProfileField(experienceRaw, '經歷');
      const personalRaw = geometry.basicCombined
        ? ocrFile(path.join(cropDir, 'personal.png'), 'chi_tra+eng', 6)
        : null;
      const birthDateRaw = geometry.basicCombined
        ? personalRaw
        : ocrFile(path.join(cropDir, 'birth.png'), 'chi_tra+eng', 6);
      const genderRaw = geometry.basicCombined
        ? personalRaw
        : ocrFile(path.join(cropDir, 'gender-glyph.png'), 'chi_tra', 10);
      const partyRaw = geometry.basicCombined
        ? ''
        : ocrFile(path.join(cropDir, 'party.png'), 'chi_tra+eng', 6);
      const parsedGender = geometry.basicCombined
        ? /性別\s*[:：]?\s*男/u.test(genderRaw) ? '男' : /性別\s*[:：]?\s*女/u.test(genderRaw) ? '女' : null
        : genderRaw.includes('男') && !genderRaw.includes('女')
          ? '男'
          : genderRaw.includes('女') && !genderRaw.includes('男') ? '女' : null;
      const verifiedGender = geometry.locatorEvidence?.locator?.verifiedGender ?? null;
      const gender = verifiedGender ?? parsedGender;
      const parsedBirthDate = geometry.basicCombined ? parseProfileCardBirthDate(birthDateRaw) : parseOcrRocBirthDate(birthDateRaw);
      const verifiedBirthDate = geometry.locatorEvidence?.locator?.verifiedBirthDate ?? null;
      const birthDate = verifiedBirthDate ?? plausibleBirthDateForElection(parsedBirthDate, entry.election_year);
      const reasons = ['ocr_derived_from_official_bulletin'];
      if (!education) reasons.push('education_ocr_empty');
      if (!experience) reasons.push('experience_ocr_empty');
      if (!birthDate) reasons.push('birth_date_ocr_unparsed');
      if (!gender) reasons.push('gender_ocr_unparsed');
      if (verifiedBirthDate || verifiedGender) reasons.push('manual_field_revalidated_in_official_bulletin');
      reasons.push(geometry.basicCombined ? 'election_party_not_extracted' : 'election_party_ocr_requires_review');
      entries.push({
        candidateId: entry.candidate_id,
        personId: entry.person_id,
        personName: entry.person_name,
        raceTitle: entry.race_title,
        matchStatus: entry.matchStatus,
        sourceUrl: entry.sourceDocument.url,
        sourceDocument: entry.sourceDocument,
        ocr: {
          status: education || experience ? 'ocr_ready_private_review' : 'ocr_empty',
          page: geometry.page,
          locator: geometry.locatorEvidence?.type ?? 'candidate_number_and_race',
          candidateNameRaw: geometry.locatorEvidence?.candidateNameRaw ?? null,
          geometrySource,
          geometry,
          educationRaw,
          education,
          experienceRaw,
          experience,
          birthDateRaw,
          birthDate,
          genderRaw,
          gender,
          electionPartyRaw: partyRaw,
          electionParty: null,
          cropFiles: geometry.basicCombined
            ? {
                name: relativeArtifact(path.join(cropDir, 'name.png')),
                education: relativeArtifact(path.join(cropDir, 'education.png')),
                experience: relativeArtifact(path.join(cropDir, 'experience.png')),
                birth: relativeArtifact(path.join(cropDir, 'personal.png')),
                gender: relativeArtifact(path.join(cropDir, 'personal.png')),
              }
            : Object.fromEntries(['name', 'education', 'experience', 'birth', 'gender', 'party'].map((name) => [
                name,
                relativeArtifact(path.join(cropDir, name === 'gender' ? 'gender-glyph.png' : `${name}.png`)),
              ])),
          publicationAssessment: { status: 'private_review_required', reasons },
        },
      });
    } catch (error) {
      entries.push({ ...pending, ocr: { status: 'failed', reason: error instanceof Error ? error.message : String(error) } });
    }
  }
  const summary = {
    targetCount: selected.length,
    ocrReadyCount: entries.filter((entry) => entry.ocr?.status === 'ocr_ready_private_review').length,
    manualLayoutCount: entries.filter((entry) => entry.ocr?.status === 'needs_manual_layout').length,
    ocrEmptyCount: entries.filter((entry) => entry.ocr?.status === 'ocr_empty').length,
    failedCount: entries.filter((entry) => entry.ocr?.status === 'failed').length,
    educationCount: entries.filter((entry) => entry.ocr?.education).length,
    experienceCount: entries.filter((entry) => entry.ocr?.experience).length,
    birthDateCount: entries.filter((entry) => entry.ocr?.birthDate).length,
    genderCount: entries.filter((entry) => entry.ocr?.gender).length,
    uniquePdfCount: pageCache.size,
    fullPageOcrPdfCount: fullPageOcrCache.size,
    imageTableLayoutCount: imageTableLayoutCache.size,
  };
  const output = { schemaVersion: 1, generatedAt: new Date().toISOString(), selection: { offset: options.offset, limit: Number.isFinite(options.limit) ? options.limit : null }, summary, entries };
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { candidateIdentityEvidence, candidateNameEdgeEvidenceMatches, candidateNameMatchesExpected, cleanOcrText, cleanProfileField, districtHeadingEvidenceForRow, districtHeadingsFromTsv, districtNumberFromOcrText, districtNumbersFromSourcePath, districtVerticalWindow, gridProfileTextExtraction, manualLocatorForEntry, parseChineseNumber, parseOcrRocBirthDate, parseProfileCardBirthDate, plausibleBirthDateForElection, profileGeometry, profileTableNumberBox, selectCandidateNumberOcr, selectStrongestIdentityMatch, sourceDocumentFromUniqueBulletinCandidate, verifiedProfileFieldsForEntry };
