-- Restore all 177 qualified 2024 party-list candidates from the archived
-- official CEC L4 JSON. Historical winners and the current roster stay separate.
BEGIN;

CREATE TEMP TABLE _party_list_roster (
  external_id TEXT PRIMARY KEY,
  person_external_id TEXT NOT NULL UNIQUE,
  party TEXT NOT NULL,
  party_no INTEGER NOT NULL,
  candidate_no INTEGER NOT NULL,
  person_name TEXT NOT NULL,
  gender TEXT NOT NULL,
  birth_date DATE,
  birth_raw TEXT,
  home TEXT,
  elected BOOLEAN NOT NULL,
  UNIQUE (party, candidate_no)
) ON COMMIT DROP;

INSERT INTO _party_list_roster VALUES
    ('cec-2024-candidate-json:L4:全國不分區:小民參政歐巴桑聯盟:1:L4:高芸婷:0650711', 'cec-2024-party-list-person-462a3eb83b3a08cf', '小民參政歐巴桑聯盟', 1, 1, '高芸婷', 'female', '1976-07-11', '0650711', '基隆市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:小民參政歐巴桑聯盟:2:L4:林詩涵:0701101', 'cec-2024-party-list-person-ade3764b2f6ffaf2', '小民參政歐巴桑聯盟', 1, 2, '林詩涵', 'female', '1981-11-01', '0701101', '臺中市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:小民參政歐巴桑聯盟:3:L4:閔柏陵:0691209', 'cec-2024-party-list-person-4ba4e321e8043535', '小民參政歐巴桑聯盟', 1, 3, '閔柏陵', 'female', '1980-12-09', '0691209', '基隆市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣綠黨:1:L4:鍾寶珠:0550203', 'cec-2024-party-list-person-d92a609322d4bdb3', '台灣綠黨', 2, 1, '鍾寶珠', 'female', '1966-02-03', '0550203', '花蓮縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣綠黨:2:L4:李菁琪:0770402', 'cec-2024-party-list-person-a495c7bbbfda24d0', '台灣綠黨', 2, 2, '李菁琪', 'female', '1988-04-02', '0770402', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣綠黨:3:L4:黃柔嘉:0801016', 'cec-2024-party-list-person-83aef3f82b8afdef', '台灣綠黨', 2, 3, '黃柔嘉', 'female', '1991-10-16', '0801016', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣綠黨:4:L4:吳伊婷:0750112', 'cec-2024-party-list-person-807b4d7766daa09a', '台灣綠黨', 2, 4, '吳伊婷', 'female', '1986-01-12', '0750112', '香港', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣綠黨:5:L4:希婻·瑪飛洑Sinan·Mavivo:0620616', 'cec-2024-party-list-person-611d62434faea551', '台灣綠黨', 2, 5, '希婻·瑪飛洑Sinan·Mavivo', 'female', '1973-06-16', '0620616', '臺東縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣綠黨:6:L4:林莉棻:0550311', 'cec-2024-party-list-person-34a6ba9dce481f61', '台灣綠黨', 2, 6, '林莉棻', 'female', '1966-03-11', '0550311', '高雄市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣綠黨:7:L4:黃慧芬:0581130', 'cec-2024-party-list-person-58d3ea8c2f199c62', '台灣綠黨', 2, 7, '黃慧芬', 'female', '1969-11-30', '0581130', '桃園市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣綠黨:8:L4:張竹芩:0740110', 'cec-2024-party-list-person-8e26da74a111f060', '台灣綠黨', 2, 8, '張竹芩', 'female', '1985-01-10', '0740110', '桃園市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣雙語無法黨:1:L4:陳亭諭:0770314', 'cec-2024-party-list-person-103a3efec154fed8', '台灣雙語無法黨', 3, 1, '陳亭諭', 'female', '1988-03-14', '0770314', '彰化縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣雙語無法黨:2:L4:蕭文乾:0630927', 'cec-2024-party-list-person-19328af6a38b5fed', '台灣雙語無法黨', 3, 2, '蕭文乾', 'male', '1974-09-27', '0630927', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣基進:1:L4:史惟筑:0680504', 'cec-2024-party-list-person-bab75923957ddd93', '台灣基進', 4, 1, '史惟筑', 'female', '1979-05-04', '0680504', '高雄市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣基進:2:L4:陳奕齊:0610827', 'cec-2024-party-list-person-7c6396eef53dc368', '台灣基進', 4, 2, '陳奕齊', 'male', '1972-08-27', '0610827', '嘉義縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣基進:3:L4:黃楓茹:0690902', 'cec-2024-party-list-person-ee536f371cfa7e65', '台灣基進', 4, 3, '黃楓茹', 'female', '1980-09-02', '0690902', '臺中市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣基進:4:L4:陳君愷:0540310', 'cec-2024-party-list-person-02984320b11df175', '台灣基進', 4, 4, '陳君愷', 'male', '1965-03-10', '0540310', '日本', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣基進:5:L4:楊佩樺:0810123', 'cec-2024-party-list-person-ba30568816940b78', '台灣基進', 4, 5, '楊佩樺', 'female', '1992-01-23', '0810123', '高雄市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣基進:6:L4:黃馨瑩:0750109', 'cec-2024-party-list-person-ec9139f7707b09fb', '台灣基進', 4, 6, '黃馨瑩', 'female', '1986-01-09', '0750109', '屏東縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣基進:7:L4:徐煊博:0791101', 'cec-2024-party-list-person-2acc0782f112f933', '台灣基進', 4, 7, '徐煊博', 'male', '1990-11-01', '0791101', '臺中市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中華統一促進黨:1:L4:丁炳仁:0480328', 'cec-2024-party-list-person-9c7e73589e1b52ee', '中華統一促進黨', 5, 1, '丁炳仁', 'male', '1959-03-28', '0480328', '高雄市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中華統一促進黨:2:L4:黃妙如:0480210', 'cec-2024-party-list-person-1fe0c635f143940d', '中華統一促進黨', 5, 2, '黃妙如', 'female', '1959-02-10', '0480210', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中華統一促進黨:3:L4:肖云霞:0580302', 'cec-2024-party-list-person-d9ffb0f0b5f8fef1', '中華統一促進黨', 5, 3, '肖云霞', 'female', '1969-03-02', '0580302', '湖南省', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中華統一促進黨:4:L4:張安樂:0370313', 'cec-2024-party-list-person-99f56ed2a4f090e4', '中華統一促進黨', 5, 4, '張安樂', 'male', '1948-03-13', '0370313', '南京市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:1:L4:林月琴:0540904', 'cec-2024-party-list-person-212ff0a90156d298', '民主進步黨', 6, 1, '林月琴', 'female', '1965-09-04', '0540904', '苗栗縣', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:2:L4:沈伯洋:0710607', 'cec-2024-party-list-person-ad4f3d835b7d5a4d', '民主進步黨', 6, 2, '沈伯洋', 'male', '1982-06-07', '0710607', '臺北市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:3:L4:張雅琳:0690829', 'cec-2024-party-list-person-1e258b2d31378076', '民主進步黨', 6, 3, '張雅琳', 'female', '1980-08-29', '0690829', '新北市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:4:L4:洪申翰:0731018', 'cec-2024-party-list-person-75dd173b6f9ef4b8', '民主進步黨', 6, 4, '洪申翰', 'male', '1984-10-18', '0731018', '臺北市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:5:L4:羅美玲:0580501', 'cec-2024-party-list-person-4a8765a10d02c84b', '民主進步黨', 6, 5, '羅美玲', 'female', '1969-05-01', '0580501', '馬來西亞', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:6:L4:游錫堃:0370425', 'cec-2024-party-list-person-8fe0aa1158858fd3', '民主進步黨', 6, 6, '游錫堃', 'male', '1948-04-25', '0370425', '宜蘭縣', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:7:L4:范雲:0570709', 'cec-2024-party-list-person-2919e9b0bebe43be', '民主進步黨', 6, 7, '范雲', 'female', '1968-07-09', '0570709', '新北市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:8:L4:柯建銘:0400908', 'cec-2024-party-list-person-80a5aeb427818161', '民主進步黨', 6, 8, '柯建銘', 'male', '1951-09-08', '0400908', '新竹市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:9:L4:沈發惠:0551102', 'cec-2024-party-list-person-23947ae728324771', '民主進步黨', 6, 9, '沈發惠', 'male', '1966-11-02', '0551102', '臺北市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:10:L4:莊瑞雄:0520420', 'cec-2024-party-list-person-627f17eaa6997a00', '民主進步黨', 6, 10, '莊瑞雄', 'male', '1963-04-20', '0520420', '屏東縣', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:11:L4:林楚茵:0611010', 'cec-2024-party-list-person-dc55874f8791956f', '民主進步黨', 6, 11, '林楚茵', 'female', '1972-10-10', '0611010', '新北市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:12:L4:郭昱晴:0590329', 'cec-2024-party-list-person-635c2a68cf5e47e4', '民主進步黨', 6, 12, '郭昱晴', 'female', '1970-03-29', '0590329', '臺北市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:13:L4:王正旭:0450820', 'cec-2024-party-list-person-fa688b476202a460', '民主進步黨', 6, 13, '王正旭', 'male', '1956-08-20', '0450820', '嘉義縣', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:14:L4:王義川:0610307', 'cec-2024-party-list-person-0681e321fb930917', '民主進步黨', 6, 14, '王義川', 'male', '1972-03-07', '0610307', '高雄市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:15:L4:陳培瑜:0660809', 'cec-2024-party-list-person-2d9f4fc796e19806', '民主進步黨', 6, 15, '陳培瑜', 'female', '1977-08-09', '0660809', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:16:L4:陳俊翰:0720615', 'cec-2024-party-list-person-9b5794ee243a742f', '民主進步黨', 6, 16, '陳俊翰', 'male', '1983-06-15', '0720615', '新竹市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:17:L4:張秀君:0540305', 'cec-2024-party-list-person-898fa77e960e5df8', '民主進步黨', 6, 17, '張秀君', 'female', '1965-03-05', '0540305', '南投縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:18:L4:黃奕睿:0560721', 'cec-2024-party-list-person-ff232df77d833902', '民主進步黨', 6, 18, '黃奕睿', 'male', '1967-07-21', '0560721', '臺中市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:19:L4:孫一信:0571129', 'cec-2024-party-list-person-02a22c4c539c543b', '民主進步黨', 6, 19, '孫一信', 'male', '1968-11-29', '0571129', '高雄市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:20:L4:吳祥榮:0510207', 'cec-2024-party-list-person-deccfc49f417f8f1', '民主進步黨', 6, 20, '吳祥榮', 'male', '1962-02-07', '0510207', '雲林縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:21:L4:陳慧君 Mulas·Ismahasan:0740122', 'cec-2024-party-list-person-5244fcfe2a33d7c0', '民主進步黨', 6, 21, '陳慧君 Mulas·Ismahasan', 'female', '1985-01-22', '0740122', '高雄市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:22:L4:柯富揚:0590101', 'cec-2024-party-list-person-149b189218017456', '民主進步黨', 6, 22, '柯富揚', 'male', '1970-01-01', '0590101', '彰化縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:23:L4:劉柏君:0680810', 'cec-2024-party-list-person-cc8d18b8464284eb', '民主進步黨', 6, 23, '劉柏君', 'female', '1979-08-10', '0680810', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:24:L4:石明謹:0650125', 'cec-2024-party-list-person-44c07629cbe2a33d', '民主進步黨', 6, 24, '石明謹', 'male', '1976-01-25', '0650125', '基隆市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:25:L4:曾美玲:0620311', 'cec-2024-party-list-person-e3de798a29b61d39', '民主進步黨', 6, 25, '曾美玲', 'female', '1973-03-11', '0620311', '屏東縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:26:L4:黃真瑋:0661203', 'cec-2024-party-list-person-44d66ee60d591329', '民主進步黨', 6, 26, '黃真瑋', 'female', '1977-12-03', '0661203', '臺南市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:27:L4:曾湘樺:0761006', 'cec-2024-party-list-person-e9f0b4a8b173ac4b', '民主進步黨', 6, 27, '曾湘樺', 'female', '1987-10-06', '0761006', '高雄市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:28:L4:鄭力嘉:0640628', 'cec-2024-party-list-person-98b4ddfe6a480281', '民主進步黨', 6, 28, '鄭力嘉', 'male', '1975-06-28', '0640628', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:29:L4:陳右欣:0760215', 'cec-2024-party-list-person-0460d0718e688cc6', '民主進步黨', 6, 29, '陳右欣', 'female', '1987-02-15', '0760215', '臺中市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:30:L4:余宛如:0690611', 'cec-2024-party-list-person-5bfd564811201976', '民主進步黨', 6, 30, '余宛如', 'female', '1980-06-11', '0690611', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:31:L4:許菡芸:0810427', 'cec-2024-party-list-person-1d463b3e94f1be66', '民主進步黨', 6, 31, '許菡芸', 'female', '1992-04-27', '0810427', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:32:L4:周威佑:0510915', 'cec-2024-party-list-person-7b94bc80562976c3', '民主進步黨', 6, 32, '周威佑', 'male', '1962-09-15', '0510915', '新竹市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:33:L4:廖韶吟:0610803', 'cec-2024-party-list-person-e393b96c7b02c7de', '民主進步黨', 6, 33, '廖韶吟', 'female', '1972-08-03', '0610803', '雲林縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:民主進步黨:34:L4:蔡宜文:0771019', 'cec-2024-party-list-person-3f275bc61231728a', '民主進步黨', 6, 34, '蔡宜文', 'female', '1988-10-19', '0771019', '新竹市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:制度救世島:1:L4:林麗容:0431013', 'cec-2024-party-list-person-338b24c157176ddc', '制度救世島', 7, 1, '林麗容', 'female', '1954-10-13', '0431013', '嘉義市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:制度救世島:2:L4:石人仁:0480616', 'cec-2024-party-list-person-a03c27d6e764daef', '制度救世島', 7, 2, '石人仁', 'male', '1959-06-16', '0480616', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:制度救世島:3:L4:張怡菁:0640820', 'cec-2024-party-list-person-9d44260f60424d0a', '制度救世島', 7, 3, '張怡菁', 'female', '1975-08-20', '0640820', '宜蘭縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:制度救世島:4:L4:古文發:0570702', 'cec-2024-party-list-person-3b0f5ac6344c7a3c', '制度救世島', 7, 4, '古文發', 'male', '1968-07-02', '0570702', '苗栗縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:制度救世島:5:L4:黃千明:0311007', 'cec-2024-party-list-person-51ceb378df52ba00', '制度救世島', 7, 5, '黃千明', 'male', '1942-10-07', '0311007', '宜蘭縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:時代力量:1:L4:林依瑩:0621230', 'cec-2024-party-list-person-ca4c03b12fc2ca8f', '時代力量', 8, 1, '林依瑩', 'female', '1973-12-30', '0621230', '彰化縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:時代力量:2:L4:王寶萱:0710207', 'cec-2024-party-list-person-9bc9647f9f1643f2', '時代力量', 8, 2, '王寶萱', 'female', '1982-02-07', '0710207', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:時代力量:3:L4:宋國鼎:0700122', 'cec-2024-party-list-person-1eb3d019bb590c33', '時代力量', 8, 3, '宋國鼎', 'male', '1981-01-22', '0700122', '苗栗縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:時代力量:4:L4:江盛:0490217', 'cec-2024-party-list-person-82ccbe43da0c1923', '時代力量', 8, 4, '江盛', 'male', '1960-02-17', '0490217', '嘉義縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:時代力量:5:L4:陳泰源:0721223', 'cec-2024-party-list-person-e50465928fb74856', '時代力量', 8, 5, '陳泰源', 'male', '1983-12-23', '0721223', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:時代力量:6:L4:陳昱安:0790402', 'cec-2024-party-list-person-f612b55f92b9f208', '時代力量', 8, 6, '陳昱安', 'male', '1990-04-02', '0790402', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:時代力量:7:L4:余佳蒨:0760416', 'cec-2024-party-list-person-53a94fbc1662e38b', '時代力量', 8, 7, '余佳蒨', 'female', '1987-04-16', '0760416', '臺中市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:時代力量:8:L4:鄭侑青:0780405', 'cec-2024-party-list-person-f8221fda9939f3bf', '時代力量', 8, 8, '鄭侑青', 'female', '1989-04-05', '0780405', '高雄市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:1:L4:韓國瑜:0460617', 'cec-2024-party-list-person-2a584aab932cf7ef', '中國國民黨', 9, 1, '韓國瑜', 'male', '1957-06-17', '0460617', '新北市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:2:L4:柯志恩:0510429', 'cec-2024-party-list-person-d1a42887a8600357', '中國國民黨', 9, 2, '柯志恩', 'female', '1962-04-29', '0510429', '屏東縣', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:3:L4:葛如鈞:0700728', 'cec-2024-party-list-person-cf478bb8e2094d65', '中國國民黨', 9, 3, '葛如鈞', 'male', '1981-07-28', '0700728', '臺北市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:4:L4:翁曉玲:0580118', 'cec-2024-party-list-person-e9f9542312335645', '中國國民黨', 9, 4, '翁曉玲', 'female', '1969-01-18', '0580118', '高雄市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:5:L4:陳菁徽:0680420', 'cec-2024-party-list-person-c0ca1b1e2b814855', '中國國民黨', 9, 5, '陳菁徽', 'female', '1979-04-20', '0680420', '高雄市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:6:L4:吳宗憲:0600927', 'cec-2024-party-list-person-4595b007c6b5e29f', '中國國民黨', 9, 6, '吳宗憲', 'male', '1971-09-27', '0600927', '臺北市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:7:L4:林倩綺:0571017', 'cec-2024-party-list-person-c873b4e4d672b9b2', '中國國民黨', 9, 7, '林倩綺', 'female', '1968-10-17', '0571017', '高雄市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:8:L4:陳永康:0400420', 'cec-2024-party-list-person-f21df5cd52cebeda', '中國國民黨', 9, 8, '陳永康', 'male', '1951-04-20', '0400420', '臺北市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:9:L4:許宇甄:0571020', 'cec-2024-party-list-person-95be778c637abc15', '中國國民黨', 9, 9, '許宇甄', 'female', '1968-10-20', '0571020', '臺北市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:10:L4:謝龍介:0501003', 'cec-2024-party-list-person-f38f0f1dfd0ad4e0', '中國國民黨', 9, 10, '謝龍介', 'male', '1961-10-03', '0501003', '臺南市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:11:L4:蘇清泉:0460805', 'cec-2024-party-list-person-d3c3221b630b1fcc', '中國國民黨', 9, 11, '蘇清泉', 'male', '1957-08-05', '0460805', '屏東縣', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:12:L4:張嘉郡:0700110', 'cec-2024-party-list-person-d603ea67106fb578', '中國國民黨', 9, 12, '張嘉郡', 'female', '1981-01-10', '0700110', '雲林縣', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:13:L4:王育敏:0600411', 'cec-2024-party-list-person-0bbd28ff2952bc1b', '中國國民黨', 9, 13, '王育敏', 'female', '1971-04-11', '0600411', '嘉義縣', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:14:L4:蔡明忠:0481209', 'cec-2024-party-list-person-546011881d0a9d69', '中國國民黨', 9, 14, '蔡明忠', 'male', '1959-12-09', '0481209', '臺中市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:15:L4:吳亮儀:0800621', 'cec-2024-party-list-person-534fac107a91261a', '中國國民黨', 9, 15, '吳亮儀', 'female', '1991-06-21', '0800621', '南非', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:16:L4:李玉嬋:0540226', 'cec-2024-party-list-person-54153936cc49551f', '中國國民黨', 9, 16, '李玉嬋', 'female', '1965-02-26', '0540226', '新竹市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:17:L4:李霞:0590525', 'cec-2024-party-list-person-3ab0d58ee32304ff', '中國國民黨', 9, 17, '李霞', 'female', '1970-05-25', '0590525', '福建省', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:18:L4:楊應超:0560506', 'cec-2024-party-list-person-447ec8efbfb309cd', '中國國民黨', 9, 18, '楊應超', 'male', '1967-05-06', '0560506', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:19:L4:徐弘庭:0710621', 'cec-2024-party-list-person-9312e863b9b12d1c', '中國國民黨', 9, 19, '徐弘庭', 'male', '1982-06-21', '0710621', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:20:L4:鍾沛君:0731210', 'cec-2024-party-list-person-b3409c2819b5321f', '中國國民黨', 9, 20, '鍾沛君', 'female', '1984-12-10', '0731210', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:21:L4:江怡臻:0711107', 'cec-2024-party-list-person-95680639babe04c8', '中國國民黨', 9, 21, '江怡臻', 'female', '1982-11-07', '0711107', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:22:L4:簡榮宗:0630407', 'cec-2024-party-list-person-96ef234c5b0c1ac3', '中國國民黨', 9, 22, '簡榮宗', 'male', '1974-04-07', '0630407', '新北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:23:L4:田長沛:0751021', 'cec-2024-party-list-person-1c2b04916ce8c565', '中國國民黨', 9, 23, '田長沛', 'male', '1986-10-21', '0751021', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:24:L4:沈采穎:0500107', 'cec-2024-party-list-person-afbbb808700f74a4', '中國國民黨', 9, 24, '沈采穎', 'female', '1961-01-07', '0500107', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:25:L4:林瓊嘉:0490306', 'cec-2024-party-list-person-49852586638006e8', '中國國民黨', 9, 25, '林瓊嘉', 'male', '1960-03-06', '0490306', '嘉義縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:26:L4:陳克威:0690825', 'cec-2024-party-list-person-ed2e6562cffa64e5', '中國國民黨', 9, 26, '陳克威', 'male', '1980-08-25', '0690825', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:27:L4:邱一峰:0710812', 'cec-2024-party-list-person-0a87ee1fa7c89c22', '中國國民黨', 9, 27, '邱一峰', 'male', '1982-08-12', '0710812', '新竹市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:28:L4:廖怡琇:0730326', 'cec-2024-party-list-person-a9ae901f4304c032', '中國國民黨', 9, 28, '廖怡琇', 'female', '1984-03-26', '0730326', '南投縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:29:L4:李縉穎:0740108', 'cec-2024-party-list-person-c84c3bae27347e43', '中國國民黨', 9, 29, '李縉穎', 'male', '1985-01-08', '0740108', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:30:L4:李茂芊:0791024', 'cec-2024-party-list-person-ed525f4b1fbadbb9', '中國國民黨', 9, 30, '李茂芊', 'female', '1990-10-24', '0791024', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:31:L4:丁瑀:0800619', 'cec-2024-party-list-person-61cf96fd34f41ff5', '中國國民黨', 9, 31, '丁瑀', 'male', '1991-06-19', '0800619', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:32:L4:楊智伃:0850527', 'cec-2024-party-list-person-9584a2a8e372acf7', '中國國民黨', 9, 32, '楊智伃', 'female', '1996-05-27', '0850527', '高雄市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:33:L4:何嘉霖:0880618', 'cec-2024-party-list-person-fa3364149af8f766', '中國國民黨', 9, 33, '何嘉霖', 'female', '1999-06-18', '0880618', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:中國國民黨:34:L4:康晉瑜:0890224', 'cec-2024-party-list-person-598cd3cd9468b4ac', '中國國民黨', 9, 34, '康晉瑜', 'male', '2000-02-24', '0890224', '臺中市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:司法改革黨:1:L4:戴翊如:0770402', 'cec-2024-party-list-person-3978966cff2cb5d1', '司法改革黨', 10, 1, '戴翊如', 'female', '1988-04-02', '0770402', '新竹市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:司法改革黨:2:L4:張靜:0450527', 'cec-2024-party-list-person-68ea09b890fc7b04', '司法改革黨', 10, 2, '張靜', 'male', '1956-05-27', '0450527', '桃園市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:司法改革黨:3:L4:李柏融:0381102', 'cec-2024-party-list-person-61d4eb448ff5b64b', '司法改革黨', 10, 3, '李柏融', 'male', '1949-11-02', '0381102', '高雄市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:司法改革黨:4:L4:尤瑞敏:0530810', 'cec-2024-party-list-person-b458b6808356ac28', '司法改革黨', 10, 4, '尤瑞敏', 'female', '1964-08-10', '0530810', '屏東縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:司法改革黨:5:L4:賴伯琦:0570917', 'cec-2024-party-list-person-ebb6379f1d26f1bb', '司法改革黨', 10, 5, '賴伯琦', 'male', '1968-09-17', '0570917', '南投縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:司法改革黨:6:L4:吳振槖:0380627', 'cec-2024-party-list-person-39781fd1af57181f', '司法改革黨', 10, 6, '吳振槖', 'male', '1949-06-27', '0380627', '桃園市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:司法改革黨:7:L4:晏揚清:0480103', 'cec-2024-party-list-person-4d945aeabdec1381', '司法改革黨', 10, 7, '晏揚清', 'male', '1959-01-03', '0480103', '臺中市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:司法改革黨:8:L4:許韶珍:0580915', 'cec-2024-party-list-person-fd1a868914ce4ba5', '司法改革黨', 10, 8, '許韶珍', 'female', '1969-09-15', '0580915', '嘉義縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:司法改革黨:9:L4:楊啓珊:0590205', 'cec-2024-party-list-person-7ade5652eeed33ee', '司法改革黨', 10, 9, '楊啓珊', 'female', '1970-02-05', '0590205', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:新黨:1:L4:王建煊:0270807', 'cec-2024-party-list-person-d975c8f7101ab6f9', '新黨', 11, 1, '王建煊', 'male', '1938-08-07', '0270807', '安徽省', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:新黨:2:L4:仉桂美:0440315', 'cec-2024-party-list-person-860a6c5d3c0c40c1', '新黨', 11, 2, '仉桂美', 'female', '1955-03-15', '0440315', '高雄市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:新黨:3:L4:吳成典:0460510', 'cec-2024-party-list-person-4fcd87a37821b238', '新黨', 11, 3, '吳成典', 'male', '1957-05-10', '0460510', '福建省', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:新黨:4:L4:賀樺:0610904', 'cec-2024-party-list-person-72cebcb7569cb2a0', '新黨', 11, 4, '賀樺', 'female', '1972-09-04', '0610904', '湖南省', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:新黨:5:L4:林易陞:0450730', 'cec-2024-party-list-person-ca46d2694421c1ec', '新黨', 11, 5, '林易陞', 'male', '1956-07-30', '0450730', '彰化縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:新黨:6:L4:陳麗玲:0580727', 'cec-2024-party-list-person-214a7fa57816f79d', '新黨', 11, 6, '陳麗玲', 'female', '1969-07-27', '0580727', '桃園市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:新黨:7:L4:戴德滿:0481120', 'cec-2024-party-list-person-50d72a47771b1d6c', '新黨', 11, 7, '戴德滿', 'male', '1959-11-20', '0481120', '福建省', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:新黨:8:L4:王子芩:0700220', 'cec-2024-party-list-person-abe78fe1f282f46b', '新黨', 11, 8, '王子芩', 'female', '1981-02-20', '0700220', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:1:L4:黃珊珊:0581018', 'cec-2024-party-list-person-052a0e10a32aad69', '台灣民眾黨', 12, 1, '黃珊珊', 'female', '1969-10-18', '0581018', '臺中市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:2:L4:黃國昌:0620819', 'cec-2024-party-list-person-ae99d0ba13c5549b', '台灣民眾黨', 12, 2, '黃國昌', 'male', '1973-08-19', '0620819', '新北市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:3:L4:陳昭姿:0450903', 'cec-2024-party-list-person-6e2ab3dd0f51112d', '台灣民眾黨', 12, 3, '陳昭姿', 'female', '1956-09-03', '0450903', '臺北市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:4:L4:吳春城:0500818', 'cec-2024-party-list-person-260cdad6154e6c88', '台灣民眾黨', 12, 4, '吳春城', 'male', '1961-08-18', '0500818', '彰化縣', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:5:L4:麥玉珍:0621014', 'cec-2024-party-list-person-7c66bb64cd1510dc', '台灣民眾黨', 12, 5, '麥玉珍', 'female', '1973-10-14', '0621014', '越南', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:6:L4:林國成:0460820', 'cec-2024-party-list-person-4cea1e10835e301c', '台灣民眾黨', 12, 6, '林國成', 'male', '1957-08-20', '0460820', '屏東縣', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:7:L4:林憶君:0591004', 'cec-2024-party-list-person-519fa004cdffa529', '台灣民眾黨', 12, 7, '林憶君', 'female', '1970-10-04', '0591004', '高雄市', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:8:L4:張啓楷:0511221', 'cec-2024-party-list-person-a2e2d254aef3c7de', '台灣民眾黨', 12, 8, '張啓楷', 'male', '1962-12-21', '0511221', '嘉義縣', TRUE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:9:L4:劉書彬:0570530', 'cec-2024-party-list-person-f6a7c68249d0a7dd', '台灣民眾黨', 12, 9, '劉書彬', 'female', '1968-05-30', '0570530', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:10:L4:洪毓祥:0571020', 'cec-2024-party-list-person-af8ee29fd05ce31c', '台灣民眾黨', 12, 10, '洪毓祥', 'male', '1968-10-20', '0571020', '高雄市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:11:L4:蔡春綢:0490113', 'cec-2024-party-list-person-4059fae5bd95e812', '台灣民眾黨', 12, 11, '蔡春綢', 'female', '1960-01-13', '0490113', '雲林縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:12:L4:王安祥:0570123', 'cec-2024-party-list-person-bd013e617362cb35', '台灣民眾黨', 12, 12, '王安祥', 'male', '1968-01-23', '0570123', '嘉義縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:13:L4:邱慧洳:0630112', 'cec-2024-party-list-person-265d4dfe776aba99', '台灣民眾黨', 12, 13, '邱慧洳', 'female', '1974-01-12', '0630112', '高雄市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:14:L4:陳清龍:0540329', 'cec-2024-party-list-person-8927bb6eb52805d7', '台灣民眾黨', 12, 14, '陳清龍', 'male', '1965-03-29', '0540329', '臺中市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:15:L4:李貞秀:0620415', 'cec-2024-party-list-person-7f8beba6ab92a759', '台灣民眾黨', 12, 15, '李貞秀', 'female', '1973-04-15', '0620415', '湖南省', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:16:L4:許忠信:0540601', 'cec-2024-party-list-person-dbd7d903441d444b', '台灣民眾黨', 12, 16, '許忠信', 'male', '1965-06-01', '0540601', '臺南市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:17:L4:徐瑞希:0511211', 'cec-2024-party-list-person-098ed21660b94adf', '台灣民眾黨', 12, 17, '徐瑞希', 'female', '1962-12-11', '0511211', '臺南市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:18:L4:楊弘意:0750803', 'cec-2024-party-list-person-04fab4078e55e8f0', '台灣民眾黨', 12, 18, '楊弘意', 'male', '1986-08-03', '0750803', '彰化縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:19:L4:陳智菡:0681208', 'cec-2024-party-list-person-89c131d37c886d5d', '台灣民眾黨', 12, 19, '陳智菡', 'female', '1979-12-08', '0681208', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:20:L4:莊貽量:0620125', 'cec-2024-party-list-person-9547eb9feeb7d6ce', '台灣民眾黨', 12, 20, '莊貽量', 'male', '1973-01-25', '0620125', '高雄市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:21:L4:林筱淇:0670413', 'cec-2024-party-list-person-ce32fee7ab704c9c', '台灣民眾黨', 12, 21, '林筱淇', 'female', '1978-04-13', '0670413', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:22:L4:蔡豐州:0571224', 'cec-2024-party-list-person-e68a5d3165882bb4', '台灣民眾黨', 12, 22, '蔡豐州', 'male', '1968-12-24', '0571224', '臺南市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:23:L4:張雪如:0550513', 'cec-2024-party-list-person-97ba8d6f015132c1', '台灣民眾黨', 12, 23, '張雪如', 'female', '1966-05-13', '0550513', '彰化縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:24:L4:湯宏正:0711025', 'cec-2024-party-list-person-3e97f119218dac6f', '台灣民眾黨', 12, 24, '湯宏正', 'male', '1982-10-25', '0711025', '新竹市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:25:L4:林淑芬:0571014', 'cec-2024-party-list-person-c6c36bc0781cd591', '台灣民眾黨', 12, 25, '林淑芬', 'female', '1968-10-14', '0571014', '雲林縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:26:L4:梁明輝:0450907', 'cec-2024-party-list-person-6f840a00b1d20c06', '台灣民眾黨', 12, 26, '梁明輝', 'male', '1956-09-07', '0450907', '屏東縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:27:L4:廖維欣:0620924', 'cec-2024-party-list-person-19da4ac268389bc8', '台灣民眾黨', 12, 27, '廖維欣', 'female', '1973-09-24', '0620924', '臺中市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:28:L4:馮啟彥:0590612', 'cec-2024-party-list-person-1e3212a0d32949e6', '台灣民眾黨', 12, 28, '馮啟彥', 'male', '1970-06-12', '0590612', '高雄市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:29:L4:林子宇:0840906', 'cec-2024-party-list-person-7fb4318cea1d6188', '台灣民眾黨', 12, 29, '林子宇', 'female', '1995-09-06', '0840906', '宜蘭縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:30:L4:張清俊:0740609', 'cec-2024-party-list-person-e1e8e08c08b8628b', '台灣民眾黨', 12, 30, '張清俊', 'male', '1985-06-09', '0740609', '桃園市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:31:L4:林治華:0761210', 'cec-2024-party-list-person-158755383c56343a', '台灣民眾黨', 12, 31, '林治華', 'female', '1987-12-10', '0761210', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:32:L4:李家豪:0730919', 'cec-2024-party-list-person-43c3e57416fab072', '台灣民眾黨', 12, 32, '李家豪', 'male', '1984-09-19', '0730919', '新北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:33:L4:邱于珊:0510225', 'cec-2024-party-list-person-41cf044f7478053b', '台灣民眾黨', 12, 33, '邱于珊', 'female', '1962-02-25', '0510225', '高雄市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣民眾黨:34:L4:周榆修:0660407', 'cec-2024-party-list-person-7bdced07f9861277', '台灣民眾黨', 12, 34, '周榆修', 'male', '1977-04-07', '0660407', '臺中市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣維新:1:L4:蘇煥智:0450720', 'cec-2024-party-list-person-f2fd11d6c9517ef4', '台灣維新', 13, 1, '蘇煥智', 'male', '1956-07-20', '0450720', '臺南市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣維新:2:L4:劉亦恩:0590928', 'cec-2024-party-list-person-58efbfed1620cb53', '台灣維新', 13, 2, '劉亦恩', 'female', '1970-09-28', '0590928', '宜蘭縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣維新:3:L4:江映瑤:0510111', 'cec-2024-party-list-person-b3a060e7dd1ed4fe', '台灣維新', 13, 3, '江映瑤', 'female', '1962-01-11', '0510111', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:親民黨:1:L4:李桐豪:0441007', 'cec-2024-party-list-person-03606f0045bc212a', '親民黨', 14, 1, '李桐豪', 'male', '1955-10-07', '0441007', '新北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:親民黨:2:L4:陳怡潔:0680909', 'cec-2024-party-list-person-068e817c9e644a82', '親民黨', 14, 2, '陳怡潔', 'female', '1979-09-09', '0680909', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:親民黨:3:L4:曲兆祥:0450104', 'cec-2024-party-list-person-c8eb18f5dbc2ff95', '親民黨', 14, 3, '曲兆祥', 'male', '1956-01-04', '0450104', '臺南市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:親民黨:4:L4:何偉真:0400104', 'cec-2024-party-list-person-ccb76e32b3382226', '親民黨', 14, 4, '何偉真', 'female', '1951-01-04', '0400104', '臺中市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:親民黨:5:L4:簡泰河:0430701', 'cec-2024-party-list-person-2bf58e911a1fcb79', '親民黨', 14, 5, '簡泰河', 'male', '1954-07-01', '0430701', '嘉義縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:親民黨:6:L4:藍志玟:0620913', 'cec-2024-party-list-person-d3a1351884e21d00', '親民黨', 14, 6, '藍志玟', 'female', '1973-09-13', '0620913', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:親民黨:7:L4:吳建德:0850915', 'cec-2024-party-list-person-86acb37e183687ca', '親民黨', 14, 7, '吳建德', 'male', '1996-09-15', '0850915', '臺中市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:親民黨:8:L4:黎淑慧:0491110', 'cec-2024-party-list-person-87f00736ef135f93', '親民黨', 14, 8, '黎淑慧', 'female', '1960-11-10', '0491110', '新竹市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:親民黨:9:L4:孫信君:0500117', 'cec-2024-party-list-person-5904ca278def3640', '親民黨', 14, 9, '孫信君', 'female', '1961-01-17', '0500117', '臺南市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:親民黨:10:L4:黎建南:0390718', 'cec-2024-party-list-person-3477a9041916282e', '親民黨', 14, 10, '黎建南', 'male', '1950-07-18', '0390718', '越南', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:人民最大黨:1:L4:林東雄:0320628', 'cec-2024-party-list-person-9df19fcd5d87d9f1', '人民最大黨', 15, 1, '林東雄', 'male', '1943-06-28', '0320628', '雲林縣', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:人民最大黨:2:L4:賴方靜靜:0311111', 'cec-2024-party-list-person-2a239782e0ce898f', '人民最大黨', 15, 2, '賴方靜靜', 'female', '1942-11-11', '0311111', '湖北省', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣團結聯盟:1:L4:周倪安:0611007', 'cec-2024-party-list-person-06bb68bd5abaa483', '台灣團結聯盟', 16, 1, '周倪安', 'female', '1972-10-07', '0611007', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣團結聯盟:2:L4:劉一德:0490415', 'cec-2024-party-list-person-6dcd3f7ffd1e50a6', '台灣團結聯盟', 16, 2, '劉一德', 'male', '1960-04-15', '0490415', '嘉義市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣團結聯盟:3:L4:歐陽瑞蓮:0650226', 'cec-2024-party-list-person-632139810095608d', '台灣團結聯盟', 16, 3, '歐陽瑞蓮', 'female', '1976-02-26', '0650226', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣團結聯盟:4:L4:王思棠:0570703', 'cec-2024-party-list-person-c0b4b55ed85f4523', '台灣團結聯盟', 16, 4, '王思棠', 'male', '1968-07-03', '0570703', '臺北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣團結聯盟:5:L4:張登凱:0461125', 'cec-2024-party-list-person-aebafa8fdc65a71a', '台灣團結聯盟', 16, 5, '張登凱', 'male', '1957-11-25', '0461125', '新北市', FALSE),
    ('cec-2024-candidate-json:L4:全國不分區:台灣團結聯盟:6:L4:吳家慶:0360401', 'cec-2024-party-list-person-569caf0e9119c8c7', '台灣團結聯盟', 16, 6, '吳家慶', 'male', '1947-04-01', '0360401', '雲林縣', FALSE);

DO $$
DECLARE roster_count INTEGER; party_count INTEGER; elected_count INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT party), COUNT(*) FILTER (WHERE elected)
  INTO roster_count, party_count, elected_count FROM _party_list_roster;
  IF roster_count <> 177 OR party_count <> 16 OR elected_count <> 34 THEN
    RAISE EXCEPTION 'Unexpected CEC roster: candidates %, parties %, elected %',
      roster_count, party_count, elected_count;
  END IF;
END;
$$;

CREATE TEMP TABLE _party_list_people (
  external_id TEXT PRIMARY KEY,
  person_id UUID NOT NULL
) ON COMMIT DROP;

WITH matches AS (
  SELECT roster.external_id, person_map.canonical_person_id AS person_id, 1 AS priority
  FROM _party_list_roster roster
  JOIN public.candidates candidate ON candidate.external_id = roster.external_id
  JOIN public.person_canonical_map person_map ON person_map.person_id = candidate.person_id
  UNION
  SELECT roster.external_id, person_map.canonical_person_id, 2
  FROM _party_list_roster roster
  JOIN public.person_claims claim
    ON claim.claim_type = 'external_id'
   AND COALESCE(claim.claim_value, claim.claim_json->>'officialExternalId') = roster.external_id
   AND claim.review_status = 'verified'
  JOIN public.person_canonical_map person_map ON person_map.person_id = claim.person_id
  UNION
  SELECT roster.external_id, person_map.canonical_person_id, 3
  FROM _party_list_roster roster
  JOIN public.people person
    ON REGEXP_REPLACE(REPLACE(person.name, '臺', '台'), '[[:space:]．・‧·]', '', 'g')
     = REGEXP_REPLACE(REPLACE(roster.person_name, '臺', '台'), '[[:space:]．・‧·]', '', 'g')
   AND REPLACE(COALESCE(person.party, ''), '臺', '台') = roster.party
  JOIN public.person_canonical_map person_map ON person_map.person_id = person.id
), deduplicated AS (
  SELECT DISTINCT external_id, person_id, priority FROM matches
), ranked AS (
  SELECT match.*, MIN(priority) OVER (PARTITION BY external_id) AS best_priority
  FROM deduplicated match
)
INSERT INTO _party_list_people
SELECT external_id, MIN(person_id::TEXT)::UUID
FROM ranked
WHERE priority = best_priority
GROUP BY external_id
HAVING COUNT(DISTINCT person_id) = 1;

INSERT INTO public.people (
  name, party, position, election_year, district, source_url,
  is_public, external_id, gender, updated_at
)
SELECT
  roster.person_name, roster.party, '2024年第11屆不分區立法委員候選人',
  2024, '全國不分區及僑居國外國民',
  'https://2024.cec.gov.tw/data/json/cand/L4/00000.json',
  TRUE, roster.person_external_id, roster.gender, NOW()
FROM _party_list_roster roster
LEFT JOIN _party_list_people resolved USING (external_id)
WHERE resolved.external_id IS NULL
ON CONFLICT (external_id) DO UPDATE SET
  name = EXCLUDED.name,
  party = EXCLUDED.party,
  election_year = EXCLUDED.election_year,
  district = EXCLUDED.district,
  source_url = EXCLUDED.source_url,
  is_public = TRUE,
  gender = CASE WHEN public.people.gender = 'unknown' THEN EXCLUDED.gender ELSE public.people.gender END,
  updated_at = NOW();

INSERT INTO _party_list_people
SELECT roster.external_id, person.id
FROM _party_list_roster roster
JOIN public.people person ON person.external_id = roster.person_external_id
ON CONFLICT (external_id) DO NOTHING;

DO $$
DECLARE resolved_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO resolved_count FROM _party_list_people;
  IF resolved_count <> 177 THEN
    RAISE EXCEPTION 'Expected 177 resolved identities, found %', resolved_count;
  END IF;
END;
$$;

UPDATE public.people person SET
  is_public = TRUE,
  gender = CASE WHEN person.gender = 'unknown' THEN roster.gender ELSE person.gender END,
  source_url = COALESCE(person.source_url, 'https://2024.cec.gov.tw/data/json/cand/L4/00000.json'),
  updated_at = NOW()
FROM _party_list_roster roster
JOIN _party_list_people resolved USING (external_id)
WHERE person.id = resolved.person_id;

UPDATE public.candidates candidate SET
  party = roster.party,
  candidate_no = roster.candidate_no::TEXT,
  registration_status = CASE WHEN roster.elected THEN 'elected' ELSE 'not_elected' END,
  source_name = '中央選舉委員會 2024 選舉專區：候選人 JSON',
  source_url = 'https://2024.cec.gov.tw/data/json/cand/L4/00000.json',
  is_public = TRUE,
  external_id = roster.external_id,
  is_elected = roster.elected,
  candidacy_status = 'qualified',
  election_result = CASE WHEN roster.elected THEN 'elected' ELSE 'not_elected' END,
  status_updated_at = NOW(),
  updated_at = NOW()
FROM _party_list_roster roster
JOIN _party_list_people resolved USING (external_id)
JOIN public.races race ON race.external_id = 'cec-2024-legislative-party-list'
WHERE candidate.race_id = race.id AND candidate.person_id = resolved.person_id;

INSERT INTO public.candidates (
  person_id, race_id, party, candidate_no, registration_status,
  source_name, source_url, is_public, external_id, is_elected,
  candidacy_status, election_result, status_updated_at
)
SELECT
  resolved.person_id, race.id, roster.party, roster.candidate_no::TEXT,
  CASE WHEN roster.elected THEN 'elected' ELSE 'not_elected' END,
  '中央選舉委員會 2024 選舉專區：候選人 JSON',
  'https://2024.cec.gov.tw/data/json/cand/L4/00000.json',
  TRUE, roster.external_id, roster.elected, 'qualified',
  CASE WHEN roster.elected THEN 'elected' ELSE 'not_elected' END, NOW()
FROM _party_list_roster roster
JOIN _party_list_people resolved USING (external_id)
JOIN public.races race ON race.external_id = 'cec-2024-legislative-party-list'
WHERE NOT EXISTS (
  SELECT 1 FROM public.candidates existing
  WHERE existing.race_id = race.id AND existing.person_id = resolved.person_id
)
ON CONFLICT (external_id) DO UPDATE SET
  person_id = EXCLUDED.person_id,
  race_id = EXCLUDED.race_id,
  party = EXCLUDED.party,
  candidate_no = EXCLUDED.candidate_no,
  registration_status = EXCLUDED.registration_status,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  is_public = TRUE,
  is_elected = EXCLUDED.is_elected,
  candidacy_status = EXCLUDED.candidacy_status,
  election_result = EXCLUDED.election_result,
  status_updated_at = NOW(),
  updated_at = NOW();

INSERT INTO public.current_office_exclusions (
  person_id, election_year, race_type, end_reason, ended_at,
  source_name, source_url, source_observed_at, source_payload, updated_at
)
SELECT
  resolved.person_id, 2024, 'party_list_legislator', 'other', NULL,

  '立法院第11屆現任立法委員名冊',
  'https://www.ly.gov.tw/Pages/List.aspx?nodeid=109',
  COALESCE((SELECT MAX(observed_at) FROM public.current_office_assignments WHERE role_key = 'legislator'), DATE '2026-08-12'),
  jsonb_build_object(
    'note', '2024年原始當選者未列於最新現任立法委員名冊；歷史選舉結果仍保留為當選',
    'officialExternalId', roster.external_id
  ),
  NOW()
FROM _party_list_roster roster
JOIN _party_list_people resolved USING (external_id)
WHERE roster.elected
  AND NOT EXISTS (
    SELECT 1
    FROM public.current_office_assignments assignment
    JOIN public.person_canonical_map assignment_map ON assignment_map.person_id = assignment.person_id
    WHERE assignment.role_key = 'legislator'
      AND assignment.is_current
      AND assignment_map.canonical_person_id = resolved.person_id
  )
ON CONFLICT (person_id, election_year, race_type) DO UPDATE SET
  end_reason = EXCLUDED.end_reason,
  ended_at = EXCLUDED.ended_at,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  source_observed_at = EXCLUDED.source_observed_at,
  source_payload = EXCLUDED.source_payload,
  updated_at = NOW();

DO $$
DECLARE candidate_count INTEGER; elected_count INTEGER; current_count INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE candidate.is_elected)
  INTO candidate_count, elected_count
  FROM public.candidates candidate
  JOIN public.races race ON race.id = candidate.race_id
  WHERE race.external_id = 'cec-2024-legislative-party-list' AND candidate.is_public;
  SELECT COUNT(*) INTO current_count
  FROM public.current_office_assignments
  WHERE role_key = 'legislator' AND is_current;
  IF candidate_count <> 177 OR elected_count <> 34 THEN
    RAISE EXCEPTION 'Unexpected party-list result: candidates %, elected %', candidate_count, elected_count;
  END IF;
  IF current_count <> 113 THEN
    RAISE EXCEPTION 'Current legislator roster changed unexpectedly: %', current_count;
  END IF;
END;
$$;

SELECT published.promote(NULL);

DO $$
DECLARE published_count INTEGER; published_elected_count INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_elected)
  INTO published_count, published_elected_count
  FROM published.candidates
  WHERE election_year = 2024
    AND race_title = '全國不分區及僑居國外國民立法委員選舉';
  IF published_count <> 177 OR published_elected_count <> 34 THEN
    RAISE EXCEPTION 'Unexpected published party-list result: candidates %, elected %',
      published_count, published_elected_count;
  END IF;
END;
$$;

COMMIT;
