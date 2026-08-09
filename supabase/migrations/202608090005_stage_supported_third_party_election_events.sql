BEGIN;

CREATE TEMP TABLE _supported_third_party_election_events (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL,
    research_id TEXT NOT NULL UNIQUE,
    claim_value TEXT NOT NULL,
    review_score INTEGER NOT NULL,
    case_stage TEXT NOT NULL,
    source_url TEXT NOT NULL,
    safety_flags JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO _supported_third_party_election_events VALUES
(
    'research:tnl-dark-guide-legal:2018-ho-wen-hai-third-party-event',
    '000ec4ee-d284-4df3-8ddc-0df686d59bff',
    'tnl-dark-guide-2018-txg-7-41-涉案紀錄-1',
    'TVBS於2018年報導，何文海的競選樁腳曾涉及買票及違反選罷法；該報導未列出樁腳姓名、判決案號與確定刑度，因此只能作為第三方競選事件脈絡，不得記為何文海本人前科，也不沿用暗公報所載二審3月。',
    85, 'legal_record_unspecified',
    'https://news.tvbs.com.tw/politics/995884',
    '["third_party_conduct_must_not_be_attributed", "must_not_attribute_criminal_liability", "exact_sentence_not_independently_supported", "stage_or_finality_must_be_stated"]'::jsonb
),
(
    'research:tnl-dark-guide-legal:2018-liu-pang-hsuan-third-party-event',
    '0a42c482-da84-423e-b19e-ae2685688688',
    'tnl-dark-guide-2018-tao-8-59-涉案紀錄-1',
    'TVBS於2018年報導，劉邦鉉的競選樁腳被揭露涉及買票；該報導未列出樁腳姓名、判決案號與刑度，因此只能作為第三方競選事件脈絡，不得記為劉邦鉉本人前科，也不沿用暗公報所載一審6月。',
    85, 'legal_record_unspecified',
    'https://news.tvbs.com.tw/politics/995884',
    '["third_party_conduct_must_not_be_attributed", "must_not_attribute_criminal_liability", "exact_sentence_not_independently_supported", "stage_or_finality_must_be_stated"]'::jsonb
),
(
    'research:tnl-dark-guide-legal:2018-chang-kuei-mien-third-party-event',
    'dc0d3bf1-c4e8-44ef-9830-943a1213e280',
    'tnl-dark-guide-2018-tao-4-58-涉案紀錄-1',
    'TVBS於2018年報導，張桂綿的競選樁腳被揭露涉及買票；該報導未列出樁腳姓名、判決案號與刑度，因此只能作為第三方競選事件脈絡，不得記為張桂綿本人前科，也不沿用暗公報所載一審1年6月。',
    85, 'legal_record_unspecified',
    'https://news.tvbs.com.tw/politics/995884',
    '["third_party_conduct_must_not_be_attributed", "must_not_attribute_criminal_liability", "exact_sentence_not_independently_supported", "stage_or_finality_must_be_stated"]'::jsonb
),
(
    'research:tnl-dark-guide-legal:2018-bawtu-payen-third-party-event',
    'eaffb8b2-6d66-4199-96e4-ed0905bedb2b',
    'tnl-dark-guide-2018-nwt-12-17-涉案紀錄-1',
    'TVBS於2018年報導，寶杜巴燕 Bawtu．Payen的競選樁腳因買票案在一審被判有罪；報導未列出樁腳姓名、案號與刑度，且一審並非確定結果，因此不得記為候選人本人前科。',
    90, 'criminal_judgment_non_final',
    'https://news.tvbs.com.tw/politics/995884',
    '["third_party_conduct_must_not_be_attributed", "must_not_attribute_criminal_liability", "third_party_first_instance_not_final", "stage_or_finality_must_be_stated"]'::jsonb
);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _supported_third_party_election_events) <> 4 THEN
        RAISE EXCEPTION 'Expected exactly 4 supported third-party election events';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM _supported_third_party_election_events staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'A supported third-party election event targets a missing or private person';
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
        'sourceId', 'supported-third-party-election-event-research',
        'researchIds', jsonb_build_array(staged.research_id),
        'caseKind', 'vote_buying',
        'caseStage', staged.case_stage,
        'recordType', 'criminal',
        'evidenceSources', jsonb_build_array(jsonb_build_object(
            'tier', 'trusted_media',
            'name', 'TVBS新聞網',
            'url', staged.source_url,
            'supports', '2018年候選人涉案名單中的競選樁腳買票事件；只支持報導明載的第三方事件與審級'
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
    'TVBS新聞網', staged.source_url,
    '2026-08-09T00:00:00+08:00'::timestamptz, FALSE,
    'supported-third-party-election-events-2026-08-09-v1',
    jsonb_build_array(jsonb_build_object(
        'version', 'supported-third-party-election-events-2026-08-09-v1',
        'reason', 'Retained trusted-media support for the campaign-worker event while removing unsupported sentence details and explicitly preventing attribution of criminal liability to the candidate',
        'reviewedAt', NOW()
    )), NOW(), NOW()
FROM _supported_third_party_election_events staged
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
        JOIN _supported_third_party_election_events staged ON staged.claim_key = claim.claim_key
        WHERE claim.confidence_level = 'B'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->>'legalCasePublicEligible' = 'false'
          AND claim.claim_json->'publicationGate'->>'requiresHumanApproval' = 'true'
          AND claim.claim_json->'safetyFlags' ? 'third_party_conduct_must_not_be_attributed'
    ) <> 4 THEN
        RAISE EXCEPTION 'Supported third-party election event guard failed';
    END IF;
END
$$;

COMMIT;
