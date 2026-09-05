import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidacyStatuses = new Set([
  'potential',
  'party_nominee',
  'officially_announced',
  'registered',
  'qualified',
  'withdrawn_or_disqualified',
  'did_not_register',
  'unknown',
]);
const electionResults = new Set(['pending', 'elected', 'not_elected', 'unknown']);
const blockingIssueNames = [
  'invalidCandidacyStatus',
  'invalidElectionResult',
  'legacyResultContradiction',
  'finalResultBeforeCompletion',
  'completedRaceWithoutResult',
  'finalResultWithoutQualification',
  'electedAfterWithdrawal',
  'missingRace',
  'missingStatusUpdatedAt',
];

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};

  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        const key = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : line;
        const value = separatorIndex >= 0
          ? line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '')
          : '';
        return [key, value];
      }),
  );
}

async function fetchRows(supabaseUrl, serviceRoleKey, tableName, select) {
  const pageSize = 1000;
  const rows = [];

  while (true) {
    const pageStart = rows.length;
    const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`);
    url.searchParams.set('select', select);
    url.searchParams.set('order', 'id.asc');

    const response = await fetch(url, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        range: `${pageStart}-${pageStart + pageSize - 1}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to fetch ${tableName}: ${body?.message ?? response.statusText}`);
    }
    if (!Array.isArray(body) || body.length === 0) break;

    rows.push(...body);
    if (body.length < pageSize) break;
  }

  return rows;
}

function increment(counts, value) {
  const key = value ?? '<null>';
  counts[key] = (counts[key] ?? 0) + 1;
}

function addIssue(issues, name, candidate, detail) {
  const issue = issues[name] ?? { count: 0, samples: [] };
  issue.count += 1;
  if (issue.samples.length < 10) {
    issue.samples.push({ candidateId: candidate.id, raceId: candidate.race_id, detail });
  }
  issues[name] = issue;
}

export function auditCandidateStatuses(candidates, races) {
  const racesById = new Map(races.map((race) => [race.id, race]));
  const candidacyStatusCounts = {};
  const electionResultCounts = {};
  const issues = {};

  for (const candidate of candidates) {
    increment(candidacyStatusCounts, candidate.candidacy_status);
    increment(electionResultCounts, candidate.election_result);

    const race = racesById.get(candidate.race_id);
    const isFinalResult = ['elected', 'not_elected'].includes(candidate.election_result);

    if (!candidacyStatuses.has(candidate.candidacy_status)) {
      addIssue(issues, 'invalidCandidacyStatus', candidate, candidate.candidacy_status);
    }
    if (!electionResults.has(candidate.election_result)) {
      addIssue(issues, 'invalidElectionResult', candidate, candidate.election_result);
    }
    if (!race) {
      addIssue(issues, 'missingRace', candidate, null);
    } else if (race.status === 'completed' && !isFinalResult) {
      addIssue(issues, 'completedRaceWithoutResult', candidate, candidate.election_result);
    } else if (race.status !== 'completed' && isFinalResult) {
      addIssue(issues, 'finalResultBeforeCompletion', candidate, race.status);
    }
    if (isFinalResult && candidate.candidacy_status !== 'qualified') {
      addIssue(issues, 'finalResultWithoutQualification', candidate, candidate.candidacy_status);
    }
    if (candidate.candidacy_status === 'withdrawn_or_disqualified' && candidate.election_result === 'elected') {
      addIssue(issues, 'electedAfterWithdrawal', candidate, null);
    }
    if ((candidate.election_result === 'elected' && candidate.is_elected === false)
      || (candidate.election_result === 'not_elected' && candidate.is_elected === true)) {
      addIssue(issues, 'legacyResultContradiction', candidate, candidate.is_elected);
    }
    if (isFinalResult && candidate.is_elected === null) {
      addIssue(issues, 'legacyResultMissing', candidate, candidate.registration_status);
    }
    if (!candidate.status_updated_at) {
      addIssue(issues, 'missingStatusUpdatedAt', candidate, null);
    }
    if (!candidate.source_name || !candidate.source_url) {
      addIssue(issues, 'missingSource', candidate, null);
    }
  }

  return {
    candidateCount: candidates.length,
    raceCount: races.length,
    candidacyStatusCounts,
    electionResultCounts,
    blockingIssueCount: blockingIssueNames.reduce((total, name) => total + (issues[name]?.count ?? 0), 0),
    issues,
  };
}

async function main() {
  const localEnv = readLocalEnv();
  const supabaseUrl = process.env.SUPABASE_URL?.trim()
    || localEnv.SUPABASE_URL
    || 'http://127.0.0.1:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || localEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

  const [candidates, races] = await Promise.all([
    fetchRows(
      supabaseUrl,
      serviceRoleKey,
      'candidates',
      'id,race_id,candidacy_status,election_result,status_updated_at,registration_status,is_elected,source_name,source_url',
    ),
    fetchRows(supabaseUrl, serviceRoleKey, 'races', 'id,status'),
  ]);
  const report = auditCandidateStatuses(candidates, races);
  console.log(JSON.stringify(report, null, 2));
  if (report.blockingIssueCount > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
