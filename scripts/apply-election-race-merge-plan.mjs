import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultInputPath = path.join(repoRoot, 'data-sources', 'election-race-merge-plan-report.json');

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
        const value = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '') : '';
        return [key, value];
      }),
  );
}

const localEnv = readLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY;

function parseArgs(argv) {
  const options = {
    inputPath: defaultInputPath,
    actions: new Set(['auto_merge', 'review_aggregate_source_link', 'review_merge', 'manual_review']),
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--input') {
      options.inputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--actions') {
      options.actions = new Set(String(argv[index + 1] ?? '').split(',').map((item) => item.trim()).filter(Boolean));
      index += 1;
      continue;
    }

    if (arg === '--write') {
      options.write = true;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  const allowedActions = new Set(['auto_merge', 'review_aggregate_source_link', 'review_merge', 'manual_review']);
  for (const action of options.actions) {
    if (!allowedActions.has(action)) {
      throw new Error(`Unsupported action: ${action}`);
    }
  }

  return options;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing merge plan: ${filePath}. Run npm run plan:election-race-merges first.`);
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function restUrl(pathname) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`);
}

async function fetchRows(tableName, select) {
  const url = restUrl(tableName);
  url.searchParams.set('select', select);

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

function decisionKey(duplicateId, canonicalId, relationType) {
  return `${duplicateId}|${canonicalId}|${relationType}`;
}

function buildReason(item, targetKind) {
  const type = targetKind === 'election' ? item.semanticType : item.semanticRaceType;
  return `${item.action}: ${item.year} ${type}`;
}

function buildElectionRows(plan, options) {
  return (plan.electionMergePlan ?? [])
    .filter((item) => options.actions.has(item.action))
    .map((item) => ({
      duplicate_election_id: item.duplicateElection.id,
      canonical_election_id: item.canonicalElection.id,
      relation_type: item.proposedDecision.relationType,
      status: item.proposedDecision.status,
      confidence_level: item.proposedDecision.confidenceLevel,
      reason: buildReason(item, 'election'),
      evidence_json: {
        action: item.action,
        year: item.year,
        semanticType: item.semanticType,
        canonicalElection: item.canonicalElection,
        duplicateElection: item.duplicateElection,
        evidence: item.evidence,
        notes: item.notes ?? null,
      },
      reviewed_by: null,
      reviewed_at: null,
    }));
}

function buildRaceRows(plan, options) {
  return (plan.raceMergePlan ?? [])
    .filter((item) => options.actions.has(item.action))
    .map((item) => ({
      duplicate_race_id: item.duplicateRace.id,
      canonical_race_id: item.canonicalRace.id,
      relation_type: item.proposedDecision.relationType,
      status: item.proposedDecision.status,
      confidence_level: item.proposedDecision.confidenceLevel,
      reason: buildReason(item, 'race'),
      evidence_json: {
        action: item.action,
        year: item.year,
        semanticRaceType: item.semanticRaceType,
        canonicalRace: item.canonicalRace,
        duplicateRace: item.duplicateRace,
        evidence: item.evidence,
      },
      reviewed_by: null,
      reviewed_at: null,
    }));
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) {
    counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  }
  return counts;
}

function confidenceRank(level) {
  return { A: 0, B: 1, C: 2, D: 3 }[level] ?? 9;
}

function candidateOverlapCount(row) {
  return row.evidence_json?.evidence?.candidateOverlap?.count ?? 0;
}

function compareDecisionRows(left, right) {
  return confidenceRank(left.confidence_level) - confidenceRank(right.confidence_level) ||
    candidateOverlapCount(right) - candidateOverlapCount(left) ||
    String(left.reason ?? '').localeCompare(String(right.reason ?? ''));
}

function selectBestRowsByDuplicate(rows, duplicateKey) {
  const bestByDuplicate = new Map();
  let internalDuplicateCount = 0;

  for (const row of rows) {
    const duplicateId = row[duplicateKey];
    const existing = bestByDuplicate.get(duplicateId);
    if (!existing) {
      bestByDuplicate.set(duplicateId, row);
      continue;
    }

    internalDuplicateCount += 1;
    if (compareDecisionRows(row, existing) < 0) {
      bestByDuplicate.set(duplicateId, row);
    }
  }

  return {
    rows: Array.from(bestByDuplicate.values()),
    internalDuplicateCount,
  };
}

function summarizeRows(rows, relationKey, confidenceKey, internalDuplicateCount = 0) {
  return {
    count: rows.length,
    internalDuplicateCount,
    relationTypeCounts: countBy(rows, relationKey),
    confidenceLevelCounts: countBy(rows, confidenceKey),
  };
}

function filterElectionRowsForWrite(rows, existingRows) {
  const activeDuplicateIds = new Set(existingRows
    .filter((item) => ['suggested', 'verified'].includes(item.status))
    .map((item) => item.duplicate_election_id));
  const terminalKeys = new Set(existingRows
    .filter((item) => ['rejected', 'archived'].includes(item.status))
    .map((item) => decisionKey(item.duplicate_election_id, item.canonical_election_id, item.relation_type)));

  return rows.filter((row) => {
    if (activeDuplicateIds.has(row.duplicate_election_id)) return false;
    return !terminalKeys.has(decisionKey(row.duplicate_election_id, row.canonical_election_id, row.relation_type));
  });
}

function filterRaceRowsForWrite(rows, existingRows) {
  const activeDuplicateIds = new Set(existingRows
    .filter((item) => ['suggested', 'verified'].includes(item.status))
    .map((item) => item.duplicate_race_id));
  const terminalKeys = new Set(existingRows
    .filter((item) => ['rejected', 'archived'].includes(item.status))
    .map((item) => decisionKey(item.duplicate_race_id, item.canonical_race_id, item.relation_type)));

  return rows.filter((row) => {
    if (activeDuplicateIds.has(row.duplicate_race_id)) return false;
    return !terminalKeys.has(decisionKey(row.duplicate_race_id, row.canonical_race_id, row.relation_type));
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = readJson(options.inputPath);
  const electionRowsRaw = buildElectionRows(plan, options);
  const raceRowsRaw = buildRaceRows(plan, options);
  const electionSelection = selectBestRowsByDuplicate(electionRowsRaw, 'duplicate_election_id');
  const raceSelection = selectBestRowsByDuplicate(raceRowsRaw, 'duplicate_race_id');
  const electionRows = electionSelection.rows;
  const raceRows = raceSelection.rows;

  if (!options.write) {
    console.log(JSON.stringify({
      status: 'ok',
      dryRun: true,
      inputPath: options.inputPath,
      selectedActions: Array.from(options.actions).sort(),
      electionRows: summarizeRows(electionRows, 'relation_type', 'confidence_level', electionSelection.internalDuplicateCount),
      raceRows: summarizeRows(raceRows, 'relation_type', 'confidence_level', raceSelection.internalDuplicateCount),
      sampleElectionRows: electionRows.slice(0, 5),
      sampleRaceRows: raceRows.slice(0, 5),
    }, null, 2));
    return;
  }

  if (!serviceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for writing election/race merge decisions.');
  }

  const [existingElectionRows, existingRaceRows] = await Promise.all([
    fetchRows('election_merge_decisions', 'duplicate_election_id,canonical_election_id,relation_type,status'),
    fetchRows('race_merge_decisions', 'duplicate_race_id,canonical_race_id,relation_type,status'),
  ]);
  const electionRowsToInsert = filterElectionRowsForWrite(electionRows, existingElectionRows);
  const raceRowsToInsert = filterRaceRowsForWrite(raceRows, existingRaceRows);
  const [insertedElectionRows, insertedRaceRows] = await Promise.all([
    insertRows('election_merge_decisions', electionRowsToInsert),
    insertRows('race_merge_decisions', raceRowsToInsert),
  ]);

  console.log(JSON.stringify({
    status: 'ok',
    dryRun: false,
    inputPath: options.inputPath,
    selectedActions: Array.from(options.actions).sort(),
    existingElectionDecisionCount: existingElectionRows.length,
    existingRaceDecisionCount: existingRaceRows.length,
    plannedElectionRows: electionRows.length,
    plannedRaceRows: raceRows.length,
    internalDuplicateElectionRows: electionSelection.internalDuplicateCount,
    internalDuplicateRaceRows: raceSelection.internalDuplicateCount,
    insertedElectionRows: insertedElectionRows.length,
    insertedRaceRows: insertedRaceRows.length,
    skippedElectionRows: electionRows.length - electionRowsToInsert.length,
    skippedRaceRows: raceRows.length - raceRowsToInsert.length,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`election/race merge plan apply failed: ${message}`);
  process.exit(1);
});
