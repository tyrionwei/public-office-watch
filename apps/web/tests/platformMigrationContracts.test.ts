import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const homeOfficeMigration = readFileSync(
  new URL('../../../supabase/migrations/20260906140100_home_candidate_office_titles.sql', import.meta.url),
  'utf8',
);
const platformQuarantineMigration = readFileSync(
  new URL('../../../supabase/migrations/20260906164542_quarantine_confirmed_platform_quality_findings.sql', import.meta.url),
  'utf8',
);
const xiaoMigration = readFileSync(
  new URL('../../../supabase/migrations/20260908100500_release_xiao_guo_liang_cec_profile_and_platform.sql', import.meta.url),
  'utf8',
);

test('submunicipal former offices never reuse a county or city name as the office label', () => {
  assert.match(homeOfficeMigration, /race_type = 'township_mayor'[\s\S]*THEN '鄉鎮市長'/u);
  assert.match(
    homeOfficeMigration,
    /race_type IN \(\s*'township_representative', 'township_representative_district'\s*\)[\s\S]*THEN '鄉鎮市民代表'/u,
  );
  assert.match(homeOfficeMigration, /race_type = 'village_chief'\s*THEN '村里長'/u);
  assert.doesNotMatch(homeOfficeMigration, /race_type = 'village_chief'[\s\S]{0,120}region_name/u);
});

test('platform item changes fail closed when fulfillment votes already exist', () => {
  assert.match(platformQuarantineMigration, /CREATE OR REPLACE FUNCTION public\.guard_platform_item_changes_with_votes\(\)/u);
  assert.match(platformQuarantineMigration, /OLD\.claim_json -> 'items' IS DISTINCT FROM NEW\.claim_json -> 'items'/u);
  assert.match(platformQuarantineMigration, /FROM public\.platform_fulfillment_votes AS vote[\s\S]*vote\.claim_id IN \(\s*OLD\.id,\s*public\.platform_fulfillment_vote_claim_id\(OLD\.id\)/u);
  assert.match(platformQuarantineMigration, /BEFORE UPDATE OF claim_json ON public\.person_claims/u);
});

test('Xiao Guo-liang platform carries the election context required by the published payload', () => {
  assert.match(xiaoMigration, /'candidateId','8a08cdd3-d6b7-4968-815a-fd4c429ba75a'/u);
  assert.match(xiaoMigration, /'raceId','e09788a1-6d10-4e52-8e46-2104630d8d12'/u);
  assert.match(xiaoMigration, /'electionId','1d63585f-87eb-4817-abc9-0d010839bf4d'/u);
  assert.match(xiaoMigration, /electionContext,candidateId/u);
});
