import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.join(repoRoot, 'data-sources', 'historical-local-chief-identity-coverage.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const visibleResolutions = new Set([
  'unique_local_chief_match',
  'ambiguous_name_unique_local_chief_match',
  'unique_name_needs_review',
  'ambiguous_match',
]);

const entries = report.entries
  .filter((entry) => visibleResolutions.has(entry.resolution))
  .map((entry) => ({
    name: entry.name,
    sourceRegions: entry.sourceRegions,
    resolution: entry.resolution,
    matchCount: entry.matches.length,
    matches: entry.matches.map((match) => ({
      personId: match.person_id,
      name: match.name,
      district: match.district,
      position: match.position,
      electionHistory: match.electionHistory.map((record) => ({
        electionYear: record.election_year,
        regionName: record.region_name,
        raceTitle: record.race_title,
        isElected: record.is_elected,
      })),
    })),
  }));

console.log(JSON.stringify({ summary: report.summary, entries }, null, 2));
