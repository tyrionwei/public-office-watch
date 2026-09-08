BEGIN;

DO $review$
DECLARE repair RECORD; affected_count INTEGER;
BEGIN
    FOR repair IN
        SELECT * FROM (VALUES
            ('3129d1fd-2eb4-40d8-9309-57ff77345d7b'::UUID,'64338b89-0816-4e8b-8693-492770be8602'::UUID,'957c7e75-83d4-44b9-930a-86364626466d'::UUID,'ad63fd766f9e488ef38e49228af99547','9e9ed063903430674d568edf229b9e53',264,NULL::TEXT,'「給孩子更好的未來」是我的承諾。打破政治世家的包袱，羅廷瑋是小家庭的發言人，更懂大家的心聲與需要。我承諾市政、經濟與福利優先，理性問政。'::TEXT,$items$[
                "推動特色好玩公園及親水公園。",
                "持續增加公立幼兒園與公共托育。",
                "健全幼教人員福利與職場權益。",
                "持續爭取親子館並增加內部軟體設施。",
                "已爭取社會住宅900戶，後續持續推動社會住宅。",
                "監督市府老樹保護及柳川整治。",
                "持續改善更新校園環境。",
                "協助民眾申請輔具及處理就業問題。",
                "推廣程式語言及機器人課程。",
                "推動兒童早期療育篩檢補助。",
                "爭取加強節電優惠補助。"
            ]$items$::JSONB),
            ('38dcce6d-31fd-41e8-9f14-bc6e9d873d8b'::UUID,'f532946d-1269-4ad6-9b1c-c13bc3794d8b'::UUID,'99cd299e-a274-4c19-bcb2-466b736d7e10'::UUID,'2d29df6e6b126a1f845bb2b46a872601','c429e1b9c86f39ec9124952ec16ba143',819,NULL::TEXT,NULL::TEXT,$items$[
                "教育優先：課業與才藝並重、雙語教學、AI教育落實，並支持老師專職教學與行政分工。",
                "產業發展：繼續督促縣府將沿海各鄉鎮文化觀光串聯、地方創生推動、養生新農業推廣及園區設立，以創造就業機會、減少人口外流，包含：於東勢鄉同安昌南東側台糖地規劃冷鏈物流、農產品加工園區。",
                "產業發展：於台西鄉、四湖鄉內設立工業或產業園區。",
                "產業發展：於台西舊公所改建為林國基娃娃館或多功能生活館。",
                "產業發展：繼續爭取沿子寮漁港護堤延伸，疏濬通航、再現風華。",
                "長照醫療：推動老人福利、社區樂齡學習與共餐，完善醫療照護。",
                "弱勢翻轉：繼續督促推廣弱勢單親、新住民、身障者第二專長培養，包含農業大學相關課程，能於沿海各鄉鎮輪流開課，就地學習、就地成長；無障礙公車、無障礙計程車、友善空間繼續加強推廣。",
                "交通建設：麥寮台塑工業區跨隔離水道橋樑，經雲2道路接雲2-1到雲1-1線即停止，未連接到台17線將功虧一簣；需強力爭取雲1-1停止點向東再延伸約2公里銜接台17線，才能真正減緩麥寮市區上下班交通問題。",
                "交通建設：爭取麥寮至西螺北側興建「78乙濁水溪南岸快速道路」，從六輕北堤平面道路結合現有堤岸道路拓寬整建或高架化，連通到西螺國道1號，以完善雲林縣北端交通網絡，帶動濁水溪南岸各鄉鎮區域發展。",
                "交通建設：爭取東勢鄉從北環東路與雲158線交叉口向南新開闢扇形外環道，貫穿三塊厝西側並銜接153線，以解決東勢鄉市區南北向交通問題。",
                "交通建設：督促160縣道拓寬工程第三段（飛沙至三條崙）、雲129文化路（林厝至崙北）路面改善工程早日完成。",
                "生活品質：協助地方爭取於台西鄉、東勢鄉內設立運動公園及興建台西鄉立圖書館；督促改善沿海各村易淹水區，擴大滯洪池、加強抽水馬力、定期排水清淤，以減少淹水發生。",
                "生活品質：贊成沿海四鄉合併升格為市，山海平衡、回饋共享、進步共榮。",
                "生活品質：繼續反對各村莊一公里內設立風力發電或變電所，以捍衛沿海各鄉鎮居民健康與生計。"
            ]$items$::JSONB),
            ('3dc80306-500f-4640-8824-46fed3755883'::UUID,'cc250214-4368-4476-ba8a-b5a280439559'::UUID,'9e3930d9-9873-43b5-a66e-75b8883ecc46'::UUID,'e69bffa861051b5ff3b6f034208c7154','44a8e0c51743658ec4c52fb09d002d3c',439,$text$1. 重視追蹤原住民族學生的學習成效；原住民文化、族語課程的落實情形。
2. 追蹤原住民族預算執行率。
3. 完善都會原住民頭目(族群領袖)、生活協進會制度。
4. 提升原住民租屋、房屋修繕補助金額。
5. 提升、尊重各原住民族傳統祭儀及文化活動之辦理自由度。
6. 維護土地權、滾動式檢討國土暨都市計畫。
7. 適當配置原鄉醫療資源、縮短救護時程。
8. 重要道路、橋梁老化補強、水溝加蓋。
9. 穩定原鄉灌溉、民生用水品質機制。
10. 定期檢視各類既有補助提升、增減。$text$::TEXT,NULL::TEXT,$items$[
                "重視追蹤原住民族學生的學習成效；原住民文化、族語課程的落實情形。",
                "追蹤原住民族預算執行率。",
                "完善都會原住民頭目(族群領袖)、生活協進會制度。",
                "提升原住民租屋、房屋修繕補助金額。",
                "提升、尊重各原住民族傳統祭儀及文化活動之辦理自由度。",
                "維護土地權、滾動式檢討國土暨都市計畫。",
                "適當配置原鄉醫療資源、縮短救護時程。",
                "重要道路、橋梁老化補強、水溝加蓋。",
                "穩定原鄉灌溉、民生用水品質機制。",
                "定期檢視各類既有補助提升、增減。"
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
                    '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-21-20260908','reasonCodes','[]'::JSONB)),TRUE),
                '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-21-20260908','repair',CASE WHEN repair.replacement_value IS NULL THEN 'official_source_full_text_resplit' ELSE 'official_source_misattribution_replaced' END,'classification','verified_repair'),TRUE),
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
        ('3129d1fd-2eb4-40d8-9309-57ff77345d7b'::UUID,11,'official_source_full_text_resplit'),
        ('38dcce6d-31fd-41e8-9f14-bc6e9d873d8b'::UUID,14,'official_source_full_text_resplit'),
        ('3dc80306-500f-4640-8824-46fed3755883'::UUID,10,'official_source_misattribution_replaced')
    )
    SELECT pg_catalog.count(*) INTO validated_count
    FROM expected JOIN public.person_claims AS claim ON claim.id=expected.claim_id
    WHERE pg_catalog.jsonb_array_length(claim.claim_json->'items')=expected.item_count
      AND claim.claim_json->>'platformText'=claim.claim_value
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
      AND claim.claim_json#>>'{contentSplit,releaseQuality,version}'='verified-high-omission-platforms-21-20260908'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'=expected.repair_kind
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='verified_repair';
    IF validated_count<>3 THEN RAISE EXCEPTION 'Expected three validated platform repairs, found %',validated_count; END IF;
END
$validate$;

COMMIT;
