-- Voting opens at the election voting-date anniversary.
-- Retain results_announced_on as metadata for existing API consumers.
BEGIN;
-- Canonical voting rules; used by the release generator.
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
            (election.voting_date + INTERVAL '1 year')::DATE AS voting_opens_on,
            TRUE AS voting_eligible,
            COALESCE(
                CURRENT_DATE >= (election.voting_date + INTERVAL '1 year')::DATE,
                FALSE
            ) AS voting_is_open
        FROM public.person_claims AS claim
        JOIN public.candidates AS candidate ON candidate.id = claim.candidate_id
        JOIN public.races AS race ON race.id = candidate.race_id
        JOIN public.elections AS election ON election.id = race.election_id
        CROSS JOIN LATERAL (
            SELECT
                pg_catalog.encode(
                    extensions.digest(pg_catalog.btrim(item.value), 'sha256'),
                    'hex'
                ) AS item_key,
                item.ordinality::INTEGER AS display_order,
                pg_catalog.btrim(item.value) AS promise_text
            FROM pg_catalog.jsonb_array_elements_text(CASE WHEN pg_catalog.jsonb_typeof(claim.claim_json -> 'items') = 'array' THEN claim.claim_json -> 'items' ELSE '[]'::jsonb END)
                WITH ORDINALITY AS item(value, ordinality)
            WHERE pg_catalog.btrim(item.value) <> ''
        ) AS derived
        WHERE claim.id = p_claim_id
          AND claim.claim_type = 'platform'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
          AND claim.claim_json #>> '{contentSplit,reviewStatus}' IN ('auto_approved', 'reviewed')
          AND candidate.person_id = claim.person_id
          AND candidate.election_result = 'elected'
          AND pg_catalog.jsonb_typeof(claim.claim_json -> 'items') = 'array'
        UNION ALL

        SELECT
            'party'::TEXT AS target_kind,
            result.result_id AS vote_target_id,
            derived.item_key,
            derived.display_order,
            derived.promise_text,
            election.results_announced_on,
            (election.voting_date + INTERVAL '1 year')::DATE AS voting_opens_on,
            result.allocated_seats > 0 AS voting_eligible,
            COALESCE(
                CURRENT_DATE >= (election.voting_date + INTERVAL '1 year')::DATE
                    AND result.allocated_seats > 0,
                FALSE
            ) AS voting_is_open
        FROM public.party_list_race_results AS result
        JOIN public.races AS race ON race.id = result.race_id
        JOIN public.elections AS election ON election.id = race.election_id
        CROSS JOIN LATERAL (
            SELECT
                pg_catalog.encode(
                    extensions.digest(pg_catalog.btrim(item.value), 'sha256'),
                    'hex'
                ) AS item_key,
                item.ordinality::INTEGER AS display_order,
                pg_catalog.btrim(item.value) AS promise_text
            FROM pg_catalog.jsonb_array_elements_text(CASE WHEN pg_catalog.jsonb_typeof(result.platform_items) = 'array' THEN result.platform_items ELSE '[]'::jsonb END)
                WITH ORDINALITY AS item(value, ordinality)
            WHERE pg_catalog.btrim(item.value) <> ''
        ) AS derived
        WHERE result.result_id = p_claim_id
          AND result.is_public = TRUE
          AND result.platform_items_reviewed_at IS NOT NULL
          AND race.race_type = 'party_list_legislator'
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

NOTIFY pgrst, 'reload schema';
COMMIT;
