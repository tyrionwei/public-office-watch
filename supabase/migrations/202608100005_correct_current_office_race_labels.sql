BEGIN;

-- The office held comes from the elected race. A later candidacy must not
-- replace it merely because people.position contains a higher-priority title.
CREATE OR REPLACE VIEW public_people AS
WITH mapped_people AS (
    SELECT
        canonical_map.canonical_person_id,
        person.*
    FROM people AS person
    JOIN person_canonical_map AS canonical_map ON canonical_map.person_id = person.id
    WHERE person.is_public = TRUE
),
canonical_people AS (
    SELECT person.*
    FROM people AS person
    WHERE person.is_public = TRUE
),
candidate_offices AS (
    SELECT
        person_map.canonical_person_id,
        candidate.id AS candidate_id,
        candidate.registration_status,
        candidate.is_elected,
        candidate.updated_at,
        election.year AS election_year,
        race.race_type,
        NULLIF(BTRIM(REGEXP_REPLACE(race.title, '候選人|選舉|全國', '', 'g')), '') AS race_label,
        NULLIF(BTRIM(REGEXP_REPLACE(person.position, '候選人|選舉|全國', '', 'g')), '') AS person_position_label,
        race.title AS race_title,
        person.position AS person_position
    FROM candidates AS candidate
    JOIN person_canonical_map AS person_map ON person_map.person_id = candidate.person_id
    JOIN race_canonical_map AS race_map ON race_map.race_id = candidate.race_id
    JOIN races AS race ON race.id = race_map.canonical_race_id AND race.is_public = TRUE
    JOIN elections AS election ON election.id = race.election_id AND election.is_public = TRUE
    JOIN people AS person ON person.id = person_map.canonical_person_id AND person.is_public = TRUE
    LEFT JOIN regions AS region ON region.id = race.region_id
    WHERE candidate.is_public = TRUE
      AND (race.region_id IS NULL OR region.is_public = TRUE)
),
ended_current_offices AS (
    SELECT
        person_map.canonical_person_id,
        exclusion.election_year,
        exclusion.race_type
    FROM current_office_exclusions AS exclusion
    JOIN person_canonical_map AS person_map ON person_map.person_id = exclusion.person_id
),
current_offices AS (
    SELECT DISTINCT ON (canonical_person_id)
        canonical_person_id,
        CASE
            WHEN race_label LIKE '%總統%' AND race_label LIKE '%副總統%' AND person_position_label LIKE '%副總統%' THEN '副總統'
            WHEN race_label LIKE '%總統%' AND race_label LIKE '%副總統%' AND person_position_label LIKE '%總統%' THEN '總統'
            WHEN race_label LIKE '%總統%' AND person_position_label LIKE '%副總統%' THEN person_position_label
            ELSE COALESCE(race_label, person_position_label)
        END AS current_office_label
    FROM candidate_offices
    WHERE (registration_status = 'elected' OR is_elected = TRUE)
      AND NOT EXISTS (
          SELECT 1
          FROM ended_current_offices AS ended
          WHERE ended.canonical_person_id = candidate_offices.canonical_person_id
            AND ended.election_year = candidate_offices.election_year
            AND ended.race_type = candidate_offices.race_type
      )
      AND (
        election_year IS NULL
        OR (COALESCE(race_title, '') ~ '(總統|副總統|立法委員|立委|不分區)' AND election_year >= 2024)
        OR (COALESCE(race_title, '') ~ '(市長|縣長|區長|議員|鄉長|鎮長|市民代表|鄉民代表|鎮民代表|村長|里長|代表)' AND election_year >= 2022)
        OR (COALESCE(race_title, '') !~ '(總統|副總統|立法委員|立委|不分區|市長|縣長|區長|議員|鄉長|鎮長|市民代表|鄉民代表|鎮民代表|村長|里長|代表)' AND election_year >= 2024)
      )
    ORDER BY
        canonical_person_id,
        CASE
            WHEN COALESCE(race_label, person_position_label, '') LIKE '%副總統%' THEN 1
            WHEN COALESCE(race_label, person_position_label, '') LIKE '%總統%' THEN 0
            WHEN COALESCE(race_label, person_position_label, '') ~ '(立法委員|立委)' THEN 2
            WHEN COALESCE(race_label, person_position_label, '') ~ '(市長|縣長)' THEN 3
            WHEN COALESCE(race_label, person_position_label, '') LIKE '%議員%' THEN 5
            ELSE 8
        END,
        election_year DESC NULLS LAST,
        updated_at DESC
),
official_current_offices AS (
    SELECT DISTINCT ON (person_map.canonical_person_id)
        person_map.canonical_person_id,
        source_person.position AS current_office_label
    FROM source_people AS source_person
    JOIN person_identity_matches AS identity_match
      ON identity_match.source_person_id = source_person.id
     AND identity_match.match_status IN ('auto_matched', 'probable_match')
    JOIN person_canonical_map AS person_map ON person_map.person_id = identity_match.person_id
    WHERE source_person.source_type = 'official_officeholder'
      AND source_person.is_public = TRUE
      AND source_person.source_payload ->> 'isCurrent' = 'true'
      AND NULLIF(BTRIM(source_person.position), '') IS NOT NULL
      AND source_person.position !~ '(候選人|參選|擬參選)'
    ORDER BY
        person_map.canonical_person_id,
        CASE
            WHEN source_person.position LIKE '%立法院院長%' AND source_person.position NOT LIKE '%副院長%' THEN 0
            WHEN source_person.position LIKE '%立法院副院長%' THEN 1
            WHEN source_person.position LIKE '%立法委員%' THEN 2
            ELSE 5
        END,
        source_person.election_year DESC NULLS LAST,
        source_person.updated_at DESC
),
upcoming_candidates AS (
    SELECT DISTINCT ON (canonical_person_id)
        canonical_person_id,
        CASE
            WHEN race_label LIKE '%總統%' AND race_label LIKE '%副總統%' AND person_position_label LIKE '%副總統%' THEN '副總統'
            WHEN race_label LIKE '%總統%' AND race_label LIKE '%副總統%' AND person_position_label LIKE '%總統%' THEN '總統'
            WHEN race_label LIKE '%總統%' AND person_position_label LIKE '%副總統%' THEN person_position_label
            ELSE COALESCE(race_label, person_position_label)
        END AS upcoming_candidate_label
    FROM candidate_offices
    WHERE registration_status IN ('pending', 'registered', 'qualified')
      AND election_year >= EXTRACT(YEAR FROM CURRENT_DATE)::INT
    ORDER BY
        canonical_person_id,
        election_year ASC,
        CASE
            WHEN COALESCE(race_label, person_position_label, '') LIKE '%副總統%' THEN 1
            WHEN COALESCE(race_label, person_position_label, '') LIKE '%總統%' THEN 0
            WHEN COALESCE(race_label, person_position_label, '') ~ '(立法委員|立委)' THEN 2
            WHEN COALESCE(race_label, person_position_label, '') ~ '(市長|縣長)' THEN 3
            WHEN COALESCE(race_label, person_position_label, '') LIKE '%議員%' THEN 5
            ELSE 8
        END,
        updated_at DESC
)
SELECT
    canonical.id AS person_id,
    canonical.name,
    COALESCE(canonical.alias, (array_remove(array_agg(mapped.alias ORDER BY mapped.updated_at DESC), NULL))[1]) AS alias,
    COALESCE(canonical.party, (array_remove(array_agg(mapped.party ORDER BY mapped.updated_at DESC), NULL))[1]) AS party,
    COALESCE(
        official_current_offices.current_office_label,
        current_offices.current_office_label,
        upcoming_candidates.upcoming_candidate_label,
        CASE WHEN canonical.position !~ '(候選人|參選|擬參選)' THEN canonical.position END,
        (array_remove(array_agg(mapped.position ORDER BY mapped.updated_at DESC) FILTER (WHERE mapped.position !~ '(候選人|參選|擬參選)'), NULL))[1]
    ) AS position,
    COALESCE(canonical.election_year, (array_remove(array_agg(mapped.election_year ORDER BY mapped.updated_at DESC), NULL))[1]) AS election_year,
    COALESCE(canonical.district, (array_remove(array_agg(mapped.district ORDER BY mapped.updated_at DESC), NULL))[1]) AS district,
    MAX(mapped.updated_at) AS updated_at,
    photo.photo_url AS primary_photo_url,
    photo.thumbnail_url AS primary_photo_thumbnail_url,
    photo.source_name AS photo_source_name,
    photo.source_url AS photo_source_url,
    photo.license_type AS photo_license_type,
    photo.license_url AS photo_license_url,
    photo.attribution AS photo_attribution,
    COALESCE(
        NULLIF(canonical.gender, 'unknown'),
        (array_remove(array_agg(NULLIF(mapped.gender, 'unknown') ORDER BY mapped.updated_at DESC), NULL))[1],
        canonical.gender
    ) AS gender,
    COALESCE(canonical.education, (array_remove(array_agg(mapped.education ORDER BY mapped.updated_at DESC), NULL))[1]) AS education,
    COALESCE(canonical.experience, (array_remove(array_agg(mapped.experience ORDER BY mapped.updated_at DESC), NULL))[1]) AS experience,
    COALESCE(
        official_current_offices.current_office_label,
        current_offices.current_office_label
    ) AS current_office_label,
    upcoming_candidates.upcoming_candidate_label
FROM mapped_people AS mapped
JOIN canonical_people AS canonical ON canonical.id = mapped.canonical_person_id
LEFT JOIN public_person_primary_photos AS photo ON photo.person_id = canonical.id
LEFT JOIN official_current_offices ON official_current_offices.canonical_person_id = canonical.id
LEFT JOIN current_offices ON current_offices.canonical_person_id = canonical.id
LEFT JOIN upcoming_candidates ON upcoming_candidates.canonical_person_id = canonical.id
GROUP BY
    canonical.id,
    canonical.name,
    canonical.alias,
    canonical.party,
    canonical.position,
    canonical.election_year,
    canonical.district,
    canonical.gender,
    canonical.education,
    canonical.experience,
    photo.photo_url,
    photo.thumbnail_url,
    photo.source_name,
    photo.source_url,
    photo.license_type,
    photo.license_url,
    photo.attribution,
    official_current_offices.current_office_label,
    current_offices.current_office_label,
    upcoming_candidates.upcoming_candidate_label;

SELECT refresh_public_people_list_cached();

COMMIT;
