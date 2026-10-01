-- 本機既有資料的小範圍回歸；由外層 BEGIN/ROLLBACK 包住，勿直接跑正式環境。
DO $test$
DECLARE
    person uuid := '5dffdbb8-9047-49d7-988f-b43e4bb38f6c';
    member uuid;
    birth text;
    value text;
    policy jsonb;
    test_claim uuid := '20000000-0000-4000-8000-000000000101';
BEGIN
    SELECT duplicate_person_id INTO STRICT member
    FROM public.person_merge_decisions
    WHERE canonical_person_id = person AND status = 'verified'
    ORDER BY duplicate_person_id LIMIT 1;
    SELECT birth_value INTO STRICT birth FROM public.official_profile_values WHERE person_id = person;
    IF birth IS NULL THEN RAISE EXCEPTION 'Fixture requires a reviewed, non-conflicting birth date'; END IF;
    value := left(birth, 4);
    policy := jsonb_build_object('officialProfilePolicy', jsonb_build_object(
        'version','official-profile-v1','eligible',true,'identityVerified',true,
        'contentVerified',true,'datePrecision','year',
        'binding',md5(member::text||'|birth_date|'||value||'|https://web.cec.gov.tw/fixture')));
    INSERT INTO public.person_claims(id,claim_key,person_id,claim_type,claim_value,claim_json,
        confidence_level,review_status,visibility,is_public,source_name,source_url)
    VALUES(test_claim,'scoped-rpc-birth-test',member,'birth_date',value,policy,
        'A','verified','public',true,'SQL fixture','https://web.cec.gov.tw/fixture');
    IF NOT EXISTS(SELECT 1 FROM published.person_claims_for(ARRAY[person]) WHERE claim_id=test_claim) THEN
        RAISE EXCEPTION 'Compatible year precision from verified merge member was lost';
    END IF;
    value := CASE WHEN left(birth,4) = '1800' THEN '1801' ELSE '1800' END;
    policy := jsonb_set(policy,'{officialProfilePolicy,binding}',to_jsonb(md5(member::text||'|birth_date|'||value||'|https://web.cec.gov.tw/fixture')));
    UPDATE public.person_claims SET claim_value=value,claim_json=policy WHERE id=test_claim;
    IF EXISTS(SELECT 1 FROM published.person_claims_for(ARRAY[person]) WHERE claim_type='birth_date') THEN
        RAISE EXCEPTION 'Conflicting verified member birth dates became public';
    END IF;
    IF NOT (SELECT birth_conflict FROM public.official_profile_values WHERE person_id=person) THEN
        RAISE EXCEPTION 'Local conflict result differs from original global policy';
    END IF;
    DELETE FROM public.person_claims WHERE id=test_claim;
    IF NOT EXISTS(SELECT 1 FROM published.person_claims_for(ARRAY[person]) WHERE claim_type='birth_date') THEN
        RAISE EXCEPTION 'Resolved conflict did not restore public birth claims';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon' AND 'statement_timeout=5s'=ANY(rolconfig)) THEN
        RAISE EXCEPTION 'anon timeout is not 5s';
    END IF;
    IF EXISTS(SELECT 1 FROM published.person_claims_for(ARRAY[]::uuid[])) THEN
        RAISE EXCEPTION 'Empty request returned claims';
    END IF;
    IF EXISTS(SELECT 1 FROM published.person_claims_for(ARRAY['00000000-0000-0000-0000-000000000000']::uuid[])) THEN
        RAISE EXCEPTION 'Unknown person returned claims';
    END IF;
END;
$test$;
SELECT 'scoped person RPC regression passed';
