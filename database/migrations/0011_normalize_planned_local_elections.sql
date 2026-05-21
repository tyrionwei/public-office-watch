UPDATE candidates AS c
SET is_public = FALSE,
    updated_at = NOW()
WHERE c.source_url LIKE 'https://example.invalid/%'
   OR EXISTS (
      SELECT 1
      FROM people AS p
      WHERE p.id = c.person_id
        AND (p.name LIKE '測試人物%' OR p.party = '測試黨')
   );

UPDATE races
SET is_public = FALSE,
    updated_at = NOW()
WHERE source_url LIKE 'https://example.invalid/%'
   OR title IN (
      '台北市直轄市長選舉',
      '台北市直轄市議員選舉',
      '台北市大安區里長選舉',
      '新北市市長選舉'
   );

UPDATE elections
SET is_public = FALSE,
    updated_at = NOW()
WHERE source_url LIKE 'https://example.invalid/%';

UPDATE people
SET is_public = FALSE,
    updated_at = NOW()
WHERE name LIKE '測試人物%'
   OR party = '測試黨';

UPDATE person_media
SET is_public = FALSE,
    updated_at = NOW()
WHERE source_url LIKE 'https://example.com/placeholder%';

WITH planned_election AS (
    INSERT INTO elections (
        external_id,
        name,
        year,
        election_type,
        voting_date,
        status,
        source_name,
        source_url,
        is_public,
        updated_at
    )
    VALUES (
        'planned-2026-local-public-officials',
        '115年地方公職人員選舉',
        2026,
        'local',
        DATE '2026-11-28',
        'announced',
        '中央選舉委員會：115年地方公職人員選舉時程',
        'https://www.cec.gov.tw/',
        TRUE,
        NOW()
    )
    ON CONFLICT (external_id) DO UPDATE
    SET name = EXCLUDED.name,
        year = EXCLUDED.year,
        election_type = EXCLUDED.election_type,
        voting_date = EXCLUDED.voting_date,
        status = EXCLUDED.status,
        source_name = EXCLUDED.source_name,
        source_url = EXCLUDED.source_url,
        is_public = EXCLUDED.is_public,
        updated_at = NOW()
    RETURNING id
),
target_election AS (
    SELECT id FROM planned_election
    UNION ALL
    SELECT id
    FROM elections
    WHERE external_id = 'planned-2026-local-public-officials'
      AND NOT EXISTS (SELECT 1 FROM planned_election)
),
base_races AS (
    SELECT r.*
    FROM races AS r
    JOIN elections AS e ON e.id = r.election_id
    WHERE e.external_id = 'cec-2022-local-public-officials'
      AND r.external_id IS NOT NULL
      AND r.status = 'completed'
      AND r.is_public = TRUE
      AND r.race_type IN ('municipality_mayor', 'county_mayor', 'city_councilor', 'county_councilor')
)
INSERT INTO races (
    external_id,
    election_id,
    region_id,
    race_type,
    title,
    voting_date,
    status,
    source_name,
    source_url,
    is_public,
    updated_at
)
SELECT
    'planned-2026-local-from-' || base_races.external_id,
    target_election.id,
    base_races.region_id,
    base_races.race_type,
    base_races.title,
    DATE '2026-11-28',
    'announced',
    '中央選舉委員會：115年地方公職人員選舉時程',
    'https://www.cec.gov.tw/',
    TRUE,
    NOW()
FROM base_races
CROSS JOIN target_election
ON CONFLICT (external_id) DO UPDATE
SET election_id = EXCLUDED.election_id,
    region_id = EXCLUDED.region_id,
    race_type = EXCLUDED.race_type,
    title = EXCLUDED.title,
    voting_date = EXCLUDED.voting_date,
    status = EXCLUDED.status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();
