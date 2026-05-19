import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const allowedPublicViews = [
  'public_people',
  'public_companies',
  'public_relation_details',
  'public_regions',
  'public_elections',
  'public_races',
  'public_candidates',
  'public_home_election_ticker',
  'public_region_election_summary',
  'public_person_primary_photos',
  'public_parties',
  'public_party_finance_summaries',
  'public_party_company_contribution_summaries',
];

const blockedTerms = [
  'relation_candidates',
  'raw_source_records',
  'source_documents',
  'person_media',
  'pending',
  'rejected',
];

function parseEnvFile(content) {
  const env = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

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

  if (!fs.existsSync(envLocalPath)) {
    return {};
  }

  return parseEnvFile(fs.readFileSync(envLocalPath, 'utf8'));
}

function getEnvValue(name, localEnv) {
  return process.env[name]?.trim() || localEnv[name]?.trim() || '';
}

function looksLikeServiceRole(value) {
  const normalized = value.toLowerCase();
  return normalized.includes('service_role') || normalized.includes('service-role');
}

function getSmokeEnv() {
  const localEnv = loadLocalEnv();
  const url = getEnvValue('VITE_SUPABASE_URL', localEnv);
  const anonKey = getEnvValue('VITE_SUPABASE_ANON_KEY', localEnv);

  if (!url || !anonKey) {
    console.log('Skipping smoke test: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
    process.exit(0);
  }

  if (looksLikeServiceRole(anonKey)) {
    console.error('Invalid frontend Supabase key configuration. Smoke test requires an anon public key.');
    process.exit(1);
  }

  return { url, anonKey };
}

function assertAllowedViewName(viewName) {
  if (blockedTerms.includes(viewName)) {
    throw new Error(`Blocked internal data source: ${viewName}`);
  }

  if (!allowedPublicViews.includes(viewName)) {
    throw new Error(`Unsupported public view: ${viewName}`);
  }
}

async function main() {
  const { url, anonKey } = getSmokeEnv();
  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  for (const viewName of allowedPublicViews) {
    assertAllowedViewName(viewName);

    try {
      const { data, error } = await client.from(viewName).select('*').limit(1);

      if (error) {
        console.log(`${viewName}: error ${error.code ?? 'unknown'} ${error.message}`);
        continue;
      }

      console.log(`${viewName}: ok rowCount=${Array.isArray(data) ? data.length : 0}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log(`${viewName}: error runtime ${message}`);
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Smoke test aborted: ${message}`);
  process.exit(1);
});
