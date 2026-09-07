#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const container = 'supabase_db_public-office-watch';
const sourceDb = 'postgres';
const testDb = 'pow_migration_pre_fix_rehearsal';
const dump = '/tmp/pow-migration-pre-fix-rehearsal.dump';
const keepFailedRehearsal = process.env.KEEP_FAILED_REHEARSAL === '1';
const dir = resolve('tmp/platform-quality-audit-20260907');
const report = resolve(dir, 'migration-rehearsal-from-pre-fix.json');
const migrations = [
  '20260906164542_quarantine_confirmed_platform_quality_findings.sql',
  '20260906171439_classify_second_round_platform_quality_findings.sql',
  '20260906173322_repair_recoverable_platform_omissions.sql',
  '20260906174350_normalize_quarantined_platform_spacing.sql',
  '20260906175037_release_verified_platform_repairs.sql',
  '20260907061839_release_verified_people_and_platforms.sql',
  '20260907071146_release_verified_tpp_high_priority_platforms.sql',
  '20260907073631_release_verified_official_council_high_priority_platforms.sql',
  '20260907080443_release_verified_remaining_high_priority_platforms.sql',
  '20260907084442_release_verified_high_source_rule_platforms.sql',
  '20260907093712_release_verified_high_omission_platforms_01.sql',
  '20260907094705_release_verified_high_omission_platforms_02.sql',
  '20260907101459_release_verified_high_omission_platforms_03.sql',
  '20260907105452_release_verified_high_omission_platforms_04.sql',
  '20260907112442_release_verified_high_omission_platforms_05.sql',
  '20260907114145_release_verified_high_omission_platforms_06.sql',
  '20260907115006_release_verified_high_omission_platforms_07.sql',
  '20260907124439_release_verified_high_omission_platforms_08.sql',
  '20260907131741_release_verified_high_omission_platforms_09.sql',
  '20260907132440_release_verified_high_omission_platforms_10.sql',
  '20260907133311_release_verified_high_omission_platforms_11.sql',
  '20260907135143_release_verified_high_omission_platforms_12.sql',
  '20260907140243_release_verified_high_omission_platforms_13.sql',
  '20260907141404_release_verified_high_omission_platforms_14.sql',
  '20260907142608_release_verified_high_omission_platforms_15.sql',
  '20260907144052_release_verified_high_omission_platforms_16.sql',
  '20260907150534_release_verified_high_omission_platforms_17.sql',
  '20260907161851_release_verified_high_omission_platforms_18.sql',
  '20260907163629_release_verified_high_omission_platforms_19.sql',
  '20260907165548_release_verified_high_omission_platforms_20.sql',
  '20260907170609_release_verified_high_omission_platforms_21.sql',
  '20260907173201_reconcile_verified_short_platform_classification.sql',
  '20260908100500_release_xiao_guo_liang_cec_profile_and_platform.sql',
];

function run(args, input) {
  const result = spawnSync('docker', args, { encoding: 'utf8', input, maxBuffer: 128 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`docker ${args.join(' ')} failed (${result.status})\n${[result.stdout, result.stderr].filter(Boolean).join('\n').trim()}`);
  }
  return result.stdout.trim();
}
function sql(db, text) {
  return run(['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db, '-At'], text);
}
function literal(value) {
  return value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
}

const scan = JSON.parse(readFileSync(resolve(dir, 'scan.json'), 'utf8')).filter((entry) => Array.isArray(entry.flags) && entry.flags.length > 0);
if (scan.length !== 458) throw new Error(`Expected 458 flagged audit rows, found ${scan.length}`);
const personScan = scan.filter((entry) => entry.kind === 'person');
if (personScan.length !== 452) throw new Error(`Expected 452 flagged person rows, found ${personScan.length}`);
const managedIds = new Set(sql(sourceDb, "SELECT id FROM public.person_claims WHERE claim_type='platform' AND claim_json ? 'platformQualityAudit' ORDER BY id;").split('\n').filter(Boolean));
const migrationScan = personScan.filter((entry) => managedIds.has(entry.id));
if (migrationScan.length !== 298) throw new Error(`Expected 298 migration-managed audit rows, found ${migrationScan.length}`);
const beforeById = new Map(JSON.parse(readFileSync(resolve(dir, 'person-platforms.json'), 'utf8')).map((entry) => [entry.id, entry]));
const ids = personScan.map((entry) => `${literal(entry.id)}::uuid`).join(',');

function snapshot(db) {
  return JSON.parse(sql(db, `
WITH a AS (
  SELECT count(*) FILTER (WHERE claim_type='platform' AND claim_json#>>'{contentSplit,reviewStatus}'='needs_review') AS needs_review,
         count(*) FILTER (WHERE claim_type='platform' AND claim_json#>>'{platformQualityAudit,classification}'='verified_repair') AS verified_repair,
         count(*) FILTER (WHERE claim_type='platform' AND claim_json#>>'{platformQualityAudit,classification}'='excluded_specific_suspicion') AS excluded,
         count(*) FILTER (WHERE claim_json->>'productionRelease' IN ('20260907-cec-2022-profile-transcription','20260908-cec-2022-xiao-guo-liang-source-replacement')) AS profiles
  FROM public.person_claims
), p AS (
  SELECT md5(string_agg(id::text||E'\\x1f'||claim_value||E'\\x1f'||claim_json::text,E'\\x1e' ORDER BY id)) AS digest
  FROM public.person_claims WHERE id=ANY(ARRAY[${ids}])
), c AS (
  SELECT md5(string_agg(id::text||E'\\x1f'||claim_value||E'\\x1f'||coalesce(claim_json->>'platformText','')||E'\\x1f'||coalesce(claim_json->>'platformIntro','')||E'\\x1f'||coalesce((claim_json->'items')::text,'null'),E'\\x1e' ORDER BY id)) AS digest
  FROM public.person_claims WHERE id=ANY(ARRAY[${ids}])
), g AS (
  SELECT md5(string_agg(id::text||E'\\x1f'||coalesce(claim_json#>>'{contentSplit,reviewStatus}','')||E'\\x1f'||coalesce(claim_json#>>'{platformQualityAudit,classification}',''),E'\\x1e' ORDER BY id)) AS digest
  FROM public.person_claims WHERE id=ANY(ARRAY[${ids}])
), r AS (
  SELECT md5(string_agg(claim_key||E'\\x1f'||person_id::text||E'\\x1f'||coalesce(candidate_id::text,'')||E'\\x1f'||claim_type||E'\\x1f'||claim_value||E'\\x1f'||claim_json::text,E'\\x1e' ORDER BY claim_key)) AS digest
  FROM public.person_claims WHERE claim_json->>'productionRelease' IN ('20260907-cec-2022-profile-transcription','20260908-cec-2022-xiao-guo-liang-source-replacement')
)
SELECT jsonb_build_object(
  'needsReview',a.needs_review,
  'verifiedRepair',a.verified_repair,
  'excludedSpecificSuspicion',a.excluded,
  'releasedProfileClaims',a.profiles,
  'platformDigest',p.digest,
  'platformContentDigest',c.digest,
  'platformReleaseStateDigest',g.digest,
  'profileDigest',r.digest,
  'zhangChiKaiExperienceCandidateId',(SELECT candidate_id FROM public.person_claims WHERE id='c3687480-48b1-4020-b122-8833694587d5'::uuid)
)::text FROM a,p,c,g,r;`));
}
function platformRows(db) {
  return JSON.parse(sql(db, `SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'claimValue',claim_value,'claimJson',claim_json) ORDER BY id),'[]'::jsonb)::text FROM public.person_claims WHERE id=ANY(ARRAY[${ids}]);`));
}

const startedAt = new Date().toISOString();
const results = [];
let baseline = null;
let rehearsalResult = null;
let currentResult = null;
let differenceDetails = [];
let passed = false;
let failure = null;
try {
  run(['exec', container, 'dropdb', '--if-exists', '--force', '-U', 'postgres', testDb]);
  run(['exec', container, 'rm', '-f', dump]);
  run(['exec', container, 'pg_dump', '-U', 'postgres', '-d', sourceDb, '-Fc', '--schema=public', '--no-owner', '--no-privileges', '-f', dump]);
  const authUserIds = sql(sourceDb, 'SELECT id FROM auth.users ORDER BY id;').split('\n').filter(Boolean);
  run(['exec', container, 'createdb', '-U', 'postgres', testDb]);
  sql(testDb, `DROP SCHEMA public CASCADE; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); INSERT INTO auth.users(id) VALUES ${authUserIds.map((id) => `(${literal(id)}::uuid)`).join(',')};`);
  run(['exec', container, 'pg_restore', '-U', 'postgres', '-d', testDb, '--no-owner', '--no-privileges', dump]);
  const rows = migrationScan.map((entry) => {
    const before = beforeById.get(entry.id);
    if (!before) throw new Error(`Missing pre-fix row ${entry.id}`);
    return `(${literal(entry.id)}::uuid,${literal(before.claim_value)},${literal(JSON.stringify(before.claim_json))}::jsonb)`;
  }).join(',\n');
  sql(testDb, `
BEGIN;
CREATE TEMP TABLE platform_pre_fix_baseline(id uuid PRIMARY KEY,claim_value text NOT NULL,claim_json jsonb NOT NULL);
INSERT INTO platform_pre_fix_baseline VALUES ${rows};
UPDATE public.person_claims c SET claim_value=b.claim_value,claim_json=b.claim_json FROM platform_pre_fix_baseline b WHERE c.id=b.id AND c.claim_type='platform';
UPDATE public.people SET source_url='https://votetw.com/wiki/%E8%95%AD%E5%9C%8B%E4%BA%AE',gender='unknown',education='',experience=''
WHERE id='393996c0-60b0-4889-851f-7d4c68f25af9'::uuid;
UPDATE public.people SET source_url='https://votetw.com/wiki/%E8%95%AD%E5%9C%8B%E4%BA%AE',gender='unknown',education='',experience='',is_public=TRUE WHERE id='3702a343-8c9c-410e-865d-63e7ec36b78e'::uuid;
UPDATE public.candidates SET source_name='VoteTW historical election results',
  source_url='https://votetw.com/wiki/2022%E5%B9%B4%E5%B1%8F%E6%9D%B1%E7%B8%A3%E5%B1%8F%E6%9D%B1%E5%B8%82%E5%B8%82%E6%B0%91%E4%BB%A3%E8%A1%A8%E9%81%B8%E8%88%89%E6%8A%95%E7%A5%A8%E7%B5%90%E6%9E%9C'
WHERE id='8a08cdd3-d6b7-4968-815a-fd4c429ba75a'::uuid;
UPDATE public.candidates SET is_public=TRUE WHERE id='3945f08c-8668-44af-b85b-6be92f1ca691'::uuid;
UPDATE public.person_claims SET review_status='verified',visibility='public',is_public=TRUE,claim_json=claim_json-'reviewDecision'
WHERE person_id IN ('3702a343-8c9c-410e-865d-63e7ec36b78e'::uuid,'393996c0-60b0-4889-851f-7d4c68f25af9'::uuid)
  AND source_name IN ('VoteTW','VoteTW historical election results');
UPDATE public.person_claims SET
  claim_key='votetw-person-enrichment:蕭國亮:platform:939a81ca3190debe',
  person_id='3702a343-8c9c-410e-865d-63e7ec36b78e'::uuid,candidate_id=NULL,
  confidence_level='B',review_status='archived',visibility='private',
  source_name='VoteTW',source_url='https://votetw.com/wiki/%E8%95%AD%E5%9C%8B%E4%BA%AE',
  observed_at='2026-07-02 11:13:57.317+00'::timestamptz,is_public=FALSE,review_score=50,
  scoring_version='platform-review-retention-policy-v1',
  scoring_reasons='["B-level source","linked to canonical person",{"reason":"VoteTW platform has no exact candidacy and is outside the retained pending-source policy","version":"platform-review-retention-policy-v1","decision":"archive","reviewedAt":"2026-08-14T11:25:21.069791+00:00"}]'::jsonb,
  auto_reviewed_at=NULL
WHERE id='aca9b005-8604-4cfc-b903-3f7caba1d9a1'::uuid;
DO $x$ BEGIN
  IF (SELECT count(*) FROM public.person_claims WHERE person_id IN ('3702a343-8c9c-410e-865d-63e7ec36b78e'::uuid,'393996c0-60b0-4889-851f-7d4c68f25af9'::uuid) AND source_name IN ('VoteTW','VoteTW historical election results') AND is_public IS TRUE)<>16 THEN
    RAISE EXCEPTION 'Expected 16 restored public VoteTW claims for Xiao Guo-liang';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.person_claims WHERE id='aca9b005-8604-4cfc-b903-3f7caba1d9a1'::uuid AND person_id='3702a343-8c9c-410e-865d-63e7ec36b78e'::uuid AND candidate_id IS NULL AND source_name='VoteTW' AND review_status='archived' AND is_public IS FALSE) THEN
    RAISE EXCEPTION 'Xiao Guo-liang platform baseline relation restore failed';
  END IF;
END $x$;
DO $v$ BEGIN
  IF (SELECT count(*) FROM platform_pre_fix_baseline b JOIN public.person_claims c USING(id) WHERE c.claim_value=b.claim_value AND c.claim_json=b.claim_json)<>298 THEN RAISE EXCEPTION '298-row migration baseline restore failed'; END IF;
  IF (SELECT count(*) FROM public.person_claims WHERE claim_json->>'productionRelease' IN ('20260907-cec-2022-profile-transcription','20260908-cec-2022-xiao-guo-liang-source-replacement'))<>75 THEN RAISE EXCEPTION 'Expected 75 round profile claims'; END IF;
END $v$;
DELETE FROM public.person_claims WHERE claim_json->>'productionRelease' IN ('20260907-cec-2022-profile-transcription','20260908-cec-2022-xiao-guo-liang-source-replacement');
UPDATE public.person_claims SET candidate_id=NULL WHERE id='c3687480-48b1-4020-b122-8833694587d5'::uuid AND person_id='3028bba8-3232-4d8f-8081-ab41503c9409'::uuid AND claim_type='experience' AND candidate_id='d40b3715-5389-42de-856a-caa2bc4c6d3c'::uuid;
DO $v$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.person_claims WHERE id='c3687480-48b1-4020-b122-8833694587d5'::uuid AND candidate_id IS NULL) THEN RAISE EXCEPTION 'Experience relation restore failed'; END IF; END $v$;
COMMIT;`);
  baseline = snapshot(testDb);
  if (baseline.releasedProfileClaims !== 0 || baseline.zhangChiKaiExperienceCandidateId !== null) throw new Error(`Baseline check failed: ${JSON.stringify(baseline)}`);
  for (const migration of migrations) {
    const host = resolve('supabase/migrations', migration);
    const target = `/tmp/${migration}`;
    run(['cp', host, `${container}:${target}`]);
    const output = run(['exec', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', testDb, '-f', target]);
    results.push({ migration, passed: true, output: output.split('\n').filter(Boolean).slice(-8) });
    run(['exec', container, 'rm', '-f', target]);
  }
  rehearsalResult = snapshot(testDb);
  currentResult = snapshot(sourceDb);
  const currentById = new Map(platformRows(sourceDb).map((row) => [row.id, row]));
  differenceDetails = platformRows(testDb).flatMap((row) => {
    const current = currentById.get(row.id);
    if (!current) return [{ id: row.id, difference: 'missing_current' }];
    const keys = new Set([...Object.keys(row.claimJson ?? {}), ...Object.keys(current.claimJson ?? {})]);
    const jsonKeys = [...keys].filter((key) => JSON.stringify(row.claimJson?.[key]) !== JSON.stringify(current.claimJson?.[key]));
    return row.claimValue !== current.claimValue || jsonKeys.length ? [{ id: row.id, claimValueDifferent: row.claimValue !== current.claimValue, jsonKeys }] : [];
  });
  const keys = ['needsReview','verifiedRepair','excludedSpecificSuspicion','releasedProfileClaims','platformContentDigest','platformReleaseStateDigest','profileDigest','zhangChiKaiExperienceCandidateId'];
  const bad = keys.filter((key) => rehearsalResult[key] !== currentResult[key]);
  if (bad.length) throw new Error(`Rehearsal differs from current repaired state: ${bad.join(', ')}`);
  passed = true;
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
} finally {
  try {
    if (passed || !keepFailedRehearsal) run(['exec', container, 'dropdb', '--if-exists', '--force', '-U', 'postgres', testDb]);
    run(['exec', container, 'rm', '-f', dump]);
  } catch (error) {
    failure = [failure, `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`].filter(Boolean).join('\n');
    passed = false;
  }
  writeFileSync(report, JSON.stringify({ version: 1, startedAt, finishedAt: new Date().toISOString(), sourceDatabase: sourceDb, rehearsalDatabase: testDb, migrations: results, baseline, rehearsalResult, currentResult, differenceDetails, passed, failure }, null, 2) + '\n');
}
if (!passed) {
  console.error(failure);
  process.exit(1);
}
console.log(`Pre-fix migration rehearsal passed. Report: ${report}`);
console.log(JSON.stringify(rehearsalResult, null, 2));
