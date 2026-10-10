import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

// 僅在明確指定的本機資料庫跑 temp fixtures；不修改研究資料或 migration 歷史。
test('已審核官方登記的來源結案與衝突重新待核', {skip: process.env.POW_LOCAL_DB_TESTS !== '1'}, () => {
  const container='supabase_db_public-office-watch';
  const ports=JSON.parse(execFileSync('docker',['inspect','--format','{{json .NetworkSettings.Ports}}',container],{encoding:'utf8'}));
  assert(ports['5432/tcp'].some(p=>p.HostPort==='54322'));
  const migration=fs.readFileSync(new URL('../../supabase/migrations/20261008103639_resolve_reviewed_registration_sources.sql',import.meta.url),'utf8');
  const tables=['source_people','person_claims','candidates','people','races','elections','person_canonical_map','person_identity_matches'];
  let view=migration.replace('public.identity_unmatched_source_people','pg_temp.test_unmatched');
  for(const t of tables)view=view.replaceAll('public.'+t,'pg_temp.'+t);
  const sid='00000000-0000-4000-8000-000000000001',pid='00000000-0000-4000-8000-000000000002',cid='00000000-0000-4000-8000-000000000003',rid='00000000-0000-4000-8000-000000000004',eid='00000000-0000-4000-8000-000000000005',clid='00000000-0000-4000-8000-000000000006';
  const hash='a'.repeat(64),url='https://web.cec.gov.tw/api/file/fixture.pdf';
  const evidence={name:'測試候選人',status:'registered',registration_date:'2026-09-02',source:{url,sha256:hash}};
  const audit={decision:'verified_official_registration_fact',claimPublic:false,qualificationConfirmed:false,personId:pid,candidateId:cid,sourceUrl:url,sourceHash:hash,registrationDate:'2026-09-02'};
  const json=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
  let sql=`\\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE source_people (id uuid PRIMARY KEY,source_person_key text,source_type text,source_name text,source_url text,raw_name text,normalized_name text,party text,position text,district text,election_year int,confidence_suggestion text,updated_at timestamptz,external_record_id text,external_person_id text,source_id text,source_payload jsonb);
CREATE TEMP TABLE person_claims (id uuid,source_person_id uuid,candidate_id uuid,person_id uuid,claim_type text,review_status text,visibility text,is_public boolean,claim_key text,source_url text,claim_json jsonb);
CREATE TEMP TABLE candidates (id uuid,person_id uuid,race_id uuid,external_id text,source_url text,candidate_name text);
CREATE TEMP TABLE people (id uuid,name text);
CREATE TEMP TABLE races (id uuid,election_id uuid,race_type text);
CREATE TEMP TABLE elections (id uuid,year int);
CREATE TEMP TABLE person_canonical_map (person_id uuid,canonical_person_id uuid);
CREATE TEMP TABLE person_identity_matches (source_person_id uuid,person_id uuid,match_status text,reviewed_at timestamptz,score numeric);
INSERT INTO source_people VALUES ('${sid}','official-candidate:pow-cec-registration-2026-ffffffffffffffffffffffffffffffff','official_election','官方測試來源','${url}','測試候選人','測試候選人',NULL,NULL,NULL,2026,'A',now(),'pow-cec-registration-2026-ffffffffffffffffffffffffffffffff','pow-cec-registration-person-2026-ffffffffffffffffffffffffffffffff','pow-cec-registration-person-2026-ffffffffffffffffffffffffffffffff',${json({candidateExternalId:'pow-cec-registration-2026-ffffffffffffffffffffffffffffffff',personExternalId:'pow-cec-registration-person-2026-ffffffffffffffffffffffffffffffff',candidacyStatus:'registered',targetRace:{id:rid},registrationEvidence:evidence})});
INSERT INTO person_claims VALUES ('${clid}','${sid}','${cid}','${pid}','candidacy','verified','review_only',false,'official-candidacy:pow-cec-registration-2026-ffffffffffffffffffffffffffffffff','${url}',${json({candidateExternalId:'pow-cec-registration-2026-ffffffffffffffffffffffffffffffff',personExternalId:'pow-cec-registration-person-2026-ffffffffffffffffffffffffffffffff',candidacyStatus:'registered',targetRace:{id:rid},registrationEvidence:evidence,registrationFactAdoption20261008:audit})});
INSERT INTO candidates VALUES ('${cid}','${pid}','${rid}','pow-cec-registration-2026-ffffffffffffffffffffffffffffffff','${url}','測試候選人');
INSERT INTO people VALUES ('${pid}','測試候選人');
INSERT INTO races VALUES ('${rid}','${eid}','township_mayor');
INSERT INTO elections VALUES ('${eid}',2026);
INSERT INTO person_canonical_map VALUES ('${pid}','${pid}');
${view}
`;
  const cases=[];
  function check(name,mutation,expected){
    cases.push(name);
    sql+=`SAVEPOINT scenario;
${mutation}
DO $$ BEGIN IF (SELECT count(*) FROM pg_temp.test_unmatched) <> ${expected} THEN RAISE EXCEPTION '${name}'; END IF; END $$;
ROLLBACK TO SAVEPOINT scenario;
`;
  }
  check('verified_registration_closes_source','',0);
  function consistentSourceUrl(nextUrl) {
    const literal="'"+nextUrl.replaceAll("'","''")+"'";
    return `UPDATE source_people SET source_url=${literal},source_payload=replace(source_payload::text,'${url}',${literal})::jsonb;
UPDATE person_claims SET source_url=${literal},claim_json=replace(claim_json::text,'${url}',${literal})::jsonb;
UPDATE candidates SET source_url=${literal};`;
  }
  const xlsx=consistentSourceUrl('https://web.cec.gov.tw/api/file/fixture.xlsx');
  check('verified_official_xlsx_closes_source',xlsx,0);
  check('pending_xlsx_not_resolved',xlsx+"UPDATE person_claims SET review_status='pending';",1);
  check('xlsx_identity_hold_reopens',xlsx+`UPDATE person_claims SET claim_json=claim_json||'{"identityAudit":{"status":"pending"}}';`,1);
  check('untrusted_xlsx_host_not_resolved',consistentSourceUrl('https://example.org/api/file/fixture.xlsx'),1);
  check('unsupported_csv_not_resolved',consistentSourceUrl('https://web.cec.gov.tw/api/file/fixture.csv'),1);
  check('xlsx_suffix_spoof_not_resolved',consistentSourceUrl('https://web.cec.gov.tw/api/file/fixture.xlsx.exe'),1);
  check('missing_approval_stays_pending',"UPDATE person_claims SET claim_json=claim_json-'registrationFactAdoption20261008';",1);
  check('pending_claim_not_resolved',"UPDATE person_claims SET review_status='pending';",1);
  check('source_content_drift_reopens',`UPDATE source_people SET source_payload=jsonb_set(source_payload,'{registrationEvidence,name}','"另一人"');`,1);
  check('audit_person_mismatch_reopens',`UPDATE person_claims SET claim_json=jsonb_set(claim_json,'{registrationFactAdoption20261008,personId}','"00000000-0000-4000-8000-000000000099"');`,1);
  check('candidate_binding_drift_reopens',`UPDATE candidates SET person_id='00000000-0000-4000-8000-000000000099';`,1);
  check('external_key_drift_reopens',"UPDATE source_people SET external_record_id='another-election';",1);
  check('race_year_mismatch_reopens',"UPDATE elections SET year=2022;",1);
  check('low_level_remains_deferred',"UPDATE races SET race_type='village_chief';",1);
  const crossSourceHold = `UPDATE person_claims SET claim_json=claim_json||'{"privateRegistrationBinding20261008":{"crossSourceIdentityResolved":false,"sameBatchIdentityResolved":false}}';`;
  check('cross_source_and_same_batch_hold_stays_pending',crossSourceHold,1);
  check('cross_source_hold_alone_stays_pending',`UPDATE person_claims SET claim_json=claim_json||'{"privateRegistrationBinding20261008":{"crossSourceIdentityResolved":false}}';`,1);
  check('same_batch_hold_alone_stays_pending',`UPDATE person_claims SET claim_json=claim_json||'{"privateRegistrationBinding20261008":{"sameBatchIdentityResolved":false}}';`,1);
  check('explicit_cross_source_resolution_allows_closure',`UPDATE person_claims SET claim_json=claim_json||'{"privateRegistrationBinding20261008":{"crossSourceIdentityResolved":true,"sameBatchIdentityResolved":true}}';`,0);
  check('null_cross_source_resolution_stays_pending',`UPDATE person_claims SET claim_json=claim_json||'{"privateRegistrationBinding20261008":{"crossSourceIdentityResolved":null}}';`,1);
  check('string_cross_source_resolution_stays_pending',`UPDATE person_claims SET claim_json=claim_json||'{"privateRegistrationBinding20261008":{"crossSourceIdentityResolved":"true"}}';`,1);
  check('cross_source_hold_cannot_be_hidden_by_auto_match',crossSourceHold+`INSERT INTO person_identity_matches VALUES ('${sid}','${pid}','auto_matched',NULL,100);`,1);
  check('cross_source_hold_xlsx_stays_pending',xlsx+crossSourceHold,1);
  check('identity_hold_reopens',`UPDATE person_claims SET claim_json=claim_json||'{"identityAudit":{"status":"pending"}}';`,1);
  check('sibling_candidacy_reopens',`INSERT INTO person_claims SELECT '00000000-0000-4000-8000-000000000007',source_person_id,candidate_id,person_id,claim_type,'pending',visibility,is_public,claim_key||'-new',source_url,claim_json FROM person_claims;`,1);
  check('unrelated_education_pending_is_not_identity_hold',`INSERT INTO person_claims SELECT '00000000-0000-4000-8000-000000000007',source_person_id,candidate_id,person_id,'education','pending',visibility,is_public,claim_key||'-education',source_url,'{}' FROM person_claims;`,0);
  check('reviewed_conflicting_match_reopens',`INSERT INTO person_identity_matches VALUES ('${sid}','00000000-0000-4000-8000-000000000099','probable_match',now(),90);`,1);
  check('conflicting_auto_match_cannot_hide_source',`INSERT INTO person_identity_matches VALUES ('${sid}','00000000-0000-4000-8000-000000000099','auto_matched',NULL,100);`,1);
  check('rejected_same_person_reopens',`INSERT INTO person_identity_matches VALUES ('${sid}','${pid}','rejected_match',now(),0);`,1);
  check('same_person_manual_hold_reopens',`INSERT INTO person_identity_matches VALUES ('${sid}','${pid}','probable_match',now(),70);`,1);
  check('same_person_unreviewed_suggestion_preserves_resolution',`INSERT INTO person_identity_matches VALUES ('${sid}','${pid}','probable_match',NULL,70);`,0);
  check('old_audit_history_does_not_reopen',`UPDATE person_claims SET claim_json=claim_json||'{"identityReviewRound17Audit":{"decision":"pending"}}';`,0);
  check('source_payload_candidate_drift_reopens',`UPDATE source_people SET source_payload=jsonb_set(source_payload,'{candidateExternalId}','"another-candidate"');`,1);
  check('source_payload_person_drift_reopens',`UPDATE source_people SET source_payload=jsonb_set(source_payload,'{personExternalId}','"another-person"');`,1);
  check('source_payload_qualification_drift_reopens',`UPDATE source_people SET source_payload=jsonb_set(source_payload,'{candidacyStatus}','"qualified"');`,1);
  check('other_year_even_if_consistent_is_not_current_scope',`UPDATE source_people SET election_year=2022,source_payload=replace(source_payload::text,'2026','2022')::jsonb,source_person_key=replace(source_person_key,'2026','2022'),external_record_id=replace(external_record_id,'2026','2022'),external_person_id=replace(external_person_id,'2026','2022'),source_id=replace(source_id,'2026','2022'); UPDATE elections SET year=2022; UPDATE candidates SET external_id=replace(external_id,'2026','2022'); UPDATE person_claims SET claim_key=replace(claim_key,'2026','2022'),claim_json=replace(claim_json::text,'2026','2022')::jsonb;`,1);
  check('legacy_auto_match_semantics_preserved',`UPDATE person_claims SET claim_json=claim_json-'registrationFactAdoption20261008'; INSERT INTO person_identity_matches VALUES ('${sid}','${pid}','auto_matched',NULL,100);`,0);
  check('public_claim_is_not_private_registration_resolution',"UPDATE person_claims SET is_public=true,visibility='public';",1);
  sql+='ROLLBACK;\n';
  const result=execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-X','-q','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',maxBuffer:2e6});
  assert(!result.includes('ERROR'));
  console.log(`本機暫存資料驗證通過：${cases.length} 個情境；永久資料寫入 0。`);
});
