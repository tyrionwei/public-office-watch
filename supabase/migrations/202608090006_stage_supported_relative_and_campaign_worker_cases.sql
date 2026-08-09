BEGIN;

CREATE TEMP TABLE _supported_relative_and_campaign_worker_cases (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL,
    research_id TEXT NOT NULL UNIQUE,
    claim_value TEXT NOT NULL,
    review_score INTEGER NOT NULL,
    case_stage TEXT NOT NULL,
    source_url TEXT NOT NULL,
    safety_flags JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO _supported_relative_and_campaign_worker_cases VALUES
(
    'research:tnl-dark-guide-legal:2018-hsu-hui-yu-relative-event',
    '159cf5ef-3cd9-40db-a1ef-ee49f34537ae',
    'tnl-dark-guide-2018-khh-5-49-涉案紀錄-1',
    '議員好好看記載，許慧玉的胞妹因幽靈人口妨害投票案在一審被判有期徒刑5月；刑事責任屬其胞妹，不得記為許慧玉本人前科，且一審並非確定結果。',
    90, 'criminal_judgment_non_final',
    'https://councilorwatch.tw/councillor/10/356',
    '["relative_conduct_must_not_be_attributed", "must_not_attribute_criminal_liability", "third_party_first_instance_not_final", "stage_or_finality_must_be_stated"]'::jsonb
),
(
    'research:tnl-dark-guide-legal:2018-chen-chin-ting-campaign-worker-event',
    'aab1b45d-1738-493d-aa94-b3b063776443',
    'tnl-dark-guide-2018-nwt-5-54-涉案紀錄-1',
    '議員好好看記載，陳錦錠的競選樁腳因買票案被判有罪確定；來源未列樁腳姓名、案號與刑度，因此只能作為第三方競選事件脈絡，不得記為陳錦錠本人前科。',
    85, 'criminal_judgment_final',
    'https://councilorwatch.tw/councillor/10/8',
    '["third_party_conduct_must_not_be_attributed", "must_not_attribute_criminal_liability", "exact_identity_and_sentence_not_independently_supported", "stage_or_finality_must_be_stated"]'::jsonb
),
(
    'research:tnl-dark-guide-legal:2018-tsai-ming-tang-campaign-worker-event',
    '28c5dfaf-6490-4641-8a2f-f49e65fa1c61',
    'tnl-dark-guide-2018-nwt-3-53-涉案紀錄-1',
    '議員好好看記載，蔡明堂的競選樁腳因買票案在一審被判有期徒刑1年；刑事責任屬競選樁腳，不得記為蔡明堂本人前科，且一審並非確定結果。',
    90, 'criminal_judgment_non_final',
    'https://councilorwatch.tw/councillor/10/24',
    '["third_party_conduct_must_not_be_attributed", "must_not_attribute_criminal_liability", "third_party_first_instance_not_final", "stage_or_finality_must_be_stated"]'::jsonb
),
(
    'research:tnl-dark-guide-legal:2018-hsieh-lung-chieh-assistant-event',
    '320c38ea-48a7-4cfb-a77b-5842abcda5ac',
    'tnl-dark-guide-2018-tnn-8-66-涉案紀錄-1',
    '議員好好看記載，謝龍介的助理因幽靈人口妨害投票案在二審被判有期徒刑4月；刑事責任屬該助理，不得記為謝龍介本人前科，且來源未說明判決是否確定。',
    90, 'criminal_judgment_non_final',
    'https://councilorwatch.tw/councillor/10/294',
    '["third_party_conduct_must_not_be_attributed", "must_not_attribute_criminal_liability", "second_instance_finality_not_stated", "stage_or_finality_must_be_stated"]'::jsonb
),
(
    'research:tnl-dark-guide-legal:2018-chung-sheng-yu-campaign-worker-event',
    '4c48ce8e-bee8-4940-bfe9-9de0e7c7ca9b',
    'tnl-dark-guide-2018-khh-1-45-涉案紀錄-1',
    '議員好好看記載，鍾盛有的競選樁腳因買票案在一審分別被判有期徒刑1年8月與4月；刑事責任屬競選樁腳，不得記為鍾盛有本人前科，且一審並非確定結果。',
    90, 'criminal_judgment_non_final',
    'https://councilorwatch.tw/councillor/10/319',
    '["third_party_conduct_must_not_be_attributed", "must_not_attribute_criminal_liability", "third_party_first_instance_not_final", "stage_or_finality_must_be_stated"]'::jsonb
);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _supported_relative_and_campaign_worker_cases) <> 5 THEN
        RAISE EXCEPTION 'Expected exactly 5 supported relative and campaign-worker cases';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM _supported_relative_and_campaign_worker_cases staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'A supported relative or campaign-worker case targets a missing or private person';
    END IF;
END
$$;

INSERT INTO person_claims (
    claim_key, person_id, claim_type, claim_value, claim_json,
    confidence_level, review_score, review_status, visibility,
    source_name, source_url, observed_at, is_public, scoring_version,
    scoring_reasons, auto_reviewed_at, updated_at
)
SELECT
    staged.claim_key, staged.person_id, 'legal_case', staged.claim_value,
    jsonb_build_object(
        'sourceId', 'supported-relative-and-campaign-worker-research',
        'researchIds', jsonb_build_array(staged.research_id),
        'caseKind', 'vote_manipulation',
        'caseStage', staged.case_stage,
        'recordType', 'criminal',
        'evidenceSources', jsonb_build_array(jsonb_build_object(
            'tier', 'trusted_secondary_data_journalism',
            'name', '議員好好看',
            'url', staged.source_url,
            'supports', '頁面明載的親屬、助理或競選樁腳涉案事件、審級與刑度；不支持將刑事責任歸於候選人本人'
        )),
        'safetyFlags', staged.safety_flags,
        'legalCasePublicEligible', false,
        'publicationGate', jsonb_build_object(
            'status', 'verified_not_published',
            'requiresHumanApproval', true,
            'requiresCurrentOutcomeReview', true
        )
    ),
    'B', staged.review_score, 'verified', 'review_only',
    '議員好好看', staged.source_url,
    '2026-08-09T00:00:00+08:00'::timestamptz, FALSE,
    'supported-relative-and-campaign-worker-cases-2026-08-09-v1',
    jsonb_build_array(jsonb_build_object(
        'version', 'supported-relative-and-campaign-worker-cases-2026-08-09-v1',
        'reason', 'Retained supported third-party election-event facts while explicitly preventing attribution of criminal liability to the candidate and keeping non-final outcomes non-public',
        'reviewedAt', NOW()
    )), NOW(), NOW()
FROM _supported_relative_and_campaign_worker_cases staged
ON CONFLICT (claim_key) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    claim_type = EXCLUDED.claim_type,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_score = EXCLUDED.review_score,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    is_public = EXCLUDED.is_public,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    auto_reviewed_at = COALESCE(person_claims.auto_reviewed_at, EXCLUDED.auto_reviewed_at),
    updated_at = EXCLUDED.updated_at;

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM person_claims claim
        JOIN _supported_relative_and_campaign_worker_cases staged ON staged.claim_key = claim.claim_key
        WHERE claim.confidence_level = 'B'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->>'legalCasePublicEligible' = 'false'
          AND claim.claim_json->'publicationGate'->>'requiresHumanApproval' = 'true'
          AND claim.claim_json->'publicationGate'->>'requiresCurrentOutcomeReview' = 'true'
          AND (
              claim.claim_json->'safetyFlags' ? 'third_party_conduct_must_not_be_attributed'
              OR claim.claim_json->'safetyFlags' ? 'relative_conduct_must_not_be_attributed'
          )
    ) <> 5 THEN
        RAISE EXCEPTION 'Supported relative and campaign-worker case guard failed';
    END IF;
END
$$;

COMMIT;
