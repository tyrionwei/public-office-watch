CREATE OR REPLACE VIEW public_election_race_list AS
WITH normalized_races AS (
    SELECT
        r.id AS race_id,
        e.id AS election_id,
        e.name AS election_name,
        rg.id AS region_id,
        rg.name AS region_name,
        rg.slug AS region_slug,
        r.race_type,
        r.title,
        r.voting_date,
        r.status,
        r.source_name,
        r.source_url,
        (
            COALESCE(EXTRACT(YEAR FROM e.voting_date)::INTEGER::TEXT, e.year::TEXT, 'unknown')
            || '-' || COALESCE(e.voting_date::TEXT, 'undated')
            || '-' || CASE
                WHEN e.election_type::TEXT IN ('presidential', 'president', 'legislative', 'legislator') THEN 'national'
                WHEN e.election_type::TEXT IN ('local', 'local_chief', 'councilor', 'township_representative', 'village_chief') THEN 'local'
                WHEN e.election_type::TEXT = 'referendum' THEN 'referendum'
                WHEN e.election_type::TEXT = 'recall' THEN 'recall'
                WHEN e.election_type::TEXT = 'by_election' THEN 'by_election'
                ELSE 'other'
            END
        ) AS event_key,
        CASE
            WHEN r.race_type::TEXT IN ('president', 'vice_president', 'party_list_legislator', 'referendum')
                OR rg.name IN ('全國', '臺灣', '台灣') THEN 'national'
            ELSE COALESCE(
                (
                    SELECT county_name
                    FROM unnest(ARRAY[
                        '臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市',
                        '基隆市', '新竹市', '嘉義市', '宜蘭縣', '新竹縣', '苗栗縣',
                        '彰化縣', '南投縣', '雲林縣', '嘉義縣', '屏東縣', '臺東縣',
                        '花蓮縣', '澎湖縣', '金門縣', '連江縣'
                    ]::TEXT[]) AS counties(county_name)
                    WHERE rg.name LIKE county_name || '%'
                    LIMIT 1
                ),
                rg.name,
                '未指定區域'
            )
        END AS region_key,
        CASE r.race_type::TEXT
            WHEN 'president' THEN 10
            WHEN 'vice_president' THEN 10
            WHEN 'municipality_mayor' THEN 20
            WHEN 'county_mayor' THEN 20
            WHEN 'local_chief' THEN 20
            WHEN 'legislator' THEN 30
            WHEN 'legislative_district' THEN 30
            WHEN 'party_list_legislator' THEN 30
            WHEN 'city_councilor' THEN 40
            WHEN 'county_councilor' THEN 40
            WHEN 'councilor_district' THEN 40
            WHEN 'township_mayor' THEN 50
            WHEN 'township_representative' THEN 60
            WHEN 'township_representative_district' THEN 60
            WHEN 'village_chief' THEN 70
            WHEN 'referendum' THEN 80
            WHEN 'recall' THEN 90
            WHEN 'indigenous' THEN 100
            ELSE 999
        END AS sort_category_order
    FROM races r
    JOIN race_canonical_map rm
        ON rm.race_id = r.id
       AND rm.canonical_race_id = r.id
    JOIN election_canonical_map em
        ON em.election_id = r.election_id
       AND em.canonical_election_id = r.election_id
    JOIN elections e ON e.id = r.election_id AND e.is_public = TRUE
    LEFT JOIN regions rg ON rg.id = r.region_id
    WHERE r.is_public = TRUE
      AND (r.region_id IS NULL OR rg.is_public = TRUE)
)
SELECT
    normalized_races.*,
    CASE region_key
        WHEN 'national' THEN -1
        WHEN '臺北市' THEN 0
        WHEN '新北市' THEN 1
        WHEN '桃園市' THEN 2
        WHEN '臺中市' THEN 3
        WHEN '臺南市' THEN 4
        WHEN '高雄市' THEN 5
        WHEN '基隆市' THEN 6
        WHEN '新竹市' THEN 7
        WHEN '嘉義市' THEN 8
        WHEN '宜蘭縣' THEN 9
        WHEN '新竹縣' THEN 10
        WHEN '苗栗縣' THEN 11
        WHEN '彰化縣' THEN 12
        WHEN '南投縣' THEN 13
        WHEN '雲林縣' THEN 14
        WHEN '嘉義縣' THEN 15
        WHEN '屏東縣' THEN 16
        WHEN '臺東縣' THEN 17
        WHEN '花蓮縣' THEN 18
        WHEN '澎湖縣' THEN 19
        WHEN '金門縣' THEN 20
        WHEN '連江縣' THEN 21
        WHEN '未指定區域' THEN 23
        ELSE 22
    END AS sort_region_order,
    (
        regexp_match(
            COALESCE(region_name, '') || ' ' || title,
            '(?:第[[:space:]]*)?0*([0-9]+)[[:space:]]*(?:選舉區|選區)'
        )
    )[1]::INTEGER AS sort_district_order
FROM normalized_races;

GRANT SELECT ON public_election_race_list TO anon, authenticated;
