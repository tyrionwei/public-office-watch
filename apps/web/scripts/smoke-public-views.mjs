import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const allowedPublicViews = [
  'public_people_list_cached',
  'public_companies',
  'public_relation_details',
  'public_regions',
  'public_elections',
  'public_races',
  'public_candidates',
  'public_home_election_ticker',
  'public_region_election_summary',
  'public_person_primary_photos',
  'public_person_identity_sources',
  'public_person_claims',
  'public_person_party_affiliations',
  'public_person_party_events',
  'public_party_officers',
  'public_people_directory',
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
  const [raceAnchorResponse, personAnchorResponse] = await Promise.all([
    client.from('public_races').select('race_id').limit(1),
    client
      .from('public_people_list_cached')
      .select('person_id')
      .eq('list_is_grassroots', false)
      .limit(1),
  ]);
  const anchorRaceId = raceAnchorResponse.data?.[0]?.race_id;
  const anchorPersonId = personAnchorResponse.data?.[0]?.person_id;

  if (raceAnchorResponse.error || !anchorRaceId) {
    throw raceAnchorResponse.error ?? new Error('Public races does not contain an anchor race.');
  }
  if (personAnchorResponse.error || !anchorPersonId) {
    throw personAnchorResponse.error ?? new Error('Public people does not contain an anchor person.');
  }

  const failedViews = [];
  const personScopedViews = new Set([
    'public_relation_details',
    'public_person_primary_photos',
    'public_person_identity_sources',
    'public_person_claims',
    'public_person_party_affiliations',
    'public_person_party_events',
  ]);

  for (const viewName of allowedPublicViews) {
    assertAllowedViewName(viewName);

    try {
      let request = client.from(viewName).select('*');
      if (viewName === 'public_candidates') {
        request = request.eq('race_id', anchorRaceId);
      }
      if (personScopedViews.has(viewName)) {
        request = request.eq('person_id', anchorPersonId);
      }
      const { data, error } = await request.limit(1);

      if (error) {
        failedViews.push(viewName);
        console.error(`${viewName}: error ${error.code ?? 'unknown'} ${error.message}`);
        continue;
      }

      console.log(`${viewName}: ok rowCount=${Array.isArray(data) ? data.length : 0}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      failedViews.push(viewName);
      console.error(`${viewName}: error runtime ${message}`);
    }
  }

  if (failedViews.length > 0) {
    throw new Error(`Public view smoke failed: ${failedViews.join(', ')}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Smoke test aborted: ${message}`);
  process.exit(1);
});
