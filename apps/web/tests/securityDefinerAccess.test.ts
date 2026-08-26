import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const accessMigration = readFileSync(
  new URL('../../../supabase/migrations/20260812054704_restrict_security_definer_maintenance_functions.sql', import.meta.url),
  'utf8',
);

const homeCandidateSecurityMigration = readFileSync(
  new URL('../../../supabase/migrations/20260825194609_home_candidate_summaries_and_function_security.sql', import.meta.url),
  'utf8',
);
const homeCandidateQueryMigration = readFileSync(
  new URL('../../../supabase/migrations/20260826105941_fix_home_candidate_summary_query.sql', import.meta.url),
  'utf8',
);

const retirementMigration = readFileSync(
  new URL('../../../supabase/migrations/20260812062319_retire_legacy_public_api_views.sql', import.meta.url),
  'utf8',
);
const regionIssueMigration = readFileSync(
  new URL('../../../supabase/migrations/20260812065629_publish_region_issue_participation_api.sql', import.meta.url),
  'utf8',
);
const browserRpcMigration = readFileSync(
  new URL('../../../supabase/migrations/20260812070539_publish_remaining_browser_rpcs.sql', import.meta.url),
  'utf8',
);
const globalChatSource = readFileSync(
  new URL('../src/lib/globalChat.ts', import.meta.url),
  'utf8',
);
const regionIssueSource = readFileSync(
  new URL('../src/lib/regionIssueParticipation.ts', import.meta.url),
  'utf8',
);
const cloudflareHeaders = readFileSync(
  new URL('../public/_headers', import.meta.url),
  'utf8',
);
const personFeedbackSource = readFileSync(
  new URL('../src/lib/personFeedback.ts', import.meta.url),
  'utf8',
);
const publicSmokeSource = readFileSync(
  new URL('../scripts/smoke-public-views.mjs', import.meta.url),
  'utf8',
);

const maintenanceFunctions = [
  'process_high_confidence_identity_reviews',
  'process_context_disambiguated_identities',
  'process_unique_career_progression_identities',
  'refresh_public_people_list_cached',
];

const triggerFunctions = [
  'broadcast_chat_moderation_change',
  'broadcast_chat_profile_moderation_change',
  'broadcast_chat_status_change',
  'broadcast_public_chat_message',
  'normalize_candidate_status_fields',
  'record_candidate_status_history',
  'normalize_election_district_fields',
  'normalize_party_affiliation_column',
  'normalize_party_column',
  'normalize_party_registry_name',
  'normalize_source_party_column',
  'reject_hidden_chat_reply',
];

const publicReadViews = [
  'election_hierarchy_map',
  'public_candidates',
  'public_chat_messages',
  'public_chat_status',
  'public_companies',
  'public_election_race_facets',
  'public_election_race_list',
  'public_election_race_summaries',
  'public_elections',
  'public_home_election_ticker',
  'public_parties',
  'public_party_company_contribution_summaries',
  'public_party_finance_summaries',
  'public_party_officers',
  'public_people',
  'public_people_directory',
  'public_people_list',
  'public_person_claims',
  'public_person_identity_sources',
  'public_person_party_affiliations',
  'public_person_party_events',
  'public_person_primary_photos',
  'public_races',
  'public_region_election_summary',
  'public_region_issue_results',
  'public_regions',
  'public_relation_details',
];

const internalViews = [
  'election_canonical_map',
  'identity_probable_match_queue',
  'identity_unmatched_source_people',
  'legal_record_review_queue',
  'person_canonical_map',
  'person_claim_review_queue',
  'person_duplicate_review_queue',
  'person_identity_review_queue',
  'race_canonical_map',
];

function revokePattern(name: string) {
  return new RegExp(
    `REVOKE ALL ON FUNCTION public\\.${name}\\(\\)\\s+FROM PUBLIC, anon, authenticated;`,
    'u',
  );
}

function assertTableAccessBlock(statement: string, views: string[], roles: string) {
  const objectList = views.map((name) => `public\\.${name}`).join(',\\s+');
  assert.match(accessMigration, new RegExp(`${statement}\\s+${objectList}\\s+${roles};`, 'u'));
}

test('security-definer maintenance functions are service-only', () => {
  for (const name of maintenanceFunctions) {
    assert.match(accessMigration, revokePattern(name));
    assert.match(
      accessMigration,
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\(\\)\\s+TO service_role;`, 'u'),
    );
  }
});

test('security-definer trigger functions cannot be called directly through the API', () => {
  for (const name of triggerFunctions) assert.match(accessMigration, revokePattern(name));
});

test('public API views are read-only for client roles', () => {
  assertTableAccessBlock('REVOKE ALL ON TABLE', publicReadViews, 'FROM PUBLIC, anon, authenticated');
  assertTableAccessBlock('GRANT SELECT ON TABLE', publicReadViews, 'TO anon, authenticated');
});

test('internal review and canonical views are service-only', () => {
  assertTableAccessBlock('REVOKE ALL ON TABLE', internalViews, 'FROM PUBLIC, anon, authenticated');
  assertTableAccessBlock('GRANT SELECT ON TABLE', internalViews, 'TO service_role');
});

test('legacy public views are removed from browser roles', () => {
  const revokeBlock = retirementMigration.match(
    /REVOKE ALL ON TABLE([\s\S]*?)FROM PUBLIC, anon, authenticated;/u,
  )?.[1];
  assert.ok(revokeBlock);

  for (const name of [...internalViews, ...publicReadViews, 'public_people_list_cached']) {
    assert.match(revokeBlock, new RegExp(`public\\.${name}(?:,|\\s)`, 'u'));
  }
});

test('local public smoke follows the reviewed published API', () => {
  assert.match(publicSmokeSource, /client\.schema\('published'\)/u);
  assert.match(publicSmokeSource, /rpc\('person_claims_for'/u);
  assert.match(publicSmokeSource, /rpc\('search_public_records'/u);
  assert.match(publicSmokeSource, /rpc\('election_race_page'/u);
  assert.doesNotMatch(publicSmokeSource, /allowedPublicViews|client\.from\(viewName\)/u);
});

test('new public objects are private by default', () => {
  for (const objectType of ['TABLES', 'SEQUENCES', 'FUNCTIONS']) {
    assert.match(
      retirementMigration,
      new RegExp(
        `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\\s+REVOKE ALL ON ${objectType} FROM PUBLIC, anon, authenticated, service_role;`,
        'u',
      ),
    );
  }
});

test('dynamic chat status is exposed only through the published RPC', () => {
  assert.match(retirementMigration, /CREATE OR REPLACE FUNCTION published\.chat_status\(\)/u);
  assert.match(
    retirementMigration,
    /REVOKE ALL ON FUNCTION published\.chat_status\(\)\s+FROM PUBLIC, anon, authenticated;/u,
  );
  assert.match(
    retirementMigration,
    /GRANT EXECUTE ON FUNCTION published\.chat_status\(\)\s+TO anon, authenticated, service_role;/u,
  );
  assert.match(globalChatSource, /client\.schema\('published'\)\.rpc\('chat_status'\)/u);
  assert.doesNotMatch(globalChatSource, /from\('public_chat_status'\)/u);
});

test('party normalization functions use invoker rights and homepage summaries stay bounded', () => {
  assert.match(homeCandidateSecurityMigration, /canonical_party_name\(p_name TEXT\)[\s\S]*SECURITY INVOKER/u);
  assert.match(homeCandidateSecurityMigration, /canonical_party_key\(p_name TEXT\)[\s\S]*SECURITY INVOKER/u);
  assert.match(homeCandidateSecurityMigration, /published\.home_candidate_summaries[\s\S]*security_invoker = false/u);
  assert.match(homeCandidateSecurityMigration, /GRANT SELECT ON published\.home_candidate_summaries TO anon, authenticated, service_role, admin_role;/u);
});

test('home candidate summary RPC bounds privileged reads before demographic joins', () => {
  assert.match(homeCandidateQueryMigration, /FUNCTION published\.home_candidate_summaries_for\(p_race_ids UUID\[\]\)/u);
  assert.match(homeCandidateQueryMigration, /SECURITY DEFINER[\s\S]*SET search_path = ''/u);
  assert.match(homeCandidateQueryMigration, /IF v_race_count > 24[\s\S]*LIMIT 401/u);
  assert.match(homeCandidateQueryMigration, /requested_candidates AS MATERIALIZED/u);
  assert.match(
    homeCandidateQueryMigration,
    /REVOKE ALL ON FUNCTION published\.home_candidate_summaries_for\(UUID\[\]\)\s+FROM PUBLIC, anon, authenticated;/u,
  );
  assert.match(
    homeCandidateQueryMigration,
    /GRANT EXECUTE ON FUNCTION published\.home_candidate_summaries_for\(UUID\[\]\)\s+TO anon, authenticated, service_role, admin_role;/u,
  );
});

test('region issue participation uses only the reviewed published API', () => {
  for (const name of ['region_issue_results', 'get_region_issue_response', 'submit_region_issue_response']) {
    assert.match(regionIssueMigration, new RegExp(`CREATE OR REPLACE FUNCTION published\\.${name}\\(`, 'u'));
    assert.match(regionIssueSource, new RegExp(`schema\\('published'\\)\\.rpc\\('${name}'`, 'u'));
  }
  assert.doesNotMatch(regionIssueSource, /from\('public_region_issue_results'\)/u);
  for (const revokePattern of [
    /REVOKE ALL ON FUNCTION public\.get_region_issue_response\(UUID, TEXT\)\s+FROM PUBLIC, anon, authenticated;/u,
    /REVOKE ALL ON FUNCTION public\.submit_region_issue_response\(UUID, TEXT, UUID\[\]\)\s+FROM PUBLIC, anon, authenticated;/u,
  ]) {
    assert.match(
      regionIssueMigration,
      revokePattern,
    );
  }
});

test('remaining browser RPCs use only the reviewed published API', () => {
  assert.match(globalChatSource, /schema\('published'\)\.rpc\('chat_messages'/u);
  assert.doesNotMatch(globalChatSource, /client\.rpc\('get_public_chat_messages'/u);
  for (const name of ['get_person_feedback_context', 'submit_person_feedback']) {
    assert.match(personFeedbackSource, new RegExp(`schema\\('published'\\)\\.rpc\\('${name}'`, 'u'));
  }
  for (const signature of [
    /public\.get_public_chat_messages\(TIMESTAMPTZ, UUID, INTEGER\)/u,
    /public\.get_person_feedback_context\(UUID, TEXT\)/u,
    /public\.submit_person_feedback\(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT\)/u,
  ]) {
    assert.match(browserRpcMigration, signature);
  }
  for (const helper of [
    /public\.candidate_candidacy_status_from_legacy\(TEXT\)/u,
    /public\.candidate_election_result_from_legacy\(TEXT, BOOLEAN\)/u,
    /public\.normalize_election_district_label\(TEXT\)/u,
  ]) {
    assert.match(browserRpcMigration, helper);
  }
});

test('Cloudflare Pages responses carry baseline security headers', () => {
  assert.match(cloudflareHeaders, /Content-Security-Policy: base-uri 'self'; object-src 'none'; frame-ancestors 'none'/u);
  assert.match(cloudflareHeaders, /Permissions-Policy:/u);
  assert.match(cloudflareHeaders, /X-Content-Type-Options: nosniff/u);
  assert.match(cloudflareHeaders, /X-Frame-Options: DENY/u);
  assert.match(cloudflareHeaders, /\/internal\/\*[\s\S]*Cache-Control: no-store/u);
  assert.match(cloudflareHeaders, /\/internal\/\*[\s\S]*X-Robots-Tag: noindex, nofollow/u);
});

test('importer RLS policies are scoped to the service role', () => {
  for (const table of ['person_party_affiliations', 'person_party_events']) {
    assert.match(
      accessMigration,
      new RegExp(
        `CREATE POLICY importer_write_${table}\\s+ON public\\.${table}\\s+FOR ALL\\s+TO service_role`,
        'u',
      ),
    );
  }
});

test('scheduled monitors use the reviewed published API after legacy view retirement', () => {
  const anonymousScheduledReaders = [
    'discover-daily-person-news.mjs',
    'fetch-cec-2024-person-profile-enrichment.mjs',
    'fetch-wikidata-person-enrichment.mjs',
    'fetch-judicial-legal-record-leads.mjs',
    'fetch-kinmen-county-official-person-profiles.mjs',
  ];

  for (const fileName of anonymousScheduledReaders) {
    const source = readFileSync(new URL(`../../../scripts/${fileName}`, import.meta.url), 'utf8');
    assert.match(source, /'accept-profile': 'published'/u, `${fileName} must select the published schema`);
    assert.doesNotMatch(source, /\/rest\/v1\/public_(?:people|candidates|person_claims)/u);
    assert.doesNotMatch(source, /fetchAllRows\('public_(?:people|candidates|person_claims)/u);
  }

  for (const fileName of [
    'build-person-enrichment-targets.mjs',
    'fetch-official-person-profile-enrichment.mjs',
  ]) {
    const source = readFileSync(new URL(`../../../scripts/${fileName}`, import.meta.url), 'utf8');
    assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/u);
    assert.match(source, /apikey: serviceRoleKey/u);
    assert.doesNotMatch(source, /apikey: anonKey/u);
    assert.doesNotMatch(source, /'accept-profile': 'published'/u);
  }

  const batch = readFileSync(
    new URL('../../../scripts/run-person-enrichment-batch.mjs', import.meta.url),
    'utf8',
  );
  const countHelpers = batch.slice(
    batch.indexOf('async function countRows'),
    batch.indexOf('function taipeiHour'),
  );
  assert.match(countHelpers, /apikey: localServiceRoleKey/u);
  assert.match(countHelpers, /authorization: `Bearer \$\{localServiceRoleKey\}`/u);
  assert.doesNotMatch(countHelpers, /apikey: localAnonKey/u);
  assert.doesNotMatch(countHelpers, /authorization: `Bearer \$\{localAnonKey\}`/u);
});


test('database-advisor functions have fixed search paths', () => {
  assert.match(
    accessMigration,
    /ALTER FUNCTION public\.candidate_candidacy_status_from_legacy\(TEXT\)\s+SET search_path = pg_catalog;/u,
  );
  assert.match(
    accessMigration,
    /ALTER FUNCTION public\.candidate_election_result_from_legacy\(TEXT, BOOLEAN\)\s+SET search_path = pg_catalog;/u,
  );
  for (const name of ['normalize_candidate_status_fields', 'record_candidate_status_history']) {
    assert.match(
      accessMigration,
      new RegExp(`ALTER FUNCTION public\\.${name}\\(\\)\\s+SET search_path = public, pg_temp;`, 'u'),
    );
  }
  assert.match(
    accessMigration,
    /ALTER FUNCTION public\.normalize_election_district_label\(TEXT\)\s+SET search_path = pg_catalog;/u,
  );
});

test('automated official-data fetches use the pinned official TWCA chain', () => {
  const batch = readFileSync(new URL('../../../scripts/run-person-enrichment-batch.mjs', import.meta.url), 'utf8');
  const archive = readFileSync(new URL('../../../scripts/archive-official-raw-sources-2022-2026.mjs', import.meta.url), 'utf8');
  const cec = readFileSync(new URL('../../../scripts/fetch-cec-2024-person-profile-enrichment.mjs', import.meta.url), 'utf8');
  const kinmen = readFileSync(new URL('../../../scripts/fetch-kinmen-county-official-person-profiles.mjs', import.meta.url), 'utf8');
  const trustedFetch = readFileSync(new URL('../../../scripts/trusted-official-fetch.mjs', import.meta.url), 'utf8');
  const certificatePem = readFileSync(new URL('../../../certificates/twca-secure-ssl-2023-g3.pem', import.meta.url), 'utf8');
  const certificate = new X509Certificate(certificatePem);

  assert.equal(
    certificate.fingerprint256,
    '1A:2C:75:FD:09:6E:04:99:E9:FF:6A:C7:4E:52:6F:61:EA:AE:3E:DF:C8:C2:EA:44:36:FE:E0:C2:4D:8B:7D:0E',
  );
  assert.match(trustedFetch, /ca: trustedCertificateAuthorities/u);
  assert.match(archive, /fetchWithTrustedTwcaChain/u);
  assert.match(cec, /fetchWithTrustedTwcaChain/u);
  assert.match(kinmen, /fetchWithTrustedTwcaChain/u);
  assert.doesNotMatch(batch, /--allow-insecure-tls/u);
  assert.doesNotMatch(cec, /allowInsecureTls|rejectUnauthorized/u);
  assert.doesNotMatch(archive, /NODE_TLS_REJECT_UNAUTHORIZED/u);
  assert.equal(kinmen.includes("execFileSync('curl', ['-k'"), false);
});
