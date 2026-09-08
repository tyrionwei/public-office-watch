BEGIN;

DO $review$
DECLARE repair RECORD; affected_count INTEGER;
BEGIN
    FOR repair IN
        SELECT * FROM (VALUES
            ('ad6828fd-7597-4bb3-a791-55a587bc35b5'::UUID,'fe9169ae-7876-4554-a7f9-ae336118bd88'::UUID,'d26824c2-3e10-4cf1-9db9-2cb523e92641'::UUID,'1a46c8b4445137ec5cfb4ec74a74d4e2','6b48451dae1a8650133f838d434753c7',236,NULL::TEXT,$items$[
                "傾聽在地聲音，提供迅速選民服務，解決民生問題，爭取市民福利。",
                "積極推行板橋都更計畫，提升市民生活品質。",
                "督促市府落實預算的執行，建立有效率的預算編制。",
                "加強弱勢家庭及身心障礙的福利服務。",
                "爭取警消人員權益、提升救災設備，保障市民之安全。",
                "持續要求市政府、警察局增加社區內監視器，以維護老弱婦孺生命財產安全。",
                "督促市府建設，改善企業投資環境，協助青年就學、就業、創業、成家、安居。",
                "持續加速板橋地區地下停車場設立，解決市區停車位數量不足問題。"
            ]$items$::JSONB),
            ('84ae9c2c-8cc4-4cda-8158-e4537647bc0c'::UUID,'ab42f089-d688-4b83-9f13-059ba3d70663'::UUID,'ee3f1be1-0d84-4663-adba-0a007ff5c902'::UUID,'67099d08edcfbdd0192f3a55e48a87af','b8618aecffc44798f3a51467fc131f1e',506,NULL::TEXT,$items$[
                "樂活中和｜安心安居：南勢角軸線翻轉，紓解交通壅塞問題。",
                "樂活中和｜安心安居：推動全民運動，促成中和第二運動中心。",
                "樂活中和｜安心安居：運動樂活，培育運動人才。",
                "樂活中和｜安心安居：加速三環六線，萬大中和線工程進度。",
                "樂活中和｜安心安居：路平專案，建構舒適安全的人行及行車空間。",
                "樂活中和｜安心安居：重新檢視中和區都市計畫。",
                "樂活中和｜安心安居：推動多元都更，危老重建，擴大公辦都更。",
                "樂活中和｜安心安居：全面檢視維修中和登山步道。",
                "樂活中和｜安心安居：加速瓦磘溝整治河道水質，水岸景觀改善。",
                "加速發展｜就近就業：推動租稅正義。",
                "加速發展｜就近就業：輔導興南夜市攤商合法化。",
                "加速發展｜就近就業：促進灰磘產業專區整體開發。",
                "加速發展｜就近就業：興建更多社會，青年住宅。",
                "行的正義｜停車容易：爭取前國防管理學院運動場開闢地下停車場。",
                "行的正義｜停車容易：校舍老舊設備更新，新增設地下停車場。",
                "行的正義｜停車容易：加速佳和公園新建幼兒園公托暨共構地下停車場工程。",
                "行的正義｜停車容易：打造宜居環境，增設YouBike 2.0站點。",
                "用心護幼｜優質長照：完善高齡照護，廣設日間照顧中心。",
                "用心護幼｜優質長照：長者在地安養，提供婦女二度職訓就業機會。",
                "用心護幼｜優質長照：重視新住民文化健康爭取社會福利資源。",
                "用心護幼｜優質長照：優化托育品質，改善幼兒遊戲場。",
                "用心護幼｜優質長照：增加國小公幼學生課後服務。",
                "用心護幼｜優質長照：補助學校更新硬體，改善通學環境。",
                "用心護幼｜優質長照：改善中和動物之家收容環境。"
            ]$items$::JSONB),
            ('cbd202c3-9607-4931-8619-01c7ceaeb59b'::UUID,'ab789c43-2c98-4a02-a1f8-30d1615c9074'::UUID,'a81840ab-c87b-45bc-9b39-1b6113d634f7'::UUID,'a661bd7f824c5adc81a936b6e625306a','c03a848c288a1fe8de65fe0cfc1dc83e',281,NULL::TEXT,$items$[
                "六年幼托｜免負擔：加強教保人員身心健康，以保障受托幼童之安全。",
                "六年幼托｜免負擔：落實三胎的優先權利。",
                "六年幼托｜免負擔：廣設公共托育、幼兒園。",
                "十年長照｜零負擔：廣設社區型老人關懷據點，因應快速的老人化社會。",
                "十年長照｜零負擔：設立銀髮社區，活化老人文化。",
                "都更改建｜保家園：為居的安全，加速都更進度。",
                "都更改建｜保家園：以里為單位，辦理都更說明會，協助都更完成。",
                "雙語教學｜國際化：推動國中小，學校全面雙語課程規劃與實踐。",
                "雙語教學｜國際化：辦理各項英語活動，讓語言可以在日常生活中落實。",
                "醫療量能｜要保全：確保三重聯合醫院的醫療效能顧及三重蘆洲。",
                "醫療量能｜要保全：加速蘆洲醫院的興建工程。"
            ]$items$::JSONB),
            ('cab038ce-4b2c-443e-8aa4-8c85e105658b'::UUID,'91882351-5b1b-4634-9698-e3276d146b28'::UUID,'e6cf649e-d2a5-491a-bc7d-c909b52b98ce'::UUID,'ab63c6578d516589f9026139db112f65','98c9bf971f9dca36ec80789af3bdddb8',706,'淑君為南部孩子，一卡皮箱上來板橋生根，台灣人在說「番薯不怕落土爛，只求枝葉代代湠」，淑君參政的初衷是希望可以在板橋湠根服務，延續何博文團隊的服務精神，未來淑君將會著重：',$items$[
                "交通安心：新北市幅員遼闊，交通問題是新北需要不斷檢討之問題，落實交通安全需要有耐心跟經驗，未來淑君將會針對不同區域的問題，對症下藥。",
                "交通安心：號誌加裝UPS（不斷電系統），提供急難使用。",
                "交通安心：檢討待轉區設立，不要讓待轉區變成待撞區。",
                "交通安心：推行無號誌化路口，簡化號誌設立同時，強化動線檢討，並加強標線規劃。",
                "交通安心：都市計畫檢討道路之設置，從源頭解決交通問題。",
                "交通安心：人行道無障礙。",
                "交通安心：增設停車空間。",
                "教育安心：新北市有最多的兒童就讀，孩子不同階段的教育都需要被重視。",
                "教育安心：增設公托、兩歲專班及公幼。",
                "教育安心：推動非營利幼兒園。",
                "教育安心：建立保母媒合平台，加強保母及家長的幼兒照顧教育訓練。",
                "教育安心：落實兒童照顧機制，建立兒虐及高風險家庭通報平台。",
                "吃得安心：新北市人口眾多，除要落實食材登錄平台，從小、從生活重新認識食品安全及食農教育十分重要。",
                "吃得安心：定期稽查食品製作過程，確保食材的品質。",
                "吃得安心：降低食品碳排放量，鼓勵在地取材食用。",
                "吃得安心：落實食農教育，推行生活綠美化，從根本調整身體健康。",
                "醫療安心：近年來疫情肆虐，讓我們深刻認知到醫療環境改善的重要性，以確保醫療資源充足。",
                "醫療安心：建立板橋醫療園區，並定期追蹤BOT進度跟人民報告。",
                "醫療安心：推動地方婦幼門診，讓孩子能夠及早接受治療，並且有充足的醫療資源可以供應。",
                "醫療安心｜增加生育率：爭取凍卵補助、建立不孕症諮商管道。",
                "醫療安心：落實心理照護機制，讓新北市民不再依靠憂鬱症藥物。"
            ]$items$::JSONB),
            ('55f51e02-3d16-4750-a073-e0d20670a4bc'::UUID,'e65fab08-6bef-4d0f-89b1-8251e7203851'::UUID,'9d0305c3-f0a1-4d78-b0f3-a39f4ce64810'::UUID,'926102f2f06aefc04a2d6fa92d1e7d50','8bfb84fdcd9d04cc33e171b3e23bbc48',516,NULL::TEXT,$items$[
                "爭取城市運動環境、提供市民健康好生活。",
                "關懷婦幼權益、推動平價托育、長照2.0推動成效。",
                "提倡國小AI教育、推廣程式語言。",
                "推廣校園圍棋，培養學童定性及邏輯能力。",
                "爭取台中捷運藍與橘線、YouBike微笑單車設站、興建停車場。",
                "支持全民體育，爭取新建足球場地、監督運動場館更新維護。",
                "要求勞保年金設樓地板、保障勞工權益。",
                "關心並建議解決高房價、物價通膨與勞工低薪問題。",
                "監督食品安全，爭取國中小營養午餐補助增加5元。",
                "爭取公立幼兒園、托兒所倍增地點。",
                "爭取警消工作裝備，支持警械使用條例修法，強化執勤安全。",
                "爭取筏子溪週邊整治，兩岸綠化藍帶，檢討都市計畫。",
                "爭取觀光旅宿產業行銷補助，輔導數位轉型升級。",
                "爭取教育資源補助，新建或汰換學校軟硬體設備。",
                "爭取興建里活動中心、西大墩低碳環保館、福科增建校舍等工程。",
                "爭取市政路延伸、環中路二段1036巷道路拓寬等工程。",
                "爭取復康巴士汰舊換新、新增消防排煙車。",
                "監督能源政策、穩定民生電價。",
                "監督臺中火力發電廠排放PM2.5數值透明化，還給市民好空氣。",
                "監督中科排放廢氣、廢水，符合環保標準。"
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
                    '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-17-20260907','reasonCodes','[]'::JSONB)),TRUE),
                '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-17-20260907','repair','official_source_full_text_resplit','classification','verified_repair'),TRUE),
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
        ('ad6828fd-7597-4bb3-a791-55a587bc35b5'::UUID,8),
        ('84ae9c2c-8cc4-4cda-8158-e4537647bc0c'::UUID,24),
        ('cbd202c3-9607-4931-8619-01c7ceaeb59b'::UUID,11),
        ('cab038ce-4b2c-443e-8aa4-8c85e105658b'::UUID,21),
        ('55f51e02-3d16-4750-a073-e0d20670a4bc'::UUID,20)
    )
    SELECT pg_catalog.count(*) INTO validated_count
    FROM expected JOIN public.person_claims AS claim ON claim.id=expected.claim_id
    WHERE pg_catalog.jsonb_array_length(claim.claim_json->'items')=expected.item_count
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
      AND claim.claim_json#>>'{contentSplit,releaseQuality,version}'='verified-high-omission-platforms-17-20260907'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='official_source_full_text_resplit'
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='verified_repair';
    IF validated_count<>5 THEN RAISE EXCEPTION 'Expected five validated platform repairs, found %',validated_count; END IF;
END
$validate$;

COMMIT;
