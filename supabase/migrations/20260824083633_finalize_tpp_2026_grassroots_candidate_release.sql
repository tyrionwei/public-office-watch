-- Refresh the published snapshot after the scoped TPP 2026 candidate release.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

SELECT public.refresh_public_people_list_cached();
SELECT published.promote(NULL);

DO $$
DECLARE
    published_candidate_count INTEGER;
    published_grassroots_count INTEGER;
    published_incumbent_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO published_candidate_count
    FROM published.candidate_facts fact
    JOIN public.candidates candidate ON candidate.id = fact.candidate_id
    WHERE candidate.external_id LIKE 'party-candidate:tpp-2026-%';

    SELECT COUNT(*) INTO published_grassroots_count
    FROM published.candidate_facts fact
    JOIN public.candidates candidate ON candidate.id = fact.candidate_id
    JOIN public.races race ON race.id = fact.race_id
    WHERE candidate.external_id LIKE 'party-candidate:tpp-2026-%'
      AND race.race_type IN ('township_mayor', 'township_representative_district', 'village_chief');

    SELECT COUNT(*) INTO published_incumbent_count
    FROM published.candidate_facts fact
    JOIN public.candidates candidate ON candidate.id = fact.candidate_id
    WHERE candidate.external_id LIKE 'party-candidate:tpp-2026-%'
      AND fact.is_incumbent = TRUE;

    IF published_candidate_count <> 105
       OR published_grassroots_count <> 40
       OR published_incumbent_count <> 20 THEN
        RAISE EXCEPTION
            'TPP 2026 published candidate count drift: candidates %, grassroots %, incumbents %',
            published_candidate_count,
            published_grassroots_count,
            published_incumbent_count;
    END IF;
END
$$;

COMMIT;
