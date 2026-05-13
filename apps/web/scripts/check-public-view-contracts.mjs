import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const allowedPublicViews = {
  public_people: ['person_id', 'name', 'updated_at'],
  public_companies: ['company_id', 'name', 'updated_at'],
  public_relation_details: ['relation_id', 'person_id', 'company_id', 'relation_type', 'verification_status'],
  public_regions: ['region_id', 'name', 'slug', 'region_type'],
  public_elections: ['election_id', 'name', 'election_type', 'status'],
  public_races: ['race_id', 'election_id', 'title', 'status'],
  public_candidates: ['candidate_id', 'person_id', 'race_id', 'election_id', 'registration_status'],
  public_home_election_ticker: ['election_id', 'election_name', 'voting_date', 'status'],
  public_region_election_summary: ['region_id', 'region_name', 'region_slug', 'upcoming_race_count'],
  public_person_primary_photos: ['person_id', 'media_id', 'photo_url', 'source_name'],
};

function parseEnvFile(content) {
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
  return env;
}

function loadLocalEnv() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const webRoot = path.resolve(currentDir, '..');
  const envLocalPath = path.join(webRoot, '.env.local');
  if (!fs.existsSync(envLocalPath)) return {};
  return parseEnvFile(fs.readFileSync(envLocalPath, 'utf8'));
}

function getEnvValue(name, localEnv) {
  return process.env[name]?.trim() || localEnv[name]?.trim() || '';
}

function looksLikeServiceRole(value) {
  const normalized = value.toLowerCase();
  return normalized.includes('service_role') || normalized.includes('service-role');
}

function getContractCheckEnv() {
  const localEnv = loadLocalEnv();
  const url = getEnvValue('VITE_SUPABASE_URL', localEnv);
  const anonKey = getEnvValue('VITE_SUPABASE_ANON_KEY', localEnv);

  if (!url || !anonKey) {
    console.log('Skipping public view contract check: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
    process.exit(0);
  }

  if (looksLikeServiceRole(anonKey)) {
    console.error('Invalid frontend Supabase key configuration. Contract check requires an anon public key.');
    process.exit(1);
  }

  return { url, anonKey };
}

async function main() {
  const { url, anonKey } = getContractCheckEnv();
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let failed = false;

  for (const [viewName, requiredFields] of Object.entries(allowedPublicViews)) {
    try {
      const { data, error } = await client.from(viewName).select('*').limit(1);

      if (error) {
        failed = true;
        console.log(`${viewName}: failed rowCount=0 ${error.code ?? 'unknown'} ${error.message}`);
        continue;
      }

      const rowCount = Array.isArray(data) ? data.length : 0;
      const firstRow = rowCount > 0 ? data[0] : null;
      const missingFields = firstRow
        ? requiredFields.filter((field) => !(field in firstRow))
        : [];

      if (missingFields.length > 0) {
        failed = true;
        console.log(`${viewName}: failed rowCount=${rowCount} missing-fields ${missingFields.join(',')}`);
        continue;
      }

      console.log(`${viewName}: ok rowCount=${rowCount}`);
    } catch (error) {
      failed = true;
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log(`${viewName}: failed rowCount=0 runtime ${message}`);
    }
  }

  if (failed) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Public view contract check aborted: ${message}`);
  process.exit(1);
});
