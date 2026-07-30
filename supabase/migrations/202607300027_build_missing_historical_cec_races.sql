-- Generated historical CEC election/race migration.

WITH input(external_id, event_external_id, region_external_id, race_type, title) AS (
    VALUES
    ('cec-historical-race-de74b87d79f4ddb4', 'cec-historical-election-a275bfcd53f64b5f', 'tw-county-10002', 'county_councilor', '宜蘭縣第11選舉區山地原住民議員選舉'),
    ('cec-historical-race-a9d25f6be969d03e', 'cec-historical-election-a275bfcd53f64b5f', 'tw-county-10013', 'county_councilor', '屏東縣第15選舉區山地原住民議員選舉'),
    ('cec-historical-race-03335fc8f1f7c9a5', 'cec-historical-election-a275bfcd53f64b5f', 'tw-county-10013', 'county_councilor', '屏東縣第16選舉區山地原住民議員選舉'),
    ('cec-historical-race-a083f527ac1643d7', 'cec-historical-election-a275bfcd53f64b5f', 'tw-county-10013', 'county_councilor', '屏東縣第8選舉區平地原住民議員選舉'),
    ('cec-historical-race-f3f954a2da845583', 'cec-historical-election-a275bfcd53f64b5f', 'tw-county-10013', 'county_councilor', '屏東縣第9選舉區山地原住民議員選舉'),
    ('cec-historical-race-43a5900bffc785b3', 'cec-historical-election-a275bfcd53f64b5f', 'cec-historical-county-kaohsiung', 'county_councilor', '高雄縣第5選舉區議員選舉'),
    ('cec-historical-race-521abe9268417601', 'cec-historical-election-a275bfcd53f64b5f', 'tw-county-10004', 'county_councilor', '新竹縣第9選舉區議員選舉'),
    ('cec-historical-race-89e7bddeeaf94b8d', 'cec-historical-election-a275bfcd53f64b5f', 'cec-historical-county-taichung', 'county_councilor', '臺中縣第8選舉區平地原住民議員選舉'),
    ('cec-historical-race-d24648b09e2d7466', 'cec-historical-election-a275bfcd53f64b5f', 'tw-county-10014', 'county_councilor', '臺東縣第10選舉區山地原住民議員選舉'),
    ('cec-historical-race-8cc355e31ef0a0d9', 'cec-historical-election-a275bfcd53f64b5f', 'tw-county-10014', 'county_councilor', '臺東縣第2選舉區議員選舉'),
    ('cec-historical-race-3b42b47fb397eb68', 'cec-historical-election-a275bfcd53f64b5f', 'tw-county-10014', 'county_councilor', '臺東縣第4選舉區議員選舉'),
    ('cec-historical-race-7e9027c76caae9e6', 'cec-historical-election-a275bfcd53f64b5f', 'tw-county-10016', 'county_councilor', '澎湖縣第5選舉區議員選舉'),
    ('cec-historical-race-ec7d11b7c264f7af', 'cec-historical-election-a275bfcd53f64b5f', 'tw-county-10016', 'county_councilor', '澎湖縣第6選舉區議員選舉'),
    ('cec-historical-race-2e12fe68cf30216c', 'cec-historical-election-64eb47f415a89d1f', 'tw-county-10015', 'county_councilor', '花蓮縣第8選舉區山地原住民議員選舉'),
    ('cec-historical-race-56d5793826dcd44f', 'cec-historical-election-64eb47f415a89d1f', 'tw-county-10008', 'county_councilor', '南投縣第3選舉區議員選舉'),
    ('cec-historical-race-57a23e97d3aa9fad', 'cec-historical-election-64eb47f415a89d1f', 'tw-county-10013', 'county_councilor', '屏東縣第6選舉區議員選舉'),
    ('cec-historical-race-eacf8e5df4aaa1f3', 'cec-historical-election-64eb47f415a89d1f', 'tw-county-10013', 'county_councilor', '屏東縣第7選舉區議員選舉'),
    ('cec-historical-race-729f62b3cd50afc5', 'cec-historical-election-64eb47f415a89d1f', 'tw-county-10013', 'county_councilor', '屏東縣第9選舉區山地原住民議員選舉'),
    ('cec-historical-race-1a73c9dd174c92ff', 'cec-historical-election-64eb47f415a89d1f', 'tw-county-09007', 'county_councilor', '連江縣第2選舉區議員選舉'),
    ('cec-historical-race-096d9ca1a5552a42', 'cec-historical-election-64eb47f415a89d1f', 'cec-historical-county-taipei', 'county_councilor', '臺北縣第9選舉區議員選舉'),
    ('cec-historical-race-f997047a6ea8f690', 'cec-historical-election-64eb47f415a89d1f', 'tw-county-10014', 'county_councilor', '臺東縣第11選舉區山地原住民議員選舉'),
    ('cec-historical-race-aa5e36dcbf0bba27', 'cec-historical-election-64eb47f415a89d1f', 'cec-historical-county-tainan', 'county_councilor', '臺南縣第8選舉區議員選舉'),
    ('cec-historical-race-48bb905fe1d499fe', 'cec-historical-election-64eb47f415a89d1f', 'tw-county-10016', 'county_councilor', '澎湖縣第5選舉區議員選舉'),
    ('cec-historical-race-ffeef3e4587afedd', 'cec-historical-election-64eb47f415a89d1f', 'tw-county-10016', 'county_councilor', '澎湖縣第6選舉區議員選舉'),
    ('cec-historical-race-4a2dc6aaedeec70d', 'cec-historical-election-29d25dce67cee6db', 'tw-county-10002', 'county_councilor', '宜蘭縣第4選舉區議員選舉'),
    ('cec-historical-race-5fd25287862c0070', 'cec-historical-election-29d25dce67cee6db', 'tw-county-10008', 'county_councilor', '南投縣第3選舉區議員選舉'),
    ('cec-historical-race-a696db98437eb97a', 'cec-historical-election-29d25dce67cee6db', 'tw-county-10013', 'county_councilor', '屏東縣第6選舉區議員選舉'),
    ('cec-historical-race-655353ae8bbd6120', 'cec-historical-election-29d25dce67cee6db', 'tw-county-10013', 'county_councilor', '屏東縣第7選舉區議員選舉'),
    ('cec-historical-race-6f5cf9af9beaa3c5', 'cec-historical-election-29d25dce67cee6db', 'tw-county-10005', 'county_councilor', '苗栗縣第8選舉區山地原住民議員選舉'),
    ('cec-historical-race-35c8c3cdd74adcf0', 'cec-historical-election-29d25dce67cee6db', 'tw-county-68000', 'city_councilor', '桃園市第11選舉區議員選舉'),
    ('cec-historical-race-d502e9ed232e97e9', 'cec-historical-election-29d25dce67cee6db', 'cec-historical-county-kaohsiung', 'county_councilor', '高雄縣第10選舉區山地原住民議員選舉'),
    ('cec-historical-race-4ae4bbdd9051d360', 'cec-historical-election-29d25dce67cee6db', 'tw-county-09007', 'county_councilor', '連江縣第4選舉區議員選舉'),
    ('cec-historical-race-81c5e7792c60a165', 'cec-historical-election-29d25dce67cee6db', 'tw-county-10004', 'county_councilor', '新竹縣第10選舉區平地原住民議員選舉'),
    ('cec-historical-race-13b2f3a3b0ac8f94', 'cec-historical-election-29d25dce67cee6db', 'tw-county-10004', 'county_councilor', '新竹縣第11選舉區山地原住民議員選舉'),
    ('cec-historical-race-2fe86e735d7ed900', 'cec-historical-election-29d25dce67cee6db', 'tw-county-10004', 'county_councilor', '新竹縣第9選舉區議員選舉'),
    ('cec-historical-race-fda78a83d5f97120', 'cec-historical-election-29d25dce67cee6db', 'cec-historical-county-taichung', 'county_councilor', '臺中縣第3選舉區議員選舉'),
    ('cec-historical-race-9cacf8ead45327d3', 'cec-historical-election-29d25dce67cee6db', 'cec-historical-county-taipei', 'county_councilor', '臺北縣第9選舉區議員選舉'),
    ('cec-historical-race-db377ddc85595709', 'cec-historical-election-29d25dce67cee6db', 'tw-county-10014', 'county_councilor', '臺東縣第3選舉區議員選舉'),
    ('cec-historical-race-3d73b767ee66a4ef', 'cec-historical-election-29d25dce67cee6db', 'cec-historical-county-tainan', 'county_councilor', '臺南縣第2選舉區議員選舉'),
    ('cec-historical-race-22f1a275e39b04a3', 'cec-historical-election-29d25dce67cee6db', 'cec-historical-county-tainan', 'county_councilor', '臺南縣第7選舉區議員選舉'),
    ('cec-historical-race-cb181b02955e38fa', 'cec-historical-election-29d25dce67cee6db', 'cec-historical-county-tainan', 'county_councilor', '臺南縣第8選舉區議員選舉'),
    ('cec-historical-race-1b2df7efd4fd7da9', 'cec-historical-election-ab20845d085c445b', 'tw-county-10002', 'county_councilor', '宜蘭縣第11選舉區山地原住民議員選舉'),
    ('cec-historical-race-0c4ff43a4a4f9b0e', 'cec-historical-election-ab20845d085c445b', 'tw-county-10002', 'county_councilor', '宜蘭縣第3選舉區議員選舉'),
    ('cec-historical-race-153822ee5cd260e4', 'cec-historical-election-ab20845d085c445b', 'tw-county-10002', 'county_councilor', '宜蘭縣第4選舉區議員選舉'),
    ('cec-historical-race-739b8c9ec8500186', 'cec-historical-election-ab20845d085c445b', 'tw-county-10013', 'county_councilor', '屏東縣第14選舉區山地原住民議員選舉'),
    ('cec-historical-race-6e7eb50b5c4be422', 'cec-historical-election-ab20845d085c445b', 'tw-county-10005', 'county_councilor', '苗栗縣第8選舉區山地原住民議員選舉'),
    ('cec-historical-race-dc07d4ca53239bb6', 'cec-historical-election-ab20845d085c445b', 'tw-county-68000', 'city_councilor', '桃園市第10選舉區議員選舉'),
    ('cec-historical-race-9d0919718039aee9', 'cec-historical-election-ab20845d085c445b', 'tw-county-68000', 'city_councilor', '桃園市第14選舉區山地原住民議員選舉'),
    ('cec-historical-race-5b79188bdc4867e0', 'cec-historical-election-ab20845d085c445b', 'tw-county-68000', 'city_councilor', '桃園市第6選舉區議員選舉'),
    ('cec-historical-race-ec9c95dbd966cf8d', 'cec-historical-election-ab20845d085c445b', 'tw-county-10017', 'city_councilor', '基隆市第6選舉區議員選舉'),
    ('cec-historical-race-53c09e499fe74e0c', 'cec-historical-election-ab20845d085c445b', 'tw-county-09007', 'county_councilor', '連江縣第3選舉區議員選舉'),
    ('cec-historical-race-299e546cfb5c2cc5', 'cec-historical-election-ab20845d085c445b', 'tw-county-09007', 'county_councilor', '連江縣第4選舉區議員選舉'),
    ('cec-historical-race-2ac0d90bd42b42ac', 'cec-historical-election-ab20845d085c445b', 'tw-county-10004', 'county_councilor', '新竹縣第11選舉區平地原住民議員選舉'),
    ('cec-historical-race-7f481a3693c50246', 'cec-historical-election-ab20845d085c445b', 'tw-county-10004', 'county_councilor', '新竹縣第7選舉區議員選舉'),
    ('cec-historical-race-90c58a5cd208cd42', 'cec-historical-election-ab20845d085c445b', 'tw-county-10014', 'county_councilor', '臺東縣第11選舉區山地原住民議員選舉'),
    ('cec-historical-race-fdbbc3181576ec7f', 'cec-historical-election-ab20845d085c445b', 'tw-county-10014', 'county_councilor', '臺東縣第3選舉區議員選舉'),
    ('cec-historical-race-7f5c38266b12cefc', 'cec-historical-election-ab20845d085c445b', 'tw-county-10014', 'county_councilor', '臺東縣第5選舉區議員選舉'),
    ('cec-historical-race-73db41338783670c', 'cec-historical-election-00f5c690fb4dddc2', 'tw-county-64000', 'city_councilor', '高雄市第12選舉區平地原住民議員選舉'),
    ('cec-historical-race-d65bbaad39c73ffa', 'cec-historical-election-00f5c690fb4dddc2', 'tw-county-67000', 'city_councilor', '臺南市第6選舉區議員選舉'),
    ('cec-historical-race-57d7f8200f4dcb5c', 'cec-historical-election-5d2d565cde864a14', 'tw-county-10002', 'county_councilor', '宜蘭縣第12選舉區山地原住民議員選舉'),
    ('cec-historical-race-13d2b22924b1067d', 'cec-historical-election-5d2d565cde864a14', 'tw-county-10002', 'county_councilor', '宜蘭縣第13選舉區山地原住民議員選舉'),
    ('cec-historical-race-704639ac7d7b2e50', 'cec-historical-election-5d2d565cde864a14', 'tw-county-10015', 'county_councilor', '花蓮縣第9選舉區山地原住民議員選舉'),
    ('cec-historical-race-9038f18b87381a5a', 'cec-historical-election-5d2d565cde864a14', 'tw-county-10008', 'county_councilor', '南投縣第7選舉區山地原住民議員選舉'),
    ('cec-historical-race-f6f03e88136c0260', 'cec-historical-election-5d2d565cde864a14', 'tw-county-10013', 'county_councilor', '屏東縣第14選舉區山地原住民議員選舉'),
    ('cec-historical-race-cdd197f9ef8dba63', 'cec-historical-election-5d2d565cde864a14', 'tw-county-10013', 'county_councilor', '屏東縣第15選舉區山地原住民議員選舉'),
    ('cec-historical-race-d393e35cad640968', 'cec-historical-election-5d2d565cde864a14', 'tw-county-10013', 'county_councilor', '屏東縣第16選舉區山地原住民議員選舉'),
    ('cec-historical-race-aa0fdbc1d1013c23', 'cec-historical-election-5d2d565cde864a14', 'tw-county-10013', 'county_councilor', '屏東縣第9選舉區山地原住民議員選舉'),
    ('cec-historical-race-a2b00389a3dec3e6', 'cec-historical-election-5d2d565cde864a14', 'tw-county-10005', 'county_councilor', '苗栗縣第7選舉區平地原住民議員選舉'),
    ('cec-historical-race-180f7d3b34e7380f', 'cec-historical-election-5d2d565cde864a14', 'tw-county-68000', 'city_councilor', '桃園市第5選舉區議員選舉'),
    ('cec-historical-race-cfdbc3022e1e6efb', 'cec-historical-election-5d2d565cde864a14', 'tw-county-64000', 'city_councilor', '高雄市第12選舉區平地原住民議員選舉'),
    ('cec-historical-race-a23ae6e49d9f6cbb', 'cec-historical-election-5d2d565cde864a14', 'tw-county-64000', 'city_councilor', '高雄市第15選舉區山地原住民議員選舉'),
    ('cec-historical-race-7851a3f4cb5f1e16', 'cec-historical-election-5d2d565cde864a14', 'tw-county-10017', 'city_councilor', '基隆市第8選舉區平地原住民議員選舉'),
    ('cec-historical-race-a7087d6fcf1f5c4e', 'cec-historical-election-5d2d565cde864a14', 'tw-county-09007', 'county_councilor', '連江縣第4選舉區議員選舉'),
    ('cec-historical-race-832f1273152c35b9', 'cec-historical-election-5d2d565cde864a14', 'tw-county-10004', 'county_councilor', '新竹縣第7選舉區議員選舉'),
    ('cec-historical-race-af63d29d649f1b3e', 'cec-historical-election-5d2d565cde864a14', 'tw-county-66000', 'city_councilor', '臺中市第14選舉區議員選舉'),
    ('cec-historical-race-711edd33e79f13ef', 'cec-historical-election-5d2d565cde864a14', 'tw-county-66000', 'city_councilor', '臺中市第16選舉區山地原住民議員選舉'),
    ('cec-historical-race-dc1402f29e15ffb9', 'cec-historical-election-5d2d565cde864a14', 'tw-county-66000', 'city_councilor', '臺中市第2選舉區議員選舉'),
    ('cec-historical-race-8a845a052fb42d83', 'cec-historical-election-5d2d565cde864a14', 'tw-county-10014', 'county_councilor', '臺東縣第13選舉區山地原住民議員選舉'),
    ('cec-historical-race-0e175e67f3a0e8e9', 'cec-historical-election-5d2d565cde864a14', 'tw-county-10014', 'county_councilor', '臺東縣第3選舉區議員選舉'),
    ('cec-historical-race-0c66e711272dc79d', 'cec-historical-election-5d2d565cde864a14', 'tw-county-10014', 'county_councilor', '臺東縣第5選舉區議員選舉'),
    ('cec-historical-race-8e4bb4ca31fd17bf', 'cec-historical-election-5d2d565cde864a14', 'tw-county-10014', 'county_councilor', '臺東縣第9選舉區平地原住民議員選舉'),
    ('cec-historical-race-12d021a4209eedac', 'cec-historical-election-5d2d565cde864a14', 'tw-county-67000', 'city_councilor', '臺南市第1選舉區議員選舉'),
    ('cec-historical-race-32233a16c7a65444', 'cec-historical-election-5d2d565cde864a14', 'tw-county-67000', 'city_councilor', '臺南市第18選舉區山地原住民議員選舉'),
    ('cec-historical-race-ad3dbd7350942d57', 'cec-historical-election-5d2d565cde864a14', 'tw-county-67000', 'city_councilor', '臺南市第6選舉區議員選舉'),
    ('cec-historical-race-5a7290d9aa6b0554', 'cec-historical-election-5d2d565cde864a14', 'tw-county-10016', 'county_councilor', '澎湖縣第4選舉區議員選舉'),
    ('cec-historical-race-f70e9b3b26c25e6d', 'cec-historical-election-5d2d565cde864a14', 'tw-county-10016', 'county_councilor', '澎湖縣第6選舉區議員選舉')
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
    IF (SELECT COUNT(*) FROM races WHERE external_id = ANY(ARRAY['cec-historical-race-de74b87d79f4ddb4', 'cec-historical-race-a9d25f6be969d03e', 'cec-historical-race-03335fc8f1f7c9a5', 'cec-historical-race-a083f527ac1643d7', 'cec-historical-race-f3f954a2da845583', 'cec-historical-race-43a5900bffc785b3', 'cec-historical-race-521abe9268417601', 'cec-historical-race-89e7bddeeaf94b8d', 'cec-historical-race-d24648b09e2d7466', 'cec-historical-race-8cc355e31ef0a0d9', 'cec-historical-race-3b42b47fb397eb68', 'cec-historical-race-7e9027c76caae9e6', 'cec-historical-race-ec7d11b7c264f7af', 'cec-historical-race-2e12fe68cf30216c', 'cec-historical-race-56d5793826dcd44f', 'cec-historical-race-57a23e97d3aa9fad', 'cec-historical-race-eacf8e5df4aaa1f3', 'cec-historical-race-729f62b3cd50afc5', 'cec-historical-race-1a73c9dd174c92ff', 'cec-historical-race-096d9ca1a5552a42', 'cec-historical-race-f997047a6ea8f690', 'cec-historical-race-aa5e36dcbf0bba27', 'cec-historical-race-48bb905fe1d499fe', 'cec-historical-race-ffeef3e4587afedd', 'cec-historical-race-4a2dc6aaedeec70d', 'cec-historical-race-5fd25287862c0070', 'cec-historical-race-a696db98437eb97a', 'cec-historical-race-655353ae8bbd6120', 'cec-historical-race-6f5cf9af9beaa3c5', 'cec-historical-race-35c8c3cdd74adcf0', 'cec-historical-race-d502e9ed232e97e9', 'cec-historical-race-4ae4bbdd9051d360', 'cec-historical-race-81c5e7792c60a165', 'cec-historical-race-13b2f3a3b0ac8f94', 'cec-historical-race-2fe86e735d7ed900', 'cec-historical-race-fda78a83d5f97120', 'cec-historical-race-9cacf8ead45327d3', 'cec-historical-race-db377ddc85595709', 'cec-historical-race-3d73b767ee66a4ef', 'cec-historical-race-22f1a275e39b04a3', 'cec-historical-race-cb181b02955e38fa', 'cec-historical-race-1b2df7efd4fd7da9', 'cec-historical-race-0c4ff43a4a4f9b0e', 'cec-historical-race-153822ee5cd260e4', 'cec-historical-race-739b8c9ec8500186', 'cec-historical-race-6e7eb50b5c4be422', 'cec-historical-race-dc07d4ca53239bb6', 'cec-historical-race-9d0919718039aee9', 'cec-historical-race-5b79188bdc4867e0', 'cec-historical-race-ec9c95dbd966cf8d', 'cec-historical-race-53c09e499fe74e0c', 'cec-historical-race-299e546cfb5c2cc5', 'cec-historical-race-2ac0d90bd42b42ac', 'cec-historical-race-7f481a3693c50246', 'cec-historical-race-90c58a5cd208cd42', 'cec-historical-race-fdbbc3181576ec7f', 'cec-historical-race-7f5c38266b12cefc', 'cec-historical-race-73db41338783670c', 'cec-historical-race-d65bbaad39c73ffa', 'cec-historical-race-57d7f8200f4dcb5c', 'cec-historical-race-13d2b22924b1067d', 'cec-historical-race-704639ac7d7b2e50', 'cec-historical-race-9038f18b87381a5a', 'cec-historical-race-f6f03e88136c0260', 'cec-historical-race-cdd197f9ef8dba63', 'cec-historical-race-d393e35cad640968', 'cec-historical-race-aa0fdbc1d1013c23', 'cec-historical-race-a2b00389a3dec3e6', 'cec-historical-race-180f7d3b34e7380f', 'cec-historical-race-cfdbc3022e1e6efb', 'cec-historical-race-a23ae6e49d9f6cbb', 'cec-historical-race-7851a3f4cb5f1e16', 'cec-historical-race-a7087d6fcf1f5c4e', 'cec-historical-race-832f1273152c35b9', 'cec-historical-race-af63d29d649f1b3e', 'cec-historical-race-711edd33e79f13ef', 'cec-historical-race-dc1402f29e15ffb9', 'cec-historical-race-8a845a052fb42d83', 'cec-historical-race-0e175e67f3a0e8e9', 'cec-historical-race-0c66e711272dc79d', 'cec-historical-race-8e4bb4ca31fd17bf', 'cec-historical-race-12d021a4209eedac', 'cec-historical-race-32233a16c7a65444', 'cec-historical-race-ad3dbd7350942d57', 'cec-historical-race-5a7290d9aa6b0554', 'cec-historical-race-f70e9b3b26c25e6d']::TEXT[])) <> 86 THEN
        RAISE EXCEPTION 'Historical CEC migration races count mismatch';
    END IF;
END
$verify$;

SELECT
    0 AS planned_regions,
    0 AS planned_elections,
    0 AS normalized_elections,
    86 AS planned_races,
    0 AS normalized_races;

SELECT published.promote(NULL);
