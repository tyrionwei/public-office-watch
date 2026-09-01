import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
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

const homePagePayloadMigration = readFileSync(
  new URL('../../../supabase/migrations/20260827035539_add_home_page_payload_rpc.sql', import.meta.url),
  'utf8',
);

const routePagePayloadMigration = readFileSync(
  new URL('../../../supabase/migrations/20260827042424_add_route_page_payload_rpcs.sql', import.meta.url),
  'utf8',
);

const partyListRacePageMigration = readFileSync(
  new URL('../../../supabase/migrations/20260831082757_add_party_list_race_page.sql', import.meta.url),
  'utf8',
);

const narrowPublishedAccessMigration = readFileSync(
  new URL('../../../supabase/migrations/20260827052016_narrow_published_frontend_access.sql', import.meta.url),
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
const anonymousParticipationMigration = readFileSync(
  new URL('../../../supabase/migrations/20260827094616_use_server_issued_anonymous_participant.sql', import.meta.url),
  'utf8',
);
const participationProxyMigration = readFileSync(
  new URL('../../../supabase/migrations/20260827102924_require_participation_write_proxy.sql', import.meta.url),
  'utf8',
);
const participationProxyGrantMigration = readFileSync(
  new URL('../../../supabase/migrations/20260827105521_grant_proxy_guarded_participation_wrappers.sql', import.meta.url),
  'utf8',
);
const publicFeedbackAndChatRealtimeMigration = readFileSync(
  new URL('../../../supabase/migrations/20260827170729_split_public_feedback_and_chat_realtime_reads.sql', import.meta.url),
  'utf8',
);
const participationSecuritySource = readFileSync(
  new URL('../src/lib/participationSecurity.ts', import.meta.url),
  'utf8',
);
const participationWorkerSource = readFileSync(
  new URL('../worker/participation.ts', import.meta.url),
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
const supabasePublicClientSource = readFileSync(
  new URL('../src/lib/supabasePublicClient.ts', import.meta.url),
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
  assert.ok(publicSmokeSource.includes("client.schema('published')"));
  assert.ok(publicSmokeSource.includes("rpc('person_profiles_for'"));
  assert.ok(publicSmokeSource.includes("rpc('person_claims_for'"));
  assert.ok(publicSmokeSource.includes("if (!retiredPersonClaims.error)"));
  assert.ok(publicSmokeSource.includes("rpc('search_public_records'"));
  assert.ok(publicSmokeSource.includes("rpc('election_race_page'"));
  assert.ok(!publicSmokeSource.includes('allowedPublicViews'));
  assert.ok(!publicSmokeSource.includes('client.from(viewName)'));
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

test('party normalization functions use invoker rights and internal homepage summaries are no longer browser-readable', () => {
  assert.ok(homeCandidateSecurityMigration.includes('canonical_party_name(p_name TEXT)'));
  assert.ok(homeCandidateSecurityMigration.includes('canonical_party_key(p_name TEXT)'));
  assert.ok(homeCandidateSecurityMigration.includes('SECURITY INVOKER'));
  assert.ok(homeCandidateSecurityMigration.includes('published.home_candidate_summaries'));
  assert.ok(narrowPublishedAccessMigration.includes('published.home_candidate_summaries'));
  assert.ok(narrowPublishedAccessMigration.includes('FROM PUBLIC, anon, authenticated;'));
});

test('retired home candidate and person claims RPCs are service-only', () => {
  assert.ok(homeCandidateQueryMigration.includes('FUNCTION published.home_candidate_summaries_for(p_race_ids UUID[])'));
  assert.ok(homeCandidateQueryMigration.includes('SECURITY DEFINER'));
  assert.ok(homeCandidateQueryMigration.includes("SET search_path = ''"));
  assert.ok(homeCandidateQueryMigration.includes('IF v_race_count > 24'));
  assert.ok(homeCandidateQueryMigration.includes('LIMIT 401'));
  for (const functionName of ['home_candidate_summaries_for', 'person_claims_for']) {
    assert.ok(narrowPublishedAccessMigration.includes('REVOKE ALL ON FUNCTION published.' + functionName));
  }
});

test('P2 removes the legacy provider and revokes internal assembly relations', () => {
  assert.equal(existsSync(new URL('../src/lib/supabasePublicDataProvider.ts', import.meta.url)), false);
  for (const relation of [
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
  ]) {
    assert.ok(narrowPublishedAccessMigration.includes('published.' + relation));
  }
  assert.ok(narrowPublishedAccessMigration.includes('CREATE OR REPLACE VIEW published.parties'));
  assert.ok(narrowPublishedAccessMigration.includes('FROM public.party_name_aliases alias'));
  assert.ok(narrowPublishedAccessMigration.includes('ALTER FUNCTION published.search_public_records(TEXT, INTEGER) SECURITY DEFINER'));
  assert.ok(narrowPublishedAccessMigration.includes("SET search_path = ''"));
  assert.ok(narrowPublishedAccessMigration.includes('REVOKE ALL ON TABLE'));
  assert.ok(narrowPublishedAccessMigration.includes('FROM PUBLIC, anon, authenticated;'));
});

test('home page payload is bounded and explicitly granted through published', () => {
  assert.match(homePagePayloadMigration, /FUNCTION published\.home_page_for\(p_region_slug TEXT DEFAULT NULL\)/u);
  assert.match(homePagePayloadMigration, /SECURITY DEFINER[\s\S]*SET search_path = ''/u);
  for (const limit of ['LIMIT 33', 'LIMIT 25', 'LIMIT 401', 'LIMIT 21']) {
    assert.match(homePagePayloadMigration, new RegExp(limit, 'u'));
  }
  assert.match(homePagePayloadMigration, /demographic\.birth_date[\s\S]*END AS age_group/u);
  assert.doesNotMatch(homePagePayloadMigration, /'birth_date'/u);
  assert.match(homePagePayloadMigration, /'api_version', 1/u);
  assert.ok(homePagePayloadMigration.includes("'release_id'"));
  assert.ok(homePagePayloadMigration.includes("'published_at'"));
  assert.match(
    homePagePayloadMigration,
    /REVOKE ALL ON FUNCTION published\.home_page_for\(TEXT\)\s+FROM PUBLIC, anon, authenticated;/u,
  );
  assert.match(
    homePagePayloadMigration,
    /GRANT EXECUTE ON FUNCTION published\.home_page_for\(TEXT\)\s+TO anon, authenticated, service_role, admin_role;/u,
  );
});

test('route page payloads stay bounded and explicitly granted through published', () => {
  for (const [name, signature] of [
    ['region_page_for', 'TEXT'],
    ['election_index_page', ''],
    ['race_page_for', 'UUID'],
    ['person_profiles_for', 'UUID\\[\\]'],
  ]) {
    assert.match(
      routePagePayloadMigration,
      new RegExp(`FUNCTION published\\.${name}\\(`, 'u'),
    );
    assert.match(
      routePagePayloadMigration,
      new RegExp(`REVOKE ALL ON FUNCTION published\\.${name}\\(${signature}\\)\\s+FROM PUBLIC, anon, authenticated;`, 'u'),
    );
    assert.match(
      routePagePayloadMigration,
      new RegExp(`GRANT EXECUTE ON FUNCTION published\\.${name}\\(${signature}\\)\\s+TO anon, authenticated, service_role, admin_role;`, 'u'),
    );
  }
  assert.equal((routePagePayloadMigration.match(/SECURITY DEFINER[\s\S]*?SET search_path = ''/gu) ?? []).length, 4);
  assert.equal(routePagePayloadMigration.split("'api_version', 1").length - 1, 4);
  assert.equal(routePagePayloadMigration.split("'release_id'").length - 1, 4);
  for (const limit of ['LIMIT 65', 'LIMIT 25', 'LIMIT 501', 'LIMIT 101', 'LIMIT 1001', 'LIMIT 401']) {
    assert.match(routePagePayloadMigration, new RegExp(limit, 'u'));
  }
  assert.match(routePagePayloadMigration, /cardinality\(COALESCE\(p_person_ids[\s\S]*?BETWEEN 1 AND 4/u);
});

test('party-list results stay private behind one bounded published RPC', () => {
  assert.match(partyListRacePageMigration, /ALTER TABLE public\.party_list_race_results ENABLE ROW LEVEL SECURITY;/u);
  assert.match(
    partyListRacePageMigration,
    /REVOKE ALL ON TABLE public\.party_list_race_results FROM PUBLIC, anon, authenticated;/u,
  );
  assert.match(
    partyListRacePageMigration,
    /CREATE FUNCTION published\.party_list_race_page_for\(p_race_id UUID\)[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = ''/u,
  );
  assert.match(partyListRacePageMigration, /LIMIT 257/u);
  assert.match(partyListRacePageMigration, /LIMIT 33/u);
  assert.match(
    partyListRacePageMigration,
    /REVOKE ALL ON FUNCTION published\.party_list_race_page_for\(UUID\) FROM PUBLIC, anon, authenticated;/u,
  );
  assert.match(
    partyListRacePageMigration,
    /GRANT EXECUTE ON FUNCTION published\.party_list_race_page_for\(UUID\) TO anon, authenticated, service_role, admin_role;/u,
  );
});

test('region issue participation uses only the reviewed published API', () => {
  for (const name of ['region_issue_results', 'get_region_issue_response']) {
    assert.match(regionIssueMigration, new RegExp(`CREATE OR REPLACE FUNCTION published\\.${name}\\(`, 'u'));
    assert.match(regionIssueSource, new RegExp(`schema\\('published'\\)\\.rpc\\('${name}'`, 'u'));
  }
  assert.doesNotMatch(regionIssueSource, /rpc\('submit_region_issue_response'/u);
  assert.match(regionIssueSource, /submitParticipationRequest/u);
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

test('anonymous participation identity is issued by Supabase Auth and enforced by RPCs', () => {
  assert.match(supabasePublicClientSource, /auth\.signInAnonymously\(\{[\s\S]*captchaToken/u);
  assert.match(supabasePublicClientSource, /anonymousParticipationSessionPromise/u);
  assert.match(supabasePublicClientSource, /getSupabaseParticipationClient/u);
  assert.match(supabasePublicClientSource, /getExistingParticipationSession/u);

  for (const source of [regionIssueSource, personFeedbackSource]) {
    assert.doesNotMatch(source, /randomUUID|participantStorageKey|p_participant_token/u);
    assert.match(source, /ensureAnonymousParticipationSession/u);
    assert.match(source, /getExistingParticipationSession/u);
  }

  assert.equal((anonymousParticipationMigration.match(/participant_id := auth\.uid\(\);/gu) ?? []).length, 4);
  assert.equal((anonymousParticipationMigration.match(/IF participant_id IS NULL THEN/gu) ?? []).length, 4);

  for (const signature of [
    'published.get_region_issue_response(UUID, TEXT)',
    'published.submit_region_issue_response(UUID, TEXT, UUID[])',
    'published.get_person_feedback_context(UUID, TEXT)',
    'published.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)',
  ]) {
    assert.ok(anonymousParticipationMigration.includes(`DROP FUNCTION ${signature};`));
  }

  for (const signature of [
    'published.get_region_issue_response(UUID)',
    'published.submit_region_issue_response(UUID, UUID[])',
    'published.get_person_feedback_context(UUID)',
    'published.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)',
  ]) {
    assert.ok(anonymousParticipationMigration.includes(`GRANT EXECUTE ON FUNCTION ${signature}\nTO authenticated;`));
    assert.ok(!anonymousParticipationMigration.includes(`GRANT EXECUTE ON FUNCTION ${signature}\nTO anon`));
  }
});

test('remaining browser RPCs use only the reviewed published API', () => {
  assert.match(globalChatSource, /schema\('published'\)\.rpc\('chat_messages'/u);
  assert.doesNotMatch(globalChatSource, /client\.rpc\('get_public_chat_messages'/u);
  assert.match(personFeedbackSource, /schema\('published'\)\.rpc\('person_feedback_priorities'/u);
  assert.match(personFeedbackSource, /schema\('published'\)\.rpc\('get_person_feedback_own_submissions'/u);
  assert.doesNotMatch(personFeedbackSource, /rpc\('get_person_feedback_context'/u);
  assert.doesNotMatch(personFeedbackSource, /rpc\('submit_person_feedback'/u);
  assert.match(personFeedbackSource, /submitParticipationRequest/u);
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

test('public feedback priorities do not require a participant session', () => {
  assert.match(
    publicFeedbackAndChatRealtimeMigration,
    /GRANT EXECUTE ON FUNCTION published\.person_feedback_priorities\(UUID\)\s+TO anon, authenticated;/u,
  );
  assert.match(
    publicFeedbackAndChatRealtimeMigration,
    /GRANT EXECUTE ON FUNCTION published\.get_person_feedback_own_submissions\(UUID\)\s+TO authenticated;/u,
  );
  assert.doesNotMatch(
    publicFeedbackAndChatRealtimeMigration,
    /GRANT EXECUTE ON FUNCTION published\.get_person_feedback_own_submissions\(UUID\)\s+TO anon/u,
  );
  assert.match(personFeedbackSource, /rpc\('person_feedback_priorities'/u);
  assert.match(personFeedbackSource, /rpc\('get_person_feedback_own_submissions'/u);
  assert.doesNotMatch(personFeedbackSource, /rpc\('get_person_feedback_context'/u);
});


test('participation writes require Turnstile clearance, rate limits, and a Cloudflare proxy proof', () => {
  assert.match(participationSecuritySource, /challenges\.cloudflare\.com\/turnstile/u);
  assert.match(participationSecuritySource, /appearance: 'interaction-only'/u);
  assert.match(participationSecuritySource, /PARTICIPATION_CHALLENGE_REQUIRED/u);
  assert.match(participationWorkerSource, /\/auth\/v1\/user/u);
  assert.match(participationWorkerSource, /PARTICIPATION_USER_RATE_LIMITER\.limit/u);
  assert.match(participationWorkerSource, /PARTICIPATION_IP_RATE_LIMITER\.limit/u);
  assert.match(participationWorkerSource, /PARTICIPATION_IP_HMAC_KEY/u);
  assert.match(participationWorkerSource, /HttpOnly; SameSite=Strict/u);
  assert.match(participationWorkerSource, /x-participation-proxy-signature/u);
  assert.doesNotMatch(participationWorkerSource, /SERVICE_ROLE/u);

  assert.match(participationProxyMigration, /participant_id := auth\.uid\(\)/u);
  assert.match(participationProxyMigration, /current_setting\('request\.headers'/u);
  assert.match(participationProxyMigration, /vault\.decrypted_secrets/u);
  assert.match(participationProxyMigration, /extensions\.hmac/u);
  assert.match(participationProxyMigration, /> 60/u);
  for (const name of [
    'submit_region_issue_response_proxied_internal',
    'submit_person_feedback_proxied_internal',
  ]) {
    assert.match(participationProxyMigration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}`, 'u'));
  }
  for (const signature of [
    'public.submit_region_issue_response(UUID, UUID[])',
    'public.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)',
  ]) {
    assert.ok(
      participationProxyGrantMigration.includes(
        `GRANT EXECUTE ON FUNCTION ${signature}\nTO authenticated;`,
      ),
    );
  }
});

test('Cloudflare Pages responses carry baseline security headers', () => {
  assert.match(cloudflareHeaders, /Content-Security-Policy: default-src 'self'/u);
  assert.match(cloudflareHeaders, /connect-src 'self' https:\/\/\*\.supabase\.co wss:\/\/\*\.supabase\.co/u);
  assert.match(cloudflareHeaders, /script-src[^;]*https:\/\/static\.cloudflareinsights\.com/u);
  assert.match(cloudflareHeaders, /Strict-Transport-Security: max-age=31536000/u);
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
