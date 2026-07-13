import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cecSourceName = '中央選舉委員會選舉資料庫：公開資料包';
const voteTwSourceName = 'VoteTW historical election results';

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

async function fetchRows(tableName, select, params = {}) {
  const rows = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const url = restUrl(tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to fetch ${tableName}: ${body?.message ?? response.statusText}`);
    }

    rows.push(...body);
    if (body.length < pageSize) {
      return rows;
    }
  }
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

function chunk(rows, size) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function normalizeParty(value) {
  return String(value ?? '').trim();
}

function candidateGroupKey(candidate) {
  const candidateNo = String(candidate.candidate_no ?? '').trim();
  const party = normalizeParty(candidate.party);

  if (!candidate.race_id || !candidate.person_name || !candidateNo || !party) {
    return null;
  }

  return [candidate.race_id, candidate.person_name.trim(), candidateNo, party].join('|');
}

function decisionPairKey(leftPersonId, rightPersonId) {
  return [leftPersonId, rightPersonId].sort().join('|');
}

function sourceRecord(records, sourceName) {
  return records.find((record) => record.source_name === sourceName) ?? null;
}

function compactCandidate(candidate) {
  return {
    candidateId: candidate.candidate_id,
    personId: candidate.person_id,
    personName: candidate.person_name,
    personPosition: candidate.person_position,
    electionId: candidate.election_id,
    electionName: candidate.election_name,
    raceId: candidate.race_id,
    raceTitle: candidate.race_title,
    regionName: candidate.region_name,
    party: candidate.party,
    candidateNo: candidate.candidate_no,
    registrationStatus: candidate.registration_status,
    isElected: candidate.is_elected,
    voteCount: candidate.vote_count,
    voteRate: candidate.vote_rate,
    sourceName: candidate.source_name,
  };
}

function buildCandidatePairs(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const key = candidateGroupKey(candidate);
    if (!key) {
      continue;
    }
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }

  return [...groups.values()]
    .filter((records) => records.length === 2)
    .map((records) => ({
      cec: sourceRecord(records, cecSourceName),
      voteTw: sourceRecord(records, voteTwSourceName),
      records,
    }))
    .filter((group) => group.cec && group.voteTw)
    .filter((group) => group.cec.person_id !== group.voteTw.person_id);
}

function countDuplicateCandidateGroups(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const key = candidateGroupKey(candidate);
    if (!key) {
      continue;
    }
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }

  return [...groups.values()].filter((records) => records.length > 1).length;
}

function chooseRows(candidatePairs, canonicalPersonByPersonId, existingDecisions) {
  const activeDuplicatePersonIds = new Set(
    existingDecisions
      .filter((decision) => ['suggested', 'verified'].includes(decision.status))
      .map((decision) => decision.duplicate_person_id),
  );
  const terminalDecisionKeys = new Set(
    existingDecisions
      .filter((decision) => ['verified', 'rejected', 'archived'].includes(decision.status))
      .map((decision) => decisionPairKey(decision.duplicate_person_id, decision.canonical_person_id)),
  );
  const candidateRowsByDuplicateId = new Map();
  const skipped = [];

  for (const pair of candidatePairs) {
    const duplicatePersonId = pair.voteTw.person_id;
    const canonicalPersonId = canonicalPersonByPersonId.get(pair.cec.person_id) ?? pair.cec.person_id;

    if (duplicatePersonId === canonicalPersonId) {
      skipped.push({ reason: 'same canonical person', pair });
      continue;
    }

    if (activeDuplicatePersonIds.has(duplicatePersonId)) {
      skipped.push({ reason: 'duplicate person already has active decision', pair });
      continue;
    }

    if (terminalDecisionKeys.has(decisionPairKey(duplicatePersonId, canonicalPersonId))) {
      skipped.push({ reason: 'pair already has terminal decision', pair });
      continue;
    }

    const row = {
      duplicate_person_id: duplicatePersonId,
      canonical_person_id: canonicalPersonId,
      status: 'verified',
      confidence_level: 'A',
      reason: 'same race candidate matched by source pair, name, candidate number, and party',
      evidence_json: {
        rule: 'candidate_source_same_race_name_number_party',
        sourcePair: [voteTwSourceName, cecSourceName],
        voteTwCandidate: compactCandidate(pair.voteTw),
        cecCandidate: compactCandidate(pair.cec),
      },
      reviewed_by: 'system:candidate-source-person-merge',
      reviewed_at: new Date().toISOString(),
    };

    candidateRowsByDuplicateId.set(duplicatePersonId, [
      ...(candidateRowsByDuplicateId.get(duplicatePersonId) ?? []),
      row,
    ]);
  }

  const rows = [];
  const duplicatePersonConflicts = [];
  for (const [duplicatePersonId, candidateRows] of candidateRowsByDuplicateId) {
    const canonicalIds = new Set(candidateRows.map((row) => row.canonical_person_id));
    if (canonicalIds.size > 1) {
      duplicatePersonConflicts.push({ duplicatePersonId, candidateRows });
      continue;
    }
    rows.push(candidateRows[0]);
  }

  return { rows, skipped, duplicatePersonConflicts };
}

async function main() {
  if (!serviceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for candidate-source person merge decisions.');
  }

  const options = parseArgs(process.argv.slice(2));
  const [candidates, canonicalMapRows, existingDecisions] = await Promise.all([
    fetchRows(
      'public_candidates',
      'candidate_id,person_id,person_name,person_position,election_id,election_name,race_id,race_title,region_name,party,candidate_no,registration_status,is_elected,vote_count,vote_rate,source_name',
    ),
    fetchRows('person_canonical_map', 'person_id,canonical_person_id'),
    fetchRows('person_merge_decisions', 'duplicate_person_id,canonical_person_id,status'),
  ]);
  const duplicateCandidateGroupCountBefore = countDuplicateCandidateGroups(candidates);
  const canonicalPersonByPersonId = new Map(
    canonicalMapRows.map((row) => [row.person_id, row.canonical_person_id]),
  );
  const candidatePairs = buildCandidatePairs(candidates);
  const { rows, skipped, duplicatePersonConflicts } = chooseRows(
    candidatePairs,
    canonicalPersonByPersonId,
    existingDecisions,
  );

  let inserted = [];
  if (options.write) {
    for (const rowsChunk of chunk(rows, 500)) {
      inserted = [...inserted, ...await insertRows('person_merge_decisions', rowsChunk)];
    }
  }

  console.log(JSON.stringify({
    status: 'ok',
    dryRun: !options.write,
    publicCandidateCount: candidates.length,
    duplicateCandidateGroupCountBefore,
    candidateSourcePairCount: candidatePairs.length,
    rowsToInsert: rows.length,
    skippedCount: skipped.length,
    duplicatePersonConflictCount: duplicatePersonConflicts.length,
    insertedCount: inserted.length,
    sampleRows: rows.slice(0, 10),
    sampleSkipped: skipped.slice(0, 5).map((item) => ({
      reason: item.reason,
      voteTwCandidate: compactCandidate(item.pair.voteTw),
      cecCandidate: compactCandidate(item.pair.cec),
    })),
    sampleDuplicatePersonConflicts: duplicatePersonConflicts.slice(0, 5),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
