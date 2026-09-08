BEGIN;

DO $review$
DECLARE
    review RECORD;
    affected_count INTEGER;
    total_affected INTEGER := 0;
BEGIN
    FOR review IN
        SELECT *
        FROM (
            VALUES
                (
                    'd4469844-ee88-44b8-a3aa-0423bc51d03b'::UUID,
                    'a1e5032e-ec18-4d72-a811-e13a8bf603a9'::UUID,
                    '267b8f39-0413-442e-b376-4a40eb52307e'::UUID,
                    'party-candidate:tpp-2026-city_councilor-174:platform'::TEXT,
                    'a7861d908141b97062a8d8aa8065e1cd'::TEXT,
                    73,
                    'https://www.tpp.org.tw/election2026/candidatedetail.php?cid=174'::TEXT
                ),
                (
                    'c635297b-09d9-4f47-a69c-b100694f4736'::UUID,
                    'ff447997-5a5d-420f-b163-dc154372c026'::UUID,
                    '26db6128-23f9-4afa-a8ce-e1ad56f3e988'::UUID,
                    'party-candidate:tpp-2026-city_councilor-168:platform'::TEXT,
                    '89fa9f2d4c1a30bbe2ae94f58f8d2739'::TEXT,
                    129,
                    'https://www.tpp.org.tw/election2026/candidatedetail.php?cid=168'::TEXT
                ),
                (
                    '97ff5578-e89a-4315-a57a-cb0b0b56f99c'::UUID,
                    '5c212987-e5b6-441e-a9b5-12ea191f09e3'::UUID,
                    '55fe6fb1-38b6-4895-acb5-895acb903108'::UUID,
                    'party-candidate:tpp-2026-city_councilor-188:platform'::TEXT,
                    '21a94da1932dc855f49e22a602bbeceb'::TEXT,
                    156,
                    'https://www.tpp.org.tw/election2026/candidatedetail.php?cid=188'::TEXT
                ),
                (
                    'd78687d8-4044-46d3-aa3e-0a2307fcf6ed'::UUID,
                    '37c927f5-7e85-4696-a937-587a61a88da6'::UUID,
                    '99bcb105-9b0d-4203-939c-28d6b872a7fa'::UUID,
                    'party-candidate:tpp-2026-city_councilor-175:platform'::TEXT,
                    '716fa5c7e9ebe3d45f1611d80d7f1a25'::TEXT,
                    362,
                    'https://www.tpp.org.tw/election2026/candidatedetail.php?cid=175'::TEXT
                ),
                (
                    '511834d7-4ff2-4200-b469-cfff968297b3'::UUID,
                    '8644ee1c-bed9-4129-91e3-e0ccff996586'::UUID,
                    '61b3d5bd-4b50-429e-90ce-a4b3a81c834a'::UUID,
                    'party-candidate:tpp-2026-city_councilor-185:platform'::TEXT,
                    'd173ea3a689f9aed5fd0f007de200428'::TEXT,
                    163,
                    'https://www.tpp.org.tw/election2026/candidatedetail.php?cid=185'::TEXT
                ),
                (
                    '9d3f9d3a-7561-454c-baa2-732290e93661'::UUID,
                    '29430a15-6243-44db-8eb0-fde01566920c'::UUID,
                    '263772f1-b984-4676-bc69-b297ade1920f'::UUID,
                    'party-candidate:tpp-2026-county_councilor-211:platform'::TEXT,
                    '1333c3a83cfa25c25a5bbf531e10ac73'::TEXT,
                    356,
                    'https://www.tpp.org.tw/election2026/candidatedetail.php?cid=211'::TEXT
                ),
                (
                    '6510bd03-a7b3-4841-ad6d-2939ac480266'::UUID,
                    '30e0f9d6-84b6-4b01-8198-9e4132bd194b'::UUID,
                    '73b1aba1-2a94-4254-8e45-7ab4a02327e9'::UUID,
                    'party-candidate:tpp-2026-city_councilor-161:platform'::TEXT,
                    '74c67337c99d70a201d54355811ebac7'::TEXT,
                    336,
                    'https://www.tpp.org.tw/election2026/candidatedetail.php?cid=161'::TEXT
                ),
                (
                    '8aa33b09-36cc-46c2-a7cc-b077819aa048'::UUID,
                    'cfc48765-c625-4a11-be68-56cc93b7fa9e'::UUID,
                    '41089edd-781e-44fb-9c34-3bf58be8848e'::UUID,
                    'party-candidate:tpp-2026-city_councilor-173:platform'::TEXT,
                    '8deffac65851504c941887b538f92d49'::TEXT,
                    271,
                    'https://www.tpp.org.tw/election2026/candidatedetail.php?cid=173'::TEXT
                ),
                (
                    '4545a9ad-d990-4813-bd01-03d1048fd377'::UUID,
                    '67a69243-eee0-49fa-8a1e-cadd259ce00d'::UUID,
                    '68a6ea63-8704-4ff7-a5fc-af55bf6af66a'::UUID,
                    'party-candidate:tpp-2026-city_councilor-187:platform'::TEXT,
                    '952cb0a5f252b0cdcab5399968351efc'::TEXT,
                    409,
                    'https://www.tpp.org.tw/election2026/candidatedetail.php?cid=187'::TEXT
                )
        ) AS reviews(
            claim_id,
            person_id,
            candidate_id,
            claim_key,
            expected_md5,
            expected_length,
            expected_source_url
        )
    LOOP
        UPDATE public.person_claims AS claim
        SET
            claim_json = pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    COALESCE(claim.claim_json, '{}'::JSONB),
                    '{contentSplit}',
                    COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                        || pg_catalog.jsonb_build_object(
                            'reviewStatus', 'reviewed',
                            'releaseQuality', pg_catalog.jsonb_build_object(
                                'version', 'verified-platform-source-cross-check-20260907',
                                'reasonCodes', '[]'::JSONB
                            )
                        ),
                    TRUE
                ),
                '{platformQualityAudit}',
                COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'repairVersion', 'verified-platform-source-cross-check-20260907',
                        'repair', 'official_party_candidate_page_cross_checked_no_text_change',
                        'classification', 'verified_repair'
                    ),
                TRUE
            ),
            updated_at = pg_catalog.now()
        WHERE claim.id = review.claim_id
          AND claim.person_id = review.person_id
          AND claim.candidate_id = review.candidate_id
          AND claim.claim_key = review.claim_key
          AND claim.claim_type = 'platform'
          AND claim.source_url = review.expected_source_url
          AND pg_catalog.md5(claim.claim_value) = review.expected_md5
          AND pg_catalog.length(claim.claim_value) = review.expected_length
          AND claim.claim_json ->> 'platformText' = claim.claim_value
          AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
          AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'requires_source_or_rule_review';

        GET DIAGNOSTICS affected_count = ROW_COUNT;
        IF affected_count <> 1 THEN
            RAISE EXCEPTION 'Expected to release verified claim %, updated %', review.claim_id, affected_count;
        END IF;
        total_affected := total_affected + affected_count;

        IF EXISTS (
            SELECT 1
            FROM public.person_claims AS claim
            WHERE claim.id = review.claim_id
              AND (
                  claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
                  OR claim.claim_json #>> '{contentSplit,releaseQuality,version}'
                      <> 'verified-platform-source-cross-check-20260907'
                  OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
                  OR claim.claim_json #>> '{platformQualityAudit,repair}'
                      <> 'official_party_candidate_page_cross_checked_no_text_change'
              )
        ) THEN
            RAISE EXCEPTION 'Verified source review failed validation for claim %', review.claim_id;
        END IF;
    END LOOP;

    IF total_affected <> 9 THEN
        RAISE EXCEPTION 'Expected nine verified platform source reviews, updated %', total_affected;
    END IF;
END
$review$;

COMMIT;
