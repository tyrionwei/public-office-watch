-- Local-only, idempotent import of the 2026 grassroots election race catalog.
-- Source: CEC hub and the 22 local election commission notices published 2026-08-20.
-- This intentionally imports announced race identities. Representative district scopes,
-- seat counts, reserved-women seats, and expense limits remain null until table-level extraction.

BEGIN;

DO $$
BEGIN
  IF current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'Unexpected database: %', current_database();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM elections
    WHERE external_id = 'planned-2026-local-public-officials'
      AND voting_date = DATE '2026-11-28'
  ) THEN
    RAISE EXCEPTION 'Missing planned 2026 local election in this database';
  END IF;
END
$$;

WITH source_map(jurisdiction, mayor_url, representative_url, village_url) AS (
  VALUES
    ('臺北市', NULL, NULL, 'https://web.cec.gov.tw/mect/article/63527'),
    ('新北市', 'https://web.cec.gov.tw/tpcec/article/63525', 'https://web.cec.gov.tw/tpcec/article/63525', 'https://web.cec.gov.tw/tpcec/article/63525'),
    ('桃園市', 'https://web.cec.gov.tw/tyec/article/63516', 'https://web.cec.gov.tw/tyec/article/63516', 'https://web.cec.gov.tw/tyec/article/63516'),
    ('臺中市', 'https://web.cec.gov.tw/tcec/article/63604', 'https://web.cec.gov.tw/tcec/article/63604', 'https://web.cec.gov.tw/tcec/article/63606'),
    ('臺南市', NULL, NULL, 'https://web.cec.gov.tw/tnec/article/63479'),
    ('高雄市', 'https://web.cec.gov.tw/khec/article/63506', 'https://web.cec.gov.tw/khec/article/63506', 'https://web.cec.gov.tw/khec/article/63506'),
    ('新竹縣', 'https://web.cec.gov.tw/hccec/article/63490', 'https://web.cec.gov.tw/hccec/article/63490', 'https://web.cec.gov.tw/hccec/article/63490'),
    ('苗栗縣', 'https://web.cec.gov.tw/mlec/article/63497', 'https://web.cec.gov.tw/mlec/article/63499', 'https://web.cec.gov.tw/mlec/article/63503'),
    ('彰化縣', 'https://web.cec.gov.tw/chec/article/63474', 'https://web.cec.gov.tw/chec/article/63474', 'https://web.cec.gov.tw/chec/article/63474'),
    ('南投縣', 'https://web.cec.gov.tw/ntec/article/63600', 'https://web.cec.gov.tw/ntec/article/63600', 'https://web.cec.gov.tw/ntec/article/63600'),
    ('雲林縣', 'https://web.cec.gov.tw/ylec/article/63592', 'https://web.cec.gov.tw/ylec/article/63592', 'https://web.cec.gov.tw/ylec/article/63592'),
    ('嘉義縣', 'https://web.cec.gov.tw/cycec/article/63452', 'https://web.cec.gov.tw/cycec/article/63452', 'https://web.cec.gov.tw/cycec/article/63452'),
    ('屏東縣', 'https://web.cec.gov.tw/ptec/article/63494', 'https://web.cec.gov.tw/ptec/article/63494', 'https://web.cec.gov.tw/ptec/article/63494'),
    ('宜蘭縣', 'https://web.cec.gov.tw/ilec/article/63595', 'https://web.cec.gov.tw/ilec/article/63595', 'https://web.cec.gov.tw/ilec/article/63595'),
    ('花蓮縣', 'https://web.cec.gov.tw/hlec/article/63588', 'https://web.cec.gov.tw/hlec/article/63588', 'https://web.cec.gov.tw/hlec/article/63588'),
    ('臺東縣', 'https://web.cec.gov.tw/ttec/article/63518', 'https://web.cec.gov.tw/ttec/article/63518', 'https://web.cec.gov.tw/ttec/article/63518'),
    ('澎湖縣', 'https://web.cec.gov.tw/phec/article/63585', 'https://web.cec.gov.tw/phec/article/63585', 'https://web.cec.gov.tw/phec/article/63585'),
    ('金門縣', 'https://web.cec.gov.tw/kmec/article/63578', 'https://web.cec.gov.tw/kmec/article/63578', 'https://web.cec.gov.tw/kmec/article/63578'),
    ('連江縣', 'https://web.cec.gov.tw/lcec/article/63623', 'https://web.cec.gov.tw/lcec/article/63623', 'https://web.cec.gov.tw/lcec/article/63623'),
    ('基隆市', NULL, NULL, 'https://web.cec.gov.tw/klec/article/63561'),
    ('新竹市', NULL, NULL, 'https://web.cec.gov.tw/hcec/article/63519'),
    ('嘉義市', NULL, NULL, 'https://web.cec.gov.tw/cyec/menu/11288')
),
target_election AS (
  SELECT id
  FROM elections
  WHERE external_id = 'planned-2026-local-public-officials'
),
historic_races AS (
  SELECT DISTINCT ON (r.race_type, r.title)
    r.region_id,
    r.race_type,
    r.title,
    sm.mayor_url,
    sm.representative_url,
    sm.village_url
  FROM races r
  JOIN elections e ON e.id = r.election_id
  JOIN source_map sm ON r.title LIKE sm.jurisdiction || '%'
  WHERE e.year = 2022
    AND r.race_type IN ('township_mayor', 'township_representative_district', 'village_chief')
    AND r.title <> '宜蘭縣壯圍鄉忠孝村村長選舉'
  ORDER BY r.race_type, r.title, r.created_at
),
catalog AS (
  SELECT
    tr.id AS election_id,
    hr.region_id,
    hr.race_type,
    hr.title,
    DATE '2026-11-28' AS voting_date,
    'announced'::text AS status,
    '中央選舉委員會及各直轄市、縣（市）選舉委員會'::text AS source_name,
    CASE hr.race_type
      WHEN 'township_mayor' THEN hr.mayor_url
      WHEN 'township_representative_district' THEN hr.representative_url
      WHEN 'village_chief' THEN hr.village_url
    END AS source_url,
    true AS is_public,
    'cec-2026-grassroots-' || md5(hr.race_type || '|' || hr.title) AS external_id,
    CASE WHEN hr.race_type IN ('township_mayor', 'village_chief') THEN 1 ELSE NULL END AS seat_count
  FROM historic_races hr
  CROSS JOIN target_election tr
),
new_villages(jurisdiction, title, source_url) AS (
  VALUES
    ('宜蘭縣', '宜蘭縣壯圍鄉壯六村村長選舉', 'https://web.cec.gov.tw/ilec/article/63595'),
    ('宜蘭縣', '宜蘭縣壯圍鄉順和村村長選舉', 'https://web.cec.gov.tw/ilec/article/63595'),
    ('宜蘭縣', '宜蘭縣壯圍鄉美間村村長選舉', 'https://web.cec.gov.tw/ilec/article/63595'),
    ('宜蘭縣', '宜蘭縣員山鄉金古村村長選舉', 'https://web.cec.gov.tw/ilec/article/63595'),
    ('宜蘭縣', '宜蘭縣員山鄉金泰村村長選舉', 'https://web.cec.gov.tw/ilec/article/63595'),
    ('嘉義縣', '嘉義縣民雄鄉新山村村長選舉', 'https://web.cec.gov.tw/cycec/article/63452')
),
complete_catalog AS (
  SELECT * FROM catalog
  UNION ALL
  SELECT
    tr.id,
    county.id,
    'village_chief',
    nv.title,
    DATE '2026-11-28',
    'announced',
    '中央選舉委員會及各直轄市、縣（市）選舉委員會',
    nv.source_url,
    true,
    'cec-2026-grassroots-' || md5('village_chief|' || nv.title),
    1
  FROM new_villages nv
  CROSS JOIN target_election tr
  JOIN regions county
    ON county.name = nv.jurisdiction
   AND county.region_type = 'county'
   AND county.is_public
)
INSERT INTO races (
  election_id,
  region_id,
  race_type,
  title,
  voting_date,
  status,
  source_name,
  source_url,
  is_public,
  external_id,
  seat_count
)
SELECT
  election_id,
  region_id,
  race_type,
  title,
  voting_date,
  status,
  source_name,
  source_url,
  is_public,
  external_id,
  seat_count
FROM complete_catalog
ON CONFLICT (external_id) DO UPDATE SET
  election_id = EXCLUDED.election_id,
  region_id = EXCLUDED.region_id,
  race_type = EXCLUDED.race_type,
  title = EXCLUDED.title,
  voting_date = EXCLUDED.voting_date,
  status = EXCLUDED.status,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  is_public = EXCLUDED.is_public,
  seat_count = EXCLUDED.seat_count,
  updated_at = now();

SELECT published.promote(NULL);
COMMIT;
