import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isLocalSupabaseUrl } from './sync-historical-executive-sources-local.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^[\"']|[\"']$/g, '')];
      }),
  );
}

async function fetchRows(supabaseUrl, serviceRoleKey, view, params = {}) {
  const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${view}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`GET ${view} failed: ${body?.message ?? response.statusText}`);
  return body;
}

async function main() {
  const localEnv = readLocalEnv();
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!isLocalSupabaseUrl(supabaseUrl)) throw new Error(`Refusing non-local Supabase URL: ${supabaseUrl}`);
  if (!serviceRoleKey) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY.');

  const sourceRows = await fetchRows(supabaseUrl, serviceRoleKey, 'source_people', {
    select: 'source_person_key,source_type,raw_name,confidence_suggestion,is_public,source_payload',
    ingest_batch_key: 'eq.historical-executive-archive-20260810',
    limit: '500',
  });
  const summary = {
    totalSourceRows: sourceRows.length,
    localChiefRows: sourceRows.filter((row) => row.source_type === 'wikipedia').length,
    presidentialRows: sourceRows.filter((row) => row.source_type === 'official_officeholder').length,
    publicSourceRows: sourceRows.filter((row) => row.is_public).length,
    archivedRows: sourceRows.filter((row) => row.source_payload?.publicationStatus === 'archived').length,
    confidenceA: sourceRows.filter((row) => row.confidence_suggestion === 'A').length,
    confidenceC: sourceRows.filter((row) => row.confidence_suggestion === 'C').length,
  };
  if (summary.totalSourceRows !== 165) throw new Error(`Expected 165 staged rows, received ${summary.totalSourceRows}.`);
  if (summary.localChiefRows !== 165 || summary.presidentialRows !== 0) throw new Error('Unexpected source-type counts.');
  if (summary.publicSourceRows !== 0) throw new Error('Historical executive staging unexpectedly exposed public source rows.');
  if (summary.archivedRows !== 165) throw new Error('Historical executive rows are not fully archived.');
  if (summary.confidenceA !== 0 || summary.confidenceC !== 165) throw new Error('Unexpected confidence-level counts.');
  console.log(JSON.stringify({ supabaseUrl, ...summary }, null, 2));
}

main().catch((error) => {
  console.error(`Historical executive local verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exit(1);
});
