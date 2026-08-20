import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findPhraseMatches, parseBboxPages } from './extract-cec-elected-platform-review.mjs';
import { textInBox } from './extract-cec-2024-profile-review.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profileSeedPath = path.join(repoRoot, 'data-sources', 'cec-2024-person-profile-claims.seed.json');
const pdfPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2024-party-list', 'bulletin.pdf');
const outputPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2024-party-list', 'profile-review.json');
const seedPath = path.join(repoRoot, 'data-sources', 'cec-2024-party-list-bulletin-profile-claims.seed.json');
const sourceId = 'cec-2024-election-bulletins';
const sourceName = '中央選舉委員會：2024年第11屆全國不分區及僑居國外國民立法委員選舉公報';
const sourceUrl = 'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/02%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/113%E5%B9%B4%E7%AC%AC11%E5%B1%86/05%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E5%8F%8A%E5%83%91%E5%B1%85%E5%9C%8B%E5%A4%96%E5%9C%8B%E6%B0%91%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E5%8F%8A%E5%83%91%E5%B1%85%E5%9C%8B%E5%A4%96%E5%9C%8B%E6%B0%91%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1.pdf';
const hanKuoYu = {
  personId: '6eec8a91-e26f-4ee6-a177-fe44ddd554d9',
  personName: '韓國瑜',
  party: '中國國民黨',
  candidateNo: '1',
  officialExternalId: 'cec-2024-candidate-json:L4:全國不分區:中國國民黨:1:L4:韓國瑜:0460617',
  identityNote: 'Mapped to the public 11th Legislative Yuan person record; duplicate same-name records remain a separate data-quality issue.',
};

function centerX(box) {
  return (box.xMin + box.xMax) / 2;
}

function centerY(box) {
  return (box.yMin + box.yMax) / 2;
}

function targetsFromProfileSeed(seed) {
  const targets = seed.personClaims
    .filter((claim) => claim.claimType === 'external_id' && claim.sourceUrl?.includes('/cand/L4/'))
    .map((claim) => ({
      personId: claim.personId,
      personName: claim.personName,
      party: claim.claimJson.party,
      candidateNo: String(claim.claimJson.candidateNo),
      officialExternalId: claim.claimJson.officialExternalId,
    }));
  targets.push(hanKuoYu);
  return targets.sort((left, right) =>
    left.party.localeCompare(right.party, 'zh-Hant') || Number(left.candidateNo) - Number(right.candidateNo));
}

function tableHeaderCandidates(page, nameMatch) {
  const nameHeaders = findPhraseMatches(page, '姓名');
  const basicHeaders = findPhraseMatches(page, '基本資料');
  const educationHeaders = findPhraseMatches(page, '學歷');
  const experienceHeaders = findPhraseMatches(page, '經歷');
  const candidates = [];
  for (const name of nameHeaders) {
    for (const basic of basicHeaders) {
      for (const education of educationHeaders) {
        for (const experience of experienceHeaders) {
          const yValues = [name, basic, education, experience].map(centerY);
          if (Math.max(...yValues) - Math.min(...yValues) > 8) continue;
          const xValues = [name, basic, education, experience].map(centerX);
          if (!(xValues[0] < xValues[1] && xValues[1] < xValues[2] && xValues[2] < xValues[3])) continue;
          const halfWidth = page.width / 2;
          const sameHalf = Math.floor(centerX(nameMatch) / halfWidth) === Math.floor(xValues[0] / halfWidth);
          if (!sameHalf || Math.abs(centerX(nameMatch) - xValues[0]) > page.width * 0.09) continue;
          const verticalDistance = Math.abs(centerY(nameMatch) - centerY(name));
          candidates.push({ name, basic, education, experience, score: verticalDistance });
        }
      }
    }
  }
  return candidates.sort((left, right) => left.score - right.score);
}

function extractTarget(target, pages) {
  const matches = pages.flatMap((page) =>
    findPhraseMatches(page, target.personName).map((nameMatch) => ({ page, nameMatch })));
  if (matches.length !== 1) {
    return { status: 'needs_manual_review', reason: `expected one exact name match, found ${matches.length}` };
  }
  const { page, nameMatch } = matches[0];
  const header = tableHeaderCandidates(page, nameMatch)[0];
  if (!header) return { status: 'needs_manual_review', reason: 'table header not found', page: page.page };

  const basicCenter = centerX(header.basic);
  const educationCenter = centerX(header.education);
  const experienceCenter = centerX(header.experience);
  const halfStart = centerX(nameMatch) < page.width / 2 ? 0 : page.width / 2;
  const halfEnd = halfStart + (page.width / 2);
  const birthMatches = page.words.filter((word) => word.text.startsWith('出生年月日'))
    .filter((match) => Math.abs(centerX(match) - basicCenter) < page.width * 0.07)
    .sort((left, right) => left.yMin - right.yMin);
  const birth = birthMatches
    .filter((match) => Math.abs(centerY(match) - centerY(nameMatch)) < page.height * 0.04)
    .sort((left, right) => Math.abs(centerY(left) - centerY(nameMatch)) - Math.abs(centerY(right) - centerY(nameMatch)))[0];
  if (!birth) return { status: 'needs_manual_review', reason: 'candidate birth row not found', page: page.page };
  const nextBirth = birthMatches.find((match) => match.yMin > birth.yMin + 4) ?? null;
  const nextTableHeader = findPhraseMatches(page, '號次·名稱')
    .filter((match) => match.yMin > birth.yMin && centerX(match) >= halfStart && centerX(match) < halfEnd)
    .sort((left, right) => left.yMin - right.yMin)[0] ?? null;
  const footer = page.words.filter((word) => word.text.includes('頁（共')).sort((left, right) => left.yMin - right.yMin)[0] ?? null;
  const yMin = Math.min(nameMatch.yMin, birth.yMin) - 2;
  const yMax = Math.min(
    nextBirth?.yMin ?? page.height,
    nextTableHeader?.yMin ?? page.height,
    footer?.yMin ?? page.height,
  ) - 1;
  const education = textInBox(page, {
    xMin: (basicCenter + educationCenter) / 2,
    xMax: (educationCenter + experienceCenter) / 2,
    yMin,
    yMax,
  });
  const experience = textInBox(page, {
    xMin: (educationCenter + experienceCenter) / 2,
    xMax: halfEnd - 5,
    yMin,
    yMax,
  });
  if (!education && !experience) {
    return { status: 'needs_manual_review', reason: 'education and experience cells were empty', page: page.page };
  }
  return {
    status: 'extracted',
    page: page.page,
    education,
    experience,
    bounds: { yMin, yMax },
  };
}

function claimFor(target, claimType, claimValue, extraction, sha256) {
  const stableKey = crypto.createHash('sha256').update(target.officialExternalId).digest('hex').slice(0, 16);
  return {
    claimKey: `official-profile:${sourceId}:party-list:${stableKey}:${claimType}`,
    personId: target.personId,
    personName: target.personName,
    claimType,
    claimValue,
    claimJson: {
      value: claimValue,
      items: [claimValue],
      profileSource: 'cec_election_bulletin',
      electionYear: 2024,
      electionName: '2024年第11屆立法委員選舉',
      raceTitle: '全國不分區及僑居國外國民立法委員選舉',
      candidateNo: target.candidateNo,
      party: target.party,
      officialExternalId: target.officialExternalId,
      sourceDocument: { sha256, page: extraction.page },
      publicationGate: {
        status: 'passed',
        reason: 'Official CEC bulletin matched by party, elected list position, and exact candidate name',
      },
      ...(target.identityNote ? { identityNote: target.identityNote } : {}),
    },
    confidenceLevel: 'A',
    reviewStatus: 'verified',
    visibility: 'public',
    sourceId,
    sourceName,
    sourceUrl,
    observedAt: '2024-01-13T00:00:00+08:00',
  };
}

function runBbox(inputPath) {
  const result = spawnSync('pdftotext', ['-bbox-layout', inputPath, '-'], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`pdftotext failed: ${(result.stderr || result.stdout).trim()}`);
  return parseBboxPages(result.stdout);
}

function main() {
  const profileSeed = JSON.parse(fs.readFileSync(profileSeedPath, 'utf8'));
  const targets = targetsFromProfileSeed(profileSeed);
  if (targets.length !== 34) throw new Error(`Expected 34 elected party-list targets, found ${targets.length}`);
  const pdf = fs.readFileSync(pdfPath);
  const sha256 = crypto.createHash('sha256').update(pdf).digest('hex');
  const pages = runBbox(pdfPath);
  const entries = targets.map((target) => ({ ...target, extraction: extractTarget(target, pages) }));
  const claims = entries.flatMap((entry) => {
    if (entry.extraction.status !== 'extracted') return [];
    return ['education', 'experience']
      .filter((claimType) => entry.extraction[claimType])
      .map((claimType) => claimFor(entry, claimType, entry.extraction[claimType], entry.extraction, sha256));
  });
  const summary = {
    targetCount: targets.length,
    extractedCount: entries.filter((entry) => entry.extraction.status === 'extracted').length,
    manualCount: entries.filter((entry) => entry.extraction.status !== 'extracted').length,
    educationCount: claims.filter((claim) => claim.claimType === 'education').length,
    experienceCount: claims.filter((claim) => claim.claimType === 'experience').length,
  };
  const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), sourceUrl, sha256, summary, entries };
  const seed = {
    schemaVersion: 1,
    name: 'cec-2024-party-list-bulletin-profile-claims',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: 'Official CEC 2024 elected party-list candidate bulletin education and experience. Candidate-provided and CEC-published.',
    sources: [{ id: sourceId, name: sourceName, url: sourceUrl, confidenceLevel: 'A' }],
    summary,
    personClaims: claims,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.manualCount || summary.educationCount !== 33 || summary.experienceCount !== 34) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { extractTarget, tableHeaderCandidates, targetsFromProfileSeed };
