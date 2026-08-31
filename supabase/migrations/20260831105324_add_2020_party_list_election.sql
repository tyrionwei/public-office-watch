-- Add the complete 2020 party-list race from the official CEC result data,
-- elected report, and election bulletin. Historical results do not imply current office.
BEGIN;

CREATE TEMP TABLE _party_list_2020_results (
  party_no INTEGER PRIMARY KEY,
  party TEXT NOT NULL UNIQUE,
  canonical_party TEXT NOT NULL UNIQUE,
  vote_count BIGINT NOT NULL,
  allocated_seats INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO _party_list_2020_results VALUES
    (1, '合一行動聯盟', '合一行動聯盟', 17515, 0),
    (2, '中華統一促進黨', '中華統一促進黨', 32966, 0),
    (3, '親民黨', '親民黨', 518921, 0),
    (4, '安定力量', '安定力量', 94563, 0),
    (5, '台灣基進', '台灣基進', 447286, 0),
    (6, '時代力量', '時代力量', 1098100, 3),
    (7, '新黨', '新黨', 147373, 0),
    (8, '喜樂島聯盟', '喜樂島聯盟', 29324, 0),
    (9, '中國國民黨', '中國國民黨', 4723504, 13),
    (10, '一邊一國行動黨', '一邊一國行動黨', 143617, 0),
    (11, '勞動黨', '勞動黨', 19941, 0),
    (12, '綠黨', '台灣綠黨', 341465, 0),
    (13, '宗教聯盟', '宗教聯盟', 31117, 0),
    (14, '民主進步黨', '民主進步黨', 4811241, 13),
    (15, '台灣民眾黨', '台灣民眾黨', 1588806, 5),
    (16, '台灣維新', '台灣維新', 11952, 0),
    (17, '台澎黨', '台澎黨', 11681, 0),
    (18, '國會政黨聯盟', '國會政黨聯盟', 40331, 0),
    (19, '台灣團結聯盟', '台聯黨', 50435, 0);

CREATE TEMP TABLE _party_list_2020_roster (
  external_id TEXT PRIMARY KEY,
  person_external_id TEXT NOT NULL UNIQUE,
  party TEXT NOT NULL,
  canonical_party TEXT NOT NULL,
  party_no INTEGER NOT NULL,
  candidate_no INTEGER NOT NULL,
  person_name TEXT NOT NULL,
  gender TEXT NOT NULL,
  birth_date DATE,
  birth_raw TEXT,
  elected BOOLEAN NOT NULL,
  UNIQUE (party, candidate_no)
) ON COMMIT DROP;

INSERT INTO _party_list_2020_roster VALUES
    ('cec-2020-bulletin:L4:全國不分區:合一行動聯盟:1:彭迦智:531001', 'cec-2020-party-list-person-408ca0c36fe56486', '合一行動聯盟', '合一行動聯盟', 1, 1, '彭迦智', 'male', '1964-10-01', '531001', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:合一行動聯盟:2:龍傅若瑋:610525', 'cec-2020-party-list-person-20cad182ae393fb4', '合一行動聯盟', '合一行動聯盟', 1, 2, '龍傅若瑋', 'female', '1972-05-25', '610525', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:合一行動聯盟:3:郝淑薏:590410', 'cec-2020-party-list-person-da552eb577dab738', '合一行動聯盟', '合一行動聯盟', 1, 3, '郝淑薏', 'female', '1970-04-10', '590410', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:合一行動聯盟:4:廖金河:520428', 'cec-2020-party-list-person-c6f1b89ba6f2a10b', '合一行動聯盟', '合一行動聯盟', 1, 4, '廖金河', 'male', '1963-04-28', '520428', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:合一行動聯盟:5:孫成玉:550810', 'cec-2020-party-list-person-d9281f01727aef43', '合一行動聯盟', '合一行動聯盟', 1, 5, '孫成玉', 'female', '1966-08-10', '550810', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:合一行動聯盟:6:張宜興:660311', 'cec-2020-party-list-person-ef32012be42dea8d', '合一行動聯盟', '合一行動聯盟', 1, 6, '張宜興', 'male', '1977-03-11', '660311', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:合一行動聯盟:7:周美雲:680913', 'cec-2020-party-list-person-b03825838b8a87fb', '合一行動聯盟', '合一行動聯盟', 1, 7, '周美雲', 'female', '1979-09-13', '680913', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:合一行動聯盟:8:林傑忠:510825', 'cec-2020-party-list-person-1c2c0d27a5661fb7', '合一行動聯盟', '合一行動聯盟', 1, 8, '林傑忠', 'male', '1962-08-25', '510825', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中華統一促進黨:1:謝啟大:380210', 'cec-2020-party-list-person-3e6fa6b4032c9f8b', '中華統一促進黨', '中華統一促進黨', 2, 1, '謝啟大', 'female', '1949-02-10', '380210', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中華統一促進黨:2:丁炳仁:480328', 'cec-2020-party-list-person-408167f14d900dfb', '中華統一促進黨', '中華統一促進黨', 2, 2, '丁炳仁', 'male', '1959-03-28', '480328', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中華統一促進黨:3:何建華:520111', 'cec-2020-party-list-person-2b4e4681ded6f4d2', '中華統一促進黨', '中華統一促進黨', 2, 3, '何建華', 'female', '1963-01-11', '520111', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中華統一促進黨:4:馬銀海:610502', 'cec-2020-party-list-person-66c5cf2efab87538', '中華統一促進黨', '中華統一促進黨', 2, 4, '馬銀海', 'male', '1972-05-02', '610502', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中華統一促進黨:5:李承龍:470213', 'cec-2020-party-list-person-b3a346030c9d2b81', '中華統一促進黨', '中華統一促進黨', 2, 5, '李承龍', 'male', '1958-02-13', '470213', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中華統一促進黨:6:張瑜庭:760516', 'cec-2020-party-list-person-0091c9b7004426fa', '中華統一促進黨', '中華統一促進黨', 2, 6, '張瑜庭', 'female', '1987-05-16', '760516', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中華統一促進黨:7:張安樂:370313', 'cec-2020-party-list-person-86abd439f8795f69', '中華統一促進黨', '中華統一促進黨', 2, 7, '張安樂', 'male', '1948-03-13', '370313', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:1:滕西華:620123', 'cec-2020-party-list-person-0a933a2d2549b1f3', '親民黨', '親民黨', 3, 1, '滕西華', 'female', '1973-01-23', '620123', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:2:李鴻鈞:480511', 'cec-2020-party-list-person-7c8eaa85a36bc1b5', '親民黨', '親民黨', 3, 2, '李鴻鈞', 'male', '1959-05-11', '480511', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:3:宣明智:410226', 'cec-2020-party-list-person-8966e95914bcef4c', '親民黨', '親民黨', 3, 3, '宣明智', 'male', '1952-02-26', '410226', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:4:劉宥彤:600110', 'cec-2020-party-list-person-0a47669f1689e3bf', '親民黨', '親民黨', 3, 4, '劉宥彤', 'female', '1971-01-10', '600110', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:5:陳怡潔:680909', 'cec-2020-party-list-person-9f3d57ddfd44cb14', '親民黨', '親民黨', 3, 5, '陳怡潔', 'female', '1979-09-09', '680909', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:6:張碩文:600507', 'cec-2020-party-list-person-c70313c60c148301', '親民黨', '親民黨', 3, 6, '張碩文', 'male', '1971-05-07', '600507', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:7:施壽全:411103', 'cec-2020-party-list-person-7f9050268e2486d0', '親民黨', '親民黨', 3, 7, '施壽全', 'male', '1952-11-03', '411103', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:8:李海同:440408', 'cec-2020-party-list-person-45d4636208741661', '親民黨', '親民黨', 3, 8, '李海同', 'male', '1955-04-08', '440408', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:9:蔡沁瑜:630817', 'cec-2020-party-list-person-25740a4c811f8eca', '親民黨', '親民黨', 3, 9, '蔡沁瑜', 'female', '1974-08-17', '630817', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:10:高瀚:690410', 'cec-2020-party-list-person-1518373435844799', '親民黨', '親民黨', 3, 10, '高瀚', 'male', '1980-04-10', '690410', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:11:游文人:560604', 'cec-2020-party-list-person-9e8393a85f3fc026', '親民黨', '親民黨', 3, 11, '游文人', 'male', '1967-06-04', '560604', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:12:陳秀玲:500417', 'cec-2020-party-list-person-d37bfea0ecb0335a', '親民黨', '親民黨', 3, 12, '陳秀玲', 'female', '1961-04-17', '500417', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:13:黃文卿:630416', 'cec-2020-party-list-person-f379ee1570ce0e12', '親民黨', '親民黨', 3, 13, '黃文卿', 'male', '1974-04-16', '630416', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:14:李本玠:361015', 'cec-2020-party-list-person-14d6753f90e62b81', '親民黨', '親民黨', 3, 14, '李本玠', 'male', '1947-10-15', '361015', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:15:黎淑慧:491110', 'cec-2020-party-list-person-14763bff2da91c34', '親民黨', '親民黨', 3, 15, '黎淑慧', 'female', '1960-11-10', '491110', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:16:彭瓊芳:460818', 'cec-2020-party-list-person-cef5d44f1545f1ed', '親民黨', '親民黨', 3, 16, '彭瓊芳', 'female', '1957-08-18', '460818', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:17:劉宗夏:680628', 'cec-2020-party-list-person-3dbab0af06bcbdaf', '親民黨', '親民黨', 3, 17, '劉宗夏', 'male', '1979-06-28', '680628', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:18:林昊宜:710322', 'cec-2020-party-list-person-e0d471f7ac5c5c2e', '親民黨', '親民黨', 3, 18, '林昊宜', 'female', '1982-03-22', '710322', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:19:趙偉伶:611106', 'cec-2020-party-list-person-a4aea54ab6564f79', '親民黨', '親民黨', 3, 19, '趙偉伶', 'female', '1972-11-06', '611106', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:20:蕭涵方:640128', 'cec-2020-party-list-person-743894cef3dea54e', '親民黨', '親民黨', 3, 20, '蕭涵方', 'female', '1975-01-28', '640128', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:21:陳一夫:751009', 'cec-2020-party-list-person-2b0b8d67a35d1a39', '親民黨', '親民黨', 3, 21, '陳一夫', 'male', '1986-10-09', '751009', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:親民黨:22:吳方宜:801002', 'cec-2020-party-list-person-ae7742ca9a04f033', '親民黨', '親民黨', 3, 22, '吳方宜', 'female', '1991-10-02', '801002', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:安定力量:1:朱竹元:470228', 'cec-2020-party-list-person-9b7d806a6995d931', '安定力量', '安定力量', 4, 1, '朱竹元', 'male', '1958-02-28', '470228', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:安定力量:2:陳曉虹:490511', 'cec-2020-party-list-person-ba4a4868fdfc99b6', '安定力量', '安定力量', 4, 2, '陳曉虹', 'female', '1960-05-11', '490511', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:安定力量:3:毛嘉慶:650603', 'cec-2020-party-list-person-8ac7eb08cf6403ff', '安定力量', '安定力量', 4, 3, '毛嘉慶', 'male', '1976-06-03', '650603', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:安定力量:4:馮瑞珠:471129', 'cec-2020-party-list-person-7b25311a8a411fce', '安定力量', '安定力量', 4, 4, '馮瑞珠', 'female', '1958-11-29', '471129', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:安定力量:5:裘佩恩:600126', 'cec-2020-party-list-person-06f5253a3c030625', '安定力量', '安定力量', 4, 5, '裘佩恩', 'male', '1971-01-26', '600126', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:安定力量:6:林秋屏:651015', 'cec-2020-party-list-person-92f4ec9520dbce73', '安定力量', '安定力量', 4, 6, '林秋屏', 'female', '1976-10-15', '651015', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:安定力量:7:吳蕚洋:490815', 'cec-2020-party-list-person-1d7751827e941200', '安定力量', '安定力量', 4, 7, '吳蕚洋', 'male', '1960-08-15', '490815', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:安定力量:8:李允佳:720709', 'cec-2020-party-list-person-3d987b683a18aae8', '安定力量', '安定力量', 4, 8, '李允佳', 'female', '1983-07-09', '720709', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:安定力量:9:洪正一:590710', 'cec-2020-party-list-person-d0e5b5c92032b584', '安定力量', '安定力量', 4, 9, '洪正一', 'male', '1970-07-10', '590710', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:安定力量:10:蘇美玲:550302', 'cec-2020-party-list-person-9a29f7793d73174a', '安定力量', '安定力量', 4, 10, '蘇美玲', 'female', '1966-03-02', '550302', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣基進:1:成令方:401224', 'cec-2020-party-list-person-347e6ab169822302', '台灣基進', '台灣基進', 5, 1, '成令方', 'female', '1951-12-24', '401224', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣基進:2:陳奕齊:610827', 'cec-2020-party-list-person-1da2b4bcf1de91da', '台灣基進', '台灣基進', 5, 2, '陳奕齊', 'male', '1972-08-27', '610827', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣基進:3:吳欣岱:760701', 'cec-2020-party-list-person-2d060d4271fad683', '台灣基進', '台灣基進', 5, 3, '吳欣岱', 'female', '1987-07-01', '760701', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣基進:4:陳冠榮:691122', 'cec-2020-party-list-person-917c7e151f3e545c', '台灣基進', '台灣基進', 5, 4, '陳冠榮', 'male', '1980-11-22', '691122', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣基進:5:何澄輝:600623', 'cec-2020-party-list-person-bfe9203e0327e031', '台灣基進', '台灣基進', 5, 5, '何澄輝', 'male', '1971-06-23', '600623', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣基進:6:李雨蓁:761215', 'cec-2020-party-list-person-70bcef932f2d24e3', '台灣基進', '台灣基進', 5, 6, '李雨蓁', 'female', '1987-12-15', '761215', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:時代力量:1:陳椒華:481029', 'cec-2020-party-list-person-bb60ca1b3926ecbf', '時代力量', '時代力量', 6, 1, '陳椒華', 'female', '1959-10-29', '481029', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:時代力量:2:邱顯智:650429', 'cec-2020-party-list-person-b4f4054c73de50f1', '時代力量', '時代力量', 6, 2, '邱顯智', 'male', '1976-04-29', '650429', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:時代力量:3:王婉諭:680426', 'cec-2020-party-list-person-75e8bf66871c29c7', '時代力量', '時代力量', 6, 3, '王婉諭', 'female', '1979-04-26', '680426', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:時代力量:4:黃國昌:620819', 'cec-2020-party-list-person-bf610d5de570416d', '時代力量', '時代力量', 6, 4, '黃國昌', 'male', '1973-08-19', '620819', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:時代力量:5:翟本喬:550518', 'cec-2020-party-list-person-8b3accb83739ba52', '時代力量', '時代力量', 6, 5, '翟本喬', 'male', '1966-05-18', '550518', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:時代力量:6:關心羚:710604', 'cec-2020-party-list-person-171a9b53522bbc8d', '時代力量', '時代力量', 6, 6, '關心羚', 'female', '1982-06-04', '710604', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:時代力量:7:王幗英:520903', 'cec-2020-party-list-person-2cc01e4f68739718', '時代力量', '時代力量', 6, 7, '王幗英', 'female', '1963-09-03', '520903', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:時代力量:8:吳佩芸:810410', 'cec-2020-party-list-person-16435150759c893e', '時代力量', '時代力量', 6, 8, '吳佩芸', 'female', '1992-04-10', '810410', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:時代力量:9:白卿芬:591125', 'cec-2020-party-list-person-1ea138994f5c06c0', '時代力量', '時代力量', 6, 9, '白卿芬', 'female', '1970-11-25', '591125', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:時代力量:10:趙芸菁:711212', 'cec-2020-party-list-person-d76efe93e9347877', '時代力量', '時代力量', 6, 10, '趙芸菁', 'female', '1982-12-12', '711212', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:時代力量:11:詹智鈞:650901', 'cec-2020-party-list-person-53f2f242eeec867d', '時代力量', '時代力量', 6, 11, '詹智鈞', 'male', '1976-09-01', '650901', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:新黨:1:邱毅:450508', 'cec-2020-party-list-person-796db1f9d92d3fd1', '新黨', '新黨', 7, 1, '邱毅', 'male', '1956-05-08', '450508', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:新黨:2:陳麗玲:580727', 'cec-2020-party-list-person-c8e2f5a15e022a57', '新黨', '新黨', 7, 2, '陳麗玲', 'female', '1969-07-27', '580727', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:新黨:3:沈采穎:500107', 'cec-2020-party-list-person-78e25feda2918c6e', '新黨', '新黨', 7, 3, '沈采穎', 'female', '1961-01-07', '500107', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:新黨:4:王炳忠:760831', 'cec-2020-party-list-person-07d88a9eca0825c9', '新黨', '新黨', 7, 4, '王炳忠', 'male', '1987-08-31', '760831', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:新黨:5:賀樺:610904', 'cec-2020-party-list-person-bd77097bf9f1920e', '新黨', '新黨', 7, 5, '賀樺', 'female', '1972-09-04', '610904', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:新黨:6:林明正:671202', 'cec-2020-party-list-person-6ed53e5276f270f9', '新黨', '新黨', 7, 6, '林明正', 'male', '1978-12-02', '671202', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:新黨:7:黃乃芸:570210', 'cec-2020-party-list-person-d0f0b241ab0b1669', '新黨', '新黨', 7, 7, '黃乃芸', 'female', '1968-02-10', '570210', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:新黨:8:龐文楚:700302', 'cec-2020-party-list-person-c216e7c6ff210e2a', '新黨', '新黨', 7, 8, '龐文楚', 'male', '1981-03-02', '700302', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:新黨:9:郝永瑞:550805', 'cec-2020-party-list-person-18892060a3027d1c', '新黨', '新黨', 7, 9, '郝永瑞', 'female', '1966-08-05', '550805', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:新黨:10:楊世光:651024', 'cec-2020-party-list-person-10a3d9a26cf23ca0', '新黨', '新黨', 7, 10, '楊世光', 'male', '1976-10-24', '651024', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:喜樂島聯盟:1:林秀霞:490202', 'cec-2020-party-list-person-ace02559a6bee3f4', '喜樂島聯盟', '喜樂島聯盟', 8, 1, '林秀霞', 'female', '1960-02-02', '490202', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:喜樂島聯盟:2:施正鋒:470224', 'cec-2020-party-list-person-766300cb4499ab46', '喜樂島聯盟', '喜樂島聯盟', 8, 2, '施正鋒', 'male', '1958-02-24', '470224', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:喜樂島聯盟:3:高大成:391120', 'cec-2020-party-list-person-ea9e7d65e540804c', '喜樂島聯盟', '喜樂島聯盟', 8, 3, '高大成', 'male', '1950-11-20', '391120', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:喜樂島聯盟:4:李素貞:400625', 'cec-2020-party-list-person-08506c44a3e0bb11', '喜樂島聯盟', '喜樂島聯盟', 8, 4, '李素貞', 'female', '1951-06-25', '400625', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:喜樂島聯盟:5:張君瑜:731126', 'cec-2020-party-list-person-f797e93a7454059f', '喜樂島聯盟', '喜樂島聯盟', 8, 5, '張君瑜', 'female', '1984-11-26', '731126', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:喜樂島聯盟:6:林東徵:711207', 'cec-2020-party-list-person-b74d29c95f8eb6ba', '喜樂島聯盟', '喜樂島聯盟', 8, 6, '林東徵', 'male', '1982-12-07', '711207', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:1:曾銘宗:480122', 'cec-2020-party-list-person-4914f88a3b496cfd', '中國國民黨', '中國國民黨', 9, 1, '曾銘宗', 'male', '1959-01-22', '480122', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:2:葉毓蘭:470227', 'cec-2020-party-list-person-f90e8fe2392d9ea1', '中國國民黨', '中國國民黨', 9, 2, '葉毓蘭', 'female', '1958-02-27', '470227', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:3:李貴敏:481211', 'cec-2020-party-list-person-3fb3dfcfca671e2c', '中國國民黨', '中國國民黨', 9, 3, '李貴敏', 'female', '1959-12-11', '481211', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:4:吳斯懷:411215', 'cec-2020-party-list-person-fcb0890231eff800', '中國國民黨', '中國國民黨', 9, 4, '吳斯懷', 'male', '1952-12-15', '411215', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:5:鄭麗文:581112', 'cec-2020-party-list-person-30b43326180c8045', '中國國民黨', '中國國民黨', 9, 5, '鄭麗文', 'female', '1969-11-12', '581112', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:6:林文瑞:480915', 'cec-2020-party-list-person-fe4b469d2f896ecf', '中國國民黨', '中國國民黨', 9, 6, '林文瑞', 'male', '1959-09-15', '480915', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:7:廖婉汝:490127', 'cec-2020-party-list-person-cde08924dbe90638', '中國國民黨', '中國國民黨', 9, 7, '廖婉汝', 'female', '1960-01-27', '490127', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:8:翁重鈞:440531', 'cec-2020-party-list-person-27608eb2a5d62260', '中國國民黨', '中國國民黨', 9, 8, '翁重鈞', 'male', '1955-05-31', '440531', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:9:吳怡玎:681113', 'cec-2020-party-list-person-d5fe2fe149dbc367', '中國國民黨', '中國國民黨', 9, 9, '吳怡玎', 'female', '1979-11-13', '681113', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:10:陳以信:611031', 'cec-2020-party-list-person-947df886b6739849', '中國國民黨', '中國國民黨', 9, 10, '陳以信', 'male', '1972-10-31', '611031', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:11:張育美:460512', 'cec-2020-party-list-person-59c6beea1728fc67', '中國國民黨', '中國國民黨', 9, 11, '張育美', 'female', '1957-05-12', '460512', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:12:李德維:580901', 'cec-2020-party-list-person-c02bb30a422ef161', '中國國民黨', '中國國民黨', 9, 12, '李德維', 'male', '1969-09-01', '580901', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:13:溫玉霞:440805', 'cec-2020-party-list-person-d4d96a48c7120465', '中國國民黨', '中國國民黨', 9, 13, '溫玉霞', 'female', '1955-08-05', '440805', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:14:吳敦義:370130', 'cec-2020-party-list-person-0a260f344748282f', '中國國民黨', '中國國民黨', 9, 14, '吳敦義', 'male', '1948-01-30', '370130', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:15:謝龍介:501003', 'cec-2020-party-list-person-d897cb7b0daf0c2a', '中國國民黨', '中國國民黨', 9, 15, '謝龍介', 'male', '1961-10-03', '501003', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:16:車宜靜:560321', 'cec-2020-party-list-person-76dcf12cd29abb7b', '中國國民黨', '中國國民黨', 9, 16, '車宜靜', 'female', '1967-03-21', '560321', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:17:牛春茹:590421', 'cec-2020-party-list-person-476277c3178ea55b', '中國國民黨', '中國國民黨', 9, 17, '牛春茹', 'female', '1970-04-21', '590421', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:18:曾文培:620111', 'cec-2020-party-list-person-fba1b43b06366639', '中國國民黨', '中國國民黨', 9, 18, '曾文培', 'male', '1973-01-11', '620111', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:19:李玉嬋:540226', 'cec-2020-party-list-person-92d991de3debb1d0', '中國國民黨', '中國國民黨', 9, 19, '李玉嬋', 'female', '1965-02-26', '540226', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:20:王裕文:580722', 'cec-2020-party-list-person-75e7bf0b6f9eac45', '中國國民黨', '中國國民黨', 9, 20, '王裕文', 'male', '1969-07-22', '580722', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:21:王桂芸:411012', 'cec-2020-party-list-person-3513ba0a6a3f1ae9', '中國國民黨', '中國國民黨', 9, 21, '王桂芸', 'female', '1952-10-12', '411012', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:22:耿繼文:400414', 'cec-2020-party-list-person-a637fa5c760dbbc6', '中國國民黨', '中國國民黨', 9, 22, '耿繼文', 'male', '1951-04-14', '400414', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:23:侯佳齡:640805', 'cec-2020-party-list-person-8e49802c97c3b8d4', '中國國民黨', '中國國民黨', 9, 23, '侯佳齡', 'female', '1975-08-05', '640805', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:24:謝瀛華:470119', 'cec-2020-party-list-person-62f4e960e0301a7d', '中國國民黨', '中國國民黨', 9, 24, '謝瀛華', 'male', '1958-01-19', '470119', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:25:邱素蘭:430208', 'cec-2020-party-list-person-572f219db6b4580f', '中國國民黨', '中國國民黨', 9, 25, '邱素蘭', 'female', '1954-02-08', '430208', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:26:張智倫:721124', 'cec-2020-party-list-person-1169149132ff82ef', '中國國民黨', '中國國民黨', 9, 26, '張智倫', 'male', '1983-11-24', '721124', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:27:李惠蘭:550809', 'cec-2020-party-list-person-fc26e20846f6663f', '中國國民黨', '中國國民黨', 9, 27, '李惠蘭', 'female', '1966-08-09', '550809', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:28:連元章:430725', 'cec-2020-party-list-person-916dce52665dea5e', '中國國民黨', '中國國民黨', 9, 28, '連元章', 'male', '1954-07-25', '430725', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:29:許謹如:601229', 'cec-2020-party-list-person-957cfe3e1409c759', '中國國民黨', '中國國民黨', 9, 29, '許謹如', 'female', '1971-12-29', '601229', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:30:林有志:560202', 'cec-2020-party-list-person-8f7c7b7b95b15db6', '中國國民黨', '中國國民黨', 9, 30, '林有志', 'male', '1967-02-02', '560202', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:中國國民黨:31:黃璉華:420128', 'cec-2020-party-list-person-5ff01c4fbe33fca2', '中國國民黨', '中國國民黨', 9, 31, '黃璉華', 'female', '1953-01-28', '420128', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:一邊一國行動黨:1:陳昭姿:450903', 'cec-2020-party-list-person-a5eb1b48985724ef', '一邊一國行動黨', '一邊一國行動黨', 10, 1, '陳昭姿', 'female', '1956-09-03', '450903', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:一邊一國行動黨:2:鄭新助:300221', 'cec-2020-party-list-person-ad51f10e917dd2e1', '一邊一國行動黨', '一邊一國行動黨', 10, 2, '鄭新助', 'male', '1941-02-21', '300221', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:一邊一國行動黨:3:朱孟庠:510908', 'cec-2020-party-list-person-af5a1ebca444bb87', '一邊一國行動黨', '一邊一國行動黨', 10, 3, '朱孟庠', 'female', '1962-09-08', '510908', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:一邊一國行動黨:4:楊其文:420502', 'cec-2020-party-list-person-4c22499981827313', '一邊一國行動黨', '一邊一國行動黨', 10, 4, '楊其文', 'male', '1953-05-02', '420502', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:一邊一國行動黨:5:張文翊:401230', 'cec-2020-party-list-person-c58c0a578834b30c', '一邊一國行動黨', '一邊一國行動黨', 10, 5, '張文翊', 'female', '1951-12-30', '401230', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:勞動黨:1:羅美文:400905', 'cec-2020-party-list-person-ead9e00ac6541267', '勞動黨', '勞動黨', 11, 1, '羅美文', 'male', '1951-09-05', '400905', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:勞動黨:2:王娟萍:490417', 'cec-2020-party-list-person-3581862211c118e4', '勞動黨', '勞動黨', 11, 2, '王娟萍', 'female', '1960-04-17', '490417', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:綠黨:1:鄧惠文:600812', 'cec-2020-party-list-person-c31123f7e304ccfb', '綠黨', '台灣綠黨', 12, 1, '鄧惠文', 'female', '1971-08-12', '600812', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:綠黨:2:高成炎:371003', 'cec-2020-party-list-person-2039d249d176d870', '綠黨', '台灣綠黨', 12, 2, '高成炎', 'male', '1948-10-03', '371003', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:綠黨:3:王浩宇:771029', 'cec-2020-party-list-person-d0f8ec022130d52b', '綠黨', '台灣綠黨', 12, 3, '王浩宇', 'male', '1988-10-29', '771029', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:綠黨:4:李菁琪:770402', 'cec-2020-party-list-person-544b93838d62ea2f', '綠黨', '台灣綠黨', 12, 4, '李菁琪', 'female', '1988-04-02', '770402', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:綠黨:5:張佑輔:660903', 'cec-2020-party-list-person-290aaed606239604', '綠黨', '台灣綠黨', 12, 5, '張佑輔', 'male', '1977-09-03', '660903', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:綠黨:6:張竹芩:740110', 'cec-2020-party-list-person-e4044d762d6275fe', '綠黨', '台灣綠黨', 12, 6, '張竹芩', 'female', '1985-01-10', '740110', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:宗教聯盟:1:朱武獻:390610', 'cec-2020-party-list-person-827f7bf28d2fe2d4', '宗教聯盟', '宗教聯盟', 13, 1, '朱武獻', 'male', '1950-06-10', '390610', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:宗教聯盟:2:翁瑋鍼:700223', 'cec-2020-party-list-person-4e99ad708810974a', '宗教聯盟', '宗教聯盟', 13, 2, '翁瑋鍼', 'female', '1981-02-23', '700223', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:宗教聯盟:3:呂玲玲:460307', 'cec-2020-party-list-person-c23d71b19845a39b', '宗教聯盟', '宗教聯盟', 13, 3, '呂玲玲', 'female', '1957-03-07', '460307', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:宗教聯盟:4:閔代璽:590407', 'cec-2020-party-list-person-18465affd7e46e9b', '宗教聯盟', '宗教聯盟', 13, 4, '閔代璽', 'male', '1970-04-07', '590407', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:宗教聯盟:5:呂錫勲:450410', 'cec-2020-party-list-person-3bbab51dbeb7e59a', '宗教聯盟', '宗教聯盟', 13, 5, '呂錫勲', 'male', '1956-04-10', '450410', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:宗教聯盟:6:袁慧心:540622', 'cec-2020-party-list-person-029bd3204bb1de46', '宗教聯盟', '宗教聯盟', 13, 6, '袁慧心', 'female', '1965-06-22', '540622', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:宗教聯盟:7:吳亮儀:550308', 'cec-2020-party-list-person-6c9c7a60a50d664a', '宗教聯盟', '宗教聯盟', 13, 7, '吳亮儀', 'female', '1966-03-08', '550308', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:宗教聯盟:8:陳建平:350511', 'cec-2020-party-list-person-e7cb36904ba7183a', '宗教聯盟', '宗教聯盟', 13, 8, '陳建平', 'male', '1946-05-11', '350511', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:1:吳玉琴:530815', 'cec-2020-party-list-person-bd7a303a85f3d70e', '民主進步黨', '民主進步黨', 14, 1, '吳玉琴', 'female', '1964-08-15', '530815', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:2:洪申翰:731018', 'cec-2020-party-list-person-4239085b58afa5d8', '民主進步黨', '民主進步黨', 14, 2, '洪申翰', 'male', '1984-10-18', '731018', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:3:范雲:570709', 'cec-2020-party-list-person-93c2ceab2017e800', '民主進步黨', '民主進步黨', 14, 3, '范雲', 'female', '1968-07-09', '570709', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:4:羅美玲:580501', 'cec-2020-party-list-person-68f3846ad2ab828f', '民主進步黨', '民主進步黨', 14, 4, '羅美玲', 'female', '1969-05-01', '580501', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:5:邱泰源:451030', 'cec-2020-party-list-person-fda2777a2e683ef5', '民主進步黨', '民主進步黨', 14, 5, '邱泰源', 'male', '1956-10-30', '451030', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:6:周春米:551101', 'cec-2020-party-list-person-20597ceb55b99602', '民主進步黨', '民主進步黨', 14, 6, '周春米', 'female', '1966-11-01', '551101', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:7:游錫堃:370425', 'cec-2020-party-list-person-653dddf2629c707b', '民主進步黨', '民主進步黨', 14, 7, '游錫堃', 'male', '1948-04-25', '370425', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:8:柯建銘:400908', 'cec-2020-party-list-person-a0f294402468401e', '民主進步黨', '民主進步黨', 14, 8, '柯建銘', 'male', '1951-09-08', '400908', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:9:管碧玲:451209', 'cec-2020-party-list-person-9de97143b8c3dbf4', '民主進步黨', '民主進步黨', 14, 9, '管碧玲', 'female', '1956-12-09', '451209', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:10:莊瑞雄:520420', 'cec-2020-party-list-person-e2ad9c2b397003c2', '民主進步黨', '民主進步黨', 14, 10, '莊瑞雄', 'male', '1963-04-20', '520420', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:11:沈發惠:551102', 'cec-2020-party-list-person-5948815546a020a4', '民主進步黨', '民主進步黨', 14, 11, '沈發惠', 'male', '1966-11-02', '551102', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:12:林楚茵:611010', 'cec-2020-party-list-person-ed9a06efde3159c5', '民主進步黨', '民主進步黨', 14, 12, '林楚茵', 'female', '1972-10-10', '611010', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:13:施義芳:510210', 'cec-2020-party-list-person-6ea0c086ae79f14c', '民主進步黨', '民主進步黨', 14, 13, '施義芳', 'male', '1962-02-10', '510210', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:14:游萬豐:570703', 'cec-2020-party-list-person-d4b52bf0e0fc3b9f', '民主進步黨', '民主進步黨', 14, 14, '游萬豐', 'male', '1968-07-03', '570703', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:15:歐蜜‧偉浪:521010', 'cec-2020-party-list-person-98e2f878280763ce', '民主進步黨', '民主進步黨', 14, 15, '歐蜜‧偉浪', 'male', '1963-10-10', '521010', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:16:湯蕙禎:431003', 'cec-2020-party-list-person-95112c2a20a229b9', '民主進步黨', '民主進步黨', 14, 16, '湯蕙禎', 'female', '1954-10-03', '431003', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:17:陳靜敏:550502', 'cec-2020-party-list-person-8f85b8bf6f8e5722', '民主進步黨', '民主進步黨', 14, 17, '陳靜敏', 'female', '1966-05-02', '550502', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:18:黃奕睿:560721', 'cec-2020-party-list-person-f17bc466af41fc18', '民主進步黨', '民主進步黨', 14, 18, '黃奕睿', 'male', '1967-07-21', '560721', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:19:許忠富:571226', 'cec-2020-party-list-person-f5916783710ecfaf', '民主進步黨', '民主進步黨', 14, 19, '許忠富', 'male', '1968-12-26', '571226', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:20:張菊芳:520119', 'cec-2020-party-list-person-22eb454f1be5b5b5', '民主進步黨', '民主進步黨', 14, 20, '張菊芳', 'female', '1963-01-19', '520119', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:21:呂建德:550613', 'cec-2020-party-list-person-7dc8716dcb85b5f9', '民主進步黨', '民主進步黨', 14, 21, '呂建德', 'male', '1966-06-13', '550613', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:22:陳培瑜:660809', 'cec-2020-party-list-person-1ade6dd37a8d140c', '民主進步黨', '民主進步黨', 14, 22, '陳培瑜', 'female', '1977-08-09', '660809', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:23:顏聖冠:570620', 'cec-2020-party-list-person-70f18edaa044f735', '民主進步黨', '民主進步黨', 14, 23, '顏聖冠', 'female', '1968-06-20', '570620', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:24:李淑芬:461112', 'cec-2020-party-list-person-3ce79d571ce04ad3', '民主進步黨', '民主進步黨', 14, 24, '李淑芬', 'female', '1957-11-12', '461112', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:25:柯富揚:590101', 'cec-2020-party-list-person-c3b82aeb95a027aa', '民主進步黨', '民主進步黨', 14, 25, '柯富揚', 'male', '1970-01-01', '590101', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:26:黃金舜:480302', 'cec-2020-party-list-person-9b7bcd1e8ae0acbf', '民主進步黨', '民主進步黨', 14, 26, '黃金舜', 'male', '1959-03-02', '480302', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:27:林愛龍:700713', 'cec-2020-party-list-person-892d18ac70c57ebf', '民主進步黨', '民主進步黨', 14, 27, '林愛龍', 'female', '1981-07-13', '700713', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:28:董建宏:600831', 'cec-2020-party-list-person-4fd74e8bff9c5653', '民主進步黨', '民主進步黨', 14, 28, '董建宏', 'male', '1971-08-31', '600831', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:29:林世嘉:580415', 'cec-2020-party-list-person-c7735c64ce196af1', '民主進步黨', '民主進步黨', 14, 29, '林世嘉', 'female', '1969-04-15', '580415', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:30:黃帝穎:730123', 'cec-2020-party-list-person-dcb29e7a66bb141e', '民主進步黨', '民主進步黨', 14, 30, '黃帝穎', 'male', '1984-01-23', '730123', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:31:趙心瑜:610430', 'cec-2020-party-list-person-46dd6163d6c92069', '民主進步黨', '民主進步黨', 14, 31, '趙心瑜', 'female', '1972-04-30', '610430', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:32:蔣念祖:571004', 'cec-2020-party-list-person-83ba1ef6a106b96b', '民主進步黨', '民主進步黨', 14, 32, '蔣念祖', 'female', '1968-10-04', '571004', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:民主進步黨:33:楊懿珊:680408', 'cec-2020-party-list-person-7e1100a6cddb83b9', '民主進步黨', '民主進步黨', 14, 33, '楊懿珊', 'female', '1979-04-08', '680408', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:1:賴香伶:570105', 'cec-2020-party-list-person-0627d52f5eed6fcd', '台灣民眾黨', '台灣民眾黨', 15, 1, '賴香伶', 'female', '1968-01-05', '570105', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:2:張其祿:570328', 'cec-2020-party-list-person-f9b8047e6c897754', '台灣民眾黨', '台灣民眾黨', 15, 2, '張其祿', 'male', '1968-03-28', '570328', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:3:高虹安:730125', 'cec-2020-party-list-person-42a1f4ba2b6452bd', '台灣民眾黨', '台灣民眾黨', 15, 3, '高虹安', 'female', '1984-01-25', '730125', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:4:邱臣遠:701211', 'cec-2020-party-list-person-845f1798f574b567', '台灣民眾黨', '台灣民眾黨', 15, 4, '邱臣遠', 'male', '1981-12-11', '701211', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:5:蔡壁如:530311', 'cec-2020-party-list-person-3c273809c2a8856a', '台灣民眾黨', '台灣民眾黨', 15, 5, '蔡壁如', 'female', '1964-03-11', '530311', TRUE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:6:楊博宇:690908', 'cec-2020-party-list-person-e4df0f29212c33b5', '台灣民眾黨', '台灣民眾黨', 15, 6, '楊博宇', 'male', '1980-09-08', '690908', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:7:吳欣盈:670518', 'cec-2020-party-list-person-8c87158920cde482', '台灣民眾黨', '台灣民眾黨', 15, 7, '吳欣盈', 'female', '1978-05-18', '670518', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:8:詹翔欽:820216', 'cec-2020-party-list-person-f7ba74923a768ec2', '台灣民眾黨', '台灣民眾黨', 15, 8, '詹翔欽', 'male', '1993-02-16', '820216', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:9:陳琬惠:630911', 'cec-2020-party-list-person-f8c9c15219fbf952', '台灣民眾黨', '台灣民眾黨', 15, 9, '陳琬惠', 'female', '1974-09-11', '630911', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:10:林國成:460820', 'cec-2020-party-list-person-71d6b1d507ca721c', '台灣民眾黨', '台灣民眾黨', 15, 10, '林國成', 'male', '1957-08-20', '460820', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:11:孫智麗:571001', 'cec-2020-party-list-person-312ea1b8865c710b', '台灣民眾黨', '台灣民眾黨', 15, 11, '孫智麗', 'female', '1968-10-01', '571001', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:12:楊弘仁:570904', 'cec-2020-party-list-person-cc8cce7ef58d70ca', '台灣民眾黨', '台灣民眾黨', 15, 12, '楊弘仁', 'male', '1968-09-04', '570904', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:13:黃瀞瑩:810610', 'cec-2020-party-list-person-e2146a0e90b1851f', '台灣民眾黨', '台灣民眾黨', 15, 13, '黃瀞瑩', 'female', '1992-06-10', '810610', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:14:馮啟彥:590612', 'cec-2020-party-list-person-3a32b8489c9f07a6', '台灣民眾黨', '台灣民眾黨', 15, 14, '馮啟彥', 'male', '1970-06-12', '590612', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:15:江惠儀:730111', 'cec-2020-party-list-person-1182c15227aa1c1a', '台灣民眾黨', '台灣民眾黨', 15, 15, '江惠儀', 'female', '1984-01-11', '730111', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:16:羅義興:610818', 'cec-2020-party-list-person-ee01ef7e83d02243', '台灣民眾黨', '台灣民眾黨', 15, 16, '羅義興', 'male', '1972-08-18', '610818', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:17:陳思宇:750904', 'cec-2020-party-list-person-5aa765d48bef71e2', '台灣民眾黨', '台灣民眾黨', 15, 17, '陳思宇', 'female', '1986-09-04', '750904', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:18:魏安國:620731', 'cec-2020-party-list-person-0ab5add8f9f36ef7', '台灣民眾黨', '台灣民眾黨', 15, 18, '魏安國', 'male', '1973-07-31', '620731', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:19:李思慧:710530', 'cec-2020-party-list-person-75991e750c5879e1', '台灣民眾黨', '台灣民眾黨', 15, 19, '李思慧', 'female', '1982-05-30', '710530', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:20:傅郁揚:711123', 'cec-2020-party-list-person-ac709757a0572750', '台灣民眾黨', '台灣民眾黨', 15, 20, '傅郁揚', 'male', '1982-11-23', '711123', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:21:何容君:641204', 'cec-2020-party-list-person-98853c56c54ab5a6', '台灣民眾黨', '台灣民眾黨', 15, 21, '何容君', 'female', '1975-12-04', '641204', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:22:端木正:590123', 'cec-2020-party-list-person-dffc0223bb2668cd', '台灣民眾黨', '台灣民眾黨', 15, 22, '端木正', 'male', '1970-01-23', '590123', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:23:陳安芃:700105', 'cec-2020-party-list-person-d4e9c7f38b02f30a', '台灣民眾黨', '台灣民眾黨', 15, 23, '陳安芃', 'female', '1981-01-05', '700105', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:24:何松穎:701025', 'cec-2020-party-list-person-253dd7cf51002e23', '台灣民眾黨', '台灣民眾黨', 15, 24, '何松穎', 'male', '1981-10-25', '701025', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:25:吳靜怡:730908', 'cec-2020-party-list-person-c5dddaaae142e020', '台灣民眾黨', '台灣民眾黨', 15, 25, '吳靜怡', 'female', '1984-09-08', '730908', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:26:李家齊:800528', 'cec-2020-party-list-person-e61ed635ee4703ae', '台灣民眾黨', '台灣民眾黨', 15, 26, '李家齊', 'male', '1991-05-28', '800528', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:27:周芳如:550328', 'cec-2020-party-list-person-7205538da9b19ce1', '台灣民眾黨', '台灣民眾黨', 15, 27, '周芳如', 'female', '1966-03-28', '550328', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣民眾黨:28:張學瀚:801127', 'cec-2020-party-list-person-c2d12a17253e3ffd', '台灣民眾黨', '台灣民眾黨', 15, 28, '張學瀚', 'male', '1991-11-27', '801127', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣維新:1:賀德芬:340526', 'cec-2020-party-list-person-cdd387ce6d986105', '台灣維新', '台灣維新', 16, 1, '賀德芬', 'female', '1945-05-26', '340526', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣維新:2:萬淑娟:530101', 'cec-2020-party-list-person-7e7c75f3edbbc056', '台灣維新', '台灣維新', 16, 2, '萬淑娟', 'female', '1964-01-01', '530101', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣維新:3:曾吉郎:470410', 'cec-2020-party-list-person-d7f35c8a975e4d3f', '台灣維新', '台灣維新', 16, 3, '曾吉郎', 'male', '1958-04-10', '470410', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣維新:4:蔡惠蘭:620702', 'cec-2020-party-list-person-3ef1d614a2f81a89', '台灣維新', '台灣維新', 16, 4, '蔡惠蘭', 'female', '1973-07-02', '620702', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣維新:5:詹昭能:490410', 'cec-2020-party-list-person-fb11a529f407b3f7', '台灣維新', '台灣維新', 16, 5, '詹昭能', 'male', '1960-04-10', '490410', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣維新:6:蘇煥智:450720', 'cec-2020-party-list-person-ac0fec47da556350', '台灣維新', '台灣維新', 16, 6, '蘇煥智', 'male', '1956-07-20', '450720', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台澎黨:1:鄭自才:251201', 'cec-2020-party-list-person-d8e1affee23f3646', '台澎黨', '台澎黨', 17, 1, '鄭自才', 'male', '1936-12-01', '251201', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台澎黨:2:黃聖峰:680630', 'cec-2020-party-list-person-f1bb1e62c8c8e79f', '台澎黨', '台澎黨', 17, 2, '黃聖峰', 'male', '1979-06-30', '680630', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台澎黨:3:楊神龍:370106', 'cec-2020-party-list-person-517b9a9bf237d7f6', '台澎黨', '台澎黨', 17, 3, '楊神龍', 'male', '1948-01-06', '370106', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台澎黨:4:林碧如:621220', 'cec-2020-party-list-person-c37d165ffe253ab4', '台澎黨', '台澎黨', 17, 4, '林碧如', 'female', '1973-12-20', '621220', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:國會政黨聯盟:1:徐欣瑩:610423', 'cec-2020-party-list-person-f7de6ddf8dc3c1fe', '國會政黨聯盟', '國會政黨聯盟', 18, 1, '徐欣瑩', 'female', '1972-04-23', '610423', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:國會政黨聯盟:2:張宗傑:540204', 'cec-2020-party-list-person-b9270de8ad14c3a7', '國會政黨聯盟', '國會政黨聯盟', 18, 2, '張宗傑', 'male', '1965-02-04', '540204', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:國會政黨聯盟:3:王靜亞:621014', 'cec-2020-party-list-person-4b4126b0394c9ba8', '國會政黨聯盟', '國會政黨聯盟', 18, 3, '王靜亞', 'female', '1973-10-14', '621014', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:國會政黨聯盟:4:陳漢洲:440121', 'cec-2020-party-list-person-3b65ecd7b1e380ef', '國會政黨聯盟', '國會政黨聯盟', 18, 4, '陳漢洲', 'male', '1955-01-21', '440121', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:國會政黨聯盟:5:李宗芹:441007', 'cec-2020-party-list-person-c92b0350bb2596bf', '國會政黨聯盟', '國會政黨聯盟', 18, 5, '李宗芹', 'female', '1955-10-07', '441007', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:國會政黨聯盟:6:余艇:430827', 'cec-2020-party-list-person-da7ba4bfbcdc8669', '國會政黨聯盟', '國會政黨聯盟', 18, 6, '余艇', 'male', '1954-08-27', '430827', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣團結聯盟:1:潘建志:550730', 'cec-2020-party-list-person-2c225e9c4e5c1c22', '台灣團結聯盟', '台聯黨', 19, 1, '潘建志', 'male', '1966-07-30', '550730', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣團結聯盟:2:周倪安:611007', 'cec-2020-party-list-person-3517dda09bb2d6e7', '台灣團結聯盟', '台聯黨', 19, 2, '周倪安', 'female', '1972-10-07', '611007', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣團結聯盟:3:劉一德:490415', 'cec-2020-party-list-person-e9125c401d391075', '台灣團結聯盟', '台聯黨', 19, 3, '劉一德', 'male', '1960-04-15', '490415', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣團結聯盟:4:蔡以新:640923', 'cec-2020-party-list-person-5b97b98d86329cb8', '台灣團結聯盟', '台聯黨', 19, 4, '蔡以新', 'female', '1975-09-23', '640923', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣團結聯盟:5:潘厚勳:700416', 'cec-2020-party-list-person-59fdad5d54826443', '台灣團結聯盟', '台聯黨', 19, 5, '潘厚勳', 'male', '1981-04-16', '700416', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣團結聯盟:6:歐陽瑞蓮:650226', 'cec-2020-party-list-person-7076eb54e57f4f5f', '台灣團結聯盟', '台聯黨', 19, 6, '歐陽瑞蓮', 'female', '1976-02-26', '650226', FALSE),
    ('cec-2020-bulletin:L4:全國不分區:台灣團結聯盟:7:高基讚:461113', 'cec-2020-party-list-person-80a1f3b6d9652296', '台灣團結聯盟', '台聯黨', 19, 7, '高基讚', 'male', '1957-11-13', '461113', FALSE);

DO $$
DECLARE
  result_count INTEGER; roster_count INTEGER; party_count INTEGER;
  vote_total BIGINT; seat_total INTEGER; elected_count INTEGER;
  female_count INTEGER; male_count INTEGER;
  elected_female_count INTEGER; elected_male_count INTEGER;
BEGIN
  SELECT COUNT(*), SUM(vote_count), SUM(allocated_seats)
  INTO result_count, vote_total, seat_total FROM _party_list_2020_results;
  SELECT COUNT(*), COUNT(DISTINCT party), COUNT(*) FILTER (WHERE elected),
         COUNT(*) FILTER (WHERE gender = 'female'), COUNT(*) FILTER (WHERE gender = 'male'),
         COUNT(*) FILTER (WHERE elected AND gender = 'female'),
         COUNT(*) FILTER (WHERE elected AND gender = 'male')
  INTO roster_count, party_count, elected_count, female_count, male_count,
       elected_female_count, elected_male_count
  FROM _party_list_2020_roster;
  IF result_count <> 19 OR roster_count <> 216 OR party_count <> 19
     OR vote_total <> 14160138 OR seat_total <> 34 OR elected_count <> 34
     OR female_count <> 109 OR male_count <> 107
     OR elected_female_count <> 19 OR elected_male_count <> 15 THEN
    RAISE EXCEPTION 'Unexpected CEC 2020 party-list data: results %, roster %, parties %, votes %, seats %, elected %, female %, male %, elected female %, elected male %',
      result_count, roster_count, party_count, vote_total, seat_total, elected_count,
      female_count, male_count, elected_female_count, elected_male_count;
  END IF;
END;
$$;

DO $$
DECLARE missing_parties TEXT;
BEGIN
  SELECT STRING_AGG(result.canonical_party, ', ' ORDER BY result.party_no)
  INTO missing_parties
  FROM _party_list_2020_results result
  LEFT JOIN public.parties party
    ON REPLACE(party.name, '臺', '台') = result.canonical_party
  WHERE party.id IS NULL;
  IF missing_parties IS NOT NULL THEN
    RAISE EXCEPTION 'Missing canonical party rows: %', missing_parties;
  END IF;
END;
$$;

INSERT INTO public.races (
  id, election_id, region_id, race_type, title, voting_date, status,
  source_name, source_url, is_public, external_id, district_scope, seat_count
)
SELECT
  '19c67780-237b-5f4f-9d2c-5b0dfa4920f1'::UUID,
  election.id,
  region.id,
  'party_list_legislator',
  '全國不分區及僑居國外國民立法委員選舉',
  DATE '2020-01-11',
  'completed',
  '中央選舉委員會：第10屆全國不分區及僑居國外國民立法委員選舉公報',
  'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/02%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/109%E5%B9%B4%E7%AC%AC10%E5%B1%86/03%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E5%8F%8A%E5%83%91%E5%B1%85%E5%9C%8B%E5%A4%96%E5%9C%8B%E6%B0%91%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1%E9%81%B8%E8%88%89%20.pdf',
  TRUE,
  'cec-2020-legislative-party-list',
  '全國不分區及僑居國外國民',
  34
FROM public.elections election
CROSS JOIN public.regions region
WHERE election.external_id = 'votetw-election-2020-1654535a43'
  AND region.external_id = 'tw'
ON CONFLICT (external_id) DO UPDATE SET
  election_id = EXCLUDED.election_id,
  region_id = EXCLUDED.region_id,
  race_type = EXCLUDED.race_type,
  title = EXCLUDED.title,
  voting_date = EXCLUDED.voting_date,
  status = EXCLUDED.status,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  is_public = TRUE,
  district_scope = EXCLUDED.district_scope,
  seat_count = EXCLUDED.seat_count,
  updated_at = NOW();

CREATE TEMP TABLE _party_list_2020_people (
  external_id TEXT PRIMARY KEY,
  person_id UUID NOT NULL
) ON COMMIT DROP;

WITH matches AS (
  SELECT roster.external_id, person_map.canonical_person_id AS person_id, 1 AS priority
  FROM _party_list_2020_roster roster
  JOIN public.candidates candidate ON candidate.external_id = roster.external_id
  JOIN public.person_canonical_map person_map ON person_map.person_id = candidate.person_id
  UNION
  SELECT roster.external_id, person_map.canonical_person_id, 2
  FROM _party_list_2020_roster roster
  JOIN public.person_claims claim
    ON claim.claim_type = 'external_id'
   AND COALESCE(claim.claim_value, claim.claim_json->>'officialExternalId') = roster.external_id
   AND claim.review_status = 'verified'
  JOIN public.person_canonical_map person_map ON person_map.person_id = claim.person_id
  UNION
  SELECT roster.external_id, person_map.canonical_person_id, 3
  FROM _party_list_2020_roster roster
  JOIN public.people person
    ON REGEXP_REPLACE(REPLACE(person.name, '臺', '台'), '[[:space:]．・‧·]', '', 'g')
     = REGEXP_REPLACE(REPLACE(roster.person_name, '臺', '台'), '[[:space:]．・‧·]', '', 'g')
   AND REPLACE(COALESCE(person.party, ''), '臺', '台') IN (roster.party, roster.canonical_party)
  JOIN public.person_canonical_map person_map ON person_map.person_id = person.id
), deduplicated AS (
  SELECT DISTINCT external_id, person_id, priority FROM matches
), ranked AS (
  SELECT match.*, MIN(priority) OVER (PARTITION BY external_id) AS best_priority
  FROM deduplicated match
)
INSERT INTO _party_list_2020_people
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
  roster.person_name, roster.party, '2020年第10屆不分區立法委員候選人',
  2020, '全國不分區及僑居國外國民', 'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/02%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/109%E5%B9%B4%E7%AC%AC10%E5%B1%86/03%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E5%8F%8A%E5%83%91%E5%B1%85%E5%9C%8B%E5%A4%96%E5%9C%8B%E6%B0%91%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1%E9%81%B8%E8%88%89%20.pdf',
  TRUE, roster.person_external_id, roster.gender, NOW()
FROM _party_list_2020_roster roster
LEFT JOIN _party_list_2020_people resolved USING (external_id)
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

INSERT INTO _party_list_2020_people
SELECT roster.external_id, person.id
FROM _party_list_2020_roster roster
JOIN public.people person ON person.external_id = roster.person_external_id
ON CONFLICT (external_id) DO NOTHING;

DO $$
DECLARE resolved_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO resolved_count FROM _party_list_2020_people;
  IF resolved_count <> 216 THEN
    RAISE EXCEPTION 'Expected 216 resolved identities, found %', resolved_count;
  END IF;
END;
$$;

UPDATE public.people person SET
  is_public = TRUE,
  gender = CASE WHEN person.gender = 'unknown' THEN roster.gender ELSE person.gender END,
  source_url = COALESCE(person.source_url, 'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/02%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/109%E5%B9%B4%E7%AC%AC10%E5%B1%86/03%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E5%8F%8A%E5%83%91%E5%B1%85%E5%9C%8B%E5%A4%96%E5%9C%8B%E6%B0%91%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1%E9%81%B8%E8%88%89%20.pdf'),
  updated_at = NOW()
FROM _party_list_2020_roster roster
JOIN _party_list_2020_people resolved USING (external_id)
WHERE person.id = resolved.person_id;

UPDATE public.candidates candidate SET
  party = roster.party,
  candidate_no = roster.candidate_no::TEXT,
  registration_status = CASE WHEN roster.elected THEN 'elected' ELSE 'not_elected' END,
  source_name = '中央選舉委員會：第10屆全國不分區及僑居國外國民立法委員選舉公報',
  source_url = 'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/02%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/109%E5%B9%B4%E7%AC%AC10%E5%B1%86/03%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E5%8F%8A%E5%83%91%E5%B1%85%E5%9C%8B%E5%A4%96%E5%9C%8B%E6%B0%91%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1%E9%81%B8%E8%88%89%20.pdf',
  is_public = TRUE,
  external_id = roster.external_id,
  is_elected = roster.elected,
  candidacy_status = 'qualified',
  election_result = CASE WHEN roster.elected THEN 'elected' ELSE 'not_elected' END,
  status_updated_at = NOW(),
  updated_at = NOW()
FROM _party_list_2020_roster roster
JOIN _party_list_2020_people resolved USING (external_id)
JOIN public.races race ON race.external_id = 'cec-2020-legislative-party-list'
WHERE candidate.race_id = race.id AND candidate.person_id = resolved.person_id;

INSERT INTO public.candidates (
  person_id, race_id, party, candidate_no, registration_status,
  source_name, source_url, is_public, external_id, is_elected,
  candidacy_status, election_result, status_updated_at
)
SELECT
  resolved.person_id, race.id, roster.party, roster.candidate_no::TEXT,
  CASE WHEN roster.elected THEN 'elected' ELSE 'not_elected' END,
  '中央選舉委員會：第10屆全國不分區及僑居國外國民立法委員選舉公報',
  'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/02%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/109%E5%B9%B4%E7%AC%AC10%E5%B1%86/03%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E5%8F%8A%E5%83%91%E5%B1%85%E5%9C%8B%E5%A4%96%E5%9C%8B%E6%B0%91%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1%E9%81%B8%E8%88%89%20.pdf', TRUE, roster.external_id, roster.elected, 'qualified',
  CASE WHEN roster.elected THEN 'elected' ELSE 'not_elected' END, NOW()
FROM _party_list_2020_roster roster
JOIN _party_list_2020_people resolved USING (external_id)
JOIN public.races race ON race.external_id = 'cec-2020-legislative-party-list'
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

INSERT INTO public.party_list_race_results (
  race_id, party_id, party_ballot_number, party_name_at_election,
  candidate_party_name, vote_count, allocated_seats, source_name,
  source_url, platform_source_url, is_public
)
SELECT
  race.id, party.id, result.party_no, result.party, result.canonical_party,
  result.vote_count, result.allocated_seats, '中央選舉委員會選舉資料庫',
  'https://db.cec.gov.tw/ElecTable/Election/ElecTickets?areaCode=00&cityCode=000&dataLevel=N&dataType=tickets&deptCode=000&legisId=L4&liCode=0000&prvCode=00&subjectId=L0&themeId=e002307160cbb898376da0c9cbb9ba16&typeId=ELC', 'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/02%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/109%E5%B9%B4%E7%AC%AC10%E5%B1%86/03%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E5%8F%8A%E5%83%91%E5%B1%85%E5%9C%8B%E5%A4%96%E5%9C%8B%E6%B0%91%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1%E9%81%B8%E8%88%89%20.pdf', TRUE
FROM _party_list_2020_results result
JOIN public.races race ON race.external_id = 'cec-2020-legislative-party-list'
JOIN public.parties party ON REPLACE(party.name, '臺', '台') = result.canonical_party
ON CONFLICT (race_id, party_id) DO UPDATE SET
  party_ballot_number = EXCLUDED.party_ballot_number,
  party_name_at_election = EXCLUDED.party_name_at_election,
  candidate_party_name = EXCLUDED.candidate_party_name,
  vote_count = EXCLUDED.vote_count,
  allocated_seats = EXCLUDED.allocated_seats,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  platform_source_url = EXCLUDED.platform_source_url,
  is_public = TRUE,
  updated_at = NOW();

DO $$
DECLARE candidate_count INTEGER; elected_count INTEGER;
  result_count INTEGER; vote_total BIGINT; seat_total INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE candidate.is_elected)
  INTO candidate_count, elected_count
  FROM public.candidates candidate
  JOIN public.races race ON race.id = candidate.race_id
  WHERE race.external_id = 'cec-2020-legislative-party-list' AND candidate.is_public;
  SELECT COUNT(*), SUM(result.vote_count), SUM(result.allocated_seats)
  INTO result_count, vote_total, seat_total
  FROM public.party_list_race_results result
  JOIN public.races race ON race.id = result.race_id
  WHERE race.external_id = 'cec-2020-legislative-party-list' AND result.is_public;
  IF candidate_count <> 216 OR elected_count <> 34 OR result_count <> 19
     OR vote_total <> 14160138 OR seat_total <> 34 THEN
    RAISE EXCEPTION 'Unexpected stored 2020 party-list result: candidates %, elected %, parties %, votes %, seats %',
      candidate_count, elected_count, result_count, vote_total, seat_total;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM _party_list_2020_results source
    LEFT JOIN public.candidates candidate
      ON candidate.race_id = (
        SELECT race.id FROM public.races race
        WHERE race.external_id = 'cec-2020-legislative-party-list'
      )
     AND candidate.party = source.canonical_party
     AND candidate.is_public
    GROUP BY source.party, source.canonical_party
    HAVING COUNT(candidate.id) <> (
      SELECT COUNT(*) FROM _party_list_2020_roster roster
      WHERE roster.party = source.party
    )
  ) THEN
    RAISE EXCEPTION 'At least one 2020 party-list result is not linked to its complete roster';
  END IF;
END;
$$;

SELECT published.promote(NULL);

DO $$
DECLARE published_count INTEGER; published_elected_count INTEGER;
  payload JSONB;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE candidate.is_elected)
  INTO published_count, published_elected_count
  FROM published.candidates candidate
  WHERE candidate.race_id = '19c67780-237b-5f4f-9d2c-5b0dfa4920f1'::UUID;
  SELECT page.payload INTO payload
  FROM published.party_list_race_page_for('19c67780-237b-5f4f-9d2c-5b0dfa4920f1'::UUID) page;
  IF published_count <> 216 OR published_elected_count <> 34 THEN
    RAISE EXCEPTION 'Unexpected published 2020 party-list candidates: candidates %, elected %',
      published_count, published_elected_count;
  END IF;
  IF JSONB_ARRAY_LENGTH(COALESCE(payload->'party_list_result_rows', '[]'::JSONB)) <> 19
     OR JSONB_ARRAY_LENGTH(COALESCE(payload->'candidate_rows', '[]'::JSONB)) <> 216 THEN
    RAISE EXCEPTION 'Unexpected 2020 party-list page payload counts';
  END IF;
END;
$$;

COMMIT;
