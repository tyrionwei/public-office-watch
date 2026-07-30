import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { externalFindingCanAutoReview } from './build-tnl-dark-guide-source-research.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(repoRoot, 'data-sources', 'tnl-dark-guide');
const categories = ['政治工作', '政治家族', '涉案紀錄', '其他'];
const statuses = [
  'auto_reviewable',
  'manual_review',
  'external_search_needed',
  'not_found_after_stop_loss',
];

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, fileName), 'utf8'));
}

function sortedEntries(map) {
  return [...map.entries()].sort(([left], [right]) => left.localeCompare(right, 'zh-Hant'));
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function isHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function countCsvRows(value) {
  let rows = 0;
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '"') {
      if (quoted && value[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (value[index] === '\n' && !quoted) rows += 1;
  }
  assert.equal(quoted, false, 'CSV contains an unclosed quoted field');
  if (value && !value.endsWith('\n')) rows += 1;
  return rows;
}

function sourceIdsForClaim(claim) {
  return claim.sourceResearchIds ?? [claim.researchId];
}

const guides = [
  readJson('tnl-dark-guide-2018.json'),
  readJson('tnl-dark-guide-2022.json'),
];
const report = readJson('source-research-report.json');
const findingsReport = readJson('source-research-findings.json');
const familyReport = readJson('family-people-report.json');
const summaryMarkdown = fs.readFileSync(path.join(dataDir, 'source-research-summary.md'), 'utf8');
const reviewCsv = fs.readFileSync(path.join(dataDir, 'source-research-review.csv'), 'utf8');

const guideCandidates = guides.flatMap((guide) => guide.candidates);
const sourceClaimCounts = new Map();
let rawClaimCount = 0;
for (const guide of guides) {
  assert.equal(guide.actualCandidateCount, guide.candidates.length);
  assert.equal(guide.expectedCandidateCount, guide.actualCandidateCount);
}
for (const candidate of guideCandidates) {
  for (const category of categories) {
    const entries = candidate.sections?.[category] ?? [];
    rawClaimCount += entries.length;
    for (const _entry of entries) {
      increment(sourceClaimCounts, `${candidate.id}|${category}`);
    }
  }
}

assert.equal(report.publicationStatus, 'internal_research_only');
assert.equal(report.summary.guideCandidateRows, guideCandidates.length);
assert.equal(report.summary.mappedGuideCandidateRows, guideCandidates.length);
assert.equal(report.summary.mappingIssues, 0);
assert.equal(report.summary.cecBulletinCandidateRows, guideCandidates.length);
assert.equal(report.summary.cecBulletinMappingIssues, 0);
assert.equal(report.mappingIssues.length, 0);
assert.equal(report.summary.rawClaims, rawClaimCount);
assert.equal(report.summary.deduplicatedClaims, report.claims.length);

const reportClaimCounts = new Map();
const researchIds = new Set();
const statusCounts = Object.fromEntries(statuses.map((status) => [status, 0]));
const sourceResearchIds = new Set();
const categoryCounts = Object.fromEntries(categories.map((category) => [category, {
  people: new Set(),
  claims: 0,
  autoReviewable: 0,
  manualReview: 0,
  externalSearchNeeded: 0,
  notFoundAfterStopLoss: 0,
}]));

for (const claim of report.claims) {
  assert.ok(claim.researchId);
  assert.ok(!researchIds.has(claim.researchId), `duplicate researchId: ${claim.researchId}`);
  researchIds.add(claim.researchId);
  assert.ok(categories.includes(claim.category), `unknown category: ${claim.category}`);
  assert.ok(statuses.includes(claim.status), `unknown status: ${claim.status}`);
  assert.ok(claim.canonicalPersonId);
  assert.ok(claim.personName);
  assert.ok(claim.text);
  assert.ok(claim.searchQuery);
  assert.ok(Array.isArray(claim.occurrences) && claim.occurrences.length > 0);
  const claimSourceResearchIds = sourceIdsForClaim(claim);
  assert.ok(claimSourceResearchIds.includes(claim.researchId));
  for (const researchId of claimSourceResearchIds) {
    assert.ok(!sourceResearchIds.has(researchId), `duplicate source researchId: ${researchId}`);
    sourceResearchIds.add(researchId);
  }

  assert.ok(Array.isArray(claim.localEvidence));

  statusCounts[claim.status] += 1;
  const category = categoryCounts[claim.category];
  category.people.add(claim.canonicalPersonId);
  category.claims += 1;
  if (claim.status === 'auto_reviewable') category.autoReviewable += 1;
  if (claim.status === 'manual_review') category.manualReview += 1;
  if (claim.status === 'external_search_needed') category.externalSearchNeeded += 1;
  if (claim.status === 'not_found_after_stop_loss') category.notFoundAfterStopLoss += 1;

  for (const occurrence of claim.occurrences) {
    increment(reportClaimCounts, `${occurrence.guideId}|${claim.category}`);
  }

  const hasConflict = claim.localEvidence.some((evidence) => (
    String(evidence.reviewStatus ?? '').includes('conflict')
    || String(evidence.claimType ?? '').includes('conflict')
  ));
  const hasAcceptedLocalEvidence = claim.localEvidence.some((evidence) => (
    evidence.tier === 'official'
    && evidence.matchScore === 1
    && [
      'verified',
      'candidate_self_reported_text_match',
      'official_profile_text_match',
    ].includes(evidence.reviewStatus)
  ));
  const hasAcceptedExternalFinding = externalFindingCanAutoReview(claim.externalResearch);

  if (claim.status === 'auto_reviewable') {
    assert.equal(hasConflict, false, `auto-review claim has conflicting evidence: ${claim.researchId}`);
    assert.ok(
      hasAcceptedLocalEvidence || hasAcceptedExternalFinding,
      `auto-review claim lacks a direct accepted source: ${claim.researchId}`,
    );
  }

  if (claim.status === 'manual_review') {
    assert.ok(
      claim.localEvidence.length > 0 || (claim.externalResearch?.sources?.length ?? 0) > 0,
      `manual-review claim has no review evidence: ${claim.researchId}`,
    );
    assert.ok(
      !hasAcceptedExternalFinding || hasConflict,
      `direct accepted source incorrectly left for manual review: ${claim.researchId}`,
    );
  }

  if (claim.status === 'not_found_after_stop_loss') {
    assert.equal(claim.localEvidence.length, 0);
    assert.equal(claim.externalResearch?.outcome, 'not_found_after_stop_loss');
    assert.equal(claim.externalResearch?.sources?.length ?? 0, 0);
  }

  if (claim.status === 'external_search_needed') {
    assert.equal(claim.localEvidence.length, 0);
    assert.equal(claim.externalResearch, null);
  }

  if (claim.externalResearch?.outcome === 'source_found_partial_manual_review') {
    assert.equal(claim.status, 'manual_review');
  }
}

assert.deepEqual(sortedEntries(reportClaimCounts), sortedEntries(sourceClaimCounts));
assert.deepEqual(report.summary.statusCounts, statusCounts);
assert.equal(statusCounts.external_search_needed, 0);
assert.equal(sourceResearchIds.size, rawClaimCount);

for (const categoryName of categories) {
  const actual = categoryCounts[categoryName];
  const expected = report.summary.categoryCounts[categoryName];
  assert.ok(expected);
  assert.deepEqual(expected, {
    people: actual.people.size,
    claims: actual.claims,
    autoReviewable: actual.autoReviewable,
    manualReview: actual.manualReview,
    externalSearchNeeded: actual.externalSearchNeeded,
    notFoundAfterStopLoss: actual.notFoundAfterStopLoss,
  });
}

const findings = findingsReport.findings;
const findingIds = new Set();
const claimsBySourceResearchId = new Map(report.claims.flatMap((claim) => (
  sourceIdsForClaim(claim).map((researchId) => [researchId, claim])
)));
for (const finding of findings) {
  assert.ok(!findingIds.has(finding.researchId), `duplicate finding: ${finding.researchId}`);
  findingIds.add(finding.researchId);
  const claim = claimsBySourceResearchId.get(finding.researchId);
  assert.ok(claim, `finding has no report claim: ${finding.researchId}`);
  assert.ok(claim.externalResearch);
  assert.ok(finding.query);
  assert.ok([
    'source_found_manual_review',
    'source_found_partial_manual_review',
    'source_conflict_manual_review',
    'source_found_conflict_manual_review',
    'source_found_requires_update',
    'not_found_after_stop_loss',
  ].includes(finding.outcome));
  assert.ok(Array.isArray(finding.sources));
  if (finding.outcome === 'not_found_after_stop_loss') {
    assert.equal(finding.sources.length, 0);
  } else {
    assert.ok(finding.sources.length > 0);
  }
  for (const source of finding.sources) {
    assert.ok([
      'official', 'trusted_media', 'secondary', 'unknown', 'candidate_official',
      'first_party', 'institutional', 'reliable_secondary', 'other',
    ].includes(source.tier));
    assert.ok(source.name);
    assert.ok(isHttpUrl(source.url), `invalid source URL: ${source.url}`);
    assert.ok(!String(source.url).startsWith('turn'));
    assert.ok(claim.externalResearch.sources.some((combinedSource) => (
      combinedSource.tier === source.tier
      && combinedSource.url === source.url
      && combinedSource.supports === source.supports
    )), `finding source missing from combined claim: ${finding.researchId}`);
  }
}

for (const claim of report.claims) {
  if (claim.externalResearch) {
    assert.ok(
      sourceIdsForClaim(claim).some((researchId) => findingIds.has(researchId)),
      `claim finding missing from findings report: ${claim.researchId}`,
    );
  }
}

const externalFindingsWithSources = report.claims.filter((claim) => (
  (claim.externalResearch?.sources?.length ?? 0) > 0
)).length;
const externalFindingsStopLoss = report.claims.filter((claim) => (
  claim.externalResearch?.outcome === 'not_found_after_stop_loss'
)).length;
assert.equal(report.summary.externalFindingsWithSources, externalFindingsWithSources);
assert.equal(report.summary.externalFindingsStopLoss, externalFindingsStopLoss);

assert.equal(familyReport.summary.familyClaimEntries, (
  familyReport.summary.claimsWithExplicitName + familyReport.summary.claimsWithoutExplicitName
));
assert.equal(familyReport.summary.uniqueNamesFound, familyReport.found.length);
assert.equal(familyReport.summary.uniqueNamesAmbiguous, familyReport.ambiguousSameName.length);
assert.equal(familyReport.summary.uniqueNamesNotFound, familyReport.notFound.length);
assert.equal(familyReport.summary.claimsWithoutExplicitName, familyReport.claimsWithoutExplicitName.length);
const familyCanonicalPeople = new Set(
  [...familyReport.found, ...familyReport.ambiguousSameName].flatMap((entry) => (
    entry.matches.map((match) => match.canonicalPersonId)
  )),
);
assert.equal(familyReport.summary.uniqueCanonicalPeopleFound, familyCanonicalPeople.size);

assert.equal(countCsvRows(reviewCsv), report.claims.length + 1);
assert.match(summaryMarkdown, /暗公報獨立來源查核完成報告/);
assert.match(summaryMarkdown, /尚需外部搜尋：0 條/);
assert.match(summaryMarkdown, /名稱找到不等於關係成立/);

console.log(JSON.stringify({
  guideCandidates: guideCandidates.length,
  rawClaims: rawClaimCount,
  deduplicatedClaims: report.claims.length,
  statusCounts,
  externalFindingsWithSources,
  externalFindingsStopLoss,
  familySummary: familyReport.summary,
}, null, 2));
