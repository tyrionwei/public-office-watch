import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CEC_SOURCE_PREFIX = '中央選舉委員會';
const VOTETW_SOURCE_PREFIX = 'VoteTW historical election results';

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');

  if (!fs.existsSync(envPath)) {
    return {};
  }

  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        const key = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : line;
        const value = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '') : '';
        return [key, value];
      }),
  );
}

function parseArgs(argv) {
  const options = { write: false };

  for (const arg of argv) {
    if (arg === '--write') {
      options.write = true;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  return options;
}

const localEnv = readLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY;

function restUrl(pathname) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`);
}

async function fetchRows(viewName, params) {
  const url = restUrl(viewName);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to fetch ${viewName}: ${body?.message ?? response.statusText}`);
  }

  return body;
}

async function insertRows(tableName, rows) {
  if (rows.length === 0) {
    return [];
  }

  const response = await fetch(restUrl(tableName), {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to insert ${tableName}: ${body?.message ?? response.statusText}`);
  }

  return body;
}

async function callRpc(functionName) {
  const response = await fetch(restUrl('rpc/' + functionName), {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: 'Bearer ' + serviceRoleKey,
      'content-type': 'application/json',
    },
    body: '{}',
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const body = await response.json();
    throw new Error('Failed to call ' + functionName + ': ' + (body?.message ?? response.statusText));
  }
}

function decisionKey(leftPersonId, rightPersonId) {
  return [leftPersonId, rightPersonId].sort().join('|');
}

function candidateKey(candidate) {
  return [
    candidate.election_id,
    candidate.race_id,
    candidate.candidate_no ?? '',
    candidate.person_name,
  ].join('|');
}

function normalizedParty(candidate) {
  return (candidate.party ?? '').replaceAll('臺', '台').replace(/\s+/g, '').trim();
}

function buildMergeRows(candidates, decisions) {
  const groups = new Map();
  const verifiedCanonicalByDuplicateId = new Map(
    decisions
      .filter((decision) => decision.status === 'verified')
      .map((decision) => [decision.duplicate_person_id, decision.canonical_person_id]),
  );
  const terminalDecisionKeys = new Set(
    decisions
      .filter((decision) => ['verified', 'rejected', 'archived'].includes(decision.status))
      .map((decision) => decisionKey(decision.duplicate_person_id, decision.canonical_person_id)),
  );
  const activeDuplicatePersonIds = new Set(
    decisions
      .filter((decision) => ['suggested', 'verified'].includes(decision.status))
      .map((decision) => decision.duplicate_person_id),
  );

  for (const candidate of candidates) {
    groups.set(candidateKey(candidate), [...(groups.get(candidateKey(candidate)) ?? []), candidate]);
  }

  const rows = [];
  const skipped = [];

  for (const group of groups.values()) {
    const uniquePersonIds = new Set(group.map((candidate) => candidate.person_id));

    if (group.length < 2 || uniquePersonIds.size < 2) {
      continue;
    }

    const cec = group.find((candidate) => candidate.source_name?.startsWith(CEC_SOURCE_PREFIX));
    const votetw = group.find((candidate) => candidate.source_name?.startsWith(VOTETW_SOURCE_PREFIX));

    if (!cec || !votetw || group.length !== 2) {
      skipped.push({ reason: 'not_exact_cec_votetw_pair', group });
      continue;
    }

    if (!cec.candidate_no || cec.candidate_no !== votetw.candidate_no || normalizedParty(cec) !== normalizedParty(votetw)) {
      skipped.push({ reason: 'candidate_number_or_party_mismatch', group });
      continue;
    }

    const pairKey = decisionKey(cec.person_id, votetw.person_id);
    if (terminalDecisionKeys.has(pairKey)) {
      skipped.push({ reason: 'terminal_decision_exists', group });
      continue;
    }

    const canonicalPersonId = verifiedCanonicalByDuplicateId.get(cec.person_id) ?? cec.person_id;
    const duplicatePersonId = votetw.person_id;

    if (activeDuplicatePersonIds.has(duplicatePersonId)) {
      skipped.push({ reason: 'duplicate_person_already_active', group });
      continue;
    }

    rows.push({
      duplicate_person_id: duplicatePersonId,
      canonical_person_id: canonicalPersonId,
      status: 'verified',
      confidence_level: 'A',
      reason: 'same 2024 candidate identity across CEC and VoteTW election results',
      evidence_json: {
        electionId: cec.election_id,
        electionName: cec.election_name,
        raceId: cec.race_id,
        raceTitle: cec.race_title,
        candidateNo: cec.candidate_no,
        candidateName: cec.person_name,
        party: cec.party,
        cecPersonId: cec.person_id,
        votetwPersonId: votetw.person_id,
        sources: [cec.source_name, votetw.source_name],
      },
      reviewed_by: 'system:2024-candidate-identity-merge',
      reviewed_at: new Date().toISOString(),
    });
  }

  return { rows, skipped };
}

async function main() {
  if (!serviceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for 2024 candidate person merge decisions.');
  }

  const options = parseArgs(process.argv.slice(2));
  const elections = await fetchRows('public_elections', {
    select: 'election_id,name,year,election_type',
    year: 'eq.2024',
    limit: '100',
  });
  const electionIds = elections.map((election) => election.election_id);

  if (electionIds.length === 0) {
    throw new Error('No 2024 public elections found.');
  }

  const [candidates, decisions] = await Promise.all([
    fetchRows('public_candidates', {
      select: 'candidate_id,person_id,person_name,race_id,race_title,election_id,election_name,party,candidate_no,source_name',
      election_id: `in.(${electionIds.join(',')})`,
      limit: '2000',
    }),
    fetchRows('person_merge_decisions', {
      select: 'duplicate_person_id,canonical_person_id,status',
      limit: '10000',
    }),
  ]);
  const { rows, skipped } = buildMergeRows(candidates, decisions);

  if (options.write) {
    const inserted = await insertRows('person_merge_decisions', rows);
    await callRpc('refresh_public_people_list_cached');
    console.log(JSON.stringify({
      status: 'ok',
      dryRun: false,
      electionCount: elections.length,
      candidateCount: candidates.length,
      plannedRowCount: rows.length,
      insertedCount: inserted.length,
      skippedCount: skipped.length,
      skipped,
    }, null, 2));
    return;
  }

  console.log(JSON.stringify({
    status: 'ok',
    dryRun: true,
    electionCount: elections.length,
    candidateCount: candidates.length,
    plannedRowCount: rows.length,
    skippedCount: skipped.length,
    sampleRows: rows.slice(0, 20),
    skipped,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`2024 candidate person merge decision apply failed: ${message}`);
  process.exit(1);
});
