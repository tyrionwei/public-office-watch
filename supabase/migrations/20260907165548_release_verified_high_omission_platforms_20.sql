BEGIN;

DO $review$
DECLARE repair RECORD; affected_count INTEGER;
BEGIN
    FOR repair IN
        SELECT * FROM (VALUES
            ('ad175882-b92f-45da-b903-78b3a379d937'::UUID,'2e48b2ea-642b-4217-87a1-a6f9a06a1980'::UUID,'ee682e37-9f94-4061-adbe-71d5ec110cfc'::UUID,'ab17cb832d59fedd831b6a4f0758365a','22ab7f9351eb0677651a62ef33cd75d1',319,NULL::TEXT,NULL::TEXT,$items$[
                "雙語教育：給孩子更好的：推動國中、小雙語教育。",
                "雙語教育：給孩子更好的：強化線上教學與其配套措施。",
                "雙語教育：給孩子更好的：爭取國民運動中心與親子共融公園。",
                "雙語教育：給孩子更好的：推動流浪貓狗生命教育。",
                "安心長照：南投養老的好地方：增加日間照顧長照機構量能。",
                "安心長照：南投養老的好地方：提升居家照顧量能與品質。",
                "安心長照：南投養老的好地方：活化中興新村的省府宿舍，保留歷史人文景觀，推動長照養生村。",
                "安心長照：南投養老的好地方：推動照服員教育分級徽章。",
                "低污染輕工業區：青年就業沒煩惱：擴大南投市都市計畫，讓新街變成南投市的衛星城市。",
                "低污染輕工業區：青年就業沒煩惱：往名間交流道方向，進行南投市都市計畫擴大，建設輕工業區、長照中心、假日小農市集，增加工作機會，不讓污染給下一代。",
                "低污染輕工業區：青年就業沒煩惱：往南投交流道方向，擴大生活機能，建設青年住宅與社會住宅。"
            ]$items$::JSONB),
            ('f557442f-2e17-47f3-9f4f-c89c896f60ad'::UUID,'f209a422-1032-4725-a2c6-22a7db8c8288'::UUID,'5bab54d7-f374-45d2-a1e7-2217ed58a990'::UUID,'32a7025663e9e44a26d2e713d045a8df','549dcebe95038435da923a98948c4272',182,$text$熱誠服務縣民，永不停止。
一、社福：
1、爭取社區關懷據點設立，落實政府長照政策。提供社區老人樂齡課程，活絡銀髮族退休生活。
2、建構縣內醫療網路，爭取大型醫療院所進駐，提升醫療服務品質。
3、幼兒生育補助加碼，減輕新手爸媽負擔。
4、結合社會資源，關懷弱勢族群。
二、就業：
1、建議縣府成立青年事務局，統籌青年創業就業等事務，吸引青年返鄉就業。
2、促請縣府強化職業訓練，結合地方資源及產業特色，提升職場競爭力，增加就業機會。
3、促請縣府宣傳多元就業政策，提供青年、中高齡及二度就業者，求職便利。
三、治安：
1、補足警消員額及設備，拒絕暴力黑道，保障縣民生命安全。
2、全力支持警政消防及防災預算，打擊犯罪，強化防災。
3、督促完善警政治安監視系統，加強監控維護社區鄰里的治安與保障婦幼安全。
四、教育：
1、注重教育品質，落實品格教育，提升學生基本能力，拉近城鄉差距。
2、活化校園閒置空間，推廣成人終身學習。
3、力推增設公營托兒所，爭取幼兒教育補助，解決年輕世代育兒難題。
五、農業：
1、重視農田道路維護，改善灌溉排水系統。
2、加強輔導精緻農業發展，促進農業升級，協助農產品行銷，增加農民收益。
3、結合觀光，積極爭取設立精緻農業休閒園區。
六、觀光：整合縣內觀光資源，發展地方特色觀光，吸引觀光人潮。
七、財政：嚴格監督縣府財政預算編列與運用。$text$::TEXT,'熱誠服務縣民，永不停止。'::TEXT,$items$[
                "社福：爭取社區關懷據點設立，落實政府長照政策。提供社區老人樂齡課程，活絡銀髮族退休生活。",
                "社福：建構縣內醫療網路，爭取大型醫療院所進駐，提升醫療服務品質。",
                "社福：幼兒生育補助加碼，減輕新手爸媽負擔。",
                "社福：結合社會資源，關懷弱勢族群。",
                "就業：建議縣府成立青年事務局，統籌青年創業就業等事務，吸引青年返鄉就業。",
                "就業：促請縣府強化職業訓練，結合地方資源及產業特色，提升職場競爭力，增加就業機會。",
                "就業：促請縣府宣傳多元就業政策，提供青年、中高齡及二度就業者，求職便利。",
                "治安：補足警消員額及設備，拒絕暴力黑道，保障縣民生命安全。",
                "治安：全力支持警政消防及防災預算，打擊犯罪，強化防災。",
                "治安：督促完善警政治安監視系統，加強監控維護社區鄰里的治安與保障婦幼安全。",
                "教育：注重教育品質，落實品格教育，提升學生基本能力，拉近城鄉差距。",
                "教育：活化校園閒置空間，推廣成人終身學習。",
                "教育：力推增設公營托兒所，爭取幼兒教育補助，解決年輕世代育兒難題。",
                "農業：重視農田道路維護，改善灌溉排水系統。",
                "農業：加強輔導精緻農業發展，促進農業升級，協助農產品行銷，增加農民收益。",
                "農業：結合觀光，積極爭取設立精緻農業休閒園區。",
                "觀光：整合縣內觀光資源，發展地方特色觀光，吸引觀光人潮。",
                "財政：嚴格監督縣府財政預算編列與運用。"
            ]$items$::JSONB),
            ('c25d40b6-1cbe-4d4a-bfbf-dfd8669a1588'::UUID,'376c9919-028d-449b-9dc2-32f9716e51d9'::UUID,'684e8807-4fcd-4fd9-b01b-59481f7fa2dc'::UUID,'3be048ffbd5f421b49139eb308040630','ad9b117c80278c69bf2f9d0f379cddd1',301,NULL::TEXT,NULL::TEXT,$items$[
                "平價幼托・育兒台北：督促成立友善育兒家庭托育環境",
                "平價幼托・育兒台北：補助居家托育人員的軟硬體設備",
                "平價幼托・育兒台北：公幼增班，增設非營利幼兒園、準公共化幼兒園",
                "平價幼托・育兒台北：增設公共場所男女廁尿布檯",
                "平價幼托・育兒台北：消彌孕婦職場歧視",
                "暢行無礙・友善台北：建立各族群友善大眾運輸環境",
                "暢行無礙・友善台北：合理化大眾運輸月票價格",
                "暢行無礙・友善台北：推動城市共享運具",
                "銀髮照顧・敬老台北：友善銀髮休閒活動空間",
                "銀髮照顧・敬老台北：推動多元型日照服務中心",
                "銀髮照顧・敬老台北：提供臨時托老服務",
                "深化民主・國際台北：力挺18歲公民權，擴大青年參與",
                "深化民主・國際台北：成立國際事務局接軌國際",
                "多元生態・動保台北：要求市府公共工程重視在地生態維護",
                "多元生態・動保台北：提升動物福利，推動寵物出生登記"
            ]$items$::JSONB),
            ('eee109e2-1488-404f-bd4a-44d6fb319a8b'::UUID,'5bcfb2ff-727c-4247-b067-577bbe021173'::UUID,'29517528-88a6-46a2-a671-dab05c226757'::UUID,'530361ce6fb3b28c51811059946e821e','ce48e3e91f6c06e4a067019db77f0a31',661,NULL::TEXT,NULL::TEXT,$items$[
                "婦幼代言人：擴大辦理國小學童營養午餐有機米及有機蔬菜。搭配牛奶或優酪乳。",
                "婦幼代言人：爭取二到四歲幼兒私幼每學期補助20,000 元。",
                "婦幼代言人：打造英語友善城市，推動南港優先示範區，擴大辦理英語夏令營。",
                "婦幼代言人：打造親子科學數位圖書館，持續推動親子生物數位圖書館。",
                "婦幼代言人：持續推動親子爆米花電影院結合市圖行動書車推廣閱讀。",
                "市政大建設：推動南港六本木結合東區門戶計畫，打造台北新都心，建立南港空橋連接系統，自中國信託到南港車站到北部流行音樂中心，再到南港機廠社會住宅。",
                "市政大建設：爭取「捷運信義線東延地下化」從玉成公園至南港國宅再到中央研究院，成功獲得市府回應延伸至廣慈/ 奉天宮站規劃案已留設尾軌（設於中坡南路下方），在工程上已保留具有續行延伸至中研院地區之可行性，持續推進中。",
                "市政大建設：成功爭取南港13 個工業區變更為「產業生活特定專用區」，開發期程再展延自變更公告後開始算起六年、工二用增額容積提高獎勵到400%，將持續檢討一二類老舊建物認定標準，爭取全面放寬。",
                "市政大建設：設置義民廟並發展更具特色的客家文化主題園區。",
                "市政大建設：推動設備完善的幸福友善銀髮養生村。",
                "樂活好幸福：持續推動寵物運動公園設施再升級。舉辦毛小孩運動會。變裝趴、愛心美容健檢等專屬活動。",
                "樂活好幸福：65 歲以上申請敬老悠遊卡或愛心悠遊卡，使用點數倍增，持卡每月免費1000 點，並擴大點數可使用範圍。",
                "樂活好幸福：關心內湖復育園區設施，爭取舉辦親子活動。",
                "樂活好幸福：活化世大運網球場。",
                "樂活好幸福：增加活化商圈行銷活動；強化青年創業輔導；保障新住民就業及社會保險權益。"
            ]$items$::JSONB),
            ('53292131-e90e-48d1-a0b8-cbaf1d3e3229'::UUID,'3168e677-72cf-479e-b530-133f77721bf0'::UUID,'1192c20e-e14d-4b3b-b4ef-cc641e5da8c5'::UUID,'f977fcb03769e5d5945f68ea8b314f4f','79d3e30f3b11780f87db4ea1be988837',325,NULL::TEXT,NULL::TEXT,$items$[
                "為你做更好：串連各大眾運輸工具與汽機車道，打造海線交通路網",
                "為你做更好：打造海線觀光廊道",
                "為你做更好：公園遊憩設施規劃體檢革新",
                "為你做更好：南山截水溝第三期",
                "為你做更好：加速活化台中港特定區",
                "為孩童：公托公幼海線倍增",
                "為孩童：推動寶貝照顧者喘息支援",
                "為孩童：照顧教保員，爭取福利",
                "為孩童：營養午餐品質把關",
                "為長輩：老人健保持續補助",
                "為長輩：愛心卡補助升級、服務擴大",
                "為長輩：推動公辦青銀共居住宅",
                "為長輩：擴大推動長照關懷據點",
                "為青年：督促持續興建社會住宅",
                "為青年：倡議社會住宅多元房源",
                "為青年：推動青年社宅回饋計畫",
                "為青年：青創單一窗口天使計畫",
                "為環境：因應氣候打造韌性城市",
                "為環境：台中淨零碳排路徑規劃",
                "為環境：空氣品質持續改善",
                "為環境：研議推廣垃圾減量獎勵"
            ]$items$::JSONB)
        ) AS row(claim_id,person_id,candidate_id,source_md5,value_md5,value_length,replacement_value,platform_intro,items)
    LOOP
        UPDATE public.person_claims AS claim
        SET claim_value=COALESCE(repair.replacement_value,claim.claim_value),
            claim_json=pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(
                        pg_catalog.jsonb_set(
                            CASE WHEN repair.platform_intro IS NULL THEN COALESCE(claim.claim_json,'{}'::JSONB)
                                 ELSE pg_catalog.jsonb_set(COALESCE(claim.claim_json,'{}'::JSONB),'{platformIntro}',pg_catalog.to_jsonb(repair.platform_intro),TRUE) END,
                            '{platformText}',pg_catalog.to_jsonb(COALESCE(repair.replacement_value,claim.claim_value)),TRUE),
                        '{items}',repair.items,TRUE),
                    '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-20-20260908','reasonCodes','[]'::JSONB)),TRUE),
                '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-20-20260908','repair',CASE WHEN repair.replacement_value IS NULL THEN 'official_source_full_text_resplit' ELSE 'official_source_misattribution_replaced' END,'classification','verified_repair'),TRUE),
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
    WITH expected(claim_id,item_count,repair_kind) AS (VALUES
        ('ad175882-b92f-45da-b903-78b3a379d937'::UUID,11,'official_source_full_text_resplit'),
        ('f557442f-2e17-47f3-9f4f-c89c896f60ad'::UUID,18,'official_source_misattribution_replaced'),
        ('c25d40b6-1cbe-4d4a-bfbf-dfd8669a1588'::UUID,15,'official_source_full_text_resplit'),
        ('eee109e2-1488-404f-bd4a-44d6fb319a8b'::UUID,15,'official_source_full_text_resplit'),
        ('53292131-e90e-48d1-a0b8-cbaf1d3e3229'::UUID,21,'official_source_full_text_resplit')
    )
    SELECT pg_catalog.count(*) INTO validated_count
    FROM expected JOIN public.person_claims AS claim ON claim.id=expected.claim_id
    WHERE pg_catalog.jsonb_array_length(claim.claim_json->'items')=expected.item_count
      AND claim.claim_json->>'platformText'=claim.claim_value
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
      AND claim.claim_json#>>'{contentSplit,releaseQuality,version}'='verified-high-omission-platforms-20-20260908'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'=expected.repair_kind
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='verified_repair';
    IF validated_count<>5 THEN RAISE EXCEPTION 'Expected five validated platform repairs, found %',validated_count; END IF;
END
$validate$;

COMMIT;
