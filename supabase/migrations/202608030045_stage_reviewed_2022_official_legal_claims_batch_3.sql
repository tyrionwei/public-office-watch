BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM people
        WHERE id = '4c110c17-b4dd-4b6a-aebb-af33a872cbc5'
          AND is_public = TRUE
    ) THEN
        RAISE EXCEPTION 'Reviewed person 林武忠 is missing or private';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_claims
        WHERE claim_key = 'research:tnl-dark-guide-legal:7c268e501877ea5a'
          AND person_id <> '4c110c17-b4dd-4b6a-aebb-af33a872cbc5'
    ) THEN
        RAISE EXCEPTION 'The stable 林武忠 legal claim key belongs to another person';
    END IF;
END
$$;

INSERT INTO person_claims (
    claim_key, person_id, claim_type, claim_value, claim_json,
    confidence_level, review_score, review_status, visibility,
    source_name, source_url, observed_at, is_public, scoring_version,
    scoring_reasons, auto_reviewed_at, updated_at
)
VALUES (
    'research:tnl-dark-guide-legal:7c268e501877ea5a',
    '4c110c17-b4dd-4b6a-aebb-af33a872cbc5',
    'legal_case',
    '最高法院106年度台上字第257號判決駁回上訴，林武忠因違反貪污治罪條例，處有期徒刑1年6月、褫奪公權2年、緩刑4年確定。',
    jsonb_build_object(
        'sourceId', 'tnl-dark-guide-independent-legal-research',
        'researchIds', jsonb_build_array('tnl-dark-guide-2022-khh-7-9-涉案紀錄-1'),
        'caseKind', 'corruption',
        'caseStage', 'criminal_judgment_final',
        'recordType', 'criminal',
        'evidenceSources', jsonb_build_array(
            jsonb_build_object(
                'tier', 'official',
                'name', '司法院法學資料檢索系統',
                'url', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPSM%2c106%2c%e5%8f%b0%e4%b8%8a%2c257%2c20170216&ot=in',
                'supports', '最高法院106年度台上字第257號刑事判決'
            ),
            jsonb_build_object(
                'tier', 'official',
                'name', '中央選舉委員會',
                'url', 'https://web.cec.gov.tw/api/file/84cf138b-cedb-431d-9924-7f4f0706021f.pdf',
                'supports', '林武忠因違反貪污治罪條例，最高法院駁回上訴，處有期徒刑1年6月、褫奪公權2年、緩刑4年確定'
            ),
            jsonb_build_object(
                'tier', 'official',
                'name', '行政院公報資訊網',
                'url', 'https://gazette.nat.gov.tw/EG_FileManager/eguploadpub/eg023047/ch02/type3/gov15/num4/Eg.htm',
                'supports', '中選會公告載明最高法院判決、刑度與確定狀態'
            ),
            jsonb_build_object(
                'tier', 'trusted_media',
                'name', '中央社',
                'url', 'https://www.cna.com.tw/news/firstnews/201702175011.aspx',
                'supports', '最高法院維持更四審判決，全案定讞'
            )
        ),
        'safetyFlags', '[]'::jsonb,
        'legalCasePublicEligible', false,
        'publicationGate', jsonb_build_object(
            'status', 'verified_not_published',
            'requiresHumanApproval', true,
            'requiresCurrentOutcomeReview', false
        )
    ),
    'A',
    100,
    'verified',
    'review_only',
    '中央選舉委員會',
    'https://web.cec.gov.tw/api/file/84cf138b-cedb-431d-9924-7f4f0706021f.pdf',
    '2026-08-09T00:00:00+08:00'::timestamptz,
    FALSE,
    'tnl-dark-guide-legal-2022-official-batch-3-v1',
    jsonb_build_array(jsonb_build_object(
        'version', 'tnl-dark-guide-legal-2022-official-batch-3-v1',
        'reason', 'Reviewed against the Supreme Court case, CEC notice, Executive Yuan Gazette and CNA; retained as non-public legal data',
        'reviewedAt', NOW()
    )),
    NOW(),
    NOW()
)
ON CONFLICT (claim_key) DO NOTHING;

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM person_claims
        WHERE claim_key = 'research:tnl-dark-guide-legal:7c268e501877ea5a'
          AND person_id = '4c110c17-b4dd-4b6a-aebb-af33a872cbc5'
          AND claim_type = 'legal_case'
          AND confidence_level = 'A'
          AND review_score = 100
          AND review_status = 'verified'
          AND visibility = 'review_only'
          AND is_public = FALSE
          AND claim_json->>'legalCasePublicEligible' = 'false'
          AND claim_json->'publicationGate'->>'status' = 'verified_not_published'
    ) <> 1 THEN
        RAISE EXCEPTION 'Reviewed 林武忠 legal claim guard failed';
    END IF;
END
$$;

COMMIT;
