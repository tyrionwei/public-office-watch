import crypto from 'node:crypto';
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
const defaultInputPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2024-legislator', 'review.json');
const defaultOutputPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2024-legislator', 'profile-review.json');
const defaultSeedPath = path.join(repoRoot, 'data-sources', 'cec-2024-bulletin-profile-claims.seed.json');
const sourceId = 'cec-2024-election-bulletins';
const sourceName = '中央選舉委員會：2024年第11屆立法委員選舉公報';
const sourceUrl = 'https://bulletin.cec.gov.tw/';

function parseArgs(argv) {
  const options = { inputPath: defaultInputPath, outputPath: defaultOutputPath, seedPath: defaultSeedPath };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.inputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--seed') options.seedPath = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  return options;
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

function textInBox(page, box) {
  const words = page.words.filter((word) => {
    const x = (word.xMin + word.xMax) / 2;
    const y = (word.yMin + word.yMax) / 2;
    return x >= box.xMin && x <= box.xMax && y >= box.yMin && y <= box.yMax;
  });
  return groupWordsIntoLines(words, 2.5)
    .map((line) => lineText(line.words))
    .filter(Boolean)
    .join('\n')
    .trim();
}

function profileHeaderCandidates(page, nameMatch) {
  const educationHeaders = findPhraseMatches(page, '學歷');
  const experienceHeaders = findPhraseMatches(page, '經歷');
  const candidates = [];
  for (const education of educationHeaders) {
    for (const experience of experienceHeaders) {
      const verticalGap = nameMatch.yMin - Math.max(education.yMin, experience.yMin);
      if (Math.abs(education.yMin - experience.yMin) > 8) continue;
      if (verticalGap < -8 || verticalGap > page.height * 0.13) continue;
      if (education.xMin <= nameMatch.xMax || experience.xMin <= education.xMax) continue;
      if (experience.xMin - education.xMin > page.width * 0.3) continue;
      candidates.push({
        education,
        experience,
        score: Math.abs(verticalGap) + ((education.xMin - nameMatch.xMax) * 0.05),
      });
    }
  }
  return candidates.sort((left, right) => left.score - right.score);
}

function findProfileSection(entry, pages) {
  const candidates = [];
  for (const page of pages) {
    for (const nameMatch of findPhraseMatches(page, entry.person_name)) {
      const header = profileHeaderCandidates(page, nameMatch)[0];
      if (header) candidates.push({ page, nameMatch, header });
    }
  }
  if (candidates.length === 0) {
    return { status: 'needs_manual_localization', reason: 'candidate profile headers not found' };
  }

  candidates.sort((left, right) => left.header.score - right.header.score || left.page.page - right.page.page);
  const { page, nameMatch, header } = candidates[0];
  const educationCenter = centerX(header.education);
  const experienceCenter = centerX(header.experience);
  const nameCenter = centerX(nameMatch);
  const nextEducation = findPhraseMatches(page, '學歷')
    .filter((match) => Math.abs(match.yMin - header.education.yMin) <= 8 && match.xMin > header.experience.xMin)
    .sort((left, right) => left.xMin - right.xMin)[0] ?? null;
  const leftBoundary = (nameCenter + educationCenter) / 2;
  const middleBoundary = (educationCenter + experienceCenter) / 2;
  const rightBoundary = nextEducation
    ? experienceCenter + ((centerX(nextEducation) - experienceCenter) * 0.48)
    : page.width - 8;
  const profileEndLabels = [
    ...findPhraseMatches(page, '政見'),
    ...findPhraseMatches(page, '基本資料'),
  ].filter((match) => {
    const x = centerX(match);
    return match.yMin > nameMatch.yMax && x >= leftBoundary - 40 && x <= rightBoundary;
  }).sort((left, right) => left.yMin - right.yMin);
  const nextHeaderY = findPhraseMatches(page, '學歷')
    .filter((match) => match.yMin > nameMatch.yMax + 15)
    .sort((left, right) => left.yMin - right.yMin)[0]?.yMin;
  const yMin = Math.max(header.education.yMax, header.experience.yMax) + 2;
  const yMax = profileEndLabels[0]?.yMin ?? nextHeaderY ?? Math.min(page.height, nameMatch.yMin + (page.height * 0.2));
  const education = textInBox(page, { xMin: leftBoundary, xMax: middleBoundary, yMin, yMax });
  const experience = textInBox(page, { xMin: middleBoundary, xMax: rightBoundary, yMin, yMax });
  if (!education && !experience) {
    return { status: 'needs_manual_localization', reason: 'profile cells were empty' };
  }
  return {
    status: 'extracted',
    page: page.page,
    bounds: { leftBoundary, middleBoundary, rightBoundary, yMin, yMax },
    education,
    experience,
  };
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
      electionYear: 2024,
      electionName: entry.election_name,
      raceTitle: entry.race_title,
      candidateId: entry.candidate_id,
      candidateNo: entry.candidate_no,
      sourceDocument: { sha256: entry.sourceDocument.sha256, page: extraction.page },
      publicationGate: {
        status: 'passed',
        reason: 'Official CEC bulletin matched to the exact elected candidate record',
      },
    },
    confidenceLevel: 'A',
    reviewStatus: 'verified',
    visibility: 'public',
    sourceId,
    sourceName,
    sourceUrl: entry.sourceDocument.url,
    observedAt: '2024-01-13T00:00:00+08:00',
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fs.readFileSync(options.inputPath, 'utf8'));
  const pageCache = new Map();
  const entries = [];
  const claims = [];
  for (const [index, entry] of input.entries.entries()) {
    if (!entry.sourceDocument?.file) continue;
    console.error(`[${index + 1}/${input.entries.length}] ${entry.person_name}`);
    const pdfPath = path.join(repoRoot, entry.sourceDocument.file);
    let pages = pageCache.get(pdfPath);
    if (!pages) {
      pages = runBbox(pdfPath);
      pageCache.set(pdfPath, pages);
    }
    const extraction = findProfileSection(entry, pages);
    entries.push({
      candidateId: entry.candidate_id,
      personId: entry.person_id,
      personName: entry.person_name,
      raceTitle: entry.race_title,
      sourceUrl: entry.sourceDocument.url,
      extraction,
    });
    if (extraction.status !== 'extracted') continue;
    if (extraction.education) claims.push(claimFor(entry, 'education', extraction.education, extraction));
    if (extraction.experience) claims.push(claimFor(entry, 'experience', extraction.experience, extraction));
  }
  const summary = {
    targetCount: input.entries.length,
    extractedCount: entries.filter((entry) => entry.extraction.status === 'extracted').length,
    manualCount: entries.filter((entry) => entry.extraction.status !== 'extracted').length,
    educationCount: claims.filter((claim) => claim.claimType === 'education').length,
    experienceCount: claims.filter((claim) => claim.claimType === 'experience').length,
    uniquePdfCount: pageCache.size,
  };
  const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), summary, entries };
  const seed = {
    schemaVersion: 1,
    name: 'cec-2024-bulletin-profile-claims',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: 'Official CEC 2024 elected-candidate bulletin education and experience. Candidate-provided and CEC-published.',
    sources: [{ id: sourceId, name: sourceName, url: sourceUrl, confidenceLevel: 'A' }],
    summary,
    personClaims: claims,
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

export { findProfileSection, lineText, profileHeaderCandidates, textInBox };
