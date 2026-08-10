import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localChiefPath = path.join(repoRoot, 'data-sources', 'historical-local-chief-winners-1950-1993.raw.json');

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

export function normalize(value) {
  return String(value ?? '').normalize('NFKC').replaceAll('台', '臺').replace(/\s+/g, '').trim();
}

function stableKey(prefix, value) {
  return `${prefix}:${crypto.createHash('sha1').update(value).digest('hex').slice(0, 16)}`;
}

export function isLocalSupabaseUrl(value) {
  const url = new URL(value);
  return ['127.0.0.1', 'localhost'].includes(url.hostname);
}

export function buildHistoricalChiefRows(source) {
  const recordsByName = new Map();
  for (const record of source.records) {
    const key = normalize(record.name);
    const group = recordsByName.get(key) ?? [];
    group.push(record);
    recordsByName.set(key, group);
  }
  return [...recordsByName.entries()].map(([normalizedName, records]) => {
    const regions = [...new Set(records.map((record) => record.historicalRegionName))];
    return {
      source_person_key: stableKey('wikipedia:historical-local-chief', normalizedName),
      source_type: 'wikipedia',
      source_id: 'wikipedia-historical-local-chief-index',
      source_name: '中文維基百科歷史縣市長選舉條目（待官方覆核）',
      source_url: records[0].sourceUrl,
      raw_name: records[0].name,
      normalized_name: normalizedName,
      party: records.at(-1).party,
      normalized_party: normalize(records.at(-1).party),
      position: '歷史縣市長當選人（待官方覆核）',
      normalized_role: 'local_chief',
      district: regions.join('、'),
      normalized_region: regions.map(normalize).join('|'),
      election_year: Math.min(...records.map((record) => record.electionYear)),
      source_payload: {
        verificationStatus: 'research_lead',
        publicationStatus: 'archived',
        historicalRegions: regions,
        electionRecords: records,
      },
      confidence_suggestion: 'C',
      ingest_batch_key: 'historical-executive-archive-20260810',
      is_public: false,
      updated_at: new Date().toISOString(),
    };
  });
}

async function upsertRows(supabaseUrl, serviceRoleKey, rows) {
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/source_people?on_conflict=source_person_key`;
  for (let offset = 0; offset < rows.length; offset += 100) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows.slice(offset, offset + 100)),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`source_people upsert failed: ${await response.text()}`);
  }
}

async function main() {
  const localEnv = readLocalEnv();
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!isLocalSupabaseUrl(supabaseUrl)) throw new Error(`Refusing non-local Supabase URL: ${supabaseUrl}`);
  if (!serviceRoleKey) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY.');
  const localChiefSource = JSON.parse(fs.readFileSync(localChiefPath, 'utf8'));
  const localChiefRows = buildHistoricalChiefRows(localChiefSource);
  await upsertRows(supabaseUrl, serviceRoleKey, localChiefRows);
  console.log(JSON.stringify({
    supabaseUrl,
    localChiefSourcePersonCount: localChiefRows.length,
    totalUpserted: localChiefRows.length,
    isPublic: false,
  }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Historical executive local sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  });
}
