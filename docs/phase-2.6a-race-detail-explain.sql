-- Read-only local validation for the bounded published race-detail path.
-- The first query identifies the largest current candidate roster. Use its race_id
-- in the three EXPLAIN ANALYZE statements below when repeating the measurement.
SELECT
    race_id,
    COUNT(*) AS candidate_count
FROM published.candidates
GROUP BY race_id
ORDER BY candidate_count DESC, race_id
LIMIT 10;

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
    race_id, election_id, election_name, region_id, region_name, region_slug,
    race_type, title, voting_date, status, source_name, source_url
FROM published.races
WHERE race_id = 'bd52aa3f-1856-4b13-b7d2-4861a9f5d3d6'
LIMIT 1;

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
    election_id, name, year, election_type, voting_date, status,
    source_name, source_url
FROM published.elections
WHERE election_id = '9947ae7e-c242-4911-bcf3-72d2f0f5517d'
LIMIT 1;

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
    candidate_id, person_id, person_name, person_party, person_position,
    race_id, race_title, election_id, election_name, region_id, region_name,
    party, candidate_no, registration_status, vote_count, vote_rate,
    is_elected, is_incumbent, election_year, candidacy_status,
    election_result, status_updated_at, candidate_updated_at, source_name,
    source_url, primary_photo_url, primary_photo_thumbnail_url,
    photo_attribution, photo_license_type
FROM published.candidates
WHERE race_id = 'bd52aa3f-1856-4b13-b7d2-4861a9f5d3d6'
ORDER BY
    candidate_no ASC NULLS LAST,
    person_name ASC,
    candidate_id ASC
LIMIT 101;
