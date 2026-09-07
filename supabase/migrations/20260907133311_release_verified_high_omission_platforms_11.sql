BEGIN;

DO $review$
DECLARE repair RECORD; affected_count INTEGER;
BEGIN
    FOR repair IN
        SELECT * FROM (VALUES
            ('a05abc8d-5a33-402f-b3d3-1347a1f34b6d'::UUID,'a89660cb-b58a-441b-a09f-c0972ac81073'::UUID,'f6d65780-2609-4848-951b-f556df487d2d'::UUID,'578a610e224f392ffc96f854a7f96465','0391dcf04da79905b6dd654d4ff4f96d',404,NULL::TEXT,$items$[
                "社會福利／婦幼：建構完整社會安全網、橫向立即通報機制，從里鄰長、社區，保護婦幼免於恐懼、防家暴、防性侵，從幼兒園、國小紮根。",
                "社會福利／老人：社區銀髮多元照護計畫，招募退休志工至各社區參與陪伴與活動，讓老人健康照護落實到各角落。",
                "社會福利／弱勢：監督政府興建社會住宅，提供弱勢族群安穩住所，強化中低收入戶以外之急難救助網、弱勢供餐、臨時住所服務。",
                "教育：爭取國中小程式教育數位載具補助，鄉土教材在地化，法治教育列入國中小課程，加強校園安全，打造共融特色公園。",
                "休閒文化：地方文史導覽、推廣，強化各鄉鎮特色景點結合美食、農特產推廣，定期舉辦地方特色活動，推動產業觀光聚落。",
                "大型公益：推動無喪葬費善終計畫。",
                "大型公益：持續舉辦彰化縣低收、獨老、邊緣戶、街友等寒冬送暖千人饗宴。",
                "大型公益：持續舉辦低收學童我愛寶貝夏令營。",
                "大型公益：不定期舉辦助貧活動。",
                "大型公益：致力推動各社區志工隊、慈善會、校園等巡迴演講。"
            ]$items$::JSONB),
            ('7bfc192d-e933-457f-a961-426d6d47e4af'::UUID,'cd8a6c0c-69ed-4101-a059-d3ad36d9f411'::UUID,'1f2f0d1b-aa8d-47d2-b3f7-114d2e06a751'::UUID,'53d84a0472080dbe6b7b0fd249d6d2b4','67a3f696fd00b33f83d56a84cf5b5203',489,NULL::TEXT,$items$[
                "建設鳳山車站6＋10層『空中鳳城』，打造全臺首座有影城、商場的車站，要求2024年底與大家見面！成為全臺第一個擁有電影院的車站，並提供商場、運動中心、空中禮堂、青創中心等多樣化的服務進駐。",
                "成功招商三井LaLaport投資鳳山，陳其邁市長直言：『許智傑化不可能為可能！』打造佔地4甲多、建地2甲多，地上6層、地下2層的超大型百貨公司，帶來鳳山經濟好光景。",
                "推動捷運黃線核定成功，要求2028年全線通車。並增加設計連接三井百貨公司、衛武營國家藝術文化中心及衛武營公園的地下街或地下聯通道。",
                "推動高雄陸海空城市，督促高雄小港國際機場改造如期如質完成，各航線盡快復飛，以及打造高雄港埠旅運中心，吸引國際郵輪作為母港，發展觀光互動旅運服務。",
                "推動國道七號核定，爭取1,537.9億元，督促114年動工、119年全線通車。",
                "在立法院推動並通過長照及幼童津貼預算，照顧更多長輩和孩子們，並持續爭取長青照護、社會住宅及幼兒教育之社福預算與教育補助。",
                "成功推動客家電視台與客家廣播電台的成立，並催生鳳山客家文創中心進駐黃埔新村，持續推動客家文化的提升。"
            ]$items$::JSONB),
            ('ea5ee72f-9981-4b5f-b6ba-787a86ebf068'::UUID,'a7a50e51-cae5-49d7-a664-c4bd25b3abb2'::UUID,'d19a94d2-976c-43cf-98aa-58965c4e2007'::UUID,'2cd53771027844408b782009019a5e9d','b4bc4dd96fc64acba663174d83ad4421',534,'「嘉倍幸福，一言為定」郭定緯以細膩、堅定態度，站在第一線，把關市政、挺身捍衛市民權益，讓嘉義更宜居、更幸福。',$items$[
                "監督市政一定強：堅持理性問政，捍衛公益與市民權益。",
                "監督市政一定強：專業嚴審預算，為市民荷包把關。",
                "服務市民一定衝：勤奮走動基層，親力親為替市民發聲。",
                "青年就業一定穩：放寬青年創業補助門檻，並發展創業募資平台，吸引青年回嘉創業。",
                "青年就業一定穩：閒置公有地增建青年住宅，讓青年返鄉買得起房。",
                "教育扎根一定好：推動嘉義市圖書總館，豐富城市精神食糧。",
                "教育扎根一定好：增加重點體育學校經費，培植優秀體育選手。",
                "文化傳承一定行：市內公園的主題串連，編織嘉義在地故事。",
                "高齡照護一定優：閒置空間增設日照中心，創造友善銀髮城市。",
                "高齡照護一定優：普設居家照護鈴，塑造老齡友善社區環境。",
                "交通一定順：增加行人徒步區，擴大市區無障礙步行空間。",
                "交通一定順：增設自行車專用道，提高公共空間自行車停車設施。",
                "生育一定安：提高生育津貼，並推動施行坐月子津貼。",
                "生育一定安：爭取增設公辦托育、幼兒園，落實社區保母優質化。",
                "毛孩一定樂：爭取推動市立動物醫院，並規劃專屬寵物公園。",
                "毛孩一定樂：增設公園狗便清潔箱，兼具美化與境教功能。"
            ]$items$::JSONB),
            ('28ee7985-cb15-45df-a423-6126faf35f50'::UUID,'16132a70-c7a7-497f-9b8d-bde17ccb4aad'::UUID,'fac161c9-f6e4-4d21-9456-72921b6e636f'::UUID,'bf1c2c144c171e45bffbfedfc0036459','78c5b630b3d916da6a7463d67c21c1e3',804,'從政首重民生經濟，守護民主，不作秀，不涉政治口水。堅持公益、市民權益、政府權力三方權力對等法原則。如有酒駕，立即辭去市議員職務。',$items$[
                "經濟與觀光發展：力拚台積電六廠建廠營運，建構半導體產業鏈，扭轉人口外移、低薪產業困境。",
                "經濟與觀光發展：推社宅、技職教育、勞訓、合作事業，緩和高科技轉型衍生貧富差距、青年窮忙、結構性失業。",
                "經濟與觀光發展：產製以高雄為主題之自產國際手遊，將遊戲產業發展策略由『鼓勵玩』扭轉為『設計生產』，推展結合元宇宙、區塊鏈數位影音內容產業。",
                "經濟與觀光發展：訂定以產值、獲利、就業人口成長為KPI指標之能源轉型、5G AIoT產業發展計畫。",
                "經濟與觀光發展：推動以海音中心、衛武營、駁二、旅運大樓、會展中心營運為主架構的高階服務業轉型與夜經濟發展計畫。",
                "經濟與觀光發展：推動以社群主題、文創事業為內涵的傳統商圈發展計畫。",
                "經濟與觀光發展：建構主攻日韓中觀光客來客數為主軸的觀光政策。",
                "經濟與觀光發展：推動觀光發展基金自償，興建跨中島、旗津、柴山纜車，推動亞灣海洋休閒專區。",
                "婦幼弱勢保護：力倡0到6歲國家養政策與育兒環境。",
                "婦幼弱勢保護：防兒虐家暴，扶助20歲以下小爸媽。",
                "婦幼弱勢保護：強化社會安全網社區聯防，鼓勵民眾通報。",
                "婦幼弱勢保護：就法、預算、政策面推展合作事業，助中高齡弱勢族群就業、經濟脫貧。",
                "交通與城市安全：危險儲槽及管線碼頭全面搬離亞灣。",
                "交通與城市安全：嚴促交通、警政執行降低高雄車禍死傷率相關措施。",
                "交通與城市安全：智慧號誌讓警消車輛安全通過紅綠燈。",
                "交通與城市安全：杜絕陷阱式的行政檢查與交通裁罰。",
                "銀髮照護：社區C化連結照護高齡獨居長者。",
                "空污與環保：焚化廠拒收外縣市事業廢棄物。",
                "空污與環保：市府自營南區焚化廠，力推垃圾減量。",
                "空污與環保：大眾交通運具全面電動化，力推共享運具。",
                "食安：獎勵食安吹哨者。",
                "食安：學童營養午餐100%採購溯源標章食材。",
                "食安：質譜儀進駐果菜市場，為農藥超標把關。",
                "食安：加強農產品、食材、食品溯源標示與源頭檢驗。"
            ]$items$::JSONB),
            ('2730e39b-a90a-4540-ab2c-4c9d01d4c3eb'::UUID,'f2b71c92-997e-4061-84fb-cbef68d0b202'::UUID,'2fc3b5a7-5b32-4784-9d7e-969816da6743'::UUID,'84e0046b093c13611c498d4f82fa95a0','ee3e5dc1717bb075196e58ffb23c98a2',502,NULL::TEXT,$items$[
                "守護兒少成長，為地方爭取設立公共化托嬰中心，爭取公幼增班，檢討托育品質，監督評鑑制度；爭取親子館，提供婦幼安心休憩時間，傾聽地方婦幼心聲，提高婦幼健康補助，積極協助婦女就業。",
                "強化在地語言及雙語教育，培養國家未來人才，順利接軌國際。",
                "發揚傳統宗教文化價值，並爭取廟會傳承交流補助。",
                "提倡運動風氣及教育，推廣體育活動，監督及爭取全民運動館。",
                "重視文化保存、環境教育，監督及爭取活化中央廣播電台鹿港分台用地。",
                "積極發展鹿港觀光產業，結合鄰近鄉鎮特色產業，爭取假日市集，提供街頭藝人表演平台。",
                "落實長期照護，整合社區與鄰里資源，打造友善高齡環境；媒合義診醫護人員，為弱勢族群強化醫療照護需求及相關資訊上的供給。",
                "促請縣府加強並推廣青年職業訓練，成立青創基地協助青年創業，建立創業平台，增加青年朋友互動的機會，提升各領域的創新能量及職場競爭力。",
                "加強推廣寵物登記及飼主責任教育，增加預算對寵物絕育、疫苗，推動認養代替購買，改善寵物殯葬問題，落實生命教育及爭取寵物公園。",
                "超越黨派，爭取建設，監督縣政，勤跑基層，傾聽民意，做好服務，落實社福，關懷弱勢。"
            ]$items$::JSONB)
        ) AS row(claim_id,person_id,candidate_id,source_md5,value_md5,value_length,platform_intro,items)
    LOOP
        UPDATE public.person_claims AS claim
        SET claim_json=pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(
                        CASE WHEN repair.platform_intro IS NULL THEN COALESCE(claim.claim_json,'{}'::JSONB)
                             ELSE pg_catalog.jsonb_set(COALESCE(claim.claim_json,'{}'::JSONB),'{platformIntro}',pg_catalog.to_jsonb(repair.platform_intro),TRUE) END,
                        '{items}',repair.items,TRUE),
                    '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-11-20260907','reasonCodes','[]'::JSONB)),TRUE),
                '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-11-20260907','repair','official_bulletin_full_text_resplit','classification','verified_repair'),TRUE),
            updated_at=pg_catalog.now()
        WHERE claim.id=repair.claim_id AND claim.person_id=repair.person_id AND claim.candidate_id=repair.candidate_id
          AND claim.claim_type='platform' AND pg_catalog.md5(claim.source_url)=repair.source_md5
          AND pg_catalog.md5(claim.claim_value)=repair.value_md5 AND pg_catalog.length(claim.claim_value)=repair.value_length
          AND claim.claim_json->>'platformText'=claim.claim_value
          AND claim.claim_json#>>'{contentSplit,reviewStatus}'='needs_review'
          AND claim.claim_json#>>'{platformQualityAudit,classification}'='confirmed_content_or_split_issue'
          AND claim.claim_json#>>'{platformQualityAudit,repair}'='recovered_missing_item_from_stored_source';
        GET DIAGNOSTICS affected_count=ROW_COUNT;
        IF affected_count<>1 THEN RAISE EXCEPTION 'Expected one platform update for %, found %',repair.claim_id,affected_count; END IF;
    END LOOP;
END
$review$;

DO $validate$
DECLARE validated_count INTEGER;
BEGIN
    WITH expected(claim_id,item_count) AS (VALUES
        ('a05abc8d-5a33-402f-b3d3-1347a1f34b6d'::UUID,10),
        ('7bfc192d-e933-457f-a961-426d6d47e4af'::UUID,7),
        ('ea5ee72f-9981-4b5f-b6ba-787a86ebf068'::UUID,16),
        ('28ee7985-cb15-45df-a423-6126faf35f50'::UUID,24),
        ('2730e39b-a90a-4540-ab2c-4c9d01d4c3eb'::UUID,10)
    )
    SELECT pg_catalog.count(*) INTO validated_count
    FROM expected JOIN public.person_claims AS claim ON claim.id=expected.claim_id
    WHERE pg_catalog.jsonb_array_length(claim.claim_json->'items')=expected.item_count
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
      AND claim.claim_json#>>'{contentSplit,releaseQuality,version}'='verified-high-omission-platforms-11-20260907'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='official_bulletin_full_text_resplit'
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='verified_repair';
    IF validated_count<>5 THEN RAISE EXCEPTION 'Expected five validated platform repairs, found %',validated_count; END IF;
END
$validate$;

COMMIT;
