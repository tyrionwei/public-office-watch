-- Run after the policy migration inside a rollback-only transaction.
DO $test$
DECLARE
 p uuid:='10000000-0000-4000-8000-000000000028';
 c uuid:='20000000-0000-4000-8000-000000000028';
 j jsonb; val text;
BEGIN
 INSERT INTO public.people(id,name,education,experience,is_public)
 VALUES(p,'官方來源合成測試','third party school','third party resume',true);
 IF EXISTS(SELECT 1 FROM public.people WHERE id=p AND (education IS NOT NULL OR experience IS NOT NULL)) THEN RAISE EXCEPTION 'unreviewed people fallback';END IF;
 INSERT INTO public.person_claims(id,claim_key,person_id,claim_type,claim_value,claim_json,confidence_level,review_status,visibility,is_public,source_name,source_url)
 VALUES(c,'official-profile-fixture',p,'education','third party school','{}','A','verified','public',true,'Official named fake','https://www.wikidata.org/wiki/Q1');
 IF NOT EXISTS(SELECT 1 FROM public.person_claims WHERE id=c AND review_status='archived' AND NOT is_public AND claim_json->'officialProfilePolicy'->>'reason'='source_policy_disabled') THEN RAISE EXCEPTION 'third party reactivated';END IF;
 UPDATE public.person_claims SET source_url='https://web.cec.gov.tw/fixture',review_status='verified',visibility='public',is_public=true WHERE id=c;
 IF EXISTS(SELECT 1 FROM public.person_claims WHERE id=c AND is_public) THEN RAISE EXCEPTION 'official URL alone accepted';END IF;
 j:=jsonb_build_object('officialProfilePolicy',jsonb_build_object('version','official-profile-v1','eligible',true,'identityVerified',true,'contentVerified',true,
  'binding',md5(p::text||'|education|reviewed official school|https://web.cec.gov.tw/fixture')));
 UPDATE public.person_claims SET claim_value='reviewed official school',claim_json=j,review_status='verified',visibility='public',is_public=true WHERE id=c;
 IF (SELECT education FROM public.people WHERE id=p) IS DISTINCT FROM 'reviewed official school' THEN RAISE EXCEPTION 'official value not adopted';END IF;
 UPDATE public.people SET education='late unreviewed overwrite' WHERE id=p;
 IF (SELECT education FROM public.people WHERE id=p) IS DISTINCT FROM 'reviewed official school' THEN RAISE EXCEPTION 'people fallback overwrote official';END IF;
 UPDATE public.person_claims SET claim_json='{}',review_status='pending',visibility='private',is_public=false WHERE id=c;
 IF NOT EXISTS(SELECT 1 FROM public.person_claims WHERE id=c AND is_public AND review_status='verified') THEN RAISE EXCEPTION 'unchanged reviewed reimport lost approval';END IF;
 -- January 1 is valid when the source actually specifies day precision.
 j:=jsonb_build_object('officialProfilePolicy',jsonb_build_object('version','official-profile-v1','eligible',true,'identityVerified',true,'contentVerified',true,'datePrecision','day',
  'binding',md5(p::text||'|birth_date|1980-01-01|https://web.cec.gov.tw/fixture')));
 UPDATE public.person_claims SET claim_type='birth_date',claim_value='1980-01-01',claim_json=j,review_status='verified',visibility='public',is_public=true WHERE id=c;
 SELECT birth_value INTO val FROM public.official_profile_values WHERE person_id=p;
 IF val IS DISTINCT FROM '1980-01-01' THEN RAISE EXCEPTION 'real January 1 lost'; END IF;
 IF (SELECT education FROM public.people WHERE id=p) IS NOT NULL THEN RAISE EXCEPTION 'removed official field remains'; END IF;

 IF (SELECT birth_date FROM published.person_demographics WHERE person_id=p) IS DISTINCT FROM '1980-01-01'::date THEN RAISE EXCEPTION 'official age projection missing'; END IF;
 j:=jsonb_build_object('officialProfilePolicy',jsonb_build_object('version','official-profile-v1','eligible',true,'identityVerified',true,'contentVerified',true,'datePrecision','year',
  'binding',md5(p::text||'|birth_date|1980|https://web.cec.gov.tw/fixture')));
 UPDATE public.person_claims SET claim_value='1980',claim_json=j WHERE id=c;

 IF (SELECT birth_date FROM published.person_demographics WHERE person_id=p) IS NOT NULL THEN RAISE EXCEPTION 'partial date left fabricated full age'; END IF;
 IF (SELECT birth_value FROM public.official_profile_values WHERE person_id=p) IS DISTINCT FROM '1980' THEN RAISE EXCEPTION 'year precision lost'; END IF;
END $test$;
SELECT 'official profile SQL regression passed';

SET LOCAL ROLE service_role;
INSERT INTO public.person_claims(id,claim_key,person_id,claim_type,claim_value,claim_json,confidence_level,review_status,visibility,is_public,source_name,source_url)
VALUES('20000000-0000-4000-8000-000000000029','official-profile-spoof','10000000-0000-4000-8000-000000000028','education','spoof',jsonb_build_object('officialProfilePolicy',jsonb_build_object('version','official-profile-v1','eligible',true,'identityVerified',true,'contentVerified',true,'binding',md5('10000000-0000-4000-8000-000000000028|education|spoof|https://web.cec.gov.tw/fixture'))),'A','verified','public',true,'official URL only','https://web.cec.gov.tw/fixture');
RESET ROLE;
DO $test$ BEGIN
 IF EXISTS(SELECT 1 FROM public.person_claims WHERE claim_key='official-profile-spoof' AND (is_public OR review_status='verified')) THEN RAISE EXCEPTION 'importer self-attestation accepted'; END IF;
 IF EXISTS(SELECT 1 FROM public.public_people_list_cached WHERE person_id='10000000-0000-4000-8000-000000000028' AND education IS NOT NULL) THEN RAISE EXCEPTION 'stale official profile cache'; END IF;
END $test$;
