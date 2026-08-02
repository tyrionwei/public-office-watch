SET statement_timeout = 0;

-- Generated historical CEC election/race migration.

WITH input(external_id, event_external_id, region_external_id, race_type, title) AS (
    VALUES
    ('cec-historical-race-969fa024c5d00bc5', 'cec-2012-legislative-yuan', 'cec-historical-county-taoyuan', 'legislative_district', '桃園縣第1選舉區立法委員選舉'),
    ('cec-historical-race-07bc388e181f3c6f', 'cec-2012-legislative-yuan', 'cec-historical-county-taoyuan', 'legislative_district', '桃園縣第2選舉區立法委員選舉'),
    ('cec-historical-race-401193bd47c885af', 'cec-2012-legislative-yuan', 'cec-historical-county-taoyuan', 'legislative_district', '桃園縣第3選舉區立法委員選舉'),
    ('cec-historical-race-9eaa04cb52b43213', 'cec-2012-legislative-yuan', 'cec-historical-county-taoyuan', 'legislative_district', '桃園縣第4選舉區立法委員選舉'),
    ('cec-historical-race-4cdd0d18db8de657', 'cec-2012-legislative-yuan', 'cec-historical-county-taoyuan', 'legislative_district', '桃園縣第5選舉區立法委員選舉'),
    ('cec-historical-race-c7de5b47b28597d6', 'cec-2012-legislative-yuan', 'cec-historical-county-taoyuan', 'legislative_district', '桃園縣第6選舉區立法委員選舉')
)
INSERT INTO races (
    external_id, election_id, region_id, race_type, title, voting_date,
    status, source_name, source_url, is_public, updated_at
)
SELECT
    input.external_id,
    election.id,
    region.id,
    input.race_type,
    input.title,
    NULL,
    'completed',
    '中央選舉委員會開放資料',
    'https://data.gov.tw/dataset/13119',
    FALSE,
    NOW()
FROM input
JOIN elections AS election ON election.external_id = input.event_external_id
LEFT JOIN regions AS region ON region.external_id = input.region_external_id
WHERE input.region_external_id IS NULL OR region.id IS NOT NULL
ON CONFLICT (external_id) DO UPDATE SET
    election_id = EXCLUDED.election_id,
    region_id = EXCLUDED.region_id,
    race_type = EXCLUDED.race_type,
    title = EXCLUDED.title,
    status = EXCLUDED.status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    is_public = FALSE,
    updated_at = NOW();

DO $verify$
BEGIN
    IF (SELECT COUNT(*) FROM races WHERE external_id = ANY(ARRAY['cec-historical-race-969fa024c5d00bc5', 'cec-historical-race-07bc388e181f3c6f', 'cec-historical-race-401193bd47c885af', 'cec-historical-race-9eaa04cb52b43213', 'cec-historical-race-4cdd0d18db8de657', 'cec-historical-race-c7de5b47b28597d6']::TEXT[])) <> 6 THEN
        RAISE EXCEPTION 'Historical CEC migration races count mismatch';
    END IF;
END
$verify$;

SELECT
    0 AS planned_regions,
    0 AS planned_elections,
    0 AS normalized_elections,
    6 AS planned_races,
    0 AS normalized_races;

SELECT published.promote(NULL);

RESET statement_timeout;
