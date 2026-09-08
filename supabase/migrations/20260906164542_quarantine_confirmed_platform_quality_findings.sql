BEGIN;

CREATE OR REPLACE FUNCTION public.guard_platform_item_changes_with_votes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF OLD.claim_json -> 'items' IS DISTINCT FROM NEW.claim_json -> 'items'
       AND EXISTS (
           SELECT 1
           FROM public.platform_fulfillment_votes AS vote
           WHERE vote.claim_id = OLD.id
       ) THEN
        RAISE EXCEPTION
            'Cannot change platform items for claim % while fulfillment votes exist',
            OLD.id
            USING ERRCODE = '55000';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_platform_item_changes_with_votes
    ON public.person_claims;
CREATE TRIGGER guard_platform_item_changes_with_votes
BEFORE UPDATE OF claim_json ON public.person_claims
FOR EACH ROW
EXECUTE FUNCTION public.guard_platform_item_changes_with_votes();

DO $quarantine$
DECLARE
    affected_count INTEGER;
    finding_ids CONSTANT UUID[] := ARRAY[
        'd191edc9-db0c-4945-83a6-61591ce3d735'::UUID,
        'e2def1e0-5ef3-4d66-8f1e-4c3bf5cf5d93'::UUID,
        '7d74bc4c-aebf-4b49-b120-a950a2ff237e'::UUID,
        'fd5c579d-225b-436f-88a2-b9aff315e1a6'::UUID,
        'f02df98a-ccdf-4a8d-a5c0-66091e89ba4a'::UUID,
        '11b48057-0fce-4122-b59b-8b946d474533'::UUID,
        '806bc1b0-d56a-4ee1-93fd-27516ccc9965'::UUID,
        '545ec16f-506e-4683-9a1b-11679d2a9c80'::UUID,
        'b18a87e1-aa95-4bc7-a098-aadf1d0b56df'::UUID,
        'd3c52747-8a9c-4ed8-aedf-8be4eef93fb5'::UUID,
        'da307a57-1b2b-4920-9afe-c9c118d31293'::UUID,
        'ddfab220-fa61-45f9-bfb3-8bf9edff7529'::UUID,
        '001b43e5-8866-4e1c-801a-c097e531273f'::UUID,
        '987d1197-7508-40a0-aa03-b2639f095892'::UUID,
        '0038ea5e-d68a-48bb-9d97-0fc436549ae0'::UUID,
        'd50b80a9-02d3-4c62-987d-0ca6559300b7'::UUID,
        'f370c034-1174-4a75-80aa-b97a9dd1353a'::UUID
    ];
BEGIN
    UPDATE public.person_claims AS claim
    SET
        claim_json = pg_catalog.jsonb_set(
            COALESCE(claim.claim_json, '{}'::JSONB),
            '{contentSplit}',
            COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                || pg_catalog.jsonb_build_object(
                    'reviewStatus',
                    'needs_review',
                    'releaseQuality',
                    pg_catalog.jsonb_build_object(
                        'version',
                        'platform-quality-audit-20260907-v1',
                        'reasonCodes',
                        pg_catalog.jsonb_build_array('confirmed_content_quality_finding')
                    )
                ),
            TRUE
        ),
        updated_at = pg_catalog.now()
    WHERE claim.id = ANY (finding_ids)
      AND claim.claim_type = 'platform'
      AND claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public = TRUE;

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    IF affected_count <> pg_catalog.array_length(finding_ids, 1) THEN
        RAISE EXCEPTION
            'Expected to quarantine % confirmed platform findings, updated %',
            pg_catalog.array_length(finding_ids, 1),
            affected_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.person_claims AS claim
        WHERE claim.id = ANY (finding_ids)
          AND claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'needs_review'
    ) THEN
        RAISE EXCEPTION 'A confirmed platform quality finding remains releaseable';
    END IF;
END
$quarantine$;

COMMIT;
