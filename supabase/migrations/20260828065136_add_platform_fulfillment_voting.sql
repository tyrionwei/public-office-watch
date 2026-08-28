BEGIN;

ALTER TABLE public.elections
ADD COLUMN results_announced_on DATE;

COMMENT ON COLUMN public.elections.results_announced_on IS
    'Date the competent election commission officially announced the election results.';

UPDATE public.elections AS election
SET
    results_announced_on = CASE election.year
        WHEN 2022 THEN DATE '2022-12-02'
        WHEN 2024 THEN DATE '2024-01-19'
    END,
    updated_at = pg_catalog.now()
WHERE (
        election.year = 2022
        AND EXISTS (
            SELECT 1
            FROM public.races AS race
            WHERE race.election_id = election.id
              AND race.race_type IN (
                  'councilor_district',
                  'city_councilor',
                  'county_councilor'
              )
        )
    )
    OR (
        election.year = 2024
        AND EXISTS (
            SELECT 1
            FROM public.races AS race
            WHERE race.election_id = election.id
              AND race.race_type IN (
                  'legislative_district',
                  'legislator',
                  'party_list_legislator',
                  'indigenous'
              )
        )
    );

CREATE TABLE public.platform_fulfillment_votes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_id UUID NOT NULL
        REFERENCES public.person_claims(id)
        ON DELETE CASCADE,
    item_key TEXT NOT NULL
        CHECK (item_key ~ '^[0-9a-f]{64}$'),
    participant_hash TEXT NOT NULL
        CHECK (participant_hash ~ '^[0-9a-f]{64}$'),
    vote_status TEXT NOT NULL
        CHECK (vote_status IN (
            'fulfilled',
            'in_progress',
            'not_fulfilled',
            'insufficient_information'
        )),
    submission_count INTEGER NOT NULL DEFAULT 1
        CHECK (submission_count > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT platform_fulfillment_votes_participant_item_key
        UNIQUE (claim_id, item_key, participant_hash)
);

CREATE INDEX platform_fulfillment_votes_claim_item_status_idx
    ON public.platform_fulfillment_votes (claim_id, item_key, vote_status);

CREATE INDEX platform_fulfillment_votes_participant_claim_idx
    ON public.platform_fulfillment_votes (participant_hash, claim_id);

ALTER TABLE public.platform_fulfillment_votes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_fulfillment_votes
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, DELETE ON TABLE public.platform_fulfillment_votes TO service_role;
REVOKE ALL ON SEQUENCE public.platform_fulfillment_votes_id_seq
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assert_participation_proxy_request(
    p_expected_action TEXT
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    participant_id UUID;
    request_headers JSONB;
    proxy_action TEXT;
    request_id TEXT;
    signature TEXT;
    timestamp_text TEXT;
    timestamp_seconds BIGINT;
    proxy_secret TEXT;
    proof_payload TEXT;
    expected_signature TEXT;
BEGIN
    participant_id := auth.uid();
    IF participant_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    request_headers := COALESCE(
        NULLIF(pg_catalog.current_setting('request.headers', TRUE), ''),
        '{}'
    )::JSONB;
    proxy_action := request_headers ->> 'x-participation-proxy-action';
    request_id := request_headers ->> 'x-participation-proxy-request-id';
    signature := request_headers ->> 'x-participation-proxy-signature';
    timestamp_text := request_headers ->> 'x-participation-proxy-timestamp';

    IF proxy_action IS DISTINCT FROM p_expected_action
       OR proxy_action NOT IN (
           'region-issue',
           'person-feedback',
           'platform-fulfillment',
           'platform-fulfillment-withdrawal'
       )
       OR request_id IS NULL
       OR request_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR timestamp_text IS NULL
       OR timestamp_text !~ '^[0-9]{10}$'
       OR signature IS NULL
       OR signature !~ '^[0-9a-f]{64}$'
    THEN
        RAISE EXCEPTION 'Participation write proxy required' USING ERRCODE = '42501';
    END IF;

    timestamp_seconds := timestamp_text::BIGINT;
    IF pg_catalog.abs(
        EXTRACT(EPOCH FROM pg_catalog.clock_timestamp())::BIGINT
        - timestamp_seconds
    ) > 60 THEN
        RAISE EXCEPTION 'Participation proxy proof expired' USING ERRCODE = '42501';
    END IF;

    SELECT secret.decrypted_secret
    INTO proxy_secret
    FROM vault.decrypted_secrets AS secret
    WHERE secret.name = 'participation_proxy_hmac_key'
    ORDER BY secret.created_at DESC
    LIMIT 1;

    IF proxy_secret IS NULL THEN
        RAISE EXCEPTION 'Participation proxy is not configured' USING ERRCODE = '42501';
    END IF;

    proof_payload := participant_id::TEXT
        || E'
' || proxy_action
        || E'
' || timestamp_text
        || E'
' || request_id;
    expected_signature := pg_catalog.encode(
        extensions.hmac(proof_payload, proxy_secret, 'sha256'),
        'hex'
    );

    IF signature IS DISTINCT FROM expected_signature THEN
        RAISE EXCEPTION 'Invalid participation proxy proof' USING ERRCODE = '42501';
    END IF;

    RETURN participant_id;
END;
$$;

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
    WITH current_items AS (
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
    LEFT JOIN public.platform_fulfillment_votes AS vote
      ON vote.claim_id = p_claim_id
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
AS $$
DECLARE
    participant_id UUID;
    participant_digest TEXT;
BEGIN
    participant_id := auth.uid();
    IF participant_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    participant_digest := pg_catalog.encode(
        extensions.digest(participant_id::TEXT, 'sha256'),
        'hex'
    );

    RETURN QUERY
    SELECT vote.item_key, vote.vote_status
    FROM public.platform_fulfillment_votes AS vote
    WHERE vote.claim_id = p_claim_id
      AND vote.participant_hash = participant_digest
      AND EXISTS (
          SELECT 1
          FROM published.platform_fulfillment_results(p_claim_id) AS item
          WHERE item.item_key = vote.item_key
      )
    ORDER BY vote.item_key;
END;
$$;

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
AS $$
DECLARE
    participant_id UUID;
    participant_digest TEXT;
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

    INSERT INTO public.platform_fulfillment_votes (
        claim_id,
        item_key,
        participant_hash,
        vote_status
    )
    VALUES (
        p_claim_id,
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
        'claimId', saved_vote.claim_id,
        'itemKey', saved_vote.item_key,
        'voteStatus', saved_vote.vote_status,
        'updatedAt', saved_vote.updated_at
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_platform_fulfillment_vote(
    p_claim_id UUID,
    p_item_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    participant_id UUID;
    participant_digest TEXT;
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

    DELETE FROM public.platform_fulfillment_votes AS vote
    WHERE vote.claim_id = p_claim_id
      AND vote.item_key = p_item_key
      AND vote.participant_hash = participant_digest;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN pg_catalog.jsonb_build_object(
        'claimId', p_claim_id,
        'itemKey', p_item_key,
        'withdrawn', deleted_count > 0
    );
END;
$$;

REVOKE ALL ON FUNCTION public.assert_participation_proxy_request(TEXT)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION published.platform_fulfillment_results(UUID)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION published.get_platform_fulfillment_votes(UUID)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_platform_fulfillment_vote(UUID, TEXT, TEXT)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.withdraw_platform_fulfillment_vote(UUID, TEXT)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION published.platform_fulfillment_results(UUID)
TO anon, authenticated;
GRANT EXECUTE ON FUNCTION published.get_platform_fulfillment_votes(UUID)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_platform_fulfillment_vote(UUID, TEXT, TEXT)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_platform_fulfillment_vote(UUID, TEXT)
TO authenticated;

COMMENT ON TABLE public.platform_fulfillment_votes IS
    'One current community fulfilment vote per anonymous participant and reviewed platform item. Item keys are SHA-256 fingerprints of reviewed item text.';
COMMENT ON FUNCTION published.platform_fulfillment_results(UUID) IS
    'Returns current reviewed platform items and community vote counts without exposing participant identifiers.';
COMMENT ON FUNCTION published.get_platform_fulfillment_votes(UUID) IS
    'Returns only the current authenticated anonymous participant votes for one platform claim.';
COMMENT ON FUNCTION public.submit_platform_fulfillment_vote(UUID, TEXT, TEXT) IS
    'Creates or updates one platform item vote after Cloudflare participation proxy verification.';
COMMENT ON FUNCTION public.withdraw_platform_fulfillment_vote(UUID, TEXT) IS
    'Deletes the current participant platform item vote after Cloudflare participation proxy verification.';

NOTIFY pgrst, 'reload schema';

COMMIT;
