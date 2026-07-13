import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cyclicAutoReason = 'same 2024 candidate identity across CEC and VoteTW election results';

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

async function patchDecision(decision) {
  const url = restUrl('person_merge_decisions');
  url.searchParams.set('id', `eq.${decision.id}`);

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: JSON.stringify({
      status: 'archived',
      reason: `${decision.reason} (archived to break verified person merge cycle)`,
      reviewed_by: 'system:archive-cyclic-person-merge',
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to archive decision ${decision.id}: ${body?.message ?? response.statusText}`);
  }

  return body[0] ?? null;
}

function detectCycles(decisions) {
  const decisionByDuplicateId = new Map(decisions.map((decision) => [decision.duplicate_person_id, decision]));
  const cycles = [];
  const seenCycleKeys = new Set();

  for (const startPersonId of decisionByDuplicateId.keys()) {
    const path = [];
    const indexByPersonId = new Map();
    let currentPersonId = startPersonId;

    while (decisionByDuplicateId.has(currentPersonId)) {
      if (indexByPersonId.has(currentPersonId)) {
        const cyclePersonIds = path.slice(indexByPersonId.get(currentPersonId));
        const cycleKey = cyclePersonIds.slice().sort().join('|');
        if (!seenCycleKeys.has(cycleKey)) {
          seenCycleKeys.add(cycleKey);
          cycles.push(cyclePersonIds.map((personId) => decisionByDuplicateId.get(personId)).filter(Boolean));
        }
        break;
      }

      indexByPersonId.set(currentPersonId, path.length);
      path.push(currentPersonId);
      currentPersonId = decisionByDuplicateId.get(currentPersonId).canonical_person_id;
    }
  }

  return cycles;
}

function chooseCycleBreaks(cycles) {
  const rows = [];
  const unsupportedCycles = [];

  for (const cycle of cycles) {
    const candidates = cycle.filter((decision) => decision.reason === cyclicAutoReason);
    if (candidates.length !== 1) {
      unsupportedCycles.push(cycle);
      continue;
    }
    rows.push(candidates[0]);
  }

  return { rows, unsupportedCycles };
}

async function main() {
  if (!serviceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for cyclic person merge cleanup.');
  }

  const options = parseArgs(process.argv.slice(2));
  const decisions = await fetchRows(
    'person_merge_decisions',
    'id,duplicate_person_id,canonical_person_id,status,confidence_level,reason,created_at,updated_at',
    { status: 'eq.verified' },
  );
  const cycles = detectCycles(decisions);
  const { rows, unsupportedCycles } = chooseCycleBreaks(cycles);
  let archived = [];

  if (options.write) {
    for (const row of rows) {
      archived.push(await patchDecision(row));
    }
  }

  console.log(JSON.stringify({
    status: 'ok',
    dryRun: !options.write,
    verifiedDecisionCount: decisions.length,
    cycleCount: cycles.length,
    rowsToArchive: rows.length,
    unsupportedCycleCount: unsupportedCycles.length,
    archivedCount: archived.length,
    sampleRowsToArchive: rows.slice(0, 10),
    sampleUnsupportedCycles: unsupportedCycles.slice(0, 5),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
