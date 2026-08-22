BEGIN;

CREATE INDEX candidate_facts_active_party_idx
    ON published.candidate_facts (
        party,
        election_year DESC,
        region_name,
        race_title,
        person_name,
        candidate_id
    )
    WHERE candidacy_status IN (
        'potential',
        'party_nominee',
        'officially_announced',
        'registered',
        'qualified'
    )
      AND election_result = 'pending';

CREATE VIEW published.active_party_candidates WITH (security_barrier = true) AS
SELECT candidate.*
FROM published.candidates candidate
JOIN published.races race ON race.race_id = candidate.race_id
JOIN published.elections election ON election.election_id = candidate.election_id
WHERE candidate.candidacy_status IN (
        'potential',
        'party_nominee',
        'officially_announced',
        'registered',
        'qualified'
    )
  AND candidate.election_result = 'pending'
  AND race.status IN (
        'announced',
        'upcoming',
        'registration_open',
        'candidates_announced',
        'voting'
    )
  AND election.status IN ('announced', 'upcoming', 'active');

COMMENT ON VIEW published.active_party_candidates IS
    'Active public candidacies for party detail pages; one row represents one current candidacy.';

NOTIFY pgrst, 'reload schema';

COMMIT;
