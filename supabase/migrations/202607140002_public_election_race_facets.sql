CREATE OR REPLACE VIEW public_election_race_facets AS
WITH normalized_races AS (
    SELECT
        election_id,
        race_type,
        CASE
            WHEN race_type::TEXT IN ('president', 'vice_president', 'party_list_legislator', 'referendum')
                OR region_name IN ('全國', '臺灣', '台灣') THEN '全國'
            ELSE COALESCE(
                (
                    SELECT county_name
                    FROM unnest(ARRAY[
                        '臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市',
                        '基隆市', '新竹市', '嘉義市', '宜蘭縣', '新竹縣', '苗栗縣',
                        '彰化縣', '南投縣', '雲林縣', '嘉義縣', '屏東縣', '臺東縣',
                        '花蓮縣', '澎湖縣', '金門縣', '連江縣'
                    ]::TEXT[]) AS counties(county_name)
                    WHERE region_name LIKE county_name || '%'
                    LIMIT 1
                ),
                region_name,
                '未指定區域'
            )
        END AS region_label
    FROM public_races
)
SELECT
    election_id,
    race_type,
    CASE WHEN region_label = '全國' THEN 'national' ELSE region_label END AS region_key,
    region_label,
    COUNT(*)::INTEGER AS race_count
FROM normalized_races
GROUP BY election_id, race_type, region_label;

GRANT SELECT ON public_election_race_facets TO anon, authenticated;
