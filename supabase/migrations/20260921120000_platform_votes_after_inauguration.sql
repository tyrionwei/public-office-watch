BEGIN;

-- Voting-only reviewed start dates. This table never changes current-office status.
-- A missing row/date closes voting; no annual calendar or future-election inference.
CREATE TABLE public.platform_voting_inaugurations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    candidate_id uuid UNIQUE REFERENCES public.candidates(id),
    race_id uuid UNIQUE REFERENCES public.races(id),
    starts_on date,
    source_url text NOT NULL CHECK (source_url ~ '^https://'),
    reason text NOT NULL,
    CHECK (num_nonnulls(candidate_id, race_id) = 1)
);
ALTER TABLE public.platform_voting_inaugurations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_voting_inaugurations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.platform_voting_inaugurations TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.platform_voting_inaugurations_id_seq TO service_role;

-- Seed only existing, public, elected candidacies with reviewed platforms.
-- These exact elections and inauguration dates are documented by the official sources.
-- Later newly elected/re-announced candidacies require a separately reviewed date row.
WITH reviewed_starts AS (
 SELECT c.id, CASE
  WHEN e.year=2024 AND coalesce(r.voting_date,e.voting_date)=DATE '2024-01-13'
   AND r.race_type IN ('president','vice_president') THEN DATE '2024-05-20'
  WHEN e.year=2024 AND coalesce(r.voting_date,e.voting_date)=DATE '2024-01-13'
   AND r.race_type IN ('legislator','legislative_district','indigenous','party_list_legislator') THEN DATE '2024-02-01'
  WHEN e.year=2022 AND coalesce(r.voting_date,e.voting_date)=DATE '2022-11-26'
   AND r.race_type IN ('local_chief','municipality_mayor','county_mayor','city_councilor','county_councilor','councilor_district','township_mayor','township_representative','township_representative_district') THEN DATE '2022-12-25'
  -- MOI explicitly includes the Chiayi City rerun in the December 25 inauguration.
  WHEN c.id='7d3ecf1f-0b4f-4ca3-95a8-ba71b04b109f'::uuid
   AND e.year=2022 AND coalesce(r.voting_date,e.voting_date)=DATE '2022-12-18' THEN DATE '2022-12-25'
 END AS starts_on
 FROM public.candidates c JOIN public.races r ON r.id=c.race_id
 JOIN public.elections e ON e.id=r.election_id
 WHERE c.is_public AND r.is_public AND e.is_public AND c.election_result='elected'
 AND e.election_type<>'by_election'
 AND c.id<>'5df46cd1-24c7-41a2-9c46-a50488e787e3'::uuid -- re-announced winner; inauguration unconfirmed
 AND (concat_ws(' ',c.source_name,c.source_url,c.external_id,r.title,e.name)!~'補選|遞補|重行公告|重行審定|重公告')
 AND EXISTS (SELECT 1 FROM public.person_claims claim WHERE claim.candidate_id=c.id
  AND claim.claim_type='platform' AND claim.review_status='verified' AND claim.visibility='public' AND claim.is_public
  AND claim.claim_json #>> '{contentSplit,reviewStatus}' IN ('auto_approved','reviewed'))
)
INSERT INTO public.platform_voting_inaugurations(candidate_id,starts_on,source_url,reason)
SELECT id,starts_on,CASE starts_on
 WHEN DATE '2024-05-20' THEN 'https://www.president.gov.tw/Page/294/49483'
 WHEN DATE '2024-02-01' THEN 'https://www.ly.gov.tw/Pages/Detail.aspx?nodeid=5255&pid=236625'
 ELSE 'https://www.moi.gov.tw/News_Content.aspx?n=2&s=274773' END,
 'Official inauguration date for the existing reviewed election-platform scope; later exceptions require review.'
FROM reviewed_starts WHERE starts_on IS NOT NULL;

INSERT INTO public.platform_voting_inaugurations(race_id,starts_on,source_url,reason)
SELECT r.id,DATE '2024-02-01','https://www.ly.gov.tw/Pages/Detail.aspx?nodeid=5255&pid=236625',
 '11th Legislative Yuan inauguration; party voting additionally requires allocated seats.'
FROM public.races r JOIN public.elections e ON e.id=r.election_id
WHERE r.is_public AND e.is_public AND r.race_type='party_list_legislator'
 AND e.year=2024 AND coalesce(r.voting_date,e.voting_date)=DATE '2024-01-13'
 AND e.election_type<>'by_election';

INSERT INTO public.platform_voting_inaugurations(race_id,starts_on,source_url,reason)
SELECT r.id,DATE '2020-02-01','https://www.ly.gov.tw/Pages/Detail.aspx?nodeid=117&pid=191615',
 '10th Legislative Yuan inauguration; preserve existing 2020 party-platform voting.'
FROM public.races r JOIN public.elections e ON e.id=r.election_id
WHERE r.is_public AND e.is_public AND r.race_type='party_list_legislator'
 AND e.year=2020 AND coalesce(r.voting_date,e.voting_date)=DATE '2020-01-11'
 AND e.election_type<>'by_election';

CREATE OR REPLACE FUNCTION published.platform_fulfillment_results(
    p_claim_id UUID
)
RETURNS TABLE (
    item_key TEXT,
    display_order INTEGER,
    promise_text TEXT,
    fulfilled_count BIGINT,
    in_progress_count BIGINT,
    not_fulfilled_count BIGINT,
    insufficient_information_count BIGINT,
    total_count BIGINT,
    results_announced_on DATE,
    voting_opens_on DATE,
    voting_is_open BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    WITH raw_items AS (
        SELECT
            'person'::TEXT AS target_kind,
            public.platform_fulfillment_vote_claim_id(p_claim_id) AS vote_target_id,
            derived.item_key,
            derived.display_order,
            derived.promise_text,
            election.results_announced_on,
            (inauguration.starts_on + INTERVAL '1 year')::DATE AS voting_opens_on,
            TRUE AS voting_eligible,
            COALESCE(
                (now() AT TIME ZONE 'Asia/Taipei')::date >= (inauguration.starts_on + INTERVAL '1 year')::DATE,
                FALSE
            ) AS voting_is_open
        FROM public.person_claims AS claim
        JOIN public.candidates AS candidate ON candidate.id = claim.candidate_id
        JOIN public.races AS race ON race.id = candidate.race_id
        JOIN public.elections AS election ON election.id = race.election_id
        LEFT JOIN public.platform_voting_inaugurations AS inauguration ON inauguration.candidate_id = candidate.id
        CROSS JOIN LATERAL (
            SELECT
                pg_catalog.encode(
                    extensions.digest(pg_catalog.btrim(item.value), 'sha256'),
                    'hex'
                ) AS item_key,
                item.ordinality::INTEGER AS display_order,
                pg_catalog.btrim(item.value) AS promise_text
            FROM pg_catalog.jsonb_array_elements_text(CASE WHEN pg_catalog.jsonb_typeof(claim.claim_json -> 'items')='array' THEN claim.claim_json -> 'items' ELSE '[]'::jsonb END)
                WITH ORDINALITY AS item(value, ordinality)
            WHERE pg_catalog.btrim(item.value) <> ''
        ) AS derived
        WHERE claim.id = p_claim_id
          AND claim.claim_type = 'platform'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
          AND claim.claim_json #>> '{contentSplit,reviewStatus}' IN ('auto_approved', 'reviewed')
          AND candidate.election_result = 'elected'
          AND candidate.is_public AND race.is_public AND election.is_public
          AND EXISTS (SELECT 1 FROM public.person_canonical_map a
            JOIN public.person_canonical_map b ON b.canonical_person_id=a.canonical_person_id
            WHERE a.person_id=claim.person_id AND b.person_id=candidate.person_id)
          AND pg_catalog.jsonb_typeof(claim.claim_json -> 'items') = 'array'
        UNION ALL

        SELECT
            'party'::TEXT AS target_kind,
            result.result_id AS vote_target_id,
            derived.item_key,
            derived.display_order,
            derived.promise_text,
            election.results_announced_on,
            (inauguration.starts_on + INTERVAL '1 year')::DATE AS voting_opens_on,
            result.allocated_seats > 0 AS voting_eligible,
            COALESCE(
                (now() AT TIME ZONE 'Asia/Taipei')::date >= (inauguration.starts_on + INTERVAL '1 year')::DATE
                    AND result.allocated_seats > 0,
                FALSE
            ) AS voting_is_open
        FROM public.party_list_race_results AS result
        JOIN public.races AS race ON race.id = result.race_id
        JOIN public.elections AS election ON election.id = race.election_id
        LEFT JOIN public.platform_voting_inaugurations AS inauguration ON inauguration.race_id = race.id
        CROSS JOIN LATERAL (
            SELECT
                pg_catalog.encode(
                    extensions.digest(pg_catalog.btrim(item.value), 'sha256'),
                    'hex'
                ) AS item_key,
                item.ordinality::INTEGER AS display_order,
                pg_catalog.btrim(item.value) AS promise_text
            FROM pg_catalog.jsonb_array_elements_text(CASE WHEN pg_catalog.jsonb_typeof(result.platform_items)='array' THEN result.platform_items ELSE '[]'::jsonb END)
                WITH ORDINALITY AS item(value, ordinality)
            WHERE pg_catalog.btrim(item.value) <> ''
        ) AS derived
        WHERE result.result_id = p_claim_id
          AND result.is_public = TRUE
          AND race.is_public AND election.is_public
          AND result.platform_items_reviewed_at IS NOT NULL
          AND race.race_type = 'party_list_legislator'
          AND election.year IN (2020, 2024)
          AND pg_catalog.jsonb_typeof(result.platform_items) = 'array'
    ),
    current_items AS (
        SELECT DISTINCT ON (item.target_kind, item.item_key) item.*
        FROM raw_items AS item
        ORDER BY item.target_kind, item.item_key, item.display_order
    ),
    all_votes AS (
        SELECT
            'person'::TEXT AS target_kind,
            vote.claim_id AS vote_target_id,
            vote.item_key,
            vote.vote_status,
            vote.id
        FROM public.platform_fulfillment_votes AS vote
        UNION ALL
        SELECT
            'party'::TEXT,
            vote.party_result_id,
            vote.item_key,
            vote.vote_status,
            vote.id
        FROM public.party_platform_fulfillment_votes AS vote
    )
    SELECT
        item.item_key,
        item.display_order,
        item.promise_text,
        pg_catalog.count(*) FILTER (WHERE vote.vote_status = 'fulfilled') AS fulfilled_count,
        pg_catalog.count(*) FILTER (WHERE vote.vote_status = 'in_progress') AS in_progress_count,
        pg_catalog.count(*) FILTER (WHERE vote.vote_status = 'not_fulfilled') AS not_fulfilled_count,
        pg_catalog.count(*) FILTER (WHERE vote.vote_status = 'insufficient_information') AS insufficient_information_count,
        pg_catalog.count(vote.id) AS total_count,
        item.results_announced_on,
        item.voting_opens_on,
        item.voting_is_open
    FROM current_items AS item
    LEFT JOIN all_votes AS vote
      ON item.voting_eligible
     AND vote.target_kind = item.target_kind
     AND vote.vote_target_id = item.vote_target_id
     AND vote.item_key = item.item_key
    GROUP BY
        item.item_key,
        item.display_order,
        item.promise_text,
        item.results_announced_on,
        item.voting_opens_on,
        item.voting_is_open
    ORDER BY item.display_order;
$function$;

DO $validate$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.platform_voting_inaugurations WHERE starts_on=DATE '2024-05-20')
 OR NOT EXISTS(SELECT 1 FROM public.platform_voting_inaugurations WHERE candidate_id IS NOT NULL AND starts_on=DATE '2024-02-01')
 OR NOT EXISTS(SELECT 1 FROM public.platform_voting_inaugurations WHERE starts_on=DATE '2022-12-25')
 OR NOT EXISTS(SELECT 1 FROM public.platform_voting_inaugurations WHERE race_id IS NOT NULL AND starts_on=DATE '2020-02-01')
 OR NOT EXISTS(SELECT 1 FROM public.platform_voting_inaugurations WHERE race_id IS NOT NULL AND starts_on=DATE '2024-02-01') THEN
  RAISE EXCEPTION 'Expected reviewed platform baseline missing; inspect target before release';
 END IF;
 IF EXISTS(SELECT 1 FROM public.platform_voting_inaugurations WHERE candidate_id='5df46cd1-24c7-41a2-9c46-a50488e787e3') THEN
  RAISE EXCEPTION 'Unconfirmed re-announced inauguration must stay excluded';
 END IF;
 IF has_table_privilege('anon','public.platform_voting_inaugurations','SELECT,INSERT,UPDATE,DELETE')
 OR has_table_privilege('authenticated','public.platform_voting_inaugurations','SELECT,INSERT,UPDATE,DELETE')
 OR has_sequence_privilege('anon','public.platform_voting_inaugurations_id_seq','USAGE,SELECT,UPDATE')
 OR has_sequence_privilege('authenticated','public.platform_voting_inaugurations_id_seq','USAGE,SELECT,UPDATE') THEN
  RAISE EXCEPTION 'Voting schedule is restricted to the reviewed server-side path';
 END IF;
END;
$validate$;

NOTIFY pgrst, 'reload schema';
COMMIT;
