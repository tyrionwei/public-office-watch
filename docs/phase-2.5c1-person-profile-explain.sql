-- Read-only Phase 2.5C1 person-profile query-plan preflight.
-- The first UUID is the local canonical person with the most published claims
-- (79) and tied for the most candidate records (6). The second has the most
-- party-affiliation rows (4).

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    person_id,
    name,
    alias,
    gender,
    party,
    position,
    current_office_label,
    upcoming_candidate_label,
    election_year,
    district,
    education,
    experience,
    updated_at,
    primary_photo_url,
    primary_photo_thumbnail_url,
    photo_source_name,
    photo_source_url,
    photo_license_type,
    photo_license_url,
    photo_attribution,
    list_role,
    list_status,
    list_is_grassroots,
    list_is_party_only,
    list_status_order,
    list_role_order,
    candidate_count,
    primary_region_id,
    primary_region_name
FROM published.people
WHERE person_id IN ('19d1a17e-aa25-4de6-89b9-b4f2204c0a1f')
ORDER BY person_id
LIMIT 4;

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    candidate_id,
    person_id,
    person_name,
    person_party,
    person_position,
    race_id,
    race_title,
    election_id,
    election_name,
    region_id,
    region_name,
    party,
    candidate_no,
    registration_status,
    vote_count,
    vote_rate,
    is_elected,
    is_incumbent,
    election_year,
    candidacy_status,
    election_result,
    status_updated_at,
    candidate_updated_at,
    source_name,
    source_url,
    primary_photo_url,
    primary_photo_thumbnail_url,
    photo_attribution,
    photo_license_type
FROM published.candidates
WHERE person_id IN ('19d1a17e-aa25-4de6-89b9-b4f2204c0a1f')
ORDER BY person_id, election_year DESC NULLS LAST, race_id, candidate_id
LIMIT 101;

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    claim_id,
    person_id,
    claim_type,
    claim_value,
    claim_json,
    confidence_level,
    review_score,
    source_name,
    source_url,
    observed_at,
    updated_at
FROM published.person_claims
WHERE person_id IN ('19d1a17e-aa25-4de6-89b9-b4f2204c0a1f')
ORDER BY person_id, observed_at DESC NULLS LAST, claim_id
LIMIT 401;

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    affiliation_id,
    affiliation_key,
    person_id,
    person_name,
    source_claim_key,
    party_name,
    role_context,
    role_title,
    organization_unit,
    display_order,
    role_tier,
    observed_year,
    observed_date,
    start_date,
    end_date,
    is_current,
    confidence_level,
    source_name,
    source_url,
    updated_at
FROM published.person_party_affiliations
WHERE person_id IN ('072996a8-3739-4c77-ae43-6d20cbddbdd8')
ORDER BY person_id, is_current DESC, observed_year DESC NULLS LAST,
    display_order ASC NULLS LAST, affiliation_id
LIMIT 101;
