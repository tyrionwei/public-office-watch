import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  findPhraseMatches,
  groupWordsIntoLines,
  parseBboxPages,
} from './extract-cec-elected-platform-review.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultInputPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2022-councilor', 'review.json');
const defaultOutputPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2022-councilor', 'profile-review.json');
const defaultSeedPath = path.join(repoRoot, 'data-sources', 'cec-2022-councilor-bulletin-profile-claims.seed.json');
const sourceId = 'cec-2022-councilor-election-bulletins';
const sourceName = '中央選舉委員會：2022年縣市議員選舉公報';
const sourceUrl = 'https://bulletin.cec.gov.tw/';

function parseArgs(argv) {
  const options = {
    inputPath: defaultInputPath,
    outputPath: defaultOutputPath,
    seedPath: defaultSeedPath,
    gapPath: null,
    personName: null,
    limit: Number.POSITIVE_INFINITY,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.inputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--seed') options.seedPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--gap-report') options.gapPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--person-name') options.personName = argv[++index] ?? '';
    else if (arg === '--limit') options.limit = Number.parseInt(argv[++index] ?? '', 10);
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (!(options.limit > 0)) throw new Error('--limit must be a positive integer');
  if (options.gapPath && !fs.existsSync(options.gapPath)) {
    throw new Error(`Gap report not found: ${options.gapPath}`);
  }
  return options;
}

function normalized(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replaceAll('臺', '台')
    .replace(/[\s\u00a0\u3000]+/gu, '')
    .toLowerCase();
}

function centerX(box) {
  return (box.xMin + box.xMax) / 2;
}

function lineText(words) {
  let text = '';
  let previous = null;
  for (const word of words) {
    const gap = previous ? word.xMin - previous.xMax : 0;
    const latinBoundary = previous && /[A-Za-z0-9]$/u.test(previous.text) && /^[A-Za-z0-9]/u.test(word.text);
    text += gap > 2.5 && latinBoundary ? ` ${word.text}` : word.text;
    previous = word;
  }
  return text.replace(/[\s\u00a0\u3000]+/gu, ' ').trim();
}

function textInBox(page, box, requireContained = false) {
  const words = page.words.filter((word) => {
    const x = centerX(word);
    const y = (word.yMin + word.yMax) / 2;
    return x >= box.xMin && x <= box.xMax
      && (!requireContained || (word.xMin >= box.xMin - 2 && word.xMax <= box.xMax + 2))
      && y >= box.yMin && y <= box.yMax;
  });
  return groupWordsIntoLines(words, 2.5)
    .map((line) => lineText(line.words))
    .filter(Boolean)
    .join('\n')
    .trim();
}

function findVerticalPhraseMatches(page, phrase) {
  const wanted = normalized(phrase);
  if (!wanted) return [];
  const words = page.words
    .map((word) => ({ ...word, normalizedText: normalized(word.text) }))
    .filter((word) => word.normalizedText && wanted.includes(word.normalizedText));
  const matches = [];
  for (const start of words) {
    if (!wanted.startsWith(start.normalizedText)) continue;
    const selected = [start];
    let combined = start.normalizedText;
    let current = start;
    while (combined.length < wanted.length) {
      const remaining = wanted.slice(combined.length);
      const next = words
        .filter((candidate) => remaining.startsWith(candidate.normalizedText)
          && candidate.yMin >= current.yMax - 2
          && candidate.yMin - current.yMax <= Math.max(30, page.height * 0.025)
          && Math.abs(centerX(candidate) - centerX(start)) <= Math.max(8, (start.xMax - start.xMin) * 0.8))
        .sort((left, right) => left.yMin - right.yMin || Math.abs(centerX(left) - centerX(start)) - Math.abs(centerX(right) - centerX(start)))[0];
      if (!next) break;
      selected.push(next);
      combined += next.normalizedText;
      current = next;
    }
    if (combined !== wanted) continue;
    matches.push({
      page: page.page,
      xMin: Math.min(...selected.map((word) => word.xMin)),
      yMin: Math.min(...selected.map((word) => word.yMin)),
      xMax: Math.max(...selected.map((word) => word.xMax)),
      yMax: Math.max(...selected.map((word) => word.yMax)),
      orientation: 'vertical',
    });
  }
  return matches;
}

function findAnyPhraseMatches(page, phrase) {
  const seen = new Set();
  return [...findPhraseMatches(page, phrase), ...findVerticalPhraseMatches(page, phrase)]
    .filter((match) => {
      const key = `${match.page}:${match.xMin.toFixed(1)}:${match.yMin.toFixed(1)}:${match.xMax.toFixed(1)}:${match.yMax.toFixed(1)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function alignedHeader(page, label, nameMatch, options = {}) {
  const minX = options.minX ?? nameMatch.xMax;
  const maxX = options.maxX ?? page.width;
  return findAnyPhraseMatches(page, label)
    .filter((match) => match.xMin > minX
      && match.xMin < maxX
      && match.yMin < nameMatch.yMin)
    .sort((left, right) => left.yMin - right.yMin || left.xMin - right.xMin)[0] ?? null;
}

function peerNameMatches(entry, page, selectedName) {
  return (entry.raceCandidates ?? [])
    .flatMap((candidate) => findAnyPhraseMatches(page, candidate.personName)
      .map((match) => ({ ...match, personName: candidate.personName })))
    .filter((match) => Math.abs(centerX(match) - centerX(selectedName)) < page.width * 0.035);
}

function parseRocBirthDate(value) {
  const compact = normalized(value).replace(/[^0-9年月日]/gu, '');
  const match = compact.match(/^(\d{1,3})年(\d{1,2})月(\d{1,2})日$/u);
  if (!match) return null;
  const year = Number(match[1]) + 1911;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeElectionParty(value) {
  const compact = normalized(value);
  const knownParties = [
    '無黨團結聯盟', '台灣團結聯盟', '民主進步黨', '中國國民黨', '台灣民眾黨',
    '社會民主黨', '時代力量', '台灣基進', '親民黨', '綠黨', '新黨', '無',
  ].map((party) => normalized(party));
  return knownParties.find((party) => {
    if (compact === party) return true;
    if (compact.length > party.length + 2) return false;
    let offset = 0;
    for (const character of compact) {
      if (character === party[offset]) offset += 1;
      if (offset === party.length) return true;
    }
    return false;
  }) ?? null;
}

function verticalColumnTexts(page, box) {
  const words = page.words.filter((word) => {
    const x = centerX(word);
    const y = (word.yMin + word.yMax) / 2;
    return x >= box.xMin && x <= box.xMax && y >= box.yMin && y <= box.yMax;
  }).sort((left, right) => centerX(left) - centerX(right) || left.yMin - right.yMin);
  const columns = [];
  for (const word of words) {
    let column = columns.find((candidate) => Math.abs(candidate.center - centerX(word)) <= page.width * 0.01);
    if (!column) {
      column = { center: centerX(word), words: [] };
      columns.push(column);
    }
    column.words.push(word);
    column.center = column.words.reduce((sum, item) => sum + centerX(item), 0) / column.words.length;
  }
  return columns
    .sort((left, right) => left.center - right.center)
    .map((column) => column.words.sort((left, right) => left.yMin - right.yMin).map((word) => word.text).join(''));
}

function stripStandaloneElectionParty(value) {
  const exactParties = new Set(['無黨團結聯盟', '台灣團結聯盟', '民主進步黨', '中國國民黨', '台灣民眾黨', '社會民主黨', '時代力量', '台灣基進', '親民黨', '綠黨', '新黨', '無'].map(normalized));
  return String(value ?? '').split(/\r?\n/u).filter((line) => !exactParties.has(normalized(line))).join('\n').trim();
}

function cleanExperienceText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu, '')
    .split(/\r?\n/u)
    .map((line) => line.trim().replace(/(?<=\p{Script=Han})\s*\d+\.$/u, ''))
    .filter((line) => line && !/^\d+[.、]?$/u.test(line))
    .join('\n');
}

function toChineseNumber(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 99) return null;
  const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (number < 10) return digits[number];
  const tens = Math.floor(number / 10);
  const ones = number % 10;
  return (tens === 1 ? '' : digits[tens]) + '十' + digits[ones];
}

function largeCandidateNumberMatches(page, candidateNumber) {
  return findPhraseMatches(page, candidateNumber)
    .filter((match) => match.yMax - match.yMin >= Math.max(14, page.height * 0.012));
}

function districtHeaderMatches(entry, page) {
  const district = entry.race_title?.match(/第(\d+)選舉區/u)?.[1];
  if (!district) return [];
  const chinese = toChineseNumber(district);
  const labels = ['第' + district + '選舉區'];
  if (chinese) labels.push('第' + chinese + '選舉區');
  return labels.flatMap((label) => findAnyPhraseMatches(page, label));
}

function selectCandidateNumberLocator(entry, pages) {
  const candidateNumber = String(entry.candidate_no ?? '').trim();
  if (!/^\d+$/u.test(candidateNumber)) return null;
  const locators = pages.flatMap((page) => largeCandidateNumberMatches(page, candidateNumber)
    .map((match) => ({ page, match })));
  if (locators.length === 0) return null;
  if (locators.length === 1) return locators[0];

  const ranked = locators.map((locator) => {
    const headers = districtHeaderMatches(entry, locator.page);
    const distance = headers.length
      ? Math.min(...headers.map((header) => Math.abs(centerX(header) - centerX(locator.match))))
      : Number.POSITIVE_INFINITY;
    return { ...locator, distance };
  }).sort((left, right) => left.distance - right.distance);
  if (!Number.isFinite(ranked[0].distance)) return null;
  if (ranked[1] && ranked[1].distance - ranked[0].distance < ranked[0].page.width * 0.06) return null;
  return ranked[0];
}

function findNumberedTableHeaders(page, numberMatch) {
  const beforeCandidate = (match) => match.yMin < numberMatch.yMin;
  const experiences = findAnyPhraseMatches(page, '經歷')
    .filter((match) => match.xMin > numberMatch.xMax && beforeCandidate(match));
  const platforms = findAnyPhraseMatches(page, '政見')
    .filter((match) => match.xMin > numberMatch.xMax && beforeCandidate(match));
  const parties = findAnyPhraseMatches(page, '推薦之政黨')
    .filter((match) => match.xMin > numberMatch.xMax && beforeCandidate(match));
  const birthplaces = findAnyPhraseMatches(page, '出生地')
    .filter((match) => match.xMin > numberMatch.xMax && beforeCandidate(match));
  const candidates = [];
  for (const experience of experiences) {
    const headerY = (experience.yMin + experience.yMax) / 2;
    const nearHeader = (match) => Math.abs(((match.yMin + match.yMax) / 2) - headerY) < page.height * 0.055;
    const platform = platforms
      .filter((match) => match.xMin > experience.xMax && nearHeader(match))
      .sort((left, right) => left.xMin - right.xMin)[0];
    const party = parties
      .filter((match) => match.xMin < experience.xMin && nearHeader(match))
      .sort((left, right) => right.xMin - left.xMin)[0];
    const birthplace = birthplaces
      .filter((match) => party && match.xMin < party.xMin && nearHeader(match))
      .sort((left, right) => right.xMin - left.xMin)[0];
    if (!platform || !party || !birthplace) continue;
    const education = findAnyPhraseMatches(page, '學歷')
      .filter((match) => match.xMin > party.xMax && match.xMin < experience.xMin && beforeCandidate(match) && nearHeader(match))
      .sort((left, right) => left.xMin - right.xMin)[0] ?? null;
    candidates.push({ experience, platform, party, birthplace, education, headerY });
  }
  return candidates
    .sort((left, right) => right.headerY - left.headerY || left.experience.xMin - right.experience.xMin)[0] ?? null;
}

function findProfileSectionByCandidateNumber(entry, pages) {
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
    .filter((match) => Math.abs(centerX(match) - centerX(numberMatch)) < page.width * 0.03)
    .sort((left, right) => left.yMin - right.yMin);
  const targetIndex = alignedNumbers.findIndex((match) => Math.abs(match.yMin - numberMatch.yMin) < 1 && Math.abs(match.xMin - numberMatch.xMin) < 1);
  if (targetIndex < 0) return null;
  const previous = alignedNumbers[targetIndex - 1] ?? null;
  const next = alignedNumbers[targetIndex + 1] ?? null;
  const targetCenterY = (numberMatch.yMin + numberMatch.yMax) / 2;
  const previousCenterY = previous ? (previous.yMin + previous.yMax) / 2 : null;
  const nextCenterY = next ? (next.yMin + next.yMax) / 2 : null;
  const headerBottom = Math.max(headers.experience.yMax, headers.platform.yMax, headers.party.yMax, headers.birthplace.yMax);
  const estimatedGap = nextCenterY != null
    ? nextCenterY - targetCenterY
    : previousCenterY != null ? targetCenterY - previousCenterY : page.height * 0.12;
  const rowTop = previousCenterY != null
    ? (previousCenterY + targetCenterY) / 2
    : Math.max(headerBottom + 2, targetCenterY - (estimatedGap / 2));
  const rowBottom = nextCenterY != null
    ? (targetCenterY + nextCenterY) / 2
    : Math.min(page.height - 8, targetCenterY + (estimatedGap / 2));
  if (rowBottom - rowTop < 20) return null;

  const profileLeft = headers.party.xMax + Math.max(2, page.width * 0.002);
  const profileRight = headers.experience.xMax + ((headers.platform.xMin - headers.experience.xMax) * 0.5);
  const profileMiddle = headers.education
    ? (centerX(headers.education) + centerX(headers.experience)) / 2
    : (2 * centerX(headers.experience)) - profileRight;
  if (profileMiddle <= profileLeft + 10 || profileRight <= profileMiddle + 10) return null;
  const educationText = stripStandaloneElectionParty(textInBox(page, { xMin: profileLeft, xMax: profileMiddle, yMin: rowTop, yMax: rowBottom }));
  const experienceText = cleanExperienceText(textInBox(page, { xMin: profileMiddle, xMax: profileRight, yMin: rowTop, yMax: rowBottom }));
  if (!educationText && !experienceText) return null;

  const birthplaceCenter = centerX(headers.birthplace);
  const partyCenter = centerX(headers.party);
  const basicStep = partyCenter - birthplaceCenter;
  if (basicStep <= 4) return null;
  const birthCenter = birthplaceCenter - (2 * basicStep);
  const genderCenter = birthplaceCenter - basicStep;
  const basicCenters = [birthCenter, genderCenter, birthplaceCenter, partyCenter];
  const basicCell = (index) => textInBox(page, {
    xMin: index === 0 ? basicCenters[0] - (basicStep / 2) : (basicCenters[index - 1] + basicCenters[index]) / 2,
    xMax: index === basicCenters.length - 1 ? profileLeft : (basicCenters[index] + basicCenters[index + 1]) / 2,
    yMin: rowTop,
    yMax: rowBottom,
  });
  const birthDateRaw = basicCell(0);
  const genderRaw = normalized(basicCell(1));
  const partyRaw = basicCell(3);
  const gender = genderRaw === '男' || genderRaw === '女' ? genderRaw : null;

  return {
    status: 'extracted_text_layer',
    locator: 'candidate_number_and_race',
    page: page.page,
    nameOrientation: 'not_required',
    bounds: { profileLeft, profileMiddle, profileRight, rowTop, rowBottom },
    education: educationText,
    experience: experienceText,
    birthDateRaw,
    birthDate: parseRocBirthDate(birthDateRaw),
    gender,
    electionPartyRaw: partyRaw,
    electionParty: normalizeElectionParty(partyRaw),
  };
}

function findProfileSection(entry, pages) {
  const candidates = [];
  let nameMatches = pages.flatMap((page) => findAnyPhraseMatches(page, entry.person_name).map((match) => ({ page, match })));
  if (nameMatches.length === 0) {
    const value = String(entry.person_name ?? '');
    const expectedHan = [...value.matchAll(/\p{Script=Han}/gu)].map((match) => match[0]).join('');
    const runs = [...value.matchAll(/\p{Script=Han}{2,}/gu)].map((match) => match[0]).sort((left, right) => right.length - left.length);
    for (const fallbackName of [...new Set([expectedHan, ...runs])].filter((name) => name.length >= 2)) {
      const fallbackMatches = pages.flatMap((page) => findAnyPhraseMatches(page, fallbackName).map((match) => ({ page, match })));
      if (fallbackMatches.length === 1) {
        nameMatches = fallbackMatches;
        break;
      }
    }
  }
  for (const { page, match: nameMatch } of nameMatches) {
      const education = alignedHeader(page, '學歷', nameMatch);
      const experience = education ? alignedHeader(page, '經歷', nameMatch, { minX: education.xMax }) : null;
      if (!education || !experience) continue;
      if (experience.xMin - education.xMin > page.width * 0.35) continue;
      candidates.push({ page, nameMatch, education, experience });
  }
  if (candidates.length === 0) {
    return findProfileSectionByCandidateNumber(entry, pages)
      ?? { status: 'needs_manual_localization', reason: 'candidate name and profile headers not found' };
  }

  candidates.sort((left, right) => left.page.page - right.page.page || left.nameMatch.yMin - right.nameMatch.yMin);
  const { page, nameMatch, education, experience } = candidates[0];
  const peers = peerNameMatches(entry, page, nameMatch)
    .sort((left, right) => left.yMin - right.yMin);
  const nextPeer = peers.find((match) => match.yMin > nameMatch.yMin + 10);
  const previousPeer = [...peers].reverse().find((match) => match.yMin < nameMatch.yMin - 10);
  const estimatedHeight = nextPeer
    ? nextPeer.yMin - nameMatch.yMin
    : previousPeer ? nameMatch.yMin - previousPeer.yMin : page.height * 0.13;
  const rowTop = Math.max(education.yMax + 2, nameMatch.yMin - (estimatedHeight * 0.12));
  const rowBottom = Math.min(page.height - 8, nextPeer ? nextPeer.yMin - 8 : rowTop + estimatedHeight - 8);
  if (rowBottom - rowTop < 20) {
    return { status: 'needs_manual_localization', reason: 'candidate row boundary not found' };
  }

  const birthHeader = alignedHeader(page, '出生年月日', nameMatch, { maxX: education.xMin });
  const genderHeader = alignedHeader(page, '性別', nameMatch, { maxX: education.xMin });
  const birthplaceHeader = alignedHeader(page, '出生地', nameMatch, { maxX: education.xMin });
  const partyHeader = alignedHeader(page, '推薦之政黨', nameMatch, { maxX: education.xMin });
  const platform = alignedHeader(page, '政見', nameMatch, { minX: experience.xMax });
  const educationCenter = centerX(education);
  const experienceCenter = centerX(experience);
  const profileMiddle = (educationCenter + experienceCenter) / 2;
  const profileLeft = partyHeader
    ? partyHeader.xMax + ((education.xMin - partyHeader.xMax) * 0.1)
    : education.xMin - ((experience.xMin - education.xMax) * 0.5);
  const inferredPlatformStart = page.words
    .filter((word) => word.xMin > profileMiddle + page.width * 0.02 && word.yMin >= rowTop && word.yMax <= rowBottom)
    .filter((word) => /^(?:\d+[.、]|[一二三四五六七八九十]+、)/u.test(normalized(word.text)))
    .sort((left, right) => left.xMin - right.xMin)[0] ?? null;
  const fallbackProfileRight = Math.min(page.width - 8, experienceCenter + (profileMiddle - educationCenter));
  const profileRight = Math.min(
    platform ? experience.xMax + ((platform.xMin - experience.xMax) * 0.5) : fallbackProfileRight,
    inferredPlatformStart ? inferredPlatformStart.xMin - 2 : fallbackProfileRight,
  );
  const educationText = stripStandaloneElectionParty(textInBox(page, { xMin: profileLeft, xMax: profileMiddle, yMin: rowTop, yMax: rowBottom }));
  const experienceText = cleanExperienceText(textInBox(page, { xMin: profileMiddle, xMax: profileRight, yMin: rowTop, yMax: rowBottom }));

  const orderedHeaders = [birthHeader, genderHeader, birthplaceHeader, partyHeader, education]
    .filter(Boolean)
    .sort((left, right) => centerX(left) - centerX(right));
  const cellFor = (header) => {
    if (!header) return '';
    const index = orderedHeaders.indexOf(header);
    const previous = orderedHeaders[index - 1] ?? nameMatch;
    const next = orderedHeaders[index + 1] ?? education;
    const rightBoundary = header === partyHeader ? profileLeft : (centerX(header) + centerX(next)) / 2;
    return textInBox(page, {
      xMin: (centerX(previous) + centerX(header)) / 2,
      xMax: rightBoundary,
      yMin: rowTop,
      yMax: rowBottom,
    });
  };
  const basicBox = { xMin: nameMatch.xMax, xMax: education.xMin, yMin: rowTop, yMax: rowBottom };
  const verticalColumns = verticalColumnTexts(page, basicBox);
  const birthDateRaw = cellFor(birthHeader) || verticalColumns.find((value) => parseRocBirthDate(value)) || '';
  const genderRaw = normalized(cellFor(genderHeader));
  const fallbackGenders = page.words
    .filter((word) => centerX(word) >= basicBox.xMin && centerX(word) <= basicBox.xMax)
    .filter((word) => (word.yMin + word.yMax) / 2 >= rowTop && (word.yMin + word.yMax) / 2 <= rowBottom)
    .map((word) => normalized(word.text)).filter((value) => value === '男' || value === '女');
  const gender = genderRaw === '男' || genderRaw === '女' ? genderRaw : new Set(fallbackGenders).size === 1 ? fallbackGenders[0] : null;
  const partyRaw = cellFor(partyHeader) || verticalColumns.find((value) => normalizeElectionParty(value)) || '';

  if (!educationText && !experienceText) {
    return { status: 'needs_manual_localization', reason: 'profile cells were empty' };
  }
  return {
    status: 'extracted_text_layer',
    page: page.page,
    nameOrientation: nameMatch.orientation ?? 'horizontal',
    bounds: { profileLeft, profileMiddle, profileRight, rowTop, rowBottom },
    education: educationText,
    experience: experienceText,
    birthDateRaw,
    birthDate: parseRocBirthDate(birthDateRaw),
    gender,
    electionPartyRaw: partyRaw,
    electionParty: normalizeElectionParty(partyRaw),
  };
}

function assessPublication(entry, extraction) {
  const reasons = [];
  const text = `${extraction.education}\n${extraction.experience}`;
  const contamination = /(政見內容是否繳送|投票有關規定|防疫宣導|候選人個人資料係|檢舉賄選|簽名或蓋章|個人資料|出生年月日|推薦之政黨|(?:^|\n)政見(?:\n|$)|(?:^|\n)學歷(?:\n|$)|(?:^|\n)經歷(?:\n|$))/u;
  if (entry.race_title.startsWith('臺北市')) reasons.push('taipei_special_layout');
  if (contamination.test(text)) reasons.push('profile_contains_non_profile_section');
  if (extraction.education.length > 180) reasons.push('education_too_long');
  if (extraction.experience.length > 300) reasons.push('experience_too_long');
  if (text.includes('�')) reasons.push('replacement_character');
  if (/(?:^|\n)無(?=[^\n])/u.test(extraction.education)
    || /(?:^|\n)[理黨民進步](?:\n|$)/u.test(extraction.education)
    || /(中國國民黨|民主進步黨|台灣民眾黨|時代力量|台灣基進)/u.test(extraction.education)) {
    reasons.push('education_may_include_party_column');
  }
  const peerNames = (entry.raceCandidates ?? [])
    .filter((candidate) => candidate.candidateId !== entry.candidate_id)
    .map((candidate) => candidate.personName)
    .filter((name) => name.length >= 2 && text.includes(name));
  if (peerNames.length) reasons.push(`profile_contains_peer_name:${peerNames.join(',')}`);
  return { status: reasons.length === 0 ? 'passed' : 'private_review_required', reasons };
}

function runBbox(pdfPath) {
  const result = spawnSync('pdftotext', ['-bbox-layout', pdfPath, '-'], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`pdftotext failed: ${(result.stderr || result.stdout).trim()}`);
  return parseBboxPages(result.stdout);
}

function claimFor(entry, claimType, claimValue, extraction) {
  return {
    claimKey: `official-profile:${sourceId}:${entry.candidate_id}:${claimType}`,
    personId: entry.person_id,
    personName: entry.person_name,
    claimType,
    claimValue,
    claimJson: {
      value: claimValue,
      items: [claimValue],
      profileSource: 'cec_election_bulletin',
      electionYear: 2022,
      electionName: entry.election_name,
      raceTitle: entry.race_title,
      candidateId: entry.candidate_id,
      candidateNo: entry.candidate_no,
      electionParty: extraction.electionParty,
      sourceDocument: { sha256: entry.sourceDocument.sha256, page: extraction.page },
      publicationGate: {
        status: 'passed',
        reason: extraction.locator === 'candidate_number_and_race'
          ? 'Official CEC bulletin matched to the exact elected candidate record through the candidate number and race'
          : 'Official CEC bulletin matched to the exact elected candidate record through the candidate name and race',
      },
    },
    confidenceLevel: 'A',
    reviewStatus: 'verified',
    visibility: 'public',
    sourceId,
    sourceName,
    sourceUrl: entry.sourceDocument.url,
    observedAt: '2022-11-26T00:00:00+08:00',
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fs.readFileSync(options.inputPath, 'utf8'));
  const requestedClaims = options.gapPath
    ? new Set(JSON.parse(fs.readFileSync(options.gapPath, 'utf8')).entries
      .flatMap((entry) => entry.missingFields.map((field) => `${entry.personId}:${field.field}`)))
    : null;
  const selected = input.entries
    .filter((entry) => entry.sourceDocument?.file)
    .filter((entry) => !options.personName || entry.person_name === options.personName)
    .slice(0, options.limit);
  const pageCache = new Map();
  const entries = [];
  const claims = [];
  for (const [index, entry] of selected.entries()) {
    console.error(`[${index + 1}/${selected.length}] ${entry.person_name}`);
    const pdfPath = path.join(repoRoot, entry.sourceDocument.file);
    let pages = pageCache.get(pdfPath);
    if (!pages) {
      pages = runBbox(pdfPath);
      pageCache.set(pdfPath, pages);
    }
    const extraction = findProfileSection(entry, pages);
    const publicationAssessment = extraction.status === 'extracted_text_layer'
      ? assessPublication(entry, extraction)
      : { status: 'private_review_required', reasons: [extraction.reason] };
    entries.push({
      candidateId: entry.candidate_id,
      personId: entry.person_id,
      personName: entry.person_name,
      raceTitle: entry.race_title,
      matchStatus: entry.matchStatus,
      sourceUrl: entry.sourceDocument.url,
      extraction: { ...extraction, publicationAssessment },
    });
    if (extraction.status !== 'extracted_text_layer' || publicationAssessment.status !== 'passed') continue;
    if (extraction.education) claims.push(claimFor(entry, 'education', extraction.education, extraction));
    if (extraction.experience) claims.push(claimFor(entry, 'experience', extraction.experience, extraction));
    if (extraction.birthDate) claims.push(claimFor(entry, 'birth_date', extraction.birthDate, extraction));
    if (extraction.gender) claims.push(claimFor(entry, 'gender', extraction.gender, extraction));
  }
  const selectedClaims = requestedClaims
    ? claims.filter((claim) => requestedClaims.has(`${claim.personId}:${claim.claimType}`))
    : claims;
  const selectedPersonCount = new Set(selectedClaims.map((claim) => claim.personId)).size;
  const summary = {
    targetCount: selected.length,
    extractedCount: entries.filter((entry) => entry.extraction.status === 'extracted_text_layer').length,
    manualCount: entries.filter((entry) => entry.extraction.status !== 'extracted_text_layer').length,
    safeExtractedCount: entries.filter((entry) => entry.extraction.publicationAssessment.status === 'passed').length,
    privateReviewCount: entries.filter((entry) => entry.extraction.publicationAssessment.status !== 'passed').length,
    educationCount: selectedClaims.filter((claim) => claim.claimType === 'education').length,
    experienceCount: selectedClaims.filter((claim) => claim.claimType === 'experience').length,
    selectedClaimCount: selectedClaims.length,
    selectedPersonCount,
    birthDateCount: selectedClaims.filter((claim) => claim.claimType === 'birth_date').length,
    genderCount: selectedClaims.filter((claim) => claim.claimType === 'gender').length,
    electionPartyCount: entries.filter((entry) => entry.extraction.electionParty).length,
    uniquePdfCount: pageCache.size,
  };
  const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), summary, entries };
  const seed = {
    schemaVersion: 1,
    name: 'cec-2022-councilor-bulletin-profile-claims',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: 'Official CEC 2022 elected councilor bulletin profiles. Education and experience are canonical only when no newer official bulletin exists; birth date and gender require deduplication; party is election-time context only.',
    sources: [{ id: sourceId, name: sourceName, url: sourceUrl, confidenceLevel: 'A' }],
    summary,
    personClaims: selectedClaims,
  };
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.mkdirSync(path.dirname(options.seedPath), { recursive: true });
  fs.writeFileSync(options.seedPath, `${JSON.stringify(seed, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { assessPublication, cleanExperienceText, findAnyPhraseMatches, findNumberedTableHeaders, findProfileSection, findProfileSectionByCandidateNumber, findVerticalPhraseMatches, largeCandidateNumberMatches, parseRocBirthDate, selectCandidateNumberLocator, textInBox };
