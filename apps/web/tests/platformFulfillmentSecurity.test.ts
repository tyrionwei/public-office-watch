import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../../../supabase/migrations/20260828065136_add_platform_fulfillment_voting.sql', import.meta.url),
  'utf8',
);
const presidentialMigration = readFileSync(
  new URL('../../../supabase/migrations/20260828210500_enable_2024_presidential_platform_voting.sql', import.meta.url),
  'utf8',
);
const approvedItemsMigration = readFileSync(
  new URL('../../../supabase/migrations/20260829010000_release_approved_platform_items.sql', import.meta.url),
  'utf8',
);
const participationSource = readFileSync(
  new URL('../src/lib/platformFulfillment.ts', import.meta.url),
  'utf8',
);
const workerSource = readFileSync(
  new URL('../worker/participation.ts', import.meta.url),
  'utf8',
);

test('platform fulfilment votes keep participant rows private and expose bounded RPCs', () => {
  assert.match(migration, /ALTER TABLE public\.platform_fulfillment_votes ENABLE ROW LEVEL SECURITY/u);
  assert.match(migration, /ALTER TABLE public\.elections\s+ADD COLUMN results_announced_on DATE;/u);
  assert.match(migration, /WHEN 2022 THEN DATE '2022-12-02'/u);
  assert.match(migration, /WHEN 2024 THEN DATE '2024-01-19'/u);
  assert.match(migration, /INTERVAL '1 year'/u);
  assert.equal(migration.match(/AND item\.voting_is_open/gu)?.length, 2);
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.platform_fulfillment_votes\s+FROM PUBLIC, anon, authenticated, service_role;/u,
  );
  assert.match(
    migration,
    /CONSTRAINT platform_fulfillment_votes_participant_item_key\s+UNIQUE \(claim_id, item_key, participant_hash\)/u,
  );
  assert.match(migration, /SET search_path = ''/u);
  assert.match(migration, /participant_id := auth\.uid\(\);/u);
  assert.match(migration, /public\.assert_participation_proxy_request\('platform-fulfillment'\)/u);
  assert.match(
    migration,
    /public\.assert_participation_proxy_request\(\s*'platform-fulfillment-withdrawal'\s*\)/u,
  );
  assert.match(migration, /JOIN public\.candidates AS candidate/u);
  assert.match(migration, /candidate\.election_result = 'elected'/u);
  assert.match(migration, /election\.year = 2024[\s\S]*'legislative_district'/u);
  assert.match(migration, /election\.year = 2022[\s\S]*'councilor_district'/u);
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION published\.platform_fulfillment_results\(UUID\)\s+TO anon, authenticated;/u,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION published\.get_platform_fulfillment_votes\(UUID\)\s+TO authenticated;/u,
  );
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.withdraw_platform_fulfillment_vote\(UUID, TEXT\)\s+FROM PUBLIC, anon, authenticated, service_role;/u,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.withdraw_platform_fulfillment_vote\(UUID, TEXT\)\s+TO authenticated;/u,
  );
  assert.doesNotMatch(
    migration,
    /GRANT (?:SELECT|INSERT|UPDATE|DELETE).*platform_fulfillment_votes.*TO (?:anon|authenticated)/u,
  );
});

test('elected presidential tickets share one reviewed platform vote record', () => {
  assert.match(presidentialMigration, /race\.race_type = 'president'/u);
  assert.match(presidentialMigration, /results_announced_on = DATE '2024-01-19'/u);
  assert.match(presidentialMigration, /official_numbered_lines/u);
  assert.match(
    presidentialMigration,
    /#>> '\{presidentialTicket,ticketNo\}'/u,
  );
  assert.match(
    presidentialMigration,
    /#>> '\{presidentialTicket,candidateRole\}' = 'president'/u,
  );
  assert.match(
    presidentialMigration,
    /public\.platform_fulfillment_vote_claim_id\(p_claim_id\)/u,
  );
  assert.ok(
    (presidentialMigration.match(/vote_claim_id := public\.platform_fulfillment_vote_claim_id/gu)?.length ?? 0) >= 3,
  );
});

test('only reviewed platform splits can become fulfilment voting items', () => {
  assert.match(
    approvedItemsMigration,
    /#>> '\{contentSplit,reviewStatus\}'\s+IN \('auto_approved', 'reviewed'\)/u,
  );
  assert.match(approvedItemsMigration, /cec-platform:2024:presidential-ticket-2/u);
  assert.match(approvedItemsMigration, /Expected 991 approved non-empty platform item payloads/u);
  assert.match(approvedItemsMigration, /candidate_map\.canonical_person_id <> claim_map\.canonical_person_id/u);
  assert.match(approvedItemsMigration, /Inserted platform claim conflicts with the reviewed release row/u);
  assert.doesNotMatch(approvedItemsMigration, /"reviewStatus":"needs_review"/u);
});

test('browser reads only aggregate and own-vote RPCs and writes through the participation proxy', () => {
  assert.match(participationSource, /schema\('published'\)\s*\.rpc\('platform_fulfillment_results'/u);
  assert.match(participationSource, /schema\('published'\)\s*\.rpc\('get_platform_fulfillment_votes'/u);
  assert.match(participationSource, /submitParticipationRequest/u);
  assert.doesNotMatch(participationSource, /from\('platform_fulfillment_votes'\)/u);
  assert.match(workerSource, /action === 'platform-fulfillment'/u);
  assert.match(workerSource, /name: 'submit_platform_fulfillment_vote'/u);
  assert.match(workerSource, /action === 'platform-fulfillment-withdrawal'/u);
  assert.match(workerSource, /name: 'withdraw_platform_fulfillment_vote'/u);
  assert.doesNotMatch(workerSource, /SERVICE_ROLE/u);
});
