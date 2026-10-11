import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

// 與登記 fixture 相同的 opt-in 本機入口。只替換交易內的資料依賴，
// 實際投影函式及具名 RPC 都會執行；不匯入研究資料、不授予匿名權限。
test('親屬 JSON 白名單與公開 RPC 不洩漏私人審核內容', {
  skip: process.env.POW_LOCAL_DB_TESTS !== '1',
}, () => {
  const container = 'supabase_db_public-office-watch';
  const ports = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', container], { encoding: 'utf8' }));
  assert(ports['5432/tcp'].some((port) => port.HostPort === '54322'));
  const migration = fs.readFileSync(new URL('../../supabase/migrations/20261008082324_protect_public_family_claim_json.sql', import.meta.url), 'utf8');
  const person = '00000000-0000-4000-8000-000000000091';
  const marker = 'POW_SYNTHETIC_PRIVATE_REVIEW_DO_NOT_PUBLISH';
  const approved = { version: 'family-publication-v1', decision: 'explicit_user_approved', eligible: true };
  const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
  const json = (value) => quote(JSON.stringify(value)) + '::jsonb';
  const checks = [];
  const check = (name, predicate) => {
    checks.push(name);
    return `DO $$ BEGIN IF (${predicate}) IS DISTINCT FROM true THEN RAISE EXCEPTION '${name}'; END IF; END $$;\n`;
  };
  // 回滾後確認函式、既有資料列數及 ACL 原封不動；不把命令成功當作回復證據。
  const state = `SELECT jsonb_build_object(
    'projection', pg_get_functiondef('public.public_official_profile_json(text,jsonb)'::regprocedure),
    'rpc', pg_get_functiondef('published.person_claims_for(uuid[])'::regprocedure),
    'claim_count', (SELECT count(*) FROM public.person_claims),
    'relation_acl', (SELECT jsonb_agg(jsonb_build_array(c.oid,c.relacl) ORDER BY c.oid)
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','published')),
    'function_acl', (SELECT jsonb_agg(jsonb_build_array(p.oid,p.proacl) ORDER BY p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','published'))
  )`;
  let sql = `\\set ON_ERROR_STOP on
${state} AS before_state \\gset
BEGIN;
${migration}
CREATE TEMP TABLE person_claims AS SELECT * FROM public.person_claims WITH NO DATA;
CREATE TEMP TABLE people (id uuid, is_public boolean);
CREATE TEMP TABLE person_merge_decisions (canonical_person_id uuid, duplicate_person_id uuid, status text);
CREATE TEMP TABLE person_canonical_map (person_id uuid, canonical_person_id uuid);
CREATE TEMP TABLE public_people_list_cached (person_id uuid);
CREATE TEMP TABLE official_profile_values (person_id uuid, birth_conflict boolean);
INSERT INTO people VALUES ('${person}',true);
INSERT INTO person_canonical_map VALUES ('${person}','${person}');
INSERT INTO public_people_list_cached VALUES ('${person}');
DO $$
DECLARE definition text; relation_name text;
BEGIN
  definition := pg_get_functiondef('published.person_claims_for(uuid[])'::regprocedure);
  FOREACH relation_name IN ARRAY ARRAY['person_claims','people','person_merge_decisions','public_people_list_cached'] LOOP
    IF position('public.' || relation_name IN definition)=0 THEN
      RAISE EXCEPTION 'RPC fixture dependency changed: %',relation_name;
    END IF;
    definition := replace(definition,'public.' || relation_name,'pg_temp.' || relation_name);
  END LOOP;
  EXECUTE definition;
  -- 使用既有公開 view 定義，只將資料來源指向空白合成表。
  PERFORM set_config('search_path','pg_catalog',true);
  definition := pg_get_viewdef('public.public_person_claims'::regclass,true);
  FOREACH relation_name IN ARRAY ARRAY['person_claims','people','person_canonical_map','official_profile_values'] LOOP
    IF position('public.' || relation_name IN definition)=0 THEN
      RAISE EXCEPTION 'Projection fixture dependency changed: %',relation_name;
    END IF;
    definition := replace(definition,'public.' || relation_name,'pg_temp.' || relation_name);
  END LOOP;
  EXECUTE 'CREATE TEMP VIEW test_public_claims AS ' || definition;
  PERFORM set_config('search_path','pg_catalog,public',true);
END $$;
`;
  const policies = [
    { ...approved, privateNote: marker },
    undefined, null, [], 'approved', {},
    { ...approved, decision: 'automatic' },
    { ...approved, version: 'unknown' },
    { ...approved, eligible: false },
    { ...approved, eligible: 'true' },
  ];
  policies.forEach((policy, index) => {
    const id = `00000000-0000-4000-8100-${String(index + 1).padStart(12, '0')}`;
    const payload = { privateReview: marker, identityEvidence: { note: marker }, familyPublicationPolicy: policy };
    const expected = index === 0 ? { familyPublicationPolicy: approved } : {};
    sql += `INSERT INTO pg_temp.person_claims (id,person_id,claim_type,claim_value,claim_json,review_status,visibility,is_public,review_score,confidence_level)
VALUES ('${id}','${person}','family_relation','合成親屬文字',${json(payload)},'verified','public',true,80,'B');\n`;
    sql += check(`family_${index}_projection`, `public.public_official_profile_json('family_relation',${json(payload)}) = ${json(expected)}`);
    sql += check(`family_${index}_view`, `(SELECT claim_json FROM pg_temp.test_public_claims WHERE claim_id='${id}') = ${json(expected)}`);
    sql += check(`family_${index}_rpc`, `(SELECT claim_json FROM published.person_claims_for(ARRAY['${person}'::uuid]) WHERE claim_id='${id}') = ${json(expected)}`);
  });
  // 政策核准標記也不能將私人／待審／不可公開資料帶入 RPC。
  for (const [index, status, visibility, isPublic] of [
    [21, 'pending', 'public', true], [22, 'verified', 'private', true],
    [23, 'verified', 'review_only', false], [24, 'verified', 'public', false],
  ]) {
    const id = `00000000-0000-4000-8100-${String(index).padStart(12, '0')}`;
    sql += `INSERT INTO pg_temp.person_claims (id,person_id,claim_type,claim_value,claim_json,review_status,visibility,is_public)
VALUES ('${id}','${person}','family_relation','${marker}',${json({ familyPublicationPolicy: approved, privateReview: marker })},'${status}','${visibility}',${isPublic});\n`;
    sql += check(`private_${index}_view`, `NOT EXISTS(SELECT 1 FROM pg_temp.test_public_claims WHERE claim_id='${id}')`);
    sql += check(`private_${index}_rpc`, `NOT EXISTS(SELECT 1 FROM published.person_claims_for(ARRAY['${person}'::uuid]) WHERE claim_id='${id}')`);
  }
  for (const [index, type, value] of [[31, 'birth_date', '1980'], [32, 'education', '合成學校'], [33, 'experience', '合成經歷']]) {
    const id = `00000000-0000-4000-8100-${String(index).padStart(12, '0')}`;
    const policy = { version: 'official-profile-v1', eligible: true, identityVerified: true, contentVerified: true, datePrecision: 'year' };
    const expected = { officialProfilePolicy: policy };
    const payload = `${json({ ...expected, privateReview: marker })} || jsonb_build_object('officialProfilePolicy',${json(policy)} || jsonb_build_object('binding',md5('${person}|${type}|${value}|https://example.gov.tw/fixture')))`;
    sql += `INSERT INTO pg_temp.person_claims (id,person_id,claim_type,claim_value,claim_json,source_url,review_status,visibility,is_public)
VALUES ('${id}','${person}','${type}','${value}',${payload},'https://example.gov.tw/fixture','verified','public',true);\n`;
    sql += check(`${type}_view_unchanged`, `(SELECT claim_json FROM pg_temp.test_public_claims WHERE claim_id='${id}') = ${json(expected)}`);
    sql += check(`${type}_rpc_unchanged`, `(SELECT claim_json FROM published.person_claims_for(ARRAY['${person}'::uuid]) WHERE claim_id='${id}') = ${json(expected)}`);
  }
  sql += `INSERT INTO pg_temp.person_claims (id,person_id,claim_type,claim_value,claim_json,review_status,visibility,is_public)
VALUES ('00000000-0000-4000-8100-000000000040','${person}','platform','合成政見','{"publicText":"kept","nested":{"value":1}}','verified','public',true);\n`;
  sql += check('other_type_view_unchanged', `(SELECT claim_json FROM pg_temp.test_public_claims WHERE claim_type='platform') = '{"publicText":"kept","nested":{"value":1}}'::jsonb`);
  sql += check('other_type_rpc_unchanged', `(SELECT claim_json FROM published.person_claims_for(ARRAY['${person}'::uuid]) WHERE claim_type='platform') = '{"publicText":"kept","nested":{"value":1}}'::jsonb`);
  sql += check('view_no_private_marker', `NOT EXISTS(SELECT 1 FROM pg_temp.test_public_claims t WHERE to_jsonb(t)::text LIKE '%${marker}%')`);
  sql += check('rpc_no_private_marker', `NOT EXISTS(SELECT 1 FROM published.person_claims_for(ARRAY['${person}'::uuid]) t WHERE to_jsonb(t)::text LIKE '%${marker}%')`);
  sql += check('rpc_no_unrequested_person', `(SELECT count(*) FROM published.person_claims_for(ARRAY['00000000-0000-4000-8000-000000000092'::uuid])) = 0`);
  sql += `ROLLBACK;
SELECT 1 / CASE WHEN (${state}) = :'before_state'::jsonb THEN 1 ELSE 0 END AS rollback_verified;
`;
  const result = execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8', maxBuffer: 2e6 });
  assert.match(result, /rollback_verified/);
  console.log(`本機親屬投影／RPC：${checks.length} 個斷言通過；函式、ACL、原資料列數回滾一致。`);
});
