import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const allowedPublicViews = {
  public_people: ['person_id', 'name', 'gender', 'education', 'experience', 'updated_at'],
  public_people_list: ['person_id', 'name', 'list_role', 'list_status', 'list_is_grassroots', 'list_status_order', 'list_role_order'],
  public_people_list_cached: ['person_id', 'name', 'list_role', 'list_status', 'list_is_grassroots', 'list_status_order', 'list_role_order'],
  public_companies: ['company_id', 'name', 'updated_at'],
  public_relation_details: ['relation_id', 'person_id', 'company_id', 'relation_type', 'verification_status'],
  public_regions: ['region_id', 'name', 'slug', 'region_type'],
  public_elections: ['election_id', 'name', 'election_type', 'status'],
  public_election_race_summaries: ['election_id', 'race_count', 'race_types'],
  public_election_race_facets: ['election_id', 'race_type', 'region_key', 'region_label', 'race_count'],
  public_election_race_list: ['race_id', 'event_key', 'race_type', 'region_key', 'sort_category_order', 'sort_region_order', 'sort_district_order'],
  public_races: ['race_id', 'election_id', 'title', 'status'],
  public_candidates: [
    'candidate_id',
    'person_id',
    'race_id',
    'election_id',
    'registration_status',
    'candidacy_status',
    'election_result',
    'status_updated_at',
  ],
  public_home_election_ticker: ['election_id', 'election_name', 'voting_date', 'status'],
  public_region_election_summary: ['region_id', 'region_name', 'region_slug', 'upcoming_race_count'],
  public_region_issue_results: ['issue_id', 'region_id', 'region_name', 'issue_key', 'response_count', 'participant_count', 'selection_rate'],
  public_person_primary_photos: ['person_id', 'media_id', 'photo_url', 'source_name'],
  public_person_identity_sources: ['identity_source_id', 'person_id', 'source_type', 'source_name', 'election_year', 'match_status', 'match_score'],
  public_person_claims: ['claim_id', 'person_id', 'candidate_id', 'claim_type', 'confidence_level', 'review_score', 'source_name'],
  public_person_party_affiliations: [
    'affiliation_id',
    'person_id',
    'source_claim_key',
    'party_name',
    'role_context',
    'role_title',
    'organization_unit',
    'display_order',
    'role_tier',
    'confidence_level',
  ],
  public_person_party_events: ['event_id', 'person_id', 'party_name', 'event_type', 'event_date', 'confidence_level'],
  public_party_officers: ['affiliation_id', 'person_id', 'party_id', 'role_title', 'organization_unit', 'role_tier', 'current_office_label'],
  public_people_directory: ['person_id', 'name', 'list_role', 'list_status', 'list_is_grassroots', 'list_is_party_only'],
  public_parties: [
    'party_id',
    'name',
    'slug',
    'theme_key',
    'chairperson_name',
    'registry_no',
    'founded_date_text',
    'filed_date_text',
    'headquarters_address',
    'contact_phone',
    'updated_at',
  ],
  public_party_finance_summaries: ['party_id', 'party_name', 'report_year', 'income_total', 'expense_total'],
  public_party_company_contribution_summaries: ['party_id', 'company_id', 'report_year', 'amount_total', 'confidence_level'],
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
    console.log('Skipping legacy public view retirement check: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
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

  for (const viewName of Object.keys(allowedPublicViews)) {
    try {
      const { error } = await client.from(viewName).select('*').limit(0);

      if (!error || error.code !== '42501') {
        failed = true;
        console.log(`${viewName}: unexpectedly accessible`);
        continue;
      }

      console.log(`${viewName}: retired`);
    } catch (error) {
      failed = true;
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log(`${viewName}: retirement check failed at runtime: ${message}`);
    }
  }

  if (failed) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Legacy public view retirement check aborted: ${message}`);
  process.exit(1);
});
