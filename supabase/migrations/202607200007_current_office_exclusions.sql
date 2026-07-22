CREATE TABLE IF NOT EXISTS current_office_exclusions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    election_year INTEGER NOT NULL,
    race_type TEXT NOT NULL,
    end_reason TEXT NOT NULL CHECK (end_reason IN ('deceased', 'resigned', 'transferred', 'removed', 'other')),
    ended_at DATE,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_observed_at DATE NOT NULL,
    source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (person_id, election_year, race_type)
);

ALTER TABLE current_office_exclusions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON current_office_exclusions FROM anon, authenticated;

INSERT INTO current_office_exclusions (
    person_id,
    election_year,
    race_type,
    end_reason,
    ended_at,
    source_name,
    source_url,
    source_observed_at,
    source_payload,
    updated_at
)
SELECT
    person.id,
    2022,
    'county_councilor',
    'deceased',
    NULL,
    '宜蘭縣選舉委員會：委員會議紀錄',
    'https://web.cec.gov.tw/api/file/2051cc15-e9e3-4b6a-ba7d-9f6dbef62f82.pdf',
    DATE '2026-07-20',
    jsonb_build_object(
        'note', '會議紀錄載明111年地方公職人員選舉宜蘭縣第10選舉區議員李茂豐因病逝世',
        'office', '宜蘭縣第10選舉區議員'
    ),
    NOW()
FROM people person
WHERE person.external_id = 'cec-2022-local-councilor-regional-person-41d1fe276d9d'
ON CONFLICT (person_id, election_year, race_type) DO UPDATE SET
    end_reason = EXCLUDED.end_reason,
    ended_at = EXCLUDED.ended_at,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    source_observed_at = EXCLUDED.source_observed_at,
    source_payload = EXCLUDED.source_payload,
    updated_at = EXCLUDED.updated_at;

CREATE OR REPLACE VIEW public_people AS
WITH mapped_people AS (
    SELECT
        cm.canonical_person_id,
        p.*
    FROM people p
    JOIN person_canonical_map cm ON cm.person_id = p.id
    WHERE p.is_public = TRUE
),
canonical_people AS (
    SELECT p.*
    FROM people p
    WHERE p.is_public = TRUE
),
candidate_offices AS (
    SELECT
        pm.canonical_person_id,
        c.id AS candidate_id,
        c.registration_status,
        c.is_elected,
        c.updated_at,
        e.year AS election_year,
        r.race_type,
        NULLIF(BTRIM(REGEXP_REPLACE(r.title, '候選人|選舉|全國', '', 'g')), '') AS race_label,
        NULLIF(BTRIM(REGEXP_REPLACE(p.position, '候選人|選舉|全國', '', 'g')), '') AS person_position_label,
        r.title AS race_title,
        p.position AS person_position
    FROM candidates c
    JOIN person_canonical_map pm ON pm.person_id = c.person_id
    JOIN race_canonical_map rm ON rm.race_id = c.race_id
    JOIN races r ON r.id = rm.canonical_race_id AND r.is_public = TRUE
    JOIN elections e ON e.id = r.election_id AND e.is_public = TRUE
    JOIN people p ON p.id = pm.canonical_person_id AND p.is_public = TRUE
    LEFT JOIN regions rg ON rg.id = r.region_id
    WHERE c.is_public = TRUE
      AND (r.region_id IS NULL OR rg.is_public = TRUE)
),
ended_current_offices AS (
    SELECT
        pcm.canonical_person_id,
        exclusion.election_year,
        exclusion.race_type
    FROM current_office_exclusions exclusion
    JOIN person_canonical_map pcm ON pcm.person_id = exclusion.person_id
),
current_offices AS (
    SELECT DISTINCT ON (canonical_person_id)
        canonical_person_id,
        CASE
            WHEN race_label LIKE '%總統%' AND race_label LIKE '%副總統%' AND person_position_label LIKE '%副總統%' THEN '副總統'
            WHEN race_label LIKE '%總統%' AND race_label LIKE '%副總統%' AND person_position_label LIKE '%總統%' THEN '總統'
            WHEN race_label LIKE '%總統%' AND person_position_label LIKE '%副總統%' THEN person_position_label
            WHEN race_label ~ '(總統|副總統|立法委員|立委|市長|縣長|議員)' THEN race_label
            WHEN person_position_label ~ '(總統|副總統|立法委員|立委|市長|縣長|議員)' THEN person_position_label
            ELSE COALESCE(race_label, person_position_label)
        END AS current_office_label
    FROM candidate_offices
    WHERE (registration_status = 'elected' OR is_elected = TRUE)
      AND NOT EXISTS (
          SELECT 1
          FROM ended_current_offices ended
          WHERE ended.canonical_person_id = candidate_offices.canonical_person_id
            AND ended.election_year = candidate_offices.election_year
            AND ended.race_type = candidate_offices.race_type
      )
      AND (
        election_year IS NULL
        OR (COALESCE(race_title, '') ~ '(總統|副總統|立法委員|立委|不分區)' AND election_year >= 2024)
        OR (COALESCE(race_title, '') ~ '(市長|縣長|議員|鄉長|鎮長|市民代表|鄉民代表|鎮民代表|村長|里長|代表)' AND election_year >= 2022)
        OR (COALESCE(race_title, '') !~ '(總統|副總統|立法委員|立委|不分區|市長|縣長|議員|鄉長|鎮長|市民代表|鄉民代表|鎮民代表|村長|里長|代表)' AND election_year >= 2024)
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
    SELECT DISTINCT ON (pcm.canonical_person_id)
        pcm.canonical_person_id,
        sp.position AS current_office_label
    FROM source_people sp
    JOIN person_identity_matches pim
      ON pim.source_person_id = sp.id
     AND pim.match_status IN ('auto_matched', 'probable_match')
    JOIN person_canonical_map pcm ON pcm.person_id = pim.person_id
    WHERE sp.source_type = 'official_officeholder'
      AND sp.is_public = TRUE
      AND sp.source_payload ->> 'isCurrent' = 'true'
      AND NULLIF(BTRIM(sp.position), '') IS NOT NULL
      AND sp.position !~ '(候選人|參選|擬參選)'
    ORDER BY
        pcm.canonical_person_id,
        CASE
            WHEN sp.position LIKE '%立法院院長%' AND sp.position NOT LIKE '%副院長%' THEN 0
            WHEN sp.position LIKE '%立法院副院長%' THEN 1
            WHEN sp.position LIKE '%立法委員%' THEN 2
            ELSE 5
        END,
        sp.election_year DESC NULLS LAST,
        sp.updated_at DESC
),
upcoming_candidates AS (
    SELECT DISTINCT ON (canonical_person_id)
        canonical_person_id,
        CASE
            WHEN race_label LIKE '%總統%' AND race_label LIKE '%副總統%' AND person_position_label LIKE '%副總統%' THEN '副總統'
            WHEN race_label LIKE '%總統%' AND race_label LIKE '%副總統%' AND person_position_label LIKE '%總統%' THEN '總統'
            WHEN race_label LIKE '%總統%' AND person_position_label LIKE '%副總統%' THEN person_position_label
            WHEN race_label ~ '(總統|副總統|立法委員|立委|市長|縣長|議員)' THEN race_label
            WHEN person_position_label ~ '(總統|副總統|立法委員|立委|市長|縣長|議員)' THEN person_position_label
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
    ph.photo_url AS primary_photo_url,
    ph.thumbnail_url AS primary_photo_thumbnail_url,
    ph.source_name AS photo_source_name,
    ph.source_url AS photo_source_url,
    ph.license_type AS photo_license_type,
    ph.license_url AS photo_license_url,
    ph.attribution AS photo_attribution,
    COALESCE(NULLIF(canonical.gender, 'unknown'), (array_remove(array_agg(NULLIF(mapped.gender, 'unknown') ORDER BY mapped.updated_at DESC), NULL))[1], canonical.gender) AS gender,
    COALESCE(canonical.education, (array_remove(array_agg(mapped.education ORDER BY mapped.updated_at DESC), NULL))[1]) AS education,
    COALESCE(canonical.experience, (array_remove(array_agg(mapped.experience ORDER BY mapped.updated_at DESC), NULL))[1]) AS experience,
    COALESCE(
        official_current_offices.current_office_label,
        current_offices.current_office_label
    ) AS current_office_label,
    upcoming_candidates.upcoming_candidate_label
FROM mapped_people mapped
JOIN canonical_people canonical ON canonical.id = mapped.canonical_person_id
LEFT JOIN public_person_primary_photos ph ON ph.person_id = canonical.id
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
    ph.photo_url,
    ph.thumbnail_url,
    ph.source_name,
    ph.source_url,
    ph.license_type,
    ph.license_url,
    ph.attribution,
    official_current_offices.current_office_label,
    current_offices.current_office_label,
    upcoming_candidates.upcoming_candidate_label;

REFRESH MATERIALIZED VIEW public_people_list_cached;
