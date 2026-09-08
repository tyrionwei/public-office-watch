BEGIN;

DO $reconcile$
DECLARE affected_count INTEGER;
BEGIN
    UPDATE public.person_claims AS claim
    SET claim_json=pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                COALESCE(claim.claim_json,'{}'::JSONB),
                '{contentSplit}',
                COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object(
                    'reviewStatus','reviewed',
                    'releaseQuality',pg_catalog.jsonb_build_object('version','verified-platform-repair-20260907','reasonCodes','[]'::JSONB)
                ),
                TRUE
            ),
            '{platformQualityAudit}',
            COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object(
                'repairVersion','verified-platform-repair-20260907',
                'repair','official_bulletin_image_confirmed_short_platform',
                'classification','verified_short_platform'
            ),
            TRUE
        ),
        updated_at=pg_catalog.now()
    WHERE claim.id='92125e61-820d-4403-a106-0e4b2f67038b'::UUID
      AND claim.person_id='62d79cbd-48e4-4c0a-b936-ef1ce3673fbd'::UUID
      AND claim.candidate_id='36dafa04-d36c-4a31-a2ad-787e568c91f6'::UUID
      AND claim.claim_type='platform'
      AND pg_catalog.md5(claim.source_url)='aea27b7e98fe237e1948cd41bf24ee17'
      AND pg_catalog.md5(claim.claim_value)='31f48c0650efede5ffb24fde64db4663'
      AND pg_catalog.length(claim.claim_value)=2
      AND claim.claim_json->>'platformText'=claim.claim_value
      AND claim.claim_json->'items'='["做事"]'::JSONB
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
      AND claim.claim_json#>>'{contentSplit,releaseQuality,version}'='restored-local-reviewed-metadata-20260907'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='restore_after_local_reclassification'
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='verified_repair';
    GET DIAGNOSTICS affected_count=ROW_COUNT;
    IF affected_count>1 THEN RAISE EXCEPTION 'Expected at most one short-platform reconciliation, found %',affected_count; END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.person_claims AS claim
        WHERE claim.id='92125e61-820d-4403-a106-0e4b2f67038b'::UUID
          AND claim.person_id='62d79cbd-48e4-4c0a-b936-ef1ce3673fbd'::UUID
          AND claim.candidate_id='36dafa04-d36c-4a31-a2ad-787e568c91f6'::UUID
          AND claim.claim_type='platform'
          AND pg_catalog.md5(claim.source_url)='aea27b7e98fe237e1948cd41bf24ee17'
          AND claim.claim_value='做事'
          AND claim.claim_json->>'platformText'='做事'
          AND claim.claim_json->'items'='["做事"]'::JSONB
          AND claim.claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
          AND claim.claim_json#>>'{contentSplit,releaseQuality,version}'='verified-platform-repair-20260907'
          AND claim.claim_json#>>'{platformQualityAudit,repair}'='official_bulletin_image_confirmed_short_platform'
          AND claim.claim_json#>>'{platformQualityAudit,classification}'='verified_short_platform'
    ) THEN RAISE EXCEPTION 'Short-platform reconciliation final state is not exact'; END IF;
END
$reconcile$;

COMMIT;
