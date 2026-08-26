BEGIN;

CREATE OR REPLACE FUNCTION published.home_candidate_summaries_for(p_race_ids UUID[])
RETURNS SETOF published.home_candidate_summaries
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_race_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT input.race_id)
    INTO v_race_count
    FROM pg_catalog.unnest(COALESCE(p_race_ids, ARRAY[]::UUID[])) AS input(race_id)
    WHERE input.race_id IS NOT NULL;

    IF v_race_count > 24 THEN
        RAISE EXCEPTION 'home_candidate_summaries_for accepts at most 24 race ids';
    END IF;

    RETURN QUERY
    WITH RECURSIVE requested_races AS (
        SELECT DISTINCT input.race_id
        FROM pg_catalog.unnest(COALESCE(p_race_ids, ARRAY[]::UUID[])) AS input(race_id)
        WHERE input.race_id IS NOT NULL
    ),
    requested_candidates AS MATERIALIZED (
        SELECT fact.*
        FROM requested_races requested
        JOIN published.candidate_facts fact
          ON fact.race_id = requested.race_id
        ORDER BY
            fact.race_id,
            fact.candidate_no NULLS LAST,
            fact.person_name,
            fact.candidate_id
        LIMIT 401
    ),
    member_ids(canonical_person_id, source_person_id, path, depth) AS (
        SELECT DISTINCT
            candidate.person_id,
            candidate.person_id,
            ARRAY[candidate.person_id],
            0
        FROM requested_candidates candidate
        WHERE candidate.person_id IS NOT NULL

        UNION ALL

        SELECT
            member.canonical_person_id,
            decision.duplicate_person_id,
            member.path || decision.duplicate_person_id,
            member.depth + 1
        FROM member_ids member
        JOIN public.person_merge_decisions decision
          ON decision.canonical_person_id = member.source_person_id
         AND decision.status = 'verified'
        WHERE member.depth < 20
          AND NOT decision.duplicate_person_id = ANY(member.path)
    ),
    birth_dates AS MATERIALIZED (
        SELECT DISTINCT ON (member.canonical_person_id)
            member.canonical_person_id AS person_id,
            claim.claim_value
        FROM member_ids member
        JOIN public.person_claims claim
          ON claim.person_id = member.source_person_id
         AND claim.claim_type = 'birth_date'
         AND claim.review_status = 'verified'
         AND claim.visibility = 'public'
         AND claim.is_public
        ORDER BY
            member.canonical_person_id,
            claim.updated_at DESC,
            claim.id
    )
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
        candidate.election_year,
        candidate.candidacy_status,
        candidate.election_result,
        candidate.status_updated_at,
        candidate.candidate_updated_at,
        core.source_name,
        core.source_url,
        photo.photo_url AS primary_photo_url,
        photo.thumbnail_url AS primary_photo_thumbnail_url,
        photo.attribution AS photo_attribution,
        photo.license_type AS photo_license_type,
        person.gender,
        birth_date.claim_value AS birth_date
    FROM requested_candidates candidate
    LEFT JOIN public.candidates core
      ON core.id = candidate.candidate_id
    LEFT JOIN public.public_person_primary_photos photo
      ON photo.person_id = candidate.person_id
    LEFT JOIN published.people_directory person
      ON person.person_id = candidate.person_id
    LEFT JOIN birth_dates birth_date
      ON birth_date.person_id = candidate.person_id
    ORDER BY
        candidate.race_id,
        candidate.candidate_no NULLS LAST,
        candidate.person_name,
        candidate.candidate_id
    LIMIT 401;
END;
$$;

REVOKE ALL ON FUNCTION published.home_candidate_summaries_for(UUID[])
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION published.home_candidate_summaries_for(UUID[])
TO anon, authenticated, service_role, admin_role;

COMMENT ON FUNCTION published.home_candidate_summaries_for(UUID[]) IS
    'Bounded homepage candidate lookup that filters the published snapshot before demographic joins.';

NOTIFY pgrst, 'reload schema';

COMMIT;
