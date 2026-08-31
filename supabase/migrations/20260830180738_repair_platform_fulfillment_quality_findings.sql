BEGIN;

DO $repair$
DECLARE
    affected_count INTEGER;
    education_promise CONSTANT TEXT := '義務教育向下扎根至５歲，減輕父母負擔。';
BEGIN
    UPDATE public.person_claims AS claim
    SET
        claim_json = pg_catalog.jsonb_set(
            COALESCE(claim.claim_json, '{}'::JSONB) - 'items',
            '{contentSplit}',
            COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                || pg_catalog.jsonb_build_object(
                    'reviewStatus',
                    'needs_review',
                    'releaseQuality',
                    pg_catalog.jsonb_build_object(
                        'version',
                        'platform-fulfillment-release-v2',
                        'reasonCodes',
                        pg_catalog.jsonb_build_array('post_deployment_quality_review')
                    )
                ),
            TRUE
        ),
        updated_at = pg_catalog.now()
    WHERE claim.id = ANY (ARRAY[
        '806bc1b0-d56a-4ee1-93fd-27516ccc9965'::UUID,
        '5c50aed9-ea2a-403b-be8e-cc9f12c92b5c'::UUID,
        '5214decb-6180-4015-8b0a-54709e209c80'::UUID,
        '156e4558-0a6f-42e0-8672-69c73ad12490'::UUID,
        '935b436c-923d-4554-8233-bb6fef0e892c'::UUID
    ])
      AND claim.claim_type = 'platform'
      AND claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public = TRUE;

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    IF affected_count <> 5 THEN
        RAISE EXCEPTION 'Expected to withhold 5 reviewed platform quality findings, updated %', affected_count;
    END IF;

    UPDATE public.person_claims AS claim
    SET
        claim_json = pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                COALESCE(claim.claim_json, '{}'::JSONB),
                '{items}',
                CASE
                    WHEN COALESCE(claim.claim_json -> 'items', '[]'::JSONB)
                        @> pg_catalog.jsonb_build_array(education_promise)
                    THEN claim.claim_json -> 'items'
                    ELSE COALESCE(claim.claim_json -> 'items', '[]'::JSONB)
                        || pg_catalog.jsonb_build_array(education_promise)
                END,
                TRUE
            ),
            '{contentSplit}',
            COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                || pg_catalog.jsonb_build_object(
                    'method',
                    'post_deployment_manual_review',
                    'confidence',
                    100,
                    'reviewStatus',
                    'reviewed',
                    'releaseQuality',
                    pg_catalog.jsonb_build_object(
                        'version',
                        'platform-fulfillment-release-v2',
                        'reasonCodes',
                        '[]'::JSONB
                    )
                ),
            TRUE
        ),
        updated_at = pg_catalog.now()
    WHERE claim.id = '42ba0525-3af7-48f5-9f35-a7c14e697d7f'::UUID
      AND claim.claim_type = 'platform'
      AND claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public = TRUE
      AND pg_catalog.jsonb_typeof(claim.claim_json -> 'items') = 'array';

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    IF affected_count <> 1 THEN
        RAISE EXCEPTION 'Expected to repair the reviewed Wu Chih-kang platform claim';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.person_claims AS claim
        WHERE claim.id = ANY (ARRAY[
            '806bc1b0-d56a-4ee1-93fd-27516ccc9965'::UUID,
            '5c50aed9-ea2a-403b-be8e-cc9f12c92b5c'::UUID,
            '5214decb-6180-4015-8b0a-54709e209c80'::UUID,
            '156e4558-0a6f-42e0-8672-69c73ad12490'::UUID,
            '935b436c-923d-4554-8233-bb6fef0e892c'::UUID
        ])
          AND (
              claim.claim_json ? 'items'
              OR claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'needs_review'
          )
    ) THEN
        RAISE EXCEPTION 'A withheld platform quality finding remains releaseable';
    END IF;

    IF (
        SELECT pg_catalog.count(*)
        FROM pg_catalog.jsonb_array_elements_text(
            (SELECT claim.claim_json -> 'items'
             FROM public.person_claims AS claim
             WHERE claim.id = '42ba0525-3af7-48f5-9f35-a7c14e697d7f'::UUID)
        ) AS item(value)
        WHERE item.value = education_promise
    ) <> 1 THEN
        RAISE EXCEPTION 'The missing education promise was not restored exactly once';
    END IF;
END
$repair$;

COMMIT;
