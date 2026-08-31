BEGIN;

CREATE TABLE public.party_list_race_results (
    result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    race_id UUID NOT NULL REFERENCES public.races(id) ON DELETE CASCADE,
    party_id UUID NOT NULL REFERENCES public.parties(id),
    party_ballot_number SMALLINT NOT NULL CHECK (party_ballot_number > 0),
    party_name_at_election TEXT NOT NULL CHECK (BTRIM(party_name_at_election) <> ''),
    candidate_party_name TEXT NOT NULL CHECK (BTRIM(candidate_party_name) <> ''),
    vote_count BIGINT NOT NULL CHECK (vote_count >= 0),
    allocated_seats SMALLINT NOT NULL DEFAULT 0 CHECK (allocated_seats >= 0),
    platform_text TEXT CHECK (platform_text IS NULL OR BTRIM(platform_text) <> ''),
    source_name TEXT NOT NULL CHECK (BTRIM(source_name) <> ''),
    source_url TEXT NOT NULL CHECK (BTRIM(source_url) <> ''),
    platform_source_url TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (race_id, party_id),
    UNIQUE (race_id, party_ballot_number)
);

CREATE INDEX party_list_race_results_public_race_idx
    ON public.party_list_race_results (race_id, party_ballot_number)
    WHERE is_public = TRUE;

ALTER TABLE public.party_list_race_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.party_list_race_results FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.party_list_race_results TO service_role;

COMMENT ON TABLE public.party_list_race_results IS
    'Reviewed party-level vote totals, allocated seats, and official common-platform sources for party-list races.';
COMMENT ON COLUMN public.party_list_race_results.platform_text IS
    'Optional reviewed transcription of the party common platform. Null means the official bulletin remains the canonical presentation.';

WITH source_rows (
    party_ballot_number,
    canonical_party_name,
    party_name_at_election,
    candidate_party_name,
    vote_count,
    allocated_seats
) AS (
    VALUES
        (1,  '小民參政歐巴桑聯盟', '小民參政歐巴桑聯盟', '小民參政歐巴桑聯盟', 128613::BIGINT, 0::SMALLINT),
        (2,  '台灣綠黨',           '台灣綠黨',           '台灣綠黨',           117298::BIGINT, 0::SMALLINT),
        (3,  '臺灣雙語無法黨',     '臺灣雙語無法黨',     '台灣雙語無法黨',      44852::BIGINT, 0::SMALLINT),
        (4,  '台灣基進',           '台灣基進',           '台灣基進',            95078::BIGINT, 0::SMALLINT),
        (5,  '中華統一促進黨',     '中華統一促進黨',     '中華統一促進黨',      18425::BIGINT, 0::SMALLINT),
        (6,  '民主進步黨',         '民主進步黨',         '民主進步黨',        4981060::BIGINT, 13::SMALLINT),
        (7,  '制度救世島',         '制度救世島',         '制度救世島',          19691::BIGINT, 0::SMALLINT),
        (8,  '時代力量',           '時代力量',           '時代力量',           353670::BIGINT, 0::SMALLINT),
        (9,  '中國國民黨',         '中國國民黨',         '中國國民黨',        4764293::BIGINT, 13::SMALLINT),
        (10, '司法改革黨',         '司法改革黨',         '司法改革黨',          37755::BIGINT, 0::SMALLINT),
        (11, '新黨',               '新黨',               '新黨',                40429::BIGINT, 0::SMALLINT),
        (12, '台灣民眾黨',         '台灣民眾黨',         '台灣民眾黨',        3040334::BIGINT, 8::SMALLINT),
        (13, '台灣維新',           '台灣維新',           '台灣維新',            10303::BIGINT, 0::SMALLINT),
        (14, '親民黨',             '親民黨',             '親民黨',              69817::BIGINT, 0::SMALLINT),
        (15, '人民最大黨',         '人民最大黨',         '人民最大黨',          11746::BIGINT, 0::SMALLINT),
        (16, '台聯黨',             '台灣團結聯盟',       '台聯黨',              43372::BIGINT, 0::SMALLINT)
),
target_race AS (
    SELECT race.id
    FROM public.races race
    WHERE race.id = 'fbf84648-d6d7-480b-a0a4-518ad1f39d2b'::UUID
      AND race.race_type = 'party_list_legislator'
      AND race.is_public = TRUE
),
inserted AS (
    INSERT INTO public.party_list_race_results (
        race_id,
        party_id,
        party_ballot_number,
        party_name_at_election,
        candidate_party_name,
        vote_count,
        allocated_seats,
        source_name,
        source_url,
        platform_source_url,
        is_public
    )
    SELECT
        race.id,
        party.id,
        source.party_ballot_number,
        source.party_name_at_election,
        source.candidate_party_name,
        source.vote_count,
        source.allocated_seats,
        '中央選舉委員會選舉資料庫',
        'https://db.cec.gov.tw/Visual/Legislator?dataLevel=N&legisId=L4&subjectId=L0&themeId=e753a8e7a7bcc09fa51d1aea0024a843&typeId=ELC',
        'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/02%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/113%E5%B9%B4%E7%AC%AC11%E5%B1%86/05%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E5%8F%8A%E5%83%91%E5%B1%85%E5%9C%8B%E5%A4%96%E5%9C%8B%E6%B0%91%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E5%8F%8A%E5%83%91%E5%B1%85%E5%9C%8B%E5%A4%96%E5%9C%8B%E6%B0%91%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1.pdf',
        TRUE
    FROM source_rows source
    CROSS JOIN target_race race
    JOIN public.parties party ON party.name = source.canonical_party_name
    RETURNING result_id
)
SELECT COUNT(*) FROM inserted;

DO $$
DECLARE
    result_count INTEGER;
    candidate_count INTEGER;
    elected_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO result_count
    FROM public.party_list_race_results result
    WHERE result.race_id = 'fbf84648-d6d7-480b-a0a4-518ad1f39d2b'::UUID
      AND result.is_public = TRUE;

    SELECT COUNT(*), COUNT(*) FILTER (WHERE candidate.is_elected = TRUE)
    INTO candidate_count, elected_count
    FROM public.public_candidates candidate
    WHERE candidate.race_id = 'fbf84648-d6d7-480b-a0a4-518ad1f39d2b'::UUID;

    IF result_count <> 16 THEN
        RAISE EXCEPTION 'Expected 16 published party-list result rows, got %', result_count;
    END IF;
    IF candidate_count <> 177 OR elected_count <> 34 THEN
        RAISE EXCEPTION 'Expected 177 party-list candidates and 34 elected candidates, got % and %', candidate_count, elected_count;
    END IF;
END;
$$;

CREATE FUNCTION published.party_list_race_page_for(p_race_id UUID)
RETURNS TABLE(payload JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
WITH release AS MATERIALIZED (
    SELECT state.release_id, state.published_at
    FROM published.release_state state
    WHERE state.state_key = 'current'
    LIMIT 1
),
selected_race AS MATERIALIZED (
    SELECT
        race.race_id,
        race.election_id,
        race.election_name,
        race.region_id,
        race.region_name,
        race.region_slug,
        race.race_type,
        race.title,
        race.voting_date,
        race.status,
        race.source_name,
        race.source_url
    FROM published.races race
    WHERE race.race_id = p_race_id
      AND race.race_type::TEXT = 'party_list_legislator'
    LIMIT 1
),
election_rows AS MATERIALIZED (
    SELECT
        election.election_id,
        election.name,
        election.year,
        election.election_type,
        election.voting_date,
        election.status,
        election.source_name,
        election.source_url
    FROM published.elections election
    WHERE election.election_id = (SELECT race.election_id FROM selected_race race)
    LIMIT 1
),
candidate_rows AS MATERIALIZED (
    SELECT
        candidate.candidate_id,
        candidate.person_id,
        candidate.person_name,
        candidate.person_party,
        candidate.person_position,
        candidate.race_id,
        candidate.race_title,
        candidate.election_id,
        candidate.election_name,
        candidate.region_id,
        candidate.region_name,
        candidate.party,
        candidate.candidate_no,
        candidate.registration_status,
        candidate.vote_count,
        candidate.vote_rate,
        candidate.is_elected,
        candidate.is_incumbent,
        candidate.office_at_election,
        candidate.election_year,
        candidate.candidacy_status,
        candidate.election_result,
        candidate.status_updated_at,
        candidate.candidate_updated_at,
        candidate.source_name,
        candidate.source_url,
        candidate.primary_photo_url,
        candidate.primary_photo_thumbnail_url,
        candidate.photo_attribution,
        candidate.photo_license_type
    FROM published.candidates candidate
    WHERE candidate.race_id = (SELECT race.race_id FROM selected_race race)
    ORDER BY candidate.party, candidate.candidate_no NULLS LAST, candidate.person_name, candidate.candidate_id
    LIMIT 257
),
party_list_totals AS MATERIALIZED (
    SELECT SUM(result.vote_count)::NUMERIC AS valid_votes
    FROM public.party_list_race_results result
    WHERE result.race_id = (SELECT race.race_id FROM selected_race race)
      AND result.is_public = TRUE
),
party_list_result_rows AS MATERIALIZED (
    SELECT
        result.result_id,
        result.race_id,
        result.party_id,
        result.party_ballot_number,
        result.party_name_at_election AS party_name,
        party.short_name AS party_short_name,
        party.slug AS party_slug,
        result.candidate_party_name,
        result.vote_count,
        CASE
            WHEN totals.valid_votes > 0
            THEN ROUND(result.vote_count::NUMERIC * 100 / totals.valid_votes, 4)::DOUBLE PRECISION
            ELSE NULL
        END AS vote_rate,
        result.allocated_seats,
        CASE
            WHEN totals.valid_votes > 0
            THEN result.vote_count::NUMERIC * 20 >= totals.valid_votes
            ELSE FALSE
        END AS passed_threshold,
        COUNT(candidate.candidate_id)::INTEGER AS candidate_count,
        COUNT(candidate.candidate_id) FILTER (WHERE candidate.is_elected = TRUE)::INTEGER AS elected_count,
        COUNT(candidate.candidate_id) FILTER (WHERE person.gender = 'female')::INTEGER AS female_candidate_count,
        COUNT(candidate.candidate_id) FILTER (WHERE person.gender = 'male')::INTEGER AS male_candidate_count,
        COUNT(candidate.candidate_id) FILTER (
            WHERE person.gender IS NULL OR person.gender NOT IN ('female', 'male')
        )::INTEGER AS unknown_gender_candidate_count,
        result.platform_text,
        result.source_name,
        result.source_url,
        result.platform_source_url,
        finance.report_year AS finance_report_year,
        finance.income_total::DOUBLE PRECISION AS finance_income_total,
        finance.expense_total::DOUBLE PRECISION AS finance_expense_total,
        finance.source_url AS finance_source_url
    FROM public.party_list_race_results result
    CROSS JOIN party_list_totals totals
    JOIN published.parties party ON party.party_id = result.party_id
    LEFT JOIN candidate_rows candidate ON candidate.party = result.candidate_party_name
    LEFT JOIN published.people person ON person.person_id = candidate.person_id
    LEFT JOIN published.party_finance_summaries finance
      ON finance.party_id = result.party_id
     AND finance.report_year = (SELECT election.year FROM election_rows election)
    WHERE result.race_id = (SELECT race.race_id FROM selected_race race)
      AND result.is_public = TRUE
    GROUP BY
        result.result_id,
        result.race_id,
        result.party_id,
        result.party_ballot_number,
        result.party_name_at_election,
        party.short_name,
        party.slug,
        result.candidate_party_name,
        result.vote_count,
        result.allocated_seats,
        result.platform_text,
        result.source_name,
        result.source_url,
        result.platform_source_url,
        totals.valid_votes,
        finance.report_year,
        finance.income_total,
        finance.expense_total,
        finance.source_url
    ORDER BY result.party_ballot_number
    LIMIT 33
)
SELECT pg_catalog.jsonb_build_object(
    'api_version', 1,
    'release_id', (SELECT release.release_id FROM release),
    'published_at', (SELECT release.published_at FROM release),
    'race_row', (SELECT pg_catalog.to_jsonb(race) FROM selected_race race),
    'election_row', (SELECT pg_catalog.to_jsonb(election) FROM election_rows election),
    'candidate_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(
            pg_catalog.to_jsonb(candidate)
            ORDER BY candidate.party, candidate.candidate_no NULLS LAST, candidate.person_name, candidate.candidate_id
        )
        FROM candidate_rows candidate
    ), '[]'::JSONB),
    'party_affiliation_rows', '[]'::JSONB,
    'party_list_result_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(result) ORDER BY result.party_ballot_number)
        FROM party_list_result_rows result
    ), '[]'::JSONB),
    'referendum_question_row', NULL,
    'referendum_option_rows', '[]'::JSONB,
    'referendum_region_result_rows', '[]'::JSONB
) AS payload
WHERE EXISTS (SELECT 1 FROM selected_race);
$$;

REVOKE ALL ON FUNCTION published.party_list_race_page_for(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION published.party_list_race_page_for(UUID) TO anon, authenticated, service_role, admin_role;

COMMIT;
