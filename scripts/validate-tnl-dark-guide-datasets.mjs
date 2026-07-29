import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(repoRoot, 'data-sources', 'tnl-dark-guide');

function fail(message) {
  throw new Error(message);
}

function load(fileName) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, fileName), 'utf8'));
}

function validateDataset(dataset, expectedYear, expectedCount) {
  if (dataset.usageScope !== 'internal_research_lead') fail(`${expectedYear}: invalid usage scope`);
  if (dataset.publicationStatus !== 'not_approved') fail(`${expectedYear}: invalid publication status`);
  if (dataset.expectedCandidateCount !== expectedCount) fail(`${expectedYear}: unexpected declared count`);
  if (dataset.candidates.length !== expectedCount) fail(`${expectedYear}: expected ${expectedCount} candidates`);

  const ids = new Set();
  for (const candidate of dataset.candidates) {
    if (candidate.year !== expectedYear) fail(`${expectedYear}: candidate year mismatch`);
    if (!candidate.id || ids.has(candidate.id)) fail(`${expectedYear}: missing or duplicate id ${candidate.id}`);
    if (!candidate.name || !candidate.party || !candidate.cityCode || !candidate.area || !candidate.pageUrl) {
      fail(`${expectedYear}: incomplete candidate ${candidate.id}`);
    }
    if (expectedYear === 2022 && !candidate.number) fail(`${expectedYear}: missing candidate number ${candidate.id}`);
    ids.add(candidate.id);
  }
}

const guide2018 = load('tnl-dark-guide-2018.json');
const guide2022 = load('tnl-dark-guide-2022.json');
validateDataset(guide2018, 2018, 748);
validateDataset(guide2022, 2022, 740);

const coveragePath = path.join(dataDir, 'coverage-report.json');
if (fs.existsSync(coveragePath)) {
  const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  if (coverage.summary?.historicalDatabase?.matchedGuideEntries !== 1488) {
    fail('Coverage report does not match all 1,488 guide entries');
  }
  if (coverage.summary?.historicalDatabase?.missingGuideEntriesInDatabase !== 0) {
    fail('Coverage report still has guide entries missing from the database');
  }
  if (coverage.summary?.historicalDatabase?.databaseCandidateContextsMissingInGuide !== 0) {
    fail('Coverage report still has historical database candidates missing from the guide');
  }
}

console.log(JSON.stringify({
  datasets: {
    2018: guide2018.candidates.length,
    2022: guide2022.candidates.length,
    total: guide2018.candidates.length + guide2022.candidates.length,
  },
  coverageReportValidated: fs.existsSync(coveragePath),
}, null, 2));
