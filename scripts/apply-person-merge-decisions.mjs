import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

const localEnv = readLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY;

function parseArgs(argv) {
  const options = {
    confidenceLevel: 'A',
    status: 'verified',
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--confidence-level') {
      options.confidenceLevel = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg === '--status') {
      options.status = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg === '--write') {
      options.write = true;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  if (!['A', 'B', 'C', 'D'].includes(options.confidenceLevel)) {
    throw new Error('--confidence-level must be A, B, C, or D.');
  }

  if (!['suggested', 'verified'].includes(options.status)) {
    throw new Error('--status must be suggested or verified.');
  }

  return options;
}

function restUrl(pathname) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`);
}

async function fetchRows(viewName, select) {
  const url = restUrl(viewName);
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
    throw new Error(`Failed to fetch ${viewName}: ${body?.message ?? response.statusText}`);
  }

  return body;
}

async function insertRows(viewName, rows) {
  if (rows.length === 0) {
    return [];
  }

  const response = await fetch(restUrl(viewName), {
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
    throw new Error(`Failed to insert ${viewName}: ${body?.message ?? response.statusText}`);
  }

  return body;
}

function decisionKey(leftPersonId, rightPersonId) {
  return [leftPersonId, rightPersonId].sort().join('|');
}

async function main() {
  if (!serviceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for person merge decisions.');
  }

  const options = parseArgs(process.argv.slice(2));
  const [queue, decisions] = await Promise.all([
    fetchRows('person_duplicate_review_queue', 'duplicate_person_id,duplicate_person_name,canonical_person_id,canonical_person_name,reason,confidence_level,score,evidence_json'),
    fetchRows('person_merge_decisions', 'duplicate_person_id,canonical_person_id,status'),
  ]);
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
  const candidates = queue
    .filter((item) => item.confidence_level === options.confidenceLevel)
    .filter((item) => !terminalDecisionKeys.has(decisionKey(item.duplicate_person_id, item.canonical_person_id)))
    .filter((item) => !activeDuplicatePersonIds.has(item.duplicate_person_id));
  const rows = candidates.map((item) => ({
    duplicate_person_id: item.duplicate_person_id,
    canonical_person_id: item.canonical_person_id,
    status: options.status,
    confidence_level: item.confidence_level,
    reason: item.reason,
    evidence_json: item.evidence_json ?? {},
    reviewed_by: options.status === 'verified' ? 'system:canonical-auto-merge-current' : null,
    reviewed_at: options.status === 'verified' ? new Date().toISOString() : null,
  }));

  if (options.write) {
    const inserted = await insertRows('person_merge_decisions', rows);
    console.log(JSON.stringify({
      status: 'ok',
      dryRun: false,
      confidenceLevel: options.confidenceLevel,
      decisionStatus: options.status,
      candidateCount: candidates.length,
      insertedCount: inserted.length,
      inserted,
    }, null, 2));
    return;
  }

  console.log(JSON.stringify({
    status: 'ok',
    dryRun: true,
    confidenceLevel: options.confidenceLevel,
    decisionStatus: options.status,
    queueCount: queue.length,
    existingDecisionCount: decisions.length,
    candidateCount: candidates.length,
    candidates,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`person merge decision apply failed: ${message}`);
  process.exit(1);
});
