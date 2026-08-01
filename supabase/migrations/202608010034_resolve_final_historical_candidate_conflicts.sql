BEGIN;

CREATE TEMP TABLE _final_historical_person_merges (
    duplicate_person_id UUID PRIMARY KEY,
    canonical_person_id UUID NOT NULL,
    person_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    evidence_json JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO _final_historical_person_merges (
    duplicate_person_id,
    canonical_person_id,
    person_name,
    reason,
    evidence_json
) VALUES
    (
        '12545cbb-3438-4b52-9225-b1f11d22d302',
        '378fbf32-ffdd-47b6-a45e-4316678764ae',
        '潘翰聲',
        '2006、2010臺北市議員、2012臺北市立法委員及2014臺北市議員紀錄為同一位候選人；2014改以樹黨參選。',
        '{"rule":"final_historical_candidate_identity_review","years":[2006,2010,2012,2014],"geography":"臺北市","parties":["綠黨","樹黨"],"sources":["https://web.cec.gov.tw/api/file/2802fcd3-f26f-452b-93fe-faa4f138162b.pdf","https://votetw.com/data/candidate/%E6%BD%98%E7%BF%B0%E8%81%B2"]}'
    ),
    (
        '6a4eb4d0-0444-48d2-9b0d-b75689d20bf8',
        '24cb1970-2ea2-4847-be15-ce393bac66a2',
        '楊應雄',
        '2002、2005、2009金門縣議員及2012金門縣立法委員紀錄為同一位候選人；立法院履歷載明曾任金門縣第3、4、5屆縣議員。',
        '{"rule":"final_historical_candidate_identity_review","years":[2002,2005,2009,2012],"geography":"金門縣","parties":["新黨","中國國民黨"],"source":"https://www.ly.gov.tw/Pages/List.aspx?nodeid=1763"}'
    );

DO $verify$
BEGIN
    IF (SELECT COUNT(*) FROM _final_historical_person_merges) <> 2 THEN
        RAISE EXCEPTION 'Final historical person merge input count mismatch';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _final_historical_person_merges input
        LEFT JOIN people duplicate ON duplicate.id = input.duplicate_person_id
        LEFT JOIN people canonical ON canonical.id = input.canonical_person_id
        LEFT JOIN person_canonical_map duplicate_state ON duplicate_state.person_id = input.duplicate_person_id
        LEFT JOIN person_canonical_map canonical_state ON canonical_state.person_id = input.canonical_person_id
        WHERE duplicate.id IS NULL
           OR canonical.id IS NULL
           OR duplicate.name <> input.person_name
           OR canonical.name <> input.person_name
           OR duplicate_state.canonical_person_id <> input.duplicate_person_id
           OR canonical_state.canonical_person_id <> input.canonical_person_id
           OR canonical.is_public IS NOT TRUE
    ) THEN
        RAISE EXCEPTION 'Final historical person merge input no longer matches reviewed people';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _final_historical_person_merges input
        JOIN person_merge_decisions existing
          ON existing.duplicate_person_id = input.duplicate_person_id
         AND existing.status IN ('suggested', 'verified')
        WHERE existing.canonical_person_id <> input.canonical_person_id
    ) THEN
        RAISE EXCEPTION 'Final historical person merge gained a conflicting active decision';
    END IF;
END
$verify$;

INSERT INTO person_merge_decisions (
    duplicate_person_id,
    canonical_person_id,
    status,
    confidence_level,
    reason,
    evidence_json,
    reviewed_by,
    reviewed_at,
    updated_at
)
SELECT
    input.duplicate_person_id,
    input.canonical_person_id,
    'verified',
    'A',
    input.reason,
    input.evidence_json,
    'codex:final-historical-candidate-review',
    NOW(),
    NOW()
FROM _final_historical_person_merges input
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = input.duplicate_person_id
      AND existing.canonical_person_id = input.canonical_person_id
      AND existing.status IN ('suggested', 'verified')
);

CREATE TEMP TABLE _lin_jing_yuan_2014_match_repair (
    source_person_id UUID PRIMARY KEY,
    wrong_canonical_person_id UUID NOT NULL,
    correct_canonical_person_id UUID NOT NULL,
    reason TEXT NOT NULL,
    evidence_json JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO _lin_jing_yuan_2014_match_repair (
    source_person_id,
    wrong_canonical_person_id,
    correct_canonical_person_id,
    reason,
    evidence_json
) VALUES (
    'af374df7-2347-4760-92a2-8ad6975ed2ce',
    '3ac9adae-0e78-496f-9df4-c8027e9e4fc2',
    '62865d74-84e7-46a4-b5ce-459f3c0140d1',
    '2012立法委員與2014高雄市議員候選人的姓名、出生日期1925-10-19及高雄活動範圍一致；1998高雄縣議員同名人物欠缺相同出生資料，故不合併。',
    '{"rule":"manual_official_birthdate_identity_review_v1","years":[2012,2014],"birthDate":"1925-10-19","sources":["https://votetw.com/data/election/20120101T1A2?%E7%9C%81%E5%B8%82=05&%E9%81%B8%E5%8D%80=08","https://votetw.com/data/election/20141101K1B2?%E7%9C%81%E5%B8%82=64&%E9%81%B8%E5%8D%80=09","https://web.cec.gov.tw/api/file/5fefe788-2f1a-477f-a432-7962596743db.pdf"]}'
);

DO $verify$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM _lin_jing_yuan_2014_match_repair repair
        JOIN source_people source ON source.id = repair.source_person_id
        JOIN people wrong_person ON wrong_person.id = repair.wrong_canonical_person_id
        JOIN people correct_person ON correct_person.id = repair.correct_canonical_person_id
        WHERE source.raw_name = '林景元'
          AND source.election_year = 2014
          AND wrong_person.name = source.raw_name
          AND correct_person.name = source.raw_name
    ) THEN
        RAISE EXCEPTION 'Lin Jing-yuan 2014 identity repair input no longer matches reviewed records';
    END IF;
END
$verify$;

UPDATE person_identity_matches match
SET match_status = 'rejected_match',
    score = 0,
    match_method = 'manual_official_birthdate_identity_rejection_v1',
    match_reason = repair.reason,
    evidence_json = COALESCE(match.evidence_json, '{}'::JSONB) || repair.evidence_json || jsonb_build_object(
        'wrongCanonicalPersonId', repair.wrong_canonical_person_id,
        'correctCanonicalPersonId', repair.correct_canonical_person_id,
        'reviewedAt', '2026-08-01'
    ),
    reviewed_by = 'codex:final-historical-candidate-review',
    reviewed_at = NOW(),
    updated_at = NOW()
FROM _lin_jing_yuan_2014_match_repair repair
CROSS JOIN person_canonical_map canonical
WHERE match.source_person_id = repair.source_person_id
  AND canonical.person_id = match.person_id
  AND canonical.canonical_person_id = repair.wrong_canonical_person_id
  AND match.match_status = 'auto_matched';

UPDATE person_identity_matches match
SET match_status = 'auto_matched',
    score = 100,
    match_method = 'manual_official_birthdate_identity_match_v1',
    match_reason = repair.reason,
    evidence_json = COALESCE(match.evidence_json, '{}'::JSONB) || repair.evidence_json || jsonb_build_object(
        'wrongCanonicalPersonId', repair.wrong_canonical_person_id,
        'correctCanonicalPersonId', repair.correct_canonical_person_id,
        'reviewedAt', '2026-08-01'
    ),
    reviewed_by = 'codex:final-historical-candidate-review',
    reviewed_at = NOW(),
    updated_at = NOW()
FROM _lin_jing_yuan_2014_match_repair repair
CROSS JOIN person_canonical_map canonical
WHERE match.source_person_id = repair.source_person_id
  AND canonical.person_id = match.person_id
  AND canonical.canonical_person_id = repair.correct_canonical_person_id
  AND match.match_status = 'probable_match';

DO $verify$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _final_historical_person_merges input
        JOIN person_canonical_map canonical ON canonical.person_id = input.duplicate_person_id
        WHERE canonical.canonical_person_id <> input.canonical_person_id
    ) THEN
        RAISE EXCEPTION 'Final historical person merges did not resolve to reviewed canonical people';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _lin_jing_yuan_2014_match_repair repair
        JOIN person_identity_matches match ON match.source_person_id = repair.source_person_id
        JOIN person_canonical_map canonical ON canonical.person_id = match.person_id
        WHERE canonical.canonical_person_id = repair.correct_canonical_person_id
          AND match.match_status = 'auto_matched'
    ) <> 1 THEN
        RAISE EXCEPTION 'Lin Jing-yuan 2014 correct identity was not activated exactly once';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _lin_jing_yuan_2014_match_repair repair
        JOIN person_identity_matches match ON match.source_person_id = repair.source_person_id
        JOIN person_canonical_map canonical ON canonical.person_id = match.person_id
        WHERE canonical.canonical_person_id = repair.wrong_canonical_person_id
          AND match.match_status = 'auto_matched'
    ) THEN
        RAISE EXCEPTION 'Lin Jing-yuan 2014 wrong identity remains active';
    END IF;
END
$verify$;

REFRESH MATERIALIZED VIEW public.public_people_list_cached;
SELECT published.promote(NULL);

COMMIT;
