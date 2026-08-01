import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const envPath = path.join(webRoot, '.env.rehearsal.local');

const readableRelations = [
  'active_party_candidates',
  'candidates',
  'election_race_facets',
  'election_race_summaries',
  'elections',
  'home_region_summary',
  'home_ticker',
  'parties',
  'party_company_contribution_summaries',
  'party_finance_summaries',
  'party_officers',
  'people',
  'people_directory',
  'person_party_affiliations',
  'races',
  'regions',
  'search_results',
];

const requiredNonEmptyRelations = new Set([
  'candidates',
  'elections',
  'people',
  'races',
  'regions',
  'search_results',
]);

function parseEnv(content) {
  return Object.fromEntries(content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)];
    }));
}

function fail(message) {
  throw new Error(`Published rehearsal smoke failed: ${message}`);
}

async function main() {
  if (!fs.existsSync(envPath)) fail(`missing ${envPath}`);
  const env = parseEnv(fs.readFileSync(envPath, 'utf8'));
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;

  if (url !== 'http://127.0.0.1:55321') fail('URL is not the isolated rehearsal API');
  if (!anonKey) fail('missing rehearsal anon key');

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const published = client.schema('published');

  for (const relation of readableRelations) {
    const { data, error } = await published.from(relation).select('*').limit(1);
    if (error) fail(`${relation} is not readable: ${error.message}`);
    if (requiredNonEmptyRelations.has(relation) && data.length === 0) {
      fail(`${relation} is unexpectedly empty`);
    }
  }

  const releaseState = await published.from('release_state').select('*').limit(1);
  if (!releaseState.error) fail('anon can read internal published.release_state');

  const promote = await published.rpc('promote', { p_source_sync_run_id: null });
  if (!promote.error) fail('anon can execute published.promote');

  const identityMatches = await client.from('person_identity_matches').select('*').limit(1);
  if (!identityMatches.error) fail('anon can read internal person_identity_matches');

  console.log(`Published rehearsal smoke OK: ${readableRelations.length} reviewed relations readable; internal release, promote, and identity data blocked.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
