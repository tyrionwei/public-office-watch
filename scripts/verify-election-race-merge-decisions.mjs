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
        const value = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '') : '';
        return [key, value];
      }),
  );
}

const localEnv = readLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY;

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

function restUrl(pathname) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`);
}

async function fetchRows(tableName, select, filters = {}) {
  const url = restUrl(tableName);
  url.searchParams.set('select', select);
  for (const [key, value] of Object.entries(filters)) {
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

  return body;
}

async function updateRows(tableName, filters) {
  const url = restUrl(tableName);
  for (const [key, value] of Object.entries(filters)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: JSON.stringify({
      status: 'verified',
      reviewed_by: 'system:election-race-auto-merge-a',
      reviewed_at: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to update ${tableName}: ${body?.message ?? response.statusText}`);
  }

  return body;
}

const eligibleFilters = {
  relation_type: 'in.(same_election,same_race)',
  status: 'eq.suggested',
  confidence_level: 'eq.A',
};

async function main() {
  if (!serviceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for election/race merge verification.');
  }

  const options = parseArgs(process.argv.slice(2));
  const [eligibleElectionRows, eligibleRaceRows] = await Promise.all([
    fetchRows('election_merge_decisions', 'id,duplicate_election_id,canonical_election_id,relation_type,status,confidence_level,reason', eligibleFilters),
    fetchRows('race_merge_decisions', 'id,duplicate_race_id,canonical_race_id,relation_type,status,confidence_level,reason', eligibleFilters),
  ]);

  if (!options.write) {
    console.log(JSON.stringify({
      status: 'ok',
      dryRun: true,
      eligibleElectionRows: eligibleElectionRows.length,
      eligibleRaceRows: eligibleRaceRows.length,
      sampleElectionRows: eligibleElectionRows.slice(0, 5),
      sampleRaceRows: eligibleRaceRows.slice(0, 5),
    }, null, 2));
    return;
  }

  const [verifiedElectionRows, verifiedRaceRows] = await Promise.all([
    updateRows('election_merge_decisions', eligibleFilters),
    updateRows('race_merge_decisions', eligibleFilters),
  ]);

  console.log(JSON.stringify({
    status: 'ok',
    dryRun: false,
    verifiedElectionRows: verifiedElectionRows.length,
    verifiedRaceRows: verifiedRaceRows.length,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`election/race merge verification failed: ${message}`);
  process.exit(1);
});
