CREATE TEMP TABLE _current_councilor_official_profiles_batch_6 (
    person_external_id TEXT PRIMARY KEY,
    person_name TEXT NOT NULL,
    source_person_key TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    external_record_id TEXT NOT NULL,
    position TEXT NOT NULL,
    district TEXT NOT NULL,
    education TEXT,
    education_claim_key TEXT,
    experience TEXT,
    experience_claim_key TEXT
) ON COMMIT DROP;

INSERT INTO _current_councilor_official_profiles_batch_6 VALUES
    ('cec-2022-local-councilor-regional-person-9c23872ca20c', '張維心', 'yunlin-county-council-current-councilors:current-councilor-db08ae19769e', 'yunlin-county-council-current-councilors', '雲林縣議會：議員列表', 'https://www.ylcc.gov.tw/Congress_Detail.aspx?n=22127&sms=21659&s=514142', 'current-councilor-db08ae19769e', '雲林縣議員', '雲林縣', '大葉大學環境工程系', 'official-profile:yunlin-county-council-current-councilors:0557b7a7dd9b:33ca0598-bcf0-45dd-9181-b1ede13c437e:education', '土庫鎮民代表會第21 屆主席', 'official-profile:yunlin-county-council-current-councilors:0557b7a7dd9b:33ca0598-bcf0-45dd-9181-b1ede13c437e:experience'),
    ('cec-2022-local-councilor-regional-person-4ada0ec1087c', '張維崢', 'yunlin-county-council-current-councilors:current-councilor-3bf799c7f64c', 'yunlin-county-council-current-councilors', '雲林縣議會：議員列表', 'https://www.ylcc.gov.tw/Congress_Detail.aspx?n=22127&sms=21659&s=514106', 'current-councilor-3bf799c7f64c', '雲林縣議員', '雲林縣', '環球科技大學公共事務管理研究所碩士畢業', 'official-profile:yunlin-county-council-current-councilors:48ec617c73ed:523e0ac5-9ee1-483d-a116-5fbd930a0fbd:education', '林內鄉第17、18 屆郷長
林內鄉民代表會第19 屆副主席
林內鄉民代表會第18 屆代表
立法委員劉建國總服務處主任
國際同濟會紫斑蝶會創會長
民進黨全國黨代表
林內國小家長會長
林內消防隊義消顧問
雲林縣社會關懷協會顧問
財團法人雲林縣崇德順心社會福利基金會', 'official-profile:yunlin-county-council-current-councilors:48ec617c73ed:523e0ac5-9ee1-483d-a116-5fbd930a0fbd:experience'),
    ('cec-2022-local-councilor-regional-person-981efc1b120f', '陳永修', 'yunlin-county-council-current-councilors:current-councilor-9d41e65fc33a', 'yunlin-county-council-current-councilors', '雲林縣議會：議員列表', 'https://www.ylcc.gov.tw/Congress_Detail.aspx?n=22127&sms=21659&s=514108', 'current-councilor-9d41e65fc33a', '雲林縣議員', '雲林縣', '鎮西國小
雲林國中
仁德醫護管理專科學校', 'official-profile:yunlin-county-council-current-councilors:24c475d14312:f299a2e4-aea1-4124-9f38-cb6ca9d0893a:education', '斗六市民代表會第11 屆代表
雲林縣警察之友會斗六辦事處－副主任
斗六民眾服務社－理事長
雲林縣莿桐國際青年商會－副會長
斗六市鎮西國小家長委員會－副會長
斗六市鎮西國小校友會－理事
斗六市雲林國中校友會－常務監事
中華民國雲林同鄉總會第10 屆－會員代表
雲林縣軍人服務站－榮譽顧問', 'official-profile:yunlin-county-council-current-councilors:24c475d14312:f299a2e4-aea1-4124-9f38-cb6ca9d0893a:experience'),
    ('cec-2022-local-councilor-regional-person-be577dc123dc', '曾博鴻', 'yunlin-county-council-current-councilors:current-councilor-4fa645ad8b63', 'yunlin-county-council-current-councilors', '雲林縣議會：議員列表', 'https://www.ylcc.gov.tw/Congress_Detail.aspx?n=22127&sms=21659&s=514122', 'current-councilor-4fa645ad8b63', '雲林縣議員', '雲林縣', '斗六市久安國民小學
雲林縣立雲林國民中學
西螺高級農工職業學校
私立親民工商專校進修
部企管科畢業', 'official-profile:yunlin-county-council-current-councilors:596f25c58bef:faf69b76-ea68-4b3b-9065-7591f54f6927:education', '立法委員劉建國服務團隊秘書
斗六市民代表會第10、11 屆代表
雲林國中校友會理事
關懷善之路志工團隊
斗六新興宮總務組長', 'official-profile:yunlin-county-council-current-councilors:596f25c58bef:faf69b76-ea68-4b3b-9065-7591f54f6927:experience'),
    ('cec-2022-local-councilor-regional-person-871a85a33d07', '蔡永富', 'yunlin-county-council-current-councilors:current-councilor-dab69c86957f', 'yunlin-county-council-current-councilors', '雲林縣議會：議員列表', 'https://www.ylcc.gov.tw/Congress_Detail.aspx?n=22127&sms=21659&s=514102', 'current-councilor-dab69c86957f', '雲林縣議員', '雲林縣', '台北市中山區國小
台北市立大直高級中學', 'official-profile:yunlin-county-council-current-councilors:36888e26c8a8:74ac42ee-1750-47a6-aa1e-d82a9c3f65e1:education', '台灣苦茶油產業發展策進會理事長
台灣更生保護會台北分會委員
雲林縣警察之友會斗南辦事處顧問
雲林同鄉會顧問
麥寮巡守隊顧問
雲林台西獅子會會員', 'official-profile:yunlin-county-council-current-councilors:36888e26c8a8:74ac42ee-1750-47a6-aa1e-d82a9c3f65e1:experience'),
    ('cec-2022-local-councilor-regional-person-6a38dd3441eb', '蔡咏鍀', 'yunlin-county-council-current-councilors:current-councilor-6e0ae8fca08c', 'yunlin-county-council-current-councilors', '雲林縣議會：議員列表', 'https://www.ylcc.gov.tw/Congress_Detail.aspx?n=22127&sms=21659&s=514068', 'current-councilor-6e0ae8fca08c', '雲林縣議員', '雲林縣', '高中畢業', 'official-profile:yunlin-county-council-current-councilors:ba987ac9adcd:7fd666f2-3ef8-4732-ad57-7d5f7b233d8b:education', '北港朝天宮第 9、10 屆董事長
北港鎮民代表會第 17、18、19、20、
21 屆主席
臺灣鄉鎮市民代表會聯合總會第 3、4、5 屆
總會長
曾任北港柯蔡宗親會理事長', 'official-profile:yunlin-county-council-current-councilors:ba987ac9adcd:7fd666f2-3ef8-4732-ad57-7d5f7b233d8b:experience'),
    ('cec-2022-local-councilor-regional-person-e1854a04867f', '鄭玲惠', 'yunlin-county-council-current-councilors:current-councilor-63e1b371cd7d', 'yunlin-county-council-current-councilors', '雲林縣議會：議員列表', 'https://www.ylcc.gov.tw/Congress_Detail.aspx?n=22127&sms=21659&s=514104', 'current-councilor-63e1b371cd7d', '雲林縣議員', '雲林縣', '高中', 'official-profile:yunlin-county-council-current-councilors:b6a9db627dc4:29b6717c-e365-413f-997d-24c632e1dd41:education', '西螺鎮第 17、18 屆鎮長
雲林縣議會第 16、17 屆縣議員
西螺鎮民代表會第 17 屆副主席
雲林水利會直選第 3 屆會務委員', 'official-profile:yunlin-county-council-current-councilors:b6a9db627dc4:29b6717c-e365-413f-997d-24c632e1dd41:experience'),
    ('cec-2022-local-councilor-regional-person-4652a0e21eec', '蘇國瓏', 'yunlin-county-council-current-councilors:current-councilor-23c462ec8f50', 'yunlin-county-council-current-councilors', '雲林縣議會：議員列表', 'https://www.ylcc.gov.tw/Congress_Detail.aspx?n=22127&sms=21659&s=514148', 'current-councilor-23c462ec8f50', '雲林縣議員', '雲林縣', '四湖鄉三崙國小
北港鎮建國國中
雲林縣宗聖家事商業
職業學校
環球科技大學附設專
科進修學校', 'official-profile:yunlin-county-council-current-councilors:ce0f87951bc7:6961e654-1bdf-4e58-a029-5eba32a62604:education', '四湖鄉第 17、18 屆鄉長
四湖鄉民代表會第 19 屆主席
四湖鄉崙北社區發展協會理事長
四湖鄉老人照護協會理事長', 'official-profile:yunlin-county-council-current-councilors:ce0f87951bc7:6961e654-1bdf-4e58-a029-5eba32a62604:experience'),
    ('cec-2022-local-councilor-regional-person-7567eba5d616', '林文彬', 'yunlin-county-council-current-councilors:current-councilor-f21956d3b5c8', 'yunlin-county-council-current-councilors', '雲林縣議會：議員列表', 'https://www.ylcc.gov.tw/Congress_Detail.aspx?n=22127&sms=21659&s=514111', 'current-councilor-f21956d3b5c8', '雲林縣議員', '雲林縣', NULL, NULL, '雲林縣議會第19 屆縣議員
本縣林姓宗親會及台語文研究學會理事長
電台政論主持
虎尾青商、魯班、福田慈善會、魅力商圈、同心獅、ｅ世紀顧問
虎尾鎮第16、17 屆鎮長（獲頒台灣城鎮品牌獎）
虎尾鎮民代表、虎尾鎮里長、企業經營、都計委員
本縣社區童軍及中小企業榮協會理事長、虎科大、環科大、社大、空大講師，著作6 冊，欣獲縣文學獎、惠風獎', 'official-profile:yunlin-county-council-current-councilors:8436ec695982:cff2ba67-5a8e-46ca-acb8-3bc6a998eda0:experience'),
    ('cec-2022-local-councilor-regional-person-3c9572c4c8c0', '張庭綺', 'yunlin-county-council-current-councilors:current-councilor-2fd5ef9bfa24', 'yunlin-county-council-current-councilors', '雲林縣議會：議員列表', 'https://www.ylcc.gov.tw/Congress_Detail.aspx?n=22127&sms=21659&s=514121', 'current-councilor-2fd5ef9bfa24', '雲林縣議員', '雲林縣', NULL, NULL, '雲林縣議會第19 屆議員', 'official-profile:yunlin-county-council-current-councilors:a79dc1770287:e6ec7cbb-9faa-49ad-ab07-562875630df6:experience'),
    ('cec-2022-local-councilor-regional-person-add52a0c5644', '簡慈坊', 'yunlin-county-council-current-councilors:current-councilor-056d9c503f2f', 'yunlin-county-council-current-councilors', '雲林縣議會：議員列表', 'https://www.ylcc.gov.tw/Congress_Detail.aspx?n=22127&sms=21659&s=514124', 'current-councilor-056d9c503f2f', '雲林縣議員', '雲林縣', '石龜國小
東明國中
嶺東商專商業設計科
台灣大學哲學系', 'official-profile:yunlin-county-council-current-councilors:a531b20e162f:64a83ca4-c4dc-4d53-87e0-68afb5450b89:education', NULL, NULL),
    ('cec-2022-local-councilor-regional-person-4e1d9b131fb5', '顏忠義', 'yunlin-county-council-current-councilors:current-councilor-2cfff6ab7332', 'yunlin-county-council-current-councilors', '雲林縣議會：議員列表', 'https://www.ylcc.gov.tw/Congress_Detail.aspx?n=22127&sms=21659&s=514105', 'current-councilor-2cfff6ab7332', '雲林縣議員', '雲林縣', NULL, NULL, '雲林縣議會第19 屆縣議員
雲林縣恩主公慈善會創會長
雲林縣斗南鎮代表會第20 屆代表', 'official-profile:yunlin-county-council-current-councilors:f66e1637ed7f:453b27b6-3568-464f-bd82-e5bb26305e81:experience'),
    ('cec-2022-local-councilor-mountain-indigenous-person-b68ade476665', '張利惠', 'pingtung-county-council-current-councilors:current-councilor-c4ea2cff1c33', 'pingtung-county-council-current-councilors', '屏東縣議會：議員介紹', 'https://www.ptcc.gov.tw/?Page=PersionalDetail&Guid=2a95fd9a-e28a-a777-fdbf-86741512e7fd', 'current-councilor-c4ea2cff1c33', '屏東縣議員', '屏東縣三地門鄉', '和春技術學院二年制專科班', 'official-profile:pingtung-county-council-current-councilors:80abba00fb33:2a832c59-3ca0-40be-a0bf-676413893436:education', '三地門鄉民代表會第19~21屆代表
二屆三地門鄉婦女會長
二屆青葉村社區發展協會理事長
現任中國國民黨黨代表', 'official-profile:pingtung-county-council-current-councilors:80abba00fb33:2a832c59-3ca0-40be-a0bf-676413893436:experience'),
    ('cec-2022-local-councilor-regional-person-f198d000e1e1', '黃盈裕', 'pingtung-county-council-current-councilors:current-councilor-ee700a548a5a', 'pingtung-county-council-current-councilors', '屏東縣議會：議員介紹', 'https://www.ptcc.gov.tw/?Page=PersionalDetail&Guid=e442379c-ab46-15d7-410b-c110cfdf1660', 'current-councilor-ee700a548a5a', '屏東縣議員', '屏東縣崁頂鄉、南州鄉、林邊鄉、佳冬鄉', '正修科技大學經營管理研究所畢業', 'official-profile:pingtung-county-council-current-councilors:5a68db673da5:3dc73701-79c9-4a2d-9643-194766ee5fd2:education', '南州鄉第17、18屆鄉長
南州鄉第19屆鄉民代表', 'official-profile:pingtung-county-council-current-councilors:5a68db673da5:3dc73701-79c9-4a2d-9643-194766ee5fd2:experience'),
    ('cec-2022-local-councilor-regional-person-96589a445c94', '蘇資婷', 'pingtung-county-council-current-councilors:current-councilor-d39a07f2053f', 'pingtung-county-council-current-councilors', '屏東縣議會：議員介紹', 'https://www.ptcc.gov.tw/?Page=PersionalDetail&Guid=22f124cf-01fd-75ef-0fbf-a755da4d6269', 'current-councilor-d39a07f2053f', '屏東縣議員', '屏東縣屏東市', '大仁科技大學', 'official-profile:pingtung-county-council-current-councilors:9e8550298684:0e026ce5-164a-4d37-8964-b10f0fe757a2:education', '國民黨屏東縣黨部主任
屏東市民眾服務社理事長
屏東市民代表', 'official-profile:pingtung-county-council-current-councilors:9e8550298684:0e026ce5-164a-4d37-8964-b10f0fe757a2:experience'),
    ('cec-2022-local-councilor-regional-person-632c9fa4fa9a', '張榮志', 'pingtung-county-council-current-councilors:current-councilor-db6c3d712f62', 'pingtung-county-council-current-councilors', '屏東縣議會：議員介紹', 'https://www.ptcc.gov.tw/?Page=PersionalDetail&Guid=a07de0ad-0469-9748-abbd-160a47cc2fe3', 'current-councilor-db6c3d712f62', '屏東縣議員', '屏東縣枋山鄉、車城鄉、恆春鎮、滿州鄉', '屏東永達技術學院', 'official-profile:pingtung-county-council-current-councilors:ba1e99400eec:c1a57dbb-ee45-4956-8d7a-b4b3fb43f4b4:education', NULL, NULL),
    ('cec-2022-local-councilor-regional-person-6b6f4c37e986', '陳志成', 'pingtung-county-council-current-councilors:current-councilor-f0568fc94f35', 'pingtung-county-council-current-councilors', '屏東縣議會：議員介紹', 'https://www.ptcc.gov.tw/?Page=PersionalDetail&Guid=20aa8db9-c27f-2dae-fae8-ed493666d396', 'current-councilor-f0568fc94f35', '屏東縣議員', '屏東縣內埔鄉、竹田鄉、萬巒鄉、潮州鎮、新埤鄉、枋寮鄉', NULL, NULL, '屏東縣第18~19屆縣議員
第17屆枋寮區漁會理事長
第13屆財團法人屏東縣北勢寮保安宮董事長
枋寮鄉調解委員會主席', 'official-profile:pingtung-county-council-current-councilors:d8b1c4aa3306:9ccc96ff-0d3c-4d4d-8103-dbd3306b4bc0:experience'),
    ('cec-2022-local-councilor-regional-person-59153d7cdc6d', '陳揚', 'pingtung-county-council-current-councilors:current-councilor-cfb791c0c4ce', 'pingtung-county-council-current-councilors', '屏東縣議會：議員介紹', 'https://www.ptcc.gov.tw/?Page=PersionalDetail&Guid=0709d2df-6534-aabc-c7dd-de9981e8f893', 'current-councilor-cfb791c0c4ce', '屏東縣議員', '屏東縣屏東市', NULL, NULL, '屏東縣第19屆縣議員
屏東市公所新聞聯絡人
屏東小鎮資訊主播
全國青工總會副祕書', 'official-profile:pingtung-county-council-current-councilors:2e2b01887eec:7b74d56f-543b-46d9-828c-8e98593c86e8:experience'),
    ('votetw-person-4c56a7066af2c726', '黃明賢', 'pingtung-county-council-current-councilors:current-councilor-d5c5393a709a', 'pingtung-county-council-current-councilors', '屏東縣議會：議員介紹', 'https://www.ptcc.gov.tw/?Page=PersionalDetail&Guid=ec54f869-d4f6-ae77-67df-410fd597b00b', 'current-councilor-d5c5393a709a', '屏東縣議員', '屏東縣屏東市', NULL, NULL, '屏東縣第19屆縣議員
中國國民黨中央委員', 'official-profile:pingtung-county-council-current-councilors:fc8b3bae5b1e:080d4881-c084-4e37-99da-acbe111afc05:experience'),
    ('votetw-person-38fcd1199df7a658', '蔣月惠', 'pingtung-county-council-current-councilors:current-councilor-67410f6002fe', 'pingtung-county-council-current-councilors', '屏東縣議會：議員介紹', 'https://www.ptcc.gov.tw/?Page=PersionalDetail&Guid=5ff9a672-8d77-9059-2e13-952fb588804e', 'current-councilor-67410f6002fe', '屏東縣議員', '屏東縣屏東市', NULL, NULL, '取得日本池坊學派插花教授執照
人際溝通分析學派課程培訓
羅騰園肢體殘障服務協會', 'official-profile:pingtung-county-council-current-councilors:1610adb1f4f9:8b25cd3a-d941-45d4-9744-27d9fcacb73f:experience'),
    ('cec-2022-local-councilor-regional-person-3cd6e78c0552', '許更生', 'taoyuan-city-council-current-councilors:current-councilor-1024', 'taoyuan-city-council-current-councilors', '桃園市議會：現任議員', 'https://www.tycc.gov.tw/TC/councilor-detail.aspx?mid=39&num=1024', 'current-councilor-1024', '桃園市第12區議員', '桃園市第12選舉區', '觀音國小觀音國中啟英高中開南大學', 'official-profile:taoyuan-city-council-current-councilors:01aad8793b04:3f76b81e-016f-4f2b-9f7c-69e700246016:education', '觀音區廣興里里長觀音國小家長會長農委會水利署桃園管理處諮議委員觀音獅子會會長觀音義消中隊顧問', 'official-profile:taoyuan-city-council-current-councilors:01aad8793b04:3f76b81e-016f-4f2b-9f7c-69e700246016:experience'),
    ('cec-2022-local-councilor-regional-person-c0f9c5934f85', '魏筠', 'taoyuan-city-council-current-councilors:current-councilor-1001', 'taoyuan-city-council-current-councilors', '桃園市議會：現任議員', 'https://www.tycc.gov.tw/TC/councilor-detail.aspx?mid=39&num=1001', 'current-councilor-1001', '桃園市第7區議員', '桃園市第7選舉區', '內壢國中武陵高中東吳大學法學院法律學系學士中央大學法律與政府研究所碩士', 'official-profile:taoyuan-city-council-current-councilors:39284da70681:ef7e82c9-d3d9-4ba1-82ca-5638dd00950b:education', '板橋地方法院檢察署書記官新竹地方法院檢察署書記官桃園市政府便民中心副主任桃園市政府社會局非營利組織中心主任民主進步黨中央黨部客家部主任桃園市政府社會局專門委員', 'official-profile:taoyuan-city-council-current-councilors:39284da70681:ef7e82c9-d3d9-4ba1-82ca-5638dd00950b:experience'),
    ('cec-2018-local-councilor-person-plain-indigenous-68000-13-20131', '林志強', 'taoyuan-city-council-current-councilors:current-councilor-1027', 'taoyuan-city-council-current-councilors', '桃園市議會：現任議員', 'https://www.tycc.gov.tw/TC/councilor-detail.aspx?mid=39&num=1027', 'current-councilor-1027', '桃園市第13區平地原住民議員', '桃園市第13選舉區', NULL, NULL, '一、桃園市議會第一、二屆市議員二、桃園市議會 民進黨團副總召、幹事長三、立法委員陳瑩國會辦 公室總督導四、大溪鎮民代表會第17、18、19屆鎮 民代表五、台灣原社副秘書長', 'official-profile:taoyuan-city-council-current-councilors:795195febd58:976c3ad8-57c7-485f-af3e-29e03fdf766f:experience'),
    ('cec-2022-local-councilor-regional-person-5b9c41eab7aa', '徐景文', 'taoyuan-city-council-current-councilors:current-councilor-1009', 'taoyuan-city-council-current-councilors', '桃園市議會：現任議員', 'https://www.tycc.gov.tw/TC/councilor-detail.aspx?mid=39&num=1009', 'current-councilor-1009', '桃園市第7區議員', '桃園市第7選舉區', NULL, NULL, '桃園縣第15、16、17屆縣議員桃園市第2屆市議員中壢青商會會長大內壢國同濟會會長桃園縣棒球委員會主任委員', 'official-profile:taoyuan-city-council-current-councilors:806c037716c1:6d7dd6e7-3964-4d3f-ac3b-9d91fb03594a:experience'),
    ('cec-2022-local-councilor-regional-person-dc60ba251add', '楊朝偉', 'taoyuan-city-council-current-councilors:current-councilor-989', 'taoyuan-city-council-current-councilors', '桃園市議會：現任議員', 'https://www.tycc.gov.tw/TC/councilor-detail.aspx?mid=39&num=989', 'current-councilor-989', '桃園市第3區議員', '桃園市第3選舉區', '僑愛國小桃園國中大華工專淡江大學公共行政系淡江大學管理科學研究所美國曼徹州立大學公共行政管理研究所。', 'official-profile:taoyuan-city-council-current-councilors:738f0a8844f6:58a6e4f8-a174-45dc-adc6-eb6873026a0e:education', NULL, NULL),
    ('cec-2022-local-councilor-plain-indigenous-person-194a03949a7c', '楊進福', 'taoyuan-city-council-current-councilors:current-councilor-1026', 'taoyuan-city-council-current-councilors', '桃園市議會：現任議員', 'https://www.tycc.gov.tw/TC/councilor-detail.aspx?mid=39&num=1026', 'current-councilor-1026', '桃園市第13區平地原住民議員', '桃園市第13選舉區', NULL, NULL, '一.桃園市第一、二市議員第17屆縣議員二.龜山鄉第16、18屆鄉民代表三.銘傳大學公共事務講師四.醒吾科大法律實務講師五.邱正明律師事務所法務助理六.文化大學法研所進修', 'official-profile:taoyuan-city-council-current-councilors:06e71ff98ed2:12c35c7a-3ad4-4e0a-a70e-82d269d3fb8b:experience'),
    ('cec-2018-local-councilor-person-mountain-indigenous-68000-14-20168', '簡志偉', 'taoyuan-city-council-current-councilors:current-councilor-1030', 'taoyuan-city-council-current-councilors', '桃園市議會：現任議員', 'https://www.tycc.gov.tw/TC/councilor-detail.aspx?mid=39&num=1030', 'current-councilor-1030', '桃園市第14區山地原住民議員', '桃園市第14選舉區', NULL, NULL, '桃園市第二屆市議員全國原住民傑出青年國立臺灣師範大學原資中心諮詢委員立法委員國會辦公室主任大紐約地區台灣學生會長駐紐約台北經濟文化辦事處專員聯合國原住民族常設論壇觀察員教育部格大學講師國發展研究院諮詢委員中華人權協會副主委', 'official-profile:taoyuan-city-council-current-councilors:85bcd16a6dba:2163824c-535d-4483-addc-e1a395f8acd0:experience');

INSERT INTO source_people (
    source_person_key, source_type, source_id, source_name, source_url,
    raw_name, normalized_name, position, normalized_role, district,
    normalized_region, external_record_id, source_payload, confidence_suggestion,
    ingest_batch_key, is_public, updated_at
)
SELECT
    profile.source_person_key,
    'official_officeholder',
    profile.source_id,
    profile.source_name,
    profile.source_url,
    profile.person_name,
    profile.person_name,
    profile.position,
    'councilor',
    profile.district,
    CASE
        WHEN profile.source_id LIKE 'yunlin-%' THEN '雲林縣'
        WHEN profile.source_id LIKE 'pingtung-%' THEN '屏東縣'
        WHEN profile.source_id LIKE 'taoyuan-%' THEN '桃園市'
    END,
    profile.external_record_id,
    jsonb_strip_nulls(jsonb_build_object(
        'profileUrl', profile.source_url,
        'education', profile.education,
        'experience', profile.experience,
        'roleOrigin', 'elected',
        'elected', TRUE
    )),
    'A',
    'official-councilor-profile-gap-20260720-batch-6',
    TRUE,
    NOW()
FROM _current_councilor_official_profiles_batch_6 profile
ON CONFLICT (source_person_key) DO UPDATE SET
    source_id = EXCLUDED.source_id,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    raw_name = EXCLUDED.raw_name,
    normalized_name = EXCLUDED.normalized_name,
    position = EXCLUDED.position,
    normalized_role = EXCLUDED.normalized_role,
    district = EXCLUDED.district,
    normalized_region = EXCLUDED.normalized_region,
    external_record_id = EXCLUDED.external_record_id,
    source_payload = source_people.source_payload || EXCLUDED.source_payload,
    confidence_suggestion = EXCLUDED.confidence_suggestion,
    ingest_batch_key = EXCLUDED.ingest_batch_key,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

WITH identity_rows AS (
    SELECT
        person.id AS person_id,
        source.id AS source_person_id,
        source.source_person_key
    FROM _current_councilor_official_profiles_batch_6 profile
    JOIN people person ON person.external_id = profile.person_external_id
    JOIN source_people source ON source.source_person_key = profile.source_person_key
)
INSERT INTO person_identity_matches (
    source_person_id, person_id, match_status, score, match_method, match_reason,
    evidence_json, reviewed_by, reviewed_at, updated_at
)
SELECT
    source_person_id,
    person_id,
    'auto_matched',
    100,
    'official_current_name_region_district',
    'Official current council profile matched by name, current council office, and region or electoral district.',
    jsonb_build_object('version', 'official-current-councilor-profiles-v6', 'sourcePersonKey', source_person_key),
    'system:official-current-councilor-profiles',
    NOW(),
    NOW()
FROM identity_rows
ON CONFLICT (source_person_id, person_id) DO UPDATE SET
    match_status = EXCLUDED.match_status,
    score = EXCLUDED.score,
    match_method = EXCLUDED.match_method,
    match_reason = EXCLUDED.match_reason,
    evidence_json = EXCLUDED.evidence_json,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = EXCLUDED.updated_at;

WITH claim_rows AS (
    SELECT
        person_external_id,
        source_person_key,
        education_claim_key AS claim_key,
        'education'::TEXT AS claim_type,
        education AS claim_value
    FROM _current_councilor_official_profiles_batch_6
    WHERE education IS NOT NULL
    UNION ALL
    SELECT
        person_external_id,
        source_person_key,
        experience_claim_key,
        'experience',
        experience
    FROM _current_councilor_official_profiles_batch_6
    WHERE experience IS NOT NULL
),
targets AS (
    SELECT
        claim.*,
        person.id AS person_id
    FROM claim_rows claim
    JOIN people person ON person.external_id = claim.person_external_id
)
INSERT INTO person_claims (
    claim_key, person_id, source_person_id, claim_type, claim_value, claim_json,
    confidence_level, review_status, visibility, source_name, source_url,
    observed_at, is_public, review_score, scoring_version, scoring_reasons,
    auto_reviewed_at, updated_at
)
SELECT
    targets.claim_key,
    targets.person_id,
    source.id,
    targets.claim_type,
    targets.claim_value,
    source.source_payload || jsonb_build_object('sourcePersonKey', source.source_person_key, 'field', targets.claim_type),
    'A',
    'verified',
    'public',
    source.source_name,
    source.source_url,
    TIMESTAMPTZ '2026-07-20 00:00:00+08',
    TRUE,
    100,
    'official-current-councilor-profiles-v6',
    jsonb_build_array('Official current council profile matched by name, current office, and region or electoral district.'),
    NOW(),
    NOW()
FROM targets
JOIN source_people source ON source.source_person_key = targets.source_person_key
ON CONFLICT (claim_key) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    source_person_id = EXCLUDED.source_person_id,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    is_public = EXCLUDED.is_public,
    review_score = EXCLUDED.review_score,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    auto_reviewed_at = EXCLUDED.auto_reviewed_at,
    updated_at = EXCLUDED.updated_at;

REFRESH MATERIALIZED VIEW public_people_list_cached;
