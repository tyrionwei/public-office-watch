BEGIN;

UPDATE public.elections AS election
SET
    results_announced_on = DATE '2024-01-19',
    updated_at = pg_catalog.now()
WHERE election.year = 2024
  AND election.results_announced_on IS NULL
  AND EXISTS (
      SELECT 1
      FROM public.races AS race
      WHERE race.election_id = election.id
        AND race.race_type = 'president'
  );

WITH presidential_platform_items AS (
    SELECT
        claim.id AS claim_id,
        pg_catalog.jsonb_agg(
            item.promise_text
            ORDER BY item.ordinality
        ) AS items
    FROM public.person_claims AS claim
    JOIN public.candidates AS candidate
      ON candidate.id = claim.candidate_id
    JOIN public.races AS race
      ON race.id = candidate.race_id
    JOIN public.elections AS election
      ON election.id = race.election_id
    CROSS JOIN LATERAL (
        SELECT
            line.ordinality,
            pg_catalog.regexp_replace(
                pg_catalog.btrim(line.value),
                '^[[:space:]]*[0-9]+[.．、][[:space:]]*',
                ''
            ) AS promise_text
        FROM pg_catalog.regexp_split_to_table(
            claim.claim_json ->> 'platformText',
            E'\\r?\\n'
        ) WITH ORDINALITY AS line(value, ordinality)
        WHERE pg_catalog.btrim(line.value)
            ~ '^[0-9]+[.．、][[:space:]]*'
    ) AS item
    WHERE election.year = 2024
      AND race.race_type = 'president'
      AND candidate.election_result = 'elected'
      AND claim.claim_type = 'platform'
      AND claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public = TRUE
      AND pg_catalog.jsonb_typeof(claim.claim_json) = 'object'
      AND claim.claim_json ->> 'platformText' IS NOT NULL
      AND NOT (claim.claim_json ? 'items')
    GROUP BY claim.id
    HAVING pg_catalog.count(*) > 0
)
UPDATE public.person_claims AS claim
SET
    claim_json = pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(
            claim.claim_json,
            '{items}',
            split.items,
            TRUE
        ),
        '{contentSplit}',
        pg_catalog.jsonb_build_object(
            'version', 'presidential-platform-items-v1',
            'method', 'official_numbered_lines',
            'confidence', 100,
            'reviewStatus', 'auto_approved'
        ),
        TRUE
    ),
    updated_at = pg_catalog.now()
FROM presidential_platform_items AS split
WHERE claim.id = split.claim_id;

CREATE OR REPLACE FUNCTION public.platform_fulfillment_vote_claim_id(
    p_claim_id UUID
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT COALESCE(
        (
            SELECT peer_claim.id
            FROM public.person_claims AS input_claim
            JOIN public.candidates AS input_candidate
              ON input_candidate.id = input_claim.candidate_id
            JOIN public.races AS input_race
              ON input_race.id = input_candidate.race_id
            JOIN public.elections AS election
              ON election.id = input_race.election_id
            JOIN public.candidates AS peer_candidate
              ON peer_candidate.race_id = input_race.id
             AND peer_candidate.election_result = 'elected'
            JOIN public.person_claims AS peer_claim
              ON peer_claim.candidate_id = peer_candidate.id
             AND peer_claim.claim_type = 'platform'
             AND peer_claim.review_status = 'verified'
             AND peer_claim.visibility = 'public'
             AND peer_claim.is_public = TRUE
            WHERE input_claim.id = p_claim_id
              AND election.year = 2024
              AND input_race.race_type = 'president'
              AND input_claim.claim_json
                    #>> '{presidentialTicket,sharedPlatform}' = 'true'
              AND peer_claim.claim_json
                    #>> '{presidentialTicket,sharedPlatform}' = 'true'
              AND peer_claim.claim_json
                    #>> '{presidentialTicket,ticketNo}'
                    = input_claim.claim_json
                    #>> '{presidentialTicket,ticketNo}'
              AND peer_claim.claim_json
                    #>> '{presidentialTicket,candidateRole}' = 'president'
            ORDER BY peer_claim.id
            LIMIT 1
        ),
        p_claim_id
    );
$function$;

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
    WITH target AS (
        SELECT public.platform_fulfillment_vote_claim_id(p_claim_id) AS vote_claim_id
    ),
    current_items AS (
        SELECT DISTINCT ON (derived.item_key)
            derived.item_key,
            derived.display_order,
            derived.promise_text,
            election.results_announced_on,
            (
                election.results_announced_on + INTERVAL '1 year'
            )::DATE AS voting_opens_on,
            COALESCE(
                CURRENT_DATE >= (
                    election.results_announced_on + INTERVAL '1 year'
                )::DATE,
                FALSE
            ) AS voting_is_open
        FROM public.person_claims AS claim
        JOIN public.candidates AS candidate
          ON candidate.id = claim.candidate_id
        JOIN public.races AS race
          ON race.id = candidate.race_id
        JOIN public.elections AS election
          ON election.id = race.election_id
        CROSS JOIN LATERAL (
            SELECT
                pg_catalog.encode(
                    extensions.digest(pg_catalog.btrim(item.value), 'sha256'),
                    'hex'
                ) AS item_key,
                item.ordinality::INTEGER AS display_order,
                pg_catalog.btrim(item.value) AS promise_text
            FROM pg_catalog.jsonb_array_elements_text(claim.claim_json -> 'items')
                WITH ORDINALITY AS item(value, ordinality)
            WHERE pg_catalog.btrim(item.value) <> ''
        ) AS derived
        WHERE claim.id = p_claim_id
          AND claim.claim_type = 'platform'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
          AND candidate.election_result = 'elected'
          AND (
              (
                  election.year = 2024
                  AND race.race_type IN (
                      'president',
                      'legislative_district',
                      'legislator',
                      'party_list_legislator',
                      'indigenous'
                  )
              )
              OR (
                  election.year = 2022
                  AND race.race_type IN (
                      'councilor_district',
                      'city_councilor',
                      'county_councilor'
                  )
              )
          )
          AND pg_catalog.jsonb_typeof(claim.claim_json -> 'items') = 'array'
        ORDER BY derived.item_key, derived.display_order
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
    CROSS JOIN target
    LEFT JOIN public.platform_fulfillment_votes AS vote
      ON vote.claim_id = target.vote_claim_id
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

CREATE OR REPLACE FUNCTION published.get_platform_fulfillment_votes(
    p_claim_id UUID
)
RETURNS TABLE (
    item_key TEXT,
    vote_status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    participant_id UUID;
    participant_digest TEXT;
    vote_claim_id UUID;
BEGIN
    participant_id := auth.uid();
    IF participant_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    participant_digest := pg_catalog.encode(
        extensions.digest(participant_id::TEXT, 'sha256'),
        'hex'
    );
    vote_claim_id := public.platform_fulfillment_vote_claim_id(p_claim_id);

    RETURN QUERY
    SELECT vote.item_key, vote.vote_status
    FROM public.platform_fulfillment_votes AS vote
    WHERE vote.claim_id = vote_claim_id
      AND vote.participant_hash = participant_digest
      AND EXISTS (
          SELECT 1
          FROM published.platform_fulfillment_results(p_claim_id) AS item
          WHERE item.item_key = vote.item_key
      )
    ORDER BY vote.item_key;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_platform_fulfillment_vote(
    p_claim_id UUID,
    p_item_key TEXT,
    p_vote_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    participant_id UUID;
    participant_digest TEXT;
    vote_claim_id UUID;
    saved_vote public.platform_fulfillment_votes%ROWTYPE;
BEGIN
    participant_id := public.assert_participation_proxy_request('platform-fulfillment');

    IF p_item_key IS NULL OR p_item_key !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid platform item key';
    END IF;

    IF p_vote_status NOT IN (
        'fulfilled',
        'in_progress',
        'not_fulfilled',
        'insufficient_information'
    ) THEN
        RAISE EXCEPTION 'Invalid platform fulfilment status';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM published.platform_fulfillment_results(p_claim_id) AS item
        WHERE item.item_key = p_item_key
    ) THEN
        RAISE EXCEPTION 'Platform item is not available for voting';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM published.platform_fulfillment_results(p_claim_id) AS item
        WHERE item.item_key = p_item_key
          AND item.voting_is_open
    ) THEN
        RAISE EXCEPTION 'Platform fulfilment voting is not open';
    END IF;

    participant_digest := pg_catalog.encode(
        extensions.digest(participant_id::TEXT, 'sha256'),
        'hex'
    );
    vote_claim_id := public.platform_fulfillment_vote_claim_id(p_claim_id);

    INSERT INTO public.platform_fulfillment_votes (
        claim_id,
        item_key,
        participant_hash,
        vote_status
    )
    VALUES (
        vote_claim_id,
        p_item_key,
        participant_digest,
        p_vote_status
    )
    ON CONFLICT (claim_id, item_key, participant_hash) DO UPDATE
    SET
        vote_status = EXCLUDED.vote_status,
        submission_count = public.platform_fulfillment_votes.submission_count + 1,
        updated_at = pg_catalog.now()
    RETURNING * INTO saved_vote;

    RETURN pg_catalog.jsonb_build_object(
        'claimId', p_claim_id,
        'voteClaimId', saved_vote.claim_id,
        'itemKey', saved_vote.item_key,
        'voteStatus', saved_vote.vote_status,
        'updatedAt', saved_vote.updated_at
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.withdraw_platform_fulfillment_vote(
    p_claim_id UUID,
    p_item_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    participant_id UUID;
    participant_digest TEXT;
    vote_claim_id UUID;
    deleted_count BIGINT;
BEGIN
    participant_id := public.assert_participation_proxy_request(
        'platform-fulfillment-withdrawal'
    );

    IF p_item_key IS NULL OR p_item_key !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid platform item key';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM published.platform_fulfillment_results(p_claim_id) AS item
        WHERE item.item_key = p_item_key
    ) THEN
        RAISE EXCEPTION 'Platform item is not available for voting';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM published.platform_fulfillment_results(p_claim_id) AS item
        WHERE item.item_key = p_item_key
          AND item.voting_is_open
    ) THEN
        RAISE EXCEPTION 'Platform fulfilment voting is not open';
    END IF;

    participant_digest := pg_catalog.encode(
        extensions.digest(participant_id::TEXT, 'sha256'),
        'hex'
    );
    vote_claim_id := public.platform_fulfillment_vote_claim_id(p_claim_id);

    DELETE FROM public.platform_fulfillment_votes AS vote
    WHERE vote.claim_id = vote_claim_id
      AND vote.item_key = p_item_key
      AND vote.participant_hash = participant_digest;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN pg_catalog.jsonb_build_object(
        'claimId', p_claim_id,
        'voteClaimId', vote_claim_id,
        'itemKey', p_item_key,
        'withdrawn', deleted_count > 0
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.platform_fulfillment_vote_claim_id(UUID)
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.platform_fulfillment_vote_claim_id(UUID) IS
    'Resolves shared presidential-ticket platform claims to the elected president claim used for vote storage.';
COMMENT ON FUNCTION published.platform_fulfillment_results(UUID) IS
    'Returns current reviewed platform items and shared community vote counts without exposing participant identifiers.';
COMMENT ON FUNCTION published.get_platform_fulfillment_votes(UUID) IS
    'Returns only the current authenticated anonymous participant votes for one platform claim or shared ticket.';
COMMENT ON FUNCTION public.submit_platform_fulfillment_vote(UUID, TEXT, TEXT) IS
    'Creates or updates one platform item vote after Cloudflare participation proxy verification.';
COMMENT ON FUNCTION public.withdraw_platform_fulfillment_vote(UUID, TEXT) IS
    'Withdraws the current participant vote from one platform item or shared presidential ticket.';

COMMIT;
