INSERT INTO regions (name, slug, region_type, parent_region_id, display_order, is_public)
VALUES
    ('台灣', 'taiwan', 'country', NULL, 1, TRUE),
    ('台北市', 'taipei-city', 'municipality', (SELECT id FROM regions WHERE slug = 'taiwan'), 10, TRUE),
    ('新北市', 'new-taipei-city', 'municipality', (SELECT id FROM regions WHERE slug = 'taiwan'), 20, TRUE),
    ('台中市', 'taichung-city', 'municipality', (SELECT id FROM regions WHERE slug = 'taiwan'), 30, TRUE),
    ('台南市', 'tainan-city', 'municipality', (SELECT id FROM regions WHERE slug = 'taiwan'), 40, TRUE),
    ('高雄市', 'kaohsiung-city', 'municipality', (SELECT id FROM regions WHERE slug = 'taiwan'), 50, TRUE),
    ('大安區', 'daan-district', 'district', (SELECT id FROM regions WHERE slug = 'taipei-city'), 101, TRUE),
    ('信義區', 'xinyi-district', 'district', (SELECT id FROM regions WHERE slug = 'taipei-city'), 102, TRUE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO elections (name, year, election_type, voting_date, status, source_name, source_url, is_public)
VALUES (
    '115年地方公職人員選舉',
    2026,
    'local',
    DATE '2026-11-28',
    'announced',
    '中央選舉委員會',
    'https://example.invalid/ccec/2026-local-election',
    TRUE
)
ON CONFLICT DO NOTHING;

INSERT INTO races (election_id, region_id, race_type, title, voting_date, status, source_name, source_url, is_public)
VALUES
    ((SELECT id FROM elections WHERE name = '115年地方公職人員選舉'), (SELECT id FROM regions WHERE slug = 'taipei-city'), 'municipality_mayor', '台北市直轄市長選舉', DATE '2026-11-28', 'upcoming', '中央選舉委員會', 'https://example.invalid/races/taipei-mayor', TRUE),
    ((SELECT id FROM elections WHERE name = '115年地方公職人員選舉'), (SELECT id FROM regions WHERE slug = 'taipei-city'), 'city_councilor', '台北市直轄市議員選舉', DATE '2026-11-28', 'upcoming', '中央選舉委員會', 'https://example.invalid/races/taipei-councilor', TRUE),
    ((SELECT id FROM elections WHERE name = '115年地方公職人員選舉'), (SELECT id FROM regions WHERE slug = 'daan-district'), 'village_chief', '台北市大安區里長選舉', DATE '2026-11-28', 'upcoming', '中央選舉委員會', 'https://example.invalid/races/daan-village-chief', TRUE),
    ((SELECT id FROM elections WHERE name = '115年地方公職人員選舉'), (SELECT id FROM regions WHERE slug = 'new-taipei-city'), 'county_mayor', '新北市市長選舉', DATE '2026-11-28', 'upcoming', '中央選舉委員會', 'https://example.invalid/races/new-taipei-mayor', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO people (name, party, position, district, is_public)
VALUES
    ('測試人物A', '測試黨', '測試候選人', '台北市', TRUE),
    ('測試人物B', '測試黨', '測試候選人', '新北市', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO candidates (person_id, race_id, party, candidate_no, registration_status, source_name, source_url, is_public)
VALUES
    ((SELECT id FROM people WHERE name = '測試人物A' LIMIT 1), (SELECT id FROM races WHERE title = '台北市直轄市長選舉' LIMIT 1), '測試黨', '1', 'registered', '中央選舉委員會', 'https://example.invalid/candidates/test-a', TRUE),
    ((SELECT id FROM people WHERE name = '測試人物B' LIMIT 1), (SELECT id FROM races WHERE title = '新北市市長選舉' LIMIT 1), '測試黨', '2', 'pending', '中央選舉委員會', 'https://example.invalid/candidates/test-b', FALSE)
ON CONFLICT DO NOTHING;
