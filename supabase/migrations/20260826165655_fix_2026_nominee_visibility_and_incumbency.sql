BEGIN;

-- Party nomination and CEC registration are separate facts. Keep the 2026
-- records as party nominees with unknown registration status, and make the
-- public projection use the modern candidacy status instead of the legacy field.
DO $$
DECLARE
    view_definition TEXT;
    projection_marker CONSTANT TEXT :=
        E'candidate.registration_status,\n            candidate.is_elected,';
    projection_replacement CONSTANT TEXT :=
        E'candidate.registration_status,\n            candidate.candidacy_status,\n            candidate.is_elected,';
    predicate_marker CONSTANT TEXT :=
        '(candidate_offices.registration_status = ANY (ARRAY[''pending''::text, ''registered''::text, ''qualified''::text]))';
    predicate_replacement CONSTANT TEXT :=
        '((candidate_offices.candidacy_status = ANY (ARRAY[''party_nominee''::text, ''officially_announced''::text, ''registered''::text, ''qualified''::text])) OR (candidate_offices.registration_status = ANY (ARRAY[''pending''::text, ''registered''::text, ''qualified''::text])))';
BEGIN
    SELECT pg_get_viewdef('public.public_people'::REGCLASS, TRUE)
    INTO view_definition;

    IF STRPOS(view_definition, projection_marker) = 0
       AND STRPOS(view_definition, 'candidate.candidacy_status,') = 0 THEN
        RAISE EXCEPTION 'public_people candidate projection no longer matches the expected definition';
    END IF;

    view_definition := REPLACE(
        view_definition,
        projection_marker,
        projection_replacement
    );

    IF STRPOS(view_definition, predicate_marker) = 0
       AND STRPOS(view_definition, 'candidate_offices.candidacy_status = ANY') = 0 THEN
        RAISE EXCEPTION 'public_people upcoming-candidate predicate no longer matches the expected definition';
    END IF;

    view_definition := REPLACE(
        view_definition,
        predicate_marker,
        predicate_replacement
    );

    EXECUTE 'CREATE OR REPLACE VIEW public.public_people AS '
        || RTRIM(view_definition, E' \n\t;');
END;
$$;

-- The council source is current and the party's 2026 roster is newer than the
-- historical election rows. Preserve the historical affiliations separately.
DO $$
DECLARE
    affected_rows INTEGER;
BEGIN
    UPDATE public.source_people
    SET
        party = '台灣民眾黨',
        normalized_party = '台灣民眾黨',
        source_payload = source_payload || jsonb_build_object(
            'isCurrent', TRUE,
            'currentTerm', '第20屆',
            'currentOfficeEvidence', '彰化縣議會現任議員頁'
        ),
        updated_at = NOW()
    WHERE source_person_key =
        'changhua-county-council-current-councilors:current-councilor-6134a183f749';

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 1 THEN
        RAISE EXCEPTION 'Expected one official 吳韋達 officeholder source, updated %', affected_rows;
    END IF;

    UPDATE public.people
    SET
        party = '台灣民眾黨',
        updated_at = NOW()
    WHERE id = '4cef450a-33fa-49e4-b79d-5554dc01e178'::UUID
      AND party IS DISTINCT FROM '台灣民眾黨';
END;
$$;

-- Mark same-office reelection bids from the current-office projection. This
-- deliberately excludes people running for a different level or office.
WITH same_office_reelection AS (
    SELECT candidate.id
    FROM public.candidates AS candidate
    JOIN public.person_canonical_map AS person_map
      ON person_map.person_id = candidate.person_id
    JOIN public.public_people AS person
      ON person.person_id = person_map.canonical_person_id
    JOIN public.races AS race ON race.id = candidate.race_id
    JOIN public.elections AS election ON election.id = race.election_id
    WHERE election.year = 2026
      AND candidate.is_public = TRUE
      AND candidate.candidacy_status IN (
          'party_nominee',
          'officially_announced',
          'registered',
          'qualified'
      )
      AND (
          (
              race.race_type IN ('city_councilor', 'county_councilor', 'councilor_district')
              AND person.current_office_label LIKE '%議員%'
          )
          OR (
              race.race_type IN ('municipality_mayor', 'county_mayor')
              AND person.current_office_label ~ '(市長|縣長)$'
          )
          OR (
              race.race_type IN ('township_representative', 'township_representative_district')
              AND person.current_office_label LIKE '%代表%'
          )
          OR (
              race.race_type = 'village_chief'
              AND person.current_office_label ~ '(村長|里長)$'
          )
          OR (
              race.race_type = 'township_mayor'
              AND person.current_office_label ~ '(鄉長|鎮長|市長)$'
          )
      )
)
UPDATE public.candidates AS candidate
SET
    is_incumbent = TRUE,
    updated_at = NOW()
FROM same_office_reelection
WHERE candidate.id = same_office_reelection.id
  AND candidate.is_incumbent IS DISTINCT FROM TRUE;

SELECT public.refresh_public_people_list_cached();
SELECT published.promote(NULL);

DO $$
DECLARE
    active_nominee_count INTEGER;
    projected_nominee_count INTEGER;
    same_office_count INTEGER;
    marked_same_office_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO active_nominee_count
    FROM public.candidates AS candidate
    JOIN public.races AS race ON race.id = candidate.race_id
    JOIN public.elections AS election ON election.id = race.election_id
    WHERE election.year = 2026
      AND candidate.is_public = TRUE
      AND candidate.candidacy_status IN (
          'party_nominee',
          'officially_announced',
          'registered',
          'qualified'
      );

    SELECT COUNT(*)
    INTO projected_nominee_count
    FROM public.candidates AS candidate
    JOIN public.person_canonical_map AS person_map
      ON person_map.person_id = candidate.person_id
    JOIN public.public_people AS person
      ON person.person_id = person_map.canonical_person_id
    JOIN public.races AS race ON race.id = candidate.race_id
    JOIN public.elections AS election ON election.id = race.election_id
    WHERE election.year = 2026
      AND candidate.is_public = TRUE
      AND candidate.candidacy_status IN (
          'party_nominee',
          'officially_announced',
          'registered',
          'qualified'
      )
      AND person.upcoming_candidate_label IS NOT NULL;

    IF active_nominee_count <> 363 OR projected_nominee_count <> active_nominee_count THEN
        RAISE EXCEPTION
            'Expected all 363 active 2026 nominees in public_people, got % of %',
            projected_nominee_count,
            active_nominee_count;
    END IF;

    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE candidate.is_incumbent IS TRUE)
    INTO same_office_count, marked_same_office_count
    FROM public.candidates AS candidate
    JOIN public.person_canonical_map AS person_map
      ON person_map.person_id = candidate.person_id
    JOIN public.public_people AS person
      ON person.person_id = person_map.canonical_person_id
    JOIN public.races AS race ON race.id = candidate.race_id
    JOIN public.elections AS election ON election.id = race.election_id
    WHERE election.year = 2026
      AND candidate.is_public = TRUE
      AND candidate.candidacy_status IN (
          'party_nominee',
          'officially_announced',
          'registered',
          'qualified'
      )
      AND (
          (race.race_type IN ('city_councilor', 'county_councilor', 'councilor_district') AND person.current_office_label LIKE '%議員%')
          OR (race.race_type IN ('municipality_mayor', 'county_mayor') AND person.current_office_label ~ '(市長|縣長)$')
          OR (race.race_type IN ('township_representative', 'township_representative_district') AND person.current_office_label LIKE '%代表%')
          OR (race.race_type = 'village_chief' AND person.current_office_label ~ '(村長|里長)$')
          OR (race.race_type = 'township_mayor' AND person.current_office_label ~ '(鄉長|鎮長|市長)$')
      );

    IF same_office_count <> 160 OR marked_same_office_count <> same_office_count THEN
        RAISE EXCEPTION
            'Expected 160 same-office reelection candidates to be marked, got % of %',
            marked_same_office_count,
            same_office_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.public_people
        WHERE person_id = '4cef450a-33fa-49e4-b79d-5554dc01e178'::UUID
          AND party = '台灣民眾黨'
          AND current_office_label = '彰化縣議員'
          AND upcoming_candidate_label LIKE '%議員%'
    ) THEN
        RAISE EXCEPTION '吳韋達 current office, current party, or 2026 candidacy is still inconsistent';
    END IF;
END;
$$;

COMMIT;
