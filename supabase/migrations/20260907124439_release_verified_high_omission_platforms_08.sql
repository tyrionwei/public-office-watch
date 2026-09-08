BEGIN;

DO $review$
DECLARE affected_count INTEGER;
BEGIN
    UPDATE public.person_claims AS claim
    SET claim_json = pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(COALESCE(claim.claim_json,'{}'::JSONB),'{platformIntro}',pg_catalog.to_jsonb('主軸：「一人當選、全家服務！兩位議員資歷加入年輕的新血來為您服務」落實兩性服務的方便性、專業性與年齡縱深。'::TEXT),TRUE),
                '{items}',$items$[
                    "交通建設：監督捷運綠線八德至大溪、大漢溪順水左岸河堤道路、提升公共運輸服務、66與3連結工程、大鶯－豐德交流道、廣設YouBike租賃站等各項交通建設執行。並促成板龍快速道路興建（含通往河東高架橋支線）以利分流降低交通壅塞。",
                    "社會福利：協助婦幼團體爭取經費、照顧弱勢婦女與家庭並開設技能訓練班、支持生育、育兒、老年津貼等各項社會福利預算、監督田心公托、埔頂親子館及河東、河西日照據點、老人會館的興建與設置。",
                    "文化與觀光建設：續推動『漫城慢遊』與『大科崁溪水與綠休閒園區計畫』、中庄吊橋、民宿、溪洲轉運站、大溪木博館延伸、河東、河西圖書館等建設。提升大溪復興夜間觀光亮點，爭取北橫線提升為國家風景區。",
                    "體育建設：監督大溪國民運動中心運作與維護、爭取桌球運動空間、設置室內健身場域、現有網球場設施精進、大漢溪順水兩岸打造河濱運動公園、滑草場、親子園區與棒壘球場維護、推動水上國民運動及監督市府各項體育選手培植推動計畫。",
                    "爭取義警、民防、義消、防宣、義交、警察志工、守望相助隊等協勤民力福利與裝備改善。",
                    "醫療建設：續爭取埔頂轉運站設置『醫療專區』、朝特色醫院（評估老人、婦幼或兒童專科）、國軍桃園總醫院提升為急重症緊急救護醫院等級便利民眾就醫、降低失救風險。",
                    "繼月眉、康莊、台七桃花源休區續爭取百吉、三層美華永福、中新瑞興休閒農業區。",
                    "爭取興建改善大溪復興區各里市民活動中心。",
                    "大溪河西地區爭取銀行進駐。",
                    "推動動物安寧醫療制度，減輕飼主與動物的痛苦。",
                    "爭取大溪復興地區教育軟硬體各項建設提升及改善校園周邊交通安全環境。"
                ]$items$::JSONB,TRUE),
            '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-08-20260907','reasonCodes','[]'::JSONB)),TRUE),
        '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-08-20260907','repair','official_bulletin_user_assisted_full_resplit','classification','verified_repair'),TRUE),
        updated_at=pg_catalog.now()
    WHERE claim.id='1d84f9ea-da38-419c-ac8c-4538d06c0e9d'::UUID
      AND claim.person_id='8fcac4b2-46da-4c3e-8a6c-f7494ea31f4b'::UUID
      AND claim.candidate_id='9c190d5b-c83b-4e03-99f8-491f404cf43e'::UUID
      AND claim.claim_type='platform'
      AND pg_catalog.md5(claim.source_url)='59e17bfe81f7a91a777477d94977e7a8'
      AND pg_catalog.md5(claim.claim_value)='34a33cca73de4905bc61eebf608a5dde'
      AND pg_catalog.length(claim.claim_value)=71
      AND claim.claim_json->>'platformText'=claim.claim_value
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='needs_review'
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='confirmed_content_or_split_issue'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='recovered_missing_item_from_stored_source';
    GET DIAGNOSTICS affected_count=ROW_COUNT;
    IF affected_count<>1 THEN RAISE EXCEPTION 'Expected one Chen Chih-wen update, found %',affected_count; END IF;
END
$review$;

DO $review$
DECLARE affected_count INTEGER;
BEGIN
    UPDATE public.person_claims AS claim
    SET claim_json = pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(COALESCE(claim.claim_json,'{}'::JSONB),'{items}',$items$[
                "持續監督道路改善計畫：監督暖暖區道路改善計畫，保障行人、機車族路權，串聯人行道，盤點閒置公有地設置停車空間，回應停車需求。",
                "穩定國道客運：強力監督市府扛起責任，積極處理，研議改善班次路線問題，甚至評估其他業者進場的方案。",
                "基隆市公車營運改革／R86班次補足：續推跨區、醫療公車路線及動態系統檢討，提高市區公共運輸使用率。",
                "基隆市公車營運改革／R86班次補足：續推市公車補足R86路線班次，增加八堵車站接駁載客運能！",
                "捷運八堵站落實公車接駁系統：納入通勤族使用經驗，規劃『公車－台鐵／捷運』轉乘動線及合理票價。",
                "解決青年三難題：租屋、長照、幼托：提升暖暖區包租代管社宅數量，監督市府陸續興建社會住宅，小家庭住／租沒問題。",
                "解決青年三難題：租屋、長照、幼托：續推市府成立長照專責單位、補足專業人力、布建日照中心。",
                "守護未來棟樑，兒童教育／遊戲權不可少：續推市府重視參與式設計，邀請親子參與鄰里空間改造，重視兒童遊戲權！",
                "守護未來棟樑，兒童教育／遊戲權不可少：守護『教育基金』直接用於教育，提高教師合格率。",
                "暖暖好街區、好生態、好生活：青創基地一起來！續推過港路及暖暖街市有閒置宿舍活化方案，民眾提案來改造。",
                "暖暖好街區、好生態、好生活：續推暖暖淡蘭古道、暖暖溪散步道，以手作步道串聯暖暖區山徑系統。",
                "暖暖好街區、好生態、好生活：持續陪伴社區討論空間規劃、改造方案，告訴市府『我們要這個』！"
            ]$items$::JSONB,TRUE),
            '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-08-20260907','reasonCodes','[]'::JSONB)),TRUE),
        '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-08-20260907','repair','official_bulletin_user_assisted_full_resplit','classification','verified_repair'),TRUE),
        updated_at=pg_catalog.now()
    WHERE claim.id='95a3110b-10c4-42e5-980a-30ec46d3528e'::UUID
      AND claim.person_id='4a509962-1bb7-4153-8100-4c912752a1a6'::UUID
      AND claim.candidate_id='c165c358-db82-4d8f-a0b5-156a2b87da31'::UUID
      AND claim.claim_type='platform'
      AND pg_catalog.md5(claim.source_url)='96c430e2ecd318e7756e781f458cdcc8'
      AND pg_catalog.md5(claim.claim_value)='287e89028b52b12f08b4d85692a7e2a6'
      AND pg_catalog.length(claim.claim_value)=534
      AND claim.claim_json->>'platformText'=claim.claim_value
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='needs_review'
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='confirmed_content_or_split_issue'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='recovered_missing_item_from_stored_source';
    GET DIAGNOSTICS affected_count=ROW_COUNT;
    IF affected_count<>1 THEN RAISE EXCEPTION 'Expected one Chen Kuan-yu update, found %',affected_count; END IF;
END
$review$;

DO $review$
DECLARE affected_count INTEGER;
BEGIN
    UPDATE public.person_claims AS claim
    SET claim_json = pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(COALESCE(claim.claim_json,'{}'::JSONB),'{items}',$items$[
                "養得起孩子／完成：成功推動台中市公托公幼倍增。",
                "養得起孩子／完成：成功推動生育津貼2萬元。",
                "養得起孩子／承諾：推動公幼、準公幼免學費。",
                "養得起孩子／承諾：推動學齡前育兒彈性工時。",
                "養得起孩子／承諾：推動校園營養午餐法。",
                "買得起房子／完成：成功推動台中囤房稅自治條例。",
                "買得起房子／完成：成功推動稅收補助青年首購及租屋補貼。",
                "買得起房子／承諾：推動新加坡模式社宅政策。",
                "買得起房子／承諾：推動興建社宅容積獎勵。",
                "退休免煩惱／完成：成功恢復65歲以上健保費補助。",
                "退休免煩惱／完成：成功爭取擴大敬老愛心卡適用範圍。",
                "退休免煩惱／承諾：就業安定基金提升長照薪資。",
                "退休免煩惱／承諾：放寬巴氏量表認定標準。",
                "生活會更好／完成：新設4所國中國小。",
                "生活會更好／完成：新建改建2座圖書館。",
                "生活會更好／完成：成功打通改善道路橋樑工程40處。",
                "生活會更好／承諾：全力推動台中捷運建設。",
                "生活會更好／承諾：推動住宅區寧靜法。",
                "生活會更好／承諾：提高詐騙犯罪最低刑期。"
            ]$items$::JSONB,TRUE),
            '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-08-20260907','reasonCodes','[]'::JSONB)),TRUE),
        '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-08-20260907','repair','official_bulletin_user_assisted_full_resplit','classification','verified_repair'),TRUE),
        updated_at=pg_catalog.now()
    WHERE claim.id='49b2205f-f5c6-4de8-a532-13ead4135784'::UUID
      AND claim.person_id='6114098b-c9d9-4b38-9dab-7b4cea0a36c3'::UUID
      AND claim.candidate_id='6bc12669-c2d6-42c9-8592-04fc69eb7c71'::UUID
      AND claim.claim_type='platform'
      AND pg_catalog.md5(claim.source_url)='2f2301d9eeff7cf2d57bd26efdf16694'
      AND pg_catalog.md5(claim.claim_value)='405978b72eca6c5d7ef5d7fbdb68e8b5'
      AND pg_catalog.length(claim.claim_value)=292
      AND claim.claim_json->>'platformText'=claim.claim_value
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='needs_review'
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='confirmed_content_or_split_issue'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='recovered_missing_item_from_stored_source';
    GET DIAGNOSTICS affected_count=ROW_COUNT;
    IF affected_count<>1 THEN RAISE EXCEPTION 'Expected one Huang Chien-hao 2024 update, found %',affected_count; END IF;
END
$review$;

DO $review$
DECLARE affected_count INTEGER;
BEGIN
    UPDATE public.person_claims AS claim
    SET claim_json = pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(COALESCE(claim.claim_json,'{}'::JSONB),'{platformIntro}',pg_catalog.to_jsonb('桃園慧更好！'::TEXT),TRUE),
                '{items}',$items$[
                    "生活慧更好：優化陳情管道、設立『網路陳情資料庫』。",
                    "生活慧更好：廣設學童通學步道，維護孩子上下學『行的安全』。",
                    "生活慧更好：全齡共融公園之設置，打造各年齡層皆合適的使用環境。",
                    "生活慧更好：國道橋下空間活化再利用。",
                    "生活慧更好：全面檢討無障礙空間以友善身障人士。",
                    "交通慧更好：爭取南桃園交流道之替代道路計畫，舒緩車流。",
                    "交通慧更好：連結桃－北生活圈、桃－北公車路線擴增及站點新增。",
                    "交通慧更好：中路／藝文特區周遭停車空間檢討、爭取各區停車格擴增。",
                    "交通慧更好：捷運站點沿線之UBike站點設置、公車站點之配合。",
                    "交通慧更好：捷運建置之交通黑暗期，替代道路設置的方案。",
                    "樂齡慧更好：完善社區關懷計畫（關懷據點設置／獨居老人定時關心）。",
                    "樂齡慧更好：完善敬老愛心卡福利。",
                    "樂齡慧更好：爭取65歲以上長輩驗光及老花眼鏡補助。",
                    "樂齡慧更好：爭取65歲以上長輩助聽器補助。",
                    "育兒慧更好：廣設公辦托嬰、臨時托育、定點臨時托育。",
                    "育兒慧更好：爭取托育補助、育兒津貼再加碼，讓桃園成為最適合年輕家庭居住的城市。",
                    "育兒慧更好：廣設圖書館之親子閱讀區，提升共讀共學風氣。",
                    "育兒慧更好：爭取增加兒童病床床數、專科醫院、兒科夜間急診。",
                    "育兒慧更好：爭取口服輪狀病毒疫苗／自費疫苗補助。",
                    "環境慧更好：加強監督汙水下水道設置之進度、爭取提高補償比率。",
                    "環境慧更好：熱點常駐車輛噪音監控管制，還給市民安靜生活品質。",
                    "環境慧更好：分區增設寵物公園，增加寵物奔跑綠地。",
                    "環境慧更好：落實寵物普查、晶片管理，從源頭控管以避免寵物流落街頭。",
                    "環境慧更好：媒合市府與民間資源，協助新住民降低語言溝通的障礙與文化上的差異性。"
                ]$items$::JSONB,TRUE),
            '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-08-20260907','reasonCodes','[]'::JSONB)),TRUE),
        '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-08-20260907','repair','official_bulletin_user_assisted_full_resplit','classification','verified_repair'),TRUE),
        updated_at=pg_catalog.now()
    WHERE claim.id='168fbd35-c28f-4cbf-86c2-171c8954babe'::UUID
      AND claim.person_id='24d90f21-d167-44ec-b677-90815f62b4d0'::UUID
      AND claim.candidate_id='91f67ca4-2407-4119-a77f-194c626ad57f'::UUID
      AND claim.claim_type='platform'
      AND pg_catalog.md5(claim.source_url)='1322b8612cef291aa69d50c8feb14d97'
      AND pg_catalog.md5(claim.claim_value)='2a46a0a09a528c385ea0de4d8acb5edf'
      AND pg_catalog.length(claim.claim_value)=801
      AND claim.claim_json->>'platformText'=claim.claim_value
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='needs_review'
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='confirmed_content_or_split_issue'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='recovered_missing_item_from_stored_source';
    GET DIAGNOSTICS affected_count=ROW_COUNT;
    IF affected_count<>1 THEN RAISE EXCEPTION 'Expected one Huang Chiung-hui update, found %',affected_count; END IF;
END
$review$;

DO $review$
DECLARE affected_count INTEGER;
BEGIN
    UPDATE public.person_claims AS claim
    SET claim_json = pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(COALESCE(claim.claim_json,'{}'::JSONB),'{items}',$items$[
                "亮眼成績：為桃園市爭取教育資源補助共312億元。完成班班有冷氣、生生有平板、改善老舊校舍及廁所整建、學校操場及設備改善、各級學校校舍新（增）建工程、代理教師全年聘期、提高育兒津貼至每月五千元、調降公幼師生比、疫後就學貸款補助。完成國民教育法、特殊教育法、性平教育法、學校衛生法、幼兒教育及照顧法、高級中等學校建教合作實施及建教生權益保障法等重大修法。",
                "檢討新課綱及學習歷程檔案成效，有效減輕教師及學生負擔。",
                "推動校園營養午餐專法立法，讓學童吃得健康、吃得安全。",
                "推動學生輔導法修法，調降各級學校專任輔導教師員額比。",
                "就學貸款零利率，減輕學生負擔。",
                "每二年檢討育兒津貼補助經費，依據通膨滾動式調整。",
                "要求中央提高桃園市補助經費，完善桃園重大建設。",
                "儘速如期完成綠線捷運、鐵路地下化。",
                "爭取桃園鐵路地下化車站，建設具地標性門戶意象，打造前後站新商圈，發展共榮願景。",
                "解決客運缺工，增加桃園市區聯外客運班次，改善民眾通勤問題。",
                "加快國道2號中路交流道完工通車。",
                "全面協助桃園市社會住宅加速興建，健全住宅市場。",
                "爭取部立桃園醫院升格為醫學中心。",
                "提升護理人員待遇，加速推動三班護病比入法。"
            ]$items$::JSONB,TRUE),
            '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-08-20260907','reasonCodes','[]'::JSONB)),TRUE),
        '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-08-20260907','repair','official_bulletin_user_assisted_full_resplit','classification','verified_repair'),TRUE),
        updated_at=pg_catalog.now()
    WHERE claim.id='645c651d-3cb3-41b6-bebd-6879bafca157'::UUID
      AND claim.person_id='4f25892a-b0c5-484e-bb26-88f1e7aea483'::UUID
      AND claim.candidate_id='d937f0d9-3c86-4534-a872-8da1c188e3eb'::UUID
      AND claim.claim_type='platform'
      AND pg_catalog.md5(claim.source_url)='d372bc538c0a57cb0ed9e919e36e106f'
      AND pg_catalog.md5(claim.claim_value)='54eaa432d103ab6222005caff391efa7'
      AND pg_catalog.length(claim.claim_value)=552
      AND claim.claim_json->>'platformText'=claim.claim_value
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='needs_review'
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='confirmed_content_or_split_issue'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='recovered_missing_item_from_stored_source';
    GET DIAGNOSTICS affected_count=ROW_COUNT;
    IF affected_count<>1 THEN RAISE EXCEPTION 'Expected one Wan Mei-ling update, found %',affected_count; END IF;
END
$review$;

WITH profile AS (
    SELECT * FROM (VALUES
        ('8fcac4b2-46da-4c3e-8a6c-f7494ea31f4b'::UUID,'9c190d5b-c83b-4e03-99f8-491f404cf43e'::UUID,'1d84f9ea-da38-419c-ac8c-4538d06c0e9d'::UUID,'cec-2022-bulletin:chen-chih-wen','1970-10-18','female','民主進步黨',$education$["瑞豐國小","獅甲國中","大榮高中","南亞技術學院二專部、二技部","美國蒂芬大學企管系碩士","開南大學公共行政學系碩士"]$education$::JSONB,$experience$["桃園縣第17屆縣議員","桃園市第1、2屆市議員","縣議員邱顯二主任秘書","大溪早起會常務理事","大溪佛光會員","大溪工商發展協進會員","大溪普修慈善協進會員","防火宣導大溪分隊顧問","大溪婦女成長協會榮譽理事長","大溪慢速壘球發展協會理事長"]$experience$::JSONB),
        ('4a509962-1bb7-4153-8100-4c912752a1a6'::UUID,'c165c358-db82-4d8f-a0b5-156a2b87da31'::UUID,'95a3110b-10c4-42e5-980a-30ec46d3528e'::UUID,'cec-2022-bulletin:chen-kuan-yu','1993-03-02','male','無',$education$["天主教輔仁大學臨床心理學系畢業"]$education$::JSONB,$experience$["左下角工作室，投入社區工作、關注在地議題","基隆市議員王醒之辦公室研究員，協助法律諮詢、陳情案件，投入政策研究，針對市公車虧損改善、暖暖國道客運及公車R86問題、東勢街1.2公里電纜地下化、過港興隆街懸臂式步道、八堵天橋拆除、碇內垃圾清運點等提出改革方案，持續針對民生議題發聲！"]$experience$::JSONB),
        ('24d90f21-d167-44ec-b677-90815f62b4d0'::UUID,'91f67ca4-2407-4119-a77f-194c626ad57f'::UUID,'168fbd35-c28f-4cbf-86c2-171c8954babe'::UUID,'cec-2022-bulletin:huang-chiung-hui','1984-06-29','female','民主進步黨',$education$["桃園國小","桃園國中","陽明高中","中原大學室內設計學系畢業"]$education$::JSONB,$experience$["市議員黃景熙辦公室主任","桃園市文化藝星協會理事長","桃園市資深義消協會理事長","桃園市博愛促進協會副理事長","拉結親子文化教育推廣協會理事長","民進黨桃園市黨部執行委員","桃園區義消中隊顧問"]$experience$::JSONB)
    ) AS row(person_id,candidate_id,platform_claim_id,claim_scope,birth_date,gender,party_affiliation,education_items,experience_items)
), expanded AS (
    SELECT profile.person_id,profile.candidate_id,profile.claim_scope,source_claim.source_name,source_claim.source_url,
           claim.claim_type,claim.claim_value,claim.items,claim.field
    FROM profile
    JOIN public.person_claims AS source_claim ON source_claim.id=profile.platform_claim_id
    CROSS JOIN LATERAL (VALUES
        ('birth_date',profile.birth_date,NULL::JSONB,'birth_date'),
        ('gender',profile.gender,NULL::JSONB,'gender'),
        ('party_affiliation',profile.party_affiliation,NULL::JSONB,'recommended_party'),
        ('education',(SELECT pg_catalog.string_agg(value,E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.education_items) WITH ORDINALITY item(value,ordinal)),profile.education_items,'education'),
        ('experience',(SELECT pg_catalog.string_agg(value,E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.experience_items) WITH ORDINALITY item(value,ordinal)),profile.experience_items,'experience')
    ) AS claim(claim_type,claim_value,items,field)
)
INSERT INTO public.person_claims (
    claim_key,person_id,candidate_id,claim_type,claim_value,claim_json,confidence_level,review_status,visibility,
    source_name,source_url,observed_at,is_public,review_score,scoring_version,scoring_reasons,auto_reviewed_at
)
SELECT 'official-profile:'||claim_scope||':'||claim_type,person_id,candidate_id,claim_type,claim_value,
       pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('field',field,'items',items,'productionRelease','20260907-official-profile-transcription-08')),
       'A','verified','public',source_name,source_url,'2022-11-25T16:00:00+00:00'::TIMESTAMPTZ,TRUE,100,
       'official-source-user-assisted-profile-v1','["Official election bulletin","User-assisted transcription from supplied official source"]'::JSONB,pg_catalog.now()
FROM expanded
ON CONFLICT (claim_key) DO UPDATE SET
    person_id=EXCLUDED.person_id,candidate_id=EXCLUDED.candidate_id,claim_type=EXCLUDED.claim_type,claim_value=EXCLUDED.claim_value,
    claim_json=EXCLUDED.claim_json,confidence_level=EXCLUDED.confidence_level,review_status=EXCLUDED.review_status,
    visibility=EXCLUDED.visibility,source_name=EXCLUDED.source_name,source_url=EXCLUDED.source_url,observed_at=EXCLUDED.observed_at,
    is_public=EXCLUDED.is_public,review_score=EXCLUDED.review_score,scoring_version=EXCLUDED.scoring_version,
    scoring_reasons=EXCLUDED.scoring_reasons,auto_reviewed_at=EXCLUDED.auto_reviewed_at,updated_at=pg_catalog.now();

DO $validate$
DECLARE platform_count INTEGER; profile_count INTEGER;
BEGIN
    SELECT pg_catalog.count(*) INTO platform_count
    FROM public.person_claims
    WHERE (id='1d84f9ea-da38-419c-ac8c-4538d06c0e9d'::UUID AND pg_catalog.jsonb_array_length(claim_json->'items')=11)
       OR (id='95a3110b-10c4-42e5-980a-30ec46d3528e'::UUID AND pg_catalog.jsonb_array_length(claim_json->'items')=12)
       OR (id='49b2205f-f5c6-4de8-a532-13ead4135784'::UUID AND pg_catalog.jsonb_array_length(claim_json->'items')=19)
       OR (id='168fbd35-c28f-4cbf-86c2-171c8954babe'::UUID AND pg_catalog.jsonb_array_length(claim_json->'items')=24)
       OR (id='645c651d-3cb3-41b6-bebd-6879bafca157'::UUID AND pg_catalog.jsonb_array_length(claim_json->'items')=14);
    IF platform_count<>5 THEN RAISE EXCEPTION 'Expected five validated platform repairs, found %',platform_count; END IF;

    SELECT pg_catalog.count(*) INTO platform_count
    FROM public.person_claims
    WHERE id IN ('1d84f9ea-da38-419c-ac8c-4538d06c0e9d','95a3110b-10c4-42e5-980a-30ec46d3528e','49b2205f-f5c6-4de8-a532-13ead4135784','168fbd35-c28f-4cbf-86c2-171c8954babe','645c651d-3cb3-41b6-bebd-6879bafca157')
      AND claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
      AND claim_json#>>'{contentSplit,releaseQuality,version}'='verified-high-omission-platforms-08-20260907'
      AND claim_json#>>'{platformQualityAudit,classification}'='verified_repair';
    IF platform_count<>5 THEN RAISE EXCEPTION 'Expected five released platform repairs, found %',platform_count; END IF;

    SELECT pg_catalog.count(*) INTO profile_count FROM public.person_claims
    WHERE claim_key LIKE ANY (ARRAY[
        'official-profile:cec-2022-bulletin:chen-chih-wen:%',
        'official-profile:cec-2022-bulletin:chen-kuan-yu:%',
        'official-profile:cec-2022-bulletin:huang-chiung-hui:%'
    ])
      AND claim_json->>'productionRelease'='20260907-official-profile-transcription-08'
      AND review_status='verified' AND visibility='public' AND is_public IS TRUE;
    IF profile_count<>15 THEN RAISE EXCEPTION 'Expected fifteen normalized profile claims, found %',profile_count; END IF;
END
$validate$;

COMMIT;
