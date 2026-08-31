import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const envPath = path.join(webRoot, '.env.local');

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
      return [
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim().replace(/^['"]|['"]$/gu, ''),
      ];
    }));
}

function assertPayloadVersion(payload, label) {
  if (payload?.api_version !== 1) fail(label + ' returned an unsupported API version');
  if (typeof payload.release_id !== 'string' || typeof payload.published_at !== 'string') {
    fail(label + ' returned invalid release metadata');
  }
}

function fail(message) {
  throw new Error(`Published local smoke failed: ${message}`);
}

function keyRole(value) {
  const payload = value.split('.')[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role ?? null;
  } catch {
    return null;
  }
}

function electionCategory(electionType) {
  if (['presidential', 'president', 'legislative', 'legislator'].includes(electionType)) return 'national';
  if (['local', 'local_chief', 'councilor', 'township_representative', 'village_chief'].includes(electionType)) return 'local';
  if (electionType === 'referendum') return 'referendum';
  if (electionType === 'recall') return 'recall';
  if (electionType === 'by_election') return 'by_election';
  return 'other';
}

async function main() {
  if (!fs.existsSync(envPath)) fail(`missing ${envPath}`);
  const env = parseEnv(fs.readFileSync(envPath, 'utf8'));
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;

  if (url !== 'http://127.0.0.1:54321') fail('URL is not the full local Supabase API');
  if (env.VITE_PUBLIC_DATA_PROVIDER !== 'published') fail('published provider is not selected');
  if (env.VITE_ENABLE_PUBLISHED_PROVIDER !== 'true') fail('published provider is not enabled');
  if (!anonKey) fail('missing local anon key');
  if (keyRole(anonKey) === 'service_role') fail('frontend key is a service-role credential');

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

  const searchResponse = await published.rpc('search_public_records', { p_query: '蔣萬安', p_limit: 3 });
  if (searchResponse.error) fail('search_public_records is unavailable: ' + searchResponse.error.message);
  const person = searchResponse.data?.find((row) => row.title === '蔣萬安');
  if (!person) fail('published search did not return the recognizable person');

  const personProfiles = await published.rpc('person_profiles_for', { p_person_ids: [person.entity_id] });
  if (personProfiles.error) fail('person_profiles_for is unavailable: ' + personProfiles.error.message);
  const personPayload = personProfiles.data?.[0]?.payload;
  assertPayloadVersion(personPayload, 'person_profiles_for');
  if (!personPayload.claim_rows?.some((claim) => claim.claim_type === 'finance_summary')) {
    fail('person_profiles_for did not return the reviewed candidate finance summary');
  }

  const partyListRace = await published.rpc('party_list_race_page_for', {
    p_race_id: 'fbf84648-d6d7-480b-a0a4-518ad1f39d2b',
  });
  if (partyListRace.error) fail('party_list_race_page_for is unavailable: ' + partyListRace.error.message);
  const partyListPayload = partyListRace.data?.[0]?.payload;
  assertPayloadVersion(partyListPayload, 'party_list_race_page_for');
  if (partyListPayload.party_list_result_rows?.length !== 16
      || partyListPayload.candidate_rows?.length !== 177
      || partyListPayload.party_list_result_rows.reduce((sum, row) => sum + row.allocated_seats, 0) !== 34) {
    fail('party_list_race_page_for did not return 16 parties, 177 candidates, and 34 seats');
  }

  const electionIndex = await published.rpc('election_index_page');
  if (electionIndex.error) fail('election_index_page is unavailable: ' + electionIndex.error.message);
  const electionPayload = electionIndex.data?.[0]?.payload;
  assertPayloadVersion(electionPayload, 'election_index_page');
  const election = electionPayload.election_rows?.find((row) => (
    row.year === 2022 && row.name.includes('市長') && row.voting_date
  ));
  if (!election) fail('election race search anchor is unavailable');
  const eventKey = election.voting_date.slice(0, 4) + '-' + election.voting_date + '-' + electionCategory(election.election_type);
  const racePageResponse = await published.rpc('election_race_page', {
    p_event_key: eventKey,
    p_election_ids: [election.election_id],
    p_race_types: null,
    p_region_key: null,
    p_query: null,
    p_page: 1,
    p_page_size: 1,
  });
  if (racePageResponse.error) fail('election_race_page is unavailable: ' + racePageResponse.error.message);
  if (!racePageResponse.data?.[0] || Number(racePageResponse.data[0].total) < 1) {
    fail('election_race_page returned no reviewed races');
  }

  const retiredHomeSummary = await published.rpc('home_candidate_summaries_for', { p_race_ids: [] });
  if (!retiredHomeSummary.error) fail('anon can execute retired home_candidate_summaries_for');
  const retiredPersonClaims = await published.rpc('person_claims_for', { p_person_ids: [person.entity_id] });
  if (!retiredPersonClaims.error) fail('anon can execute retired person_claims_for');

  const releaseState = await published.from('release_state').select('*').limit(1);
  if (!releaseState.error) fail('anon can read internal published.release_state');

  const promote = await published.rpc('promote', { p_source_sync_run_id: null });
  if (!promote.error) fail('anon can execute published.promote');

  const identityMatches = await client.from('person_identity_matches').select('*').limit(1);
  if (!identityMatches.error) fail('anon can read internal person_identity_matches');

  const retiredPublicView = await client.from('public_races').select('*').limit(1);
  if (!retiredPublicView.error) fail('anon can still read retired public.public_races');

  console.log(`Published local smoke OK: ${readableRelations.length} reviewed relations and the person, finance, search, and election RPC paths work; internal and retired public data remain blocked.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
