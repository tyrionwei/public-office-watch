BEGIN;

CREATE TEMP TABLE _councilor_count_before ON COMMIT DROP AS
SELECT
    COUNT(*) FILTER (
        WHERE list_status = 'current'
          AND list_role = 'councilor'
    ) AS all_current,
    COUNT(*) FILTER (
        WHERE list_status = 'current'
          AND list_role = 'councilor'
          AND district LIKE '新北市%'
    ) AS new_taipei_current
FROM public.public_people_list;

ALTER TABLE public.current_office_assignments
    DROP CONSTRAINT current_office_assignments_role_key_check;

ALTER TABLE public.current_office_assignments
    ADD CONSTRAINT current_office_assignments_role_key_check
    CHECK (role_key IN ('legislator', 'local_deputy', 'agency_head', 'councilor'));

UPDATE public.candidates
SET
    registration_status = 'elected',
    election_result = 'elected',
    is_elected = TRUE,
    is_incumbent = TRUE,
    status_updated_at = NOW(),
    updated_at = NOW()
WHERE external_id = 'cec-2022-local-councilor-regional-candidate-3db7d5d522eb'
  AND source_name = '中央選舉委員會選舉資料庫：公開資料包';

INSERT INTO public.current_office_assignments (
    person_id,
    role_key,
    office_label,
    region_name,
    source_name,
    source_url,
    observed_at,
    source_kind,
    is_current,
    updated_at
)
SELECT
    person.id,
    'councilor',
    '新北市第5區議員',
    '新北市第5選舉區',
    '中央選舉委員會：新北市議會第4屆第5選舉區遞補當選公告',
    'https://web.cec.gov.tw/central/article/46161',
    DATE '2024-09-20',
    'official_succession',
    TRUE,
    NOW()
FROM public.people person
WHERE person.external_id = 'cec-2022-local-councilor-regional-person-a1e1daf4373a'
ON CONFLICT (person_id, role_key) DO UPDATE
SET
    office_label = EXCLUDED.office_label,
    region_name = EXCLUDED.region_name,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    source_kind = EXCLUDED.source_kind,
    is_current = EXCLUDED.is_current,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.current_office_exclusions (
    person_id,
    election_year,
    race_type,
    end_reason,
    ended_at,
    source_name,
    source_url,
    source_observed_at,
    source_payload,
    updated_at
)
SELECT
    person.id,
    2022,
    'city_councilor',
    'removed',
    DATE '2024-08-30',
    '中央選舉委員會：新北市議會第4屆第5選舉區遞補當選公告',
    'https://web.cec.gov.tw/central/article/46161',
    DATE '2024-09-20',
    JSONB_BUILD_OBJECT(
        'reason', 'election_invalidated',
        'judgment', '臺灣高等法院113年度選上字第1號',
        'replacementPersonName', '石一佑',
        'replacementAnnouncedAt', '2024-09-20'
    ),
    NOW()
FROM public.people person
WHERE person.external_id = 'cec-2022-local-councilor-regional-person-ecbe7385b5b4'
ON CONFLICT (person_id, election_year, race_type) DO UPDATE
SET
    end_reason = EXCLUDED.end_reason,
    ended_at = EXCLUDED.ended_at,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    source_observed_at = EXCLUDED.source_observed_at,
    source_payload = EXCLUDED.source_payload,
    updated_at = EXCLUDED.updated_at;

WITH candidate_context AS (
    SELECT
        candidate.id AS candidate_id,
        candidate.race_id,
        race.election_id
    FROM public.candidates candidate
    JOIN public.races race ON race.id = candidate.race_id
    WHERE candidate.external_id = 'cec-2022-local-councilor-regional-candidate-a1e1daf4373a'
)
UPDATE public.person_claims claim
SET
    candidate_id = context.candidate_id,
    claim_json = COALESCE(claim.claim_json, '{}'::JSONB) || JSONB_BUILD_OBJECT(
        'electionContext', JSONB_BUILD_OBJECT(
            'candidateId', context.candidate_id,
            'raceId', context.race_id,
            'electionId', context.election_id
        ),
        'platformText', claim.claim_value,
        'officeSuccession', JSONB_BUILD_OBJECT(
            'status', 'replacement_elected',
            'predecessorName', '黃俊哲',
            'judgment', '臺灣高等法院113年度選上字第1號',
            'announcedAt', '2024-09-20',
            'sourceUrl', 'https://web.cec.gov.tw/central/article/46161'
        ),
        'publicationGate', JSONB_BUILD_OBJECT(
            'status', 'passed',
            'reason', 'Official council platform matched to the 2022 candidacy and official 2024 succession',
            'reviewedAt', NOW()
        ),
        'campaignPlatformReview', JSONB_BUILD_OBJECT(
            'status', 'passed',
            'reason', 'Exact person, candidacy, and official succession were confirmed before publication',
            'reviewedAt', NOW()
        ),
        'reviewDecision', JSONB_BUILD_OBJECT(
            'version', 'official-council-succession-v1',
            'decision', 'approve',
            'reviewedAt', NOW()
        )
    ),
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    auto_reviewed_at = NOW(),
    scoring_version = 'official-council-succession-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) || JSONB_BUILD_ARRAY(
        JSONB_BUILD_OBJECT(
            'version', 'official-council-succession-v1',
            'decision', 'approve',
            'reason', 'Official council source, exact 2022 candidacy, and CEC succession announcement match',
            'reviewedAt', NOW()
        )
    ),
    updated_at = NOW()
FROM candidate_context context
WHERE claim.id = '4b00c2ce-640c-46b9-9a7f-944db15f48ff'
  AND claim.claim_type = 'platform'
  AND claim.source_name = '新北市議會：現任議員';

WITH candidate_context AS (
    SELECT
        candidate.id AS candidate_id,
        candidate.race_id,
        race.election_id
    FROM public.candidates candidate
    JOIN public.races race ON race.id = candidate.race_id
    WHERE candidate.external_id = 'cec-2022-local-councilor-regional-candidate-3db7d5d522eb'
)
UPDATE public.person_claims claim
SET
    candidate_id = context.candidate_id,
    claim_json = COALESCE(claim.claim_json, '{}'::JSONB) || JSONB_BUILD_OBJECT(
        'electionContext', JSONB_BUILD_OBJECT(
            'candidateId', context.candidate_id,
            'raceId', context.race_id,
            'electionId', context.election_id
        ),
        'platformText', claim.claim_value,
        'publicationGate', JSONB_BUILD_OBJECT(
            'status', 'passed',
            'reason', 'Official council platform matched to the corrected 2022 elected candidacy',
            'reviewedAt', NOW()
        ),
        'campaignPlatformReview', JSONB_BUILD_OBJECT(
            'status', 'passed',
            'reason', 'Exact person and official 2022 elected candidacy were confirmed before publication',
            'reviewedAt', NOW()
        ),
        'reviewDecision', JSONB_BUILD_OBJECT(
            'version', 'official-council-election-correction-v1',
            'decision', 'approve',
            'reviewedAt', NOW()
        )
    ),
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    auto_reviewed_at = NOW(),
    scoring_version = 'official-council-election-correction-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) || JSONB_BUILD_ARRAY(
        JSONB_BUILD_OBJECT(
            'version', 'official-council-election-correction-v1',
            'decision', 'approve',
            'reason', 'Official council source and CEC 2022 elected announcement match',
            'reviewedAt', NOW()
        )
    ),
    updated_at = NOW()
FROM candidate_context context
WHERE claim.id = '1d6c8216-c60b-409a-802c-94a42e651f64'
  AND claim.claim_type = 'platform'
  AND claim.source_name = '臺南市議會：現任議員';

WITH succession_context AS (
    SELECT
        person.id AS person_id,
        candidate.id AS candidate_id,
        candidate.race_id,
        race.election_id
    FROM public.people person
    JOIN public.candidates candidate ON candidate.person_id = person.id
    JOIN public.races race ON race.id = candidate.race_id
    WHERE person.external_id = 'cec-2022-local-councilor-regional-person-a1e1daf4373a'
      AND candidate.external_id = 'cec-2022-local-councilor-regional-candidate-a1e1daf4373a'
)
INSERT INTO public.person_claims (
    claim_key,
    person_id,
    candidate_id,
    claim_type,
    claim_value,
    claim_json,
    confidence_level,
    review_status,
    visibility,
    source_name,
    source_url,
    observed_at,
    is_public,
    review_score,
    scoring_version,
    scoring_reasons,
    auto_reviewed_at,
    updated_at
)
SELECT
    'cec-office-succession:2024:new-taipei-council-d5:shi-yi-yu',
    context.person_id,
    context.candidate_id,
    'office',
    '2024年9月20日公告遞補當選新北市議會第4屆第5選舉區議員',
    JSONB_BUILD_OBJECT(
        'event', 'succession',
        'predecessorName', '黃俊哲',
        'judgment', '臺灣高等法院113年度選上字第1號',
        'announcedAt', '2024-09-20',
        'electionContext', JSONB_BUILD_OBJECT(
            'candidateId', context.candidate_id,
            'raceId', context.race_id,
            'electionId', context.election_id
        )
    ),
    'A',
    'verified',
    'public',
    '中央選舉委員會：新北市議會第4屆第5選舉區遞補當選公告',
    'https://web.cec.gov.tw/central/article/46161',
    TIMESTAMPTZ '2024-09-20 00:00:00+08',
    TRUE,
    100,
    'official-succession-v1',
    JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
        'version', 'official-succession-v1',
        'reason', 'CEC official replacement-election announcement',
        'reviewedAt', NOW()
    )),
    NOW(),
    NOW()
FROM succession_context context
ON CONFLICT (claim_key) DO UPDATE
SET
    person_id = EXCLUDED.person_id,
    candidate_id = EXCLUDED.candidate_id,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    is_public = EXCLUDED.is_public,
    review_score = EXCLUDED.review_score,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    auto_reviewed_at = EXCLUDED.auto_reviewed_at,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.person_claims (
    claim_key,
    person_id,
    claim_type,
    claim_value,
    claim_json,
    confidence_level,
    review_status,
    visibility,
    source_name,
    source_url,
    observed_at,
    is_public,
    review_score,
    scoring_version,
    scoring_reasons,
    updated_at
)
SELECT
    'news-family-relation:2026:shi-yi-yu:chen-chun-yen',
    person.id,
    'family_relation',
    '陳俊諺（子）',
    JSONB_BUILD_OBJECT(
        'relation', 'son',
        'relatedPersonName', '陳俊諺',
        'context', '石一佑宣布不再競選連任，由兒子陳俊諺參與民進黨黨內初選',
        'publicationGate', JSONB_BUILD_OBJECT(
            'status', 'pending_manual_review',
            'reason', 'Family relationship is sensitive and is supported by news reporting rather than an official election registration'
        )
    ),
    'C',
    'pending',
    'review_only',
    '聯合新聞網：交棒給兒子陳俊諺選',
    'https://udn.com/news/story/7323/9321934',
    TIMESTAMPTZ '2026-02-10 00:00:00+08',
    FALSE,
    45,
    'sensitive-family-news-lead-v1',
    JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
        'version', 'sensitive-family-news-lead-v1',
        'reason', 'Named relationship reported by a mainstream news source; manual review required before publication',
        'reviewedAt', NOW()
    )),
    NOW()
FROM public.people person
WHERE person.external_id = 'cec-2022-local-councilor-regional-person-a1e1daf4373a'
ON CONFLICT (claim_key) DO UPDATE
SET
    person_id = EXCLUDED.person_id,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    is_public = EXCLUDED.is_public,
    review_score = EXCLUDED.review_score,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    updated_at = EXCLUDED.updated_at;

CREATE OR REPLACE VIEW public.person_claim_review_queue AS
SELECT
    pc.id AS claim_id,
    pc.person_id,
    pc.source_person_id,
    sp.raw_name,
    sp.normalized_name,
    pc.claim_type,
    pc.claim_value,
    pc.claim_json,
    pc.confidence_level,
    pc.review_score,
    pc.review_status,
    pc.visibility,
    pc.source_name,
    pc.source_url,
    pc.scoring_version,
    pc.scoring_reasons,
    pc.updated_at,
    pc.candidate_id,
    COALESCE(canonical_person.name, claim_person.name) AS canonical_person_name
FROM public.person_claims pc
LEFT JOIN public.source_people sp ON sp.id = pc.source_person_id
LEFT JOIN public.people claim_person ON claim_person.id = pc.person_id
LEFT JOIN public.person_canonical_map person_map ON person_map.person_id = pc.person_id
LEFT JOIN public.people canonical_person ON canonical_person.id = person_map.canonical_person_id
WHERE pc.review_status IN ('pending', 'needs_more_evidence')
ORDER BY pc.review_score DESC, pc.updated_at DESC;

COMMENT ON VIEW public.person_claim_review_queue IS
    'Private review queue; includes exact candidacy and canonical person name for local review search.';

SELECT public.refresh_public_people_list_cached();

DO $$
DECLARE
    before_all BIGINT;
    before_new_taipei BIGINT;
    after_all BIGINT;
    after_new_taipei BIGINT;
BEGIN
    SELECT all_current, new_taipei_current
    INTO before_all, before_new_taipei
    FROM _councilor_count_before;

    SELECT
        COUNT(*) FILTER (WHERE list_status = 'current' AND list_role = 'councilor'),
        COUNT(*) FILTER (
            WHERE list_status = 'current'
              AND list_role = 'councilor'
              AND district LIKE '新北市%'
        )
    INTO after_all, after_new_taipei
    FROM public.public_people_list;

    IF before_all <> after_all OR before_new_taipei <> after_new_taipei THEN
        RAISE EXCEPTION
            'Current councilor counts changed unexpectedly: all % -> %, New Taipei % -> %',
            before_all,
            after_all,
            before_new_taipei,
            after_new_taipei;
    END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
