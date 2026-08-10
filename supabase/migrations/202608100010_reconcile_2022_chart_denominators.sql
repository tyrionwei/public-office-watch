SET statement_timeout = 0;

BEGIN;

-- The 2022 Miaoli indigenous councilor result was ingested twice: once from
-- VoteTW with the indigenous name and vote totals, and once from the official
-- CEC/current-officeholder source. They are the same candidate in the same
-- canonical race. Keep the official current-officeholder identity canonical;
-- public_candidates will then retain the more complete vote-bearing candidate
-- row through its existing ranking rule.
DO $verify_yang_wenchang$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM people canonical
        JOIN person_canonical_map canonical_state
          ON canonical_state.person_id = canonical.id
         AND canonical_state.canonical_person_id = canonical.id
        JOIN people duplicate
          ON duplicate.id = '55f137c3-cac7-4d7c-b300-32060511e8b9'
        JOIN person_canonical_map duplicate_state
          ON duplicate_state.person_id = duplicate.id
         AND duplicate_state.canonical_person_id = duplicate.id
        WHERE canonical.id = '7a39709c-121c-4a3f-9539-a13644c70819'
          AND canonical.name = '楊文昌'
          AND duplicate.name = '楊文昌Baiho．Watan'
    ) THEN
        RAISE EXCEPTION '楊文昌 canonical boundary drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_merge_decisions decision
        WHERE decision.duplicate_person_id = '55f137c3-cac7-4d7c-b300-32060511e8b9'
          AND decision.status IN ('suggested', 'verified')
          AND decision.canonical_person_id <> '7a39709c-121c-4a3f-9539-a13644c70819'
    ) THEN
        RAISE EXCEPTION '楊文昌 duplicate already maps to another canonical person';
    END IF;
END
$verify_yang_wenchang$;

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
    '55f137c3-cac7-4d7c-b300-32060511e8b9',
    '7a39709c-121c-4a3f-9539-a13644c70819',
    'verified',
    'A',
    '同一位苗栗縣第7選舉區議員楊文昌：2018、2022選區、族名、候選號次及現任公職資料相符。',
    jsonb_build_object(
        'version', 'chart-denominator-audit-v1',
        'evidenceKind', 'same_official_race_candidate_and_current_officeholder',
        'evidenceUrl', 'https://db.cec.gov.tw/Candidate/?cand_name=%E6%A5%8A%E6%96%87%E6%98%8C&is_current=false&page=1'
    ),
    'system:chart-denominator-audit-v1',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions decision
    WHERE decision.duplicate_person_id = '55f137c3-cac7-4d7c-b300-32060511e8b9'
      AND decision.status IN ('suggested', 'verified')
);

CREATE TEMP TABLE _resolved_2022_village_chief_ties (
    winner_candidate_id UUID PRIMARY KEY,
    loser_candidate_id UUID NOT NULL UNIQUE,
    winner_name TEXT NOT NULL,
    loser_name TEXT NOT NULL,
    original_vote_count INTEGER NOT NULL,
    winner_vote_count INTEGER NOT NULL,
    loser_vote_count INTEGER NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _resolved_2022_village_chief_ties VALUES
    ('3af78714-433b-42f2-98c4-b51f0febe5ea', '13e91744-448d-433c-a6f6-7880c3700381', '簡和仁', '簡忠義', 236, 236, 236, '嘉義縣選舉委員會', 'https://web.cec.gov.tw/api/file/33e69d9d-e0bd-41ba-bfe3-6d12be8a5b28.pdf'),
    ('5df46cd1-24c7-41a2-9c46-a50488e787e3', '69fc7d97-8230-455e-9dc8-ac52f7bdc2f6', '翁有義', '張政僑', 185, 185, 184, '嘉義縣選舉委員會', 'https://web.cec.gov.tw/api/file/fe426522-6520-44b5-8a6b-84def12036cf.pdf'),
    ('59d17f07-88c6-4dfc-853b-5ce5bac5ccaa', 'd2889206-2590-4b95-8999-00560ab543b1', '蔡傳恭', '曾榮生', 297, 297, 297, '中央通訊社', 'https://www.cna.com.tw/news/aloc/202211280200.aspx'),
    ('31b22ce1-bebc-4418-923f-fb635fcdd06f', '4baa4f5a-a96b-49ec-9500-a5e999985fe1', '蘇臻宥', '卓阿萬', 1383, 1383, 1383, 'TVBS新聞網', 'https://news.tvbs.com.tw/politics/1974748'),
    ('a1469f6f-f6b1-432f-b8c9-3dde70f9dba6', 'd721da91-4553-4383-8448-29113d403f78', '葉步謀', '張肇鴻', 228, 228, 228, '苗栗縣選舉委員會', 'https://web.cec.gov.tw/api/file/6f2b6bfa-5b08-4b2a-b251-bc6c4aa62561.pdf'),
    ('0b693d22-8c86-424c-88ac-7afe8064adca', '07e248ba-907d-42f5-bce4-3983cbd4341a', '吳國璋', '吳昭安', 202, 203, 202, '雲林縣選舉委員會', 'https://web.cec.gov.tw/api/file/6b191e3b-eaf9-407a-a446-b554803b98dc.pdf'),
    ('eac3993d-722a-482c-8062-fd917079a160', '1adb587d-3ecc-4fbf-8b4f-f6f0df84820f', '張綺苓', '曾秀華', 625, 625, 625, '中央通訊社', 'https://www.cna.com.tw/news/aloc/202211280120.aspx'),
    ('93d66e28-9b04-4c8a-99f9-9da0af6cf541', '4e94de0d-ab3c-46ab-bcc0-fe66e1f48191', '邱清勳', '李永貴', 714, 714, 714, '高雄市選舉委員會', 'https://web.cec.gov.tw/api/file/d06b632e-47ce-4395-8a61-e9f4cc462778.pdf');

DO $verify_village_ties$
BEGIN
    IF (SELECT COUNT(*) FROM _resolved_2022_village_chief_ties) <> 8
       OR EXISTS (
            SELECT 1
            FROM _resolved_2022_village_chief_ties input
            LEFT JOIN candidates winner ON winner.id = input.winner_candidate_id
            LEFT JOIN people winner_person ON winner_person.id = winner.person_id
            LEFT JOIN candidates loser ON loser.id = input.loser_candidate_id
            LEFT JOIN people loser_person ON loser_person.id = loser.person_id
            LEFT JOIN races race ON race.id = winner.race_id
            LEFT JOIN elections election ON election.id = race.election_id
            WHERE winner.id IS NULL
               OR loser.id IS NULL
               OR winner_person.name <> input.winner_name
               OR loser_person.name <> input.loser_name
               OR winner.race_id <> loser.race_id
               OR winner.vote_count <> input.original_vote_count
               OR loser.vote_count <> input.original_vote_count
               OR COALESCE(winner.is_elected, FALSE) = TRUE
               OR race.race_type::TEXT <> 'village_chief'
               OR election.year <> 2022
       ) THEN
        RAISE EXCEPTION '2022 village-chief tie boundary drifted';
    END IF;
END
$verify_village_ties$;

UPDATE candidates candidate
SET
    vote_count = input.winner_vote_count,
    vote_rate = ROUND(
        input.winner_vote_count::NUMERIC
        / NULLIF(input.winner_vote_count + input.loser_vote_count, 0)
        * 100,
        4
    ),
    is_elected = TRUE,
    candidacy_status = 'qualified',
    election_result = 'elected',
    registration_status = 'elected',
    source_name = input.source_name,
    source_url = input.source_url,
    status_updated_at = NOW(),
    updated_at = NOW()
FROM _resolved_2022_village_chief_ties input
WHERE candidate.id = input.winner_candidate_id;

UPDATE candidates candidate
SET
    vote_count = input.loser_vote_count,
    vote_rate = ROUND(
        input.loser_vote_count::NUMERIC
        / NULLIF(input.winner_vote_count + input.loser_vote_count, 0)
        * 100,
        4
    ),
    is_elected = FALSE,
    election_result = 'not_elected',
    registration_status = 'not_elected',
    source_name = CASE
        WHEN input.winner_vote_count <> input.loser_vote_count THEN input.source_name
        ELSE candidate.source_name
    END,
    source_url = CASE
        WHEN input.winner_vote_count <> input.loser_vote_count THEN input.source_url
        ELSE candidate.source_url
    END,
    status_updated_at = NOW(),
    updated_at = NOW()
FROM _resolved_2022_village_chief_ties input
WHERE candidate.id = input.loser_candidate_id;

SELECT published.promote(NULL);

DO $verify_result$
DECLARE
    v_councilor_candidates INTEGER;
    v_councilor_winners INTEGER;
    v_representative_candidates INTEGER;
    v_representative_winners INTEGER;
    v_village_candidates INTEGER;
    v_village_winners INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM person_canonical_map canonical
        WHERE canonical.person_id = '55f137c3-cac7-4d7c-b300-32060511e8b9'
          AND canonical.canonical_person_id = '7a39709c-121c-4a3f-9539-a13644c70819'
    ) THEN
        RAISE EXCEPTION '楊文昌 identity did not converge';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _resolved_2022_village_chief_ties input
        JOIN candidates winner
          ON winner.id = input.winner_candidate_id
         AND winner.is_elected = TRUE
         AND winner.election_result = 'elected'
         AND winner.registration_status = 'elected'
    ) <> 8 THEN
        RAISE EXCEPTION '2022 village-chief winners were not fully reconciled';
    END IF;

    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE candidate.is_elected = TRUE)
    INTO v_councilor_candidates, v_councilor_winners
    FROM published.candidate_facts candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE candidate.election_year = 2022
      AND race.race_type::TEXT IN ('city_councilor', 'county_councilor');

    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE candidate.is_elected = TRUE)
    INTO v_representative_candidates, v_representative_winners
    FROM published.candidate_facts candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE candidate.election_year = 2022
      AND race.race_type::TEXT = 'township_representative_district';

    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE candidate.is_elected = TRUE)
    INTO v_village_candidates, v_village_winners
    FROM published.candidate_facts candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE candidate.election_year = 2022
      AND race.race_type::TEXT = 'village_chief';

    IF v_councilor_candidates <> 1677 OR v_councilor_winners <> 910 THEN
        RAISE EXCEPTION '2022 councilor denominator mismatch: % candidates, % winners',
            v_councilor_candidates, v_councilor_winners;
    END IF;

    IF v_representative_candidates <> 3451 OR v_representative_winners <> 2138 THEN
        RAISE EXCEPTION '2022 representative denominator mismatch: % candidates, % winners',
            v_representative_candidates, v_representative_winners;
    END IF;

    IF v_village_candidates <> 14021 OR v_village_winners <> 7748 THEN
        RAISE EXCEPTION '2022 village-chief denominator mismatch: % candidates, % winners',
            v_village_candidates, v_village_winners;
    END IF;
END
$verify_result$;

COMMIT;

RESET statement_timeout;
