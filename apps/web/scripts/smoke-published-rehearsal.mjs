import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const envPath = path.join(webRoot, '.env.rehearsal.local');

const readableRelations = [
  'active_party_candidates',
  'current_legislator_party_summary',
  'election_race_facets',
  'national_office_holders',
  'parties',
  'party_annual_finance_filings',
  'party_company_contribution_summaries',
  'party_finance_summaries',
  'party_officers',
  'people_directory',
  'regions',
  'update_feed',
];

const blockedRelations = [
  'candidates',
  'election_race_summaries',
  'elections',
  'home_candidate_summaries',
  'home_region_summary',
  'home_ticker',
  'party_name_aliases',
  'people',
  'person_party_affiliations',
  'races',
  'referendum_options',
  'referendum_questions',
  'referendum_region_results',
  'search_results',
];

const requiredNonEmptyRelations = new Set([
  'current_legislator_party_summary',
  'national_office_holders',
  'parties',
  'people_directory',
  'regions',
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

function assertPayloadVersion(payload, label) {
  if (payload?.api_version !== 1) fail(label + ' returned an unsupported API version');
  if (typeof payload.release_id !== 'string' || typeof payload.published_at !== 'string') {
    fail(label + ' returned invalid release metadata');
  }
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

  for (const relation of blockedRelations) {
    const result = await published.from(relation).select('*').limit(1);
    if (!result.error) fail('anon can read retired published.' + relation);
  }

  const homePage = await published.rpc('home_page_for', { p_region_slug: 'taipei-city' });
  if (homePage.error) fail(`home_page_for is not executable: ${homePage.error.message}`);
  const homePayload = homePage.data?.[0]?.payload;
  assertPayloadVersion(homePayload, 'home_page_for');
  if (!homePayload || homePayload.region_rows?.length === 0) fail('home_page_for returned no regions');
  if (homePayload.race_rows?.length === 0) fail('home_page_for returned no Taipei races');
  if (homePayload.candidate_rows?.length === 0) fail('home_page_for returned no Taipei candidates');
  if (homePayload.seat_rows?.length === 0) fail('home_page_for returned no Taipei seats');
  if (JSON.stringify(homePayload).includes('birth_date')) fail('home_page_for exposed an exact birth date');

  const regionPage = await published.rpc('region_page_for', { p_region_slug: 'taipei-city' });
  if (regionPage.error) fail(`region_page_for is not executable: ${regionPage.error.message}`);
  const regionPayload = regionPage.data?.[0]?.payload;
  assertPayloadVersion(regionPayload, 'region_page_for');
  if (!regionPayload.region_row) fail('region_page_for returned no region');

  const electionIndex = await published.rpc('election_index_page');
  if (electionIndex.error) fail(`election_index_page is not executable: ${electionIndex.error.message}`);
  const electionPayload = electionIndex.data?.[0]?.payload;
  assertPayloadVersion(electionPayload, 'election_index_page');
  if (electionPayload.election_rows?.length === 0) {
    fail('election_index_page returned no elections');
  }

  const raceId = homePayload.race_rows[0]?.race_id;
  const racePage = await published.rpc('race_page_for', { p_race_id: raceId });
  if (racePage.error) fail(`race_page_for is not executable: ${racePage.error.message}`);
  const racePayload = racePage.data?.[0]?.payload;
  assertPayloadVersion(racePayload, 'race_page_for');
  if (racePayload.race_row?.race_id !== raceId) {
    fail('race_page_for returned the wrong race');
  }

  const partyListRace = await published.rpc('party_list_race_page_for', {
    p_race_id: 'fbf84648-d6d7-480b-a0a4-518ad1f39d2b',
  });
  if (partyListRace.error) fail(`party_list_race_page_for is not executable: ${partyListRace.error.message}`);
  const partyListPayload = partyListRace.data?.[0]?.payload;
  assertPayloadVersion(partyListPayload, 'party_list_race_page_for');
  if (partyListPayload.party_list_result_rows?.length !== 16
      || partyListPayload.candidate_rows?.length !== 177
      || partyListPayload.party_list_result_rows.reduce((sum, row) => sum + row.allocated_seats, 0) !== 34) {
    fail('party_list_race_page_for did not return 16 parties, 177 candidates, and 34 seats');
  }

  const personId = homePayload.candidate_rows[0]?.person_id;
  const personProfiles = await published.rpc('person_profiles_for', { p_person_ids: [personId] });
  if (personProfiles.error) fail(`person_profiles_for is not executable: ${personProfiles.error.message}`);
  const personPayload = personProfiles.data?.[0]?.payload;
  assertPayloadVersion(personPayload, 'person_profiles_for');
  if (personPayload.person_rows?.[0]?.person_id !== personId) {
    fail('person_profiles_for returned the wrong person');
  }

  const retiredHomeSummary = await published.rpc('home_candidate_summaries_for', { p_race_ids: [] });
  if (!retiredHomeSummary.error) fail('anon can execute retired home_candidate_summaries_for');
  const retiredPersonClaims = await published.rpc('person_claims_for', { p_person_ids: [personId] });
  if (!retiredPersonClaims.error) fail('anon can execute retired person_claims_for');

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
