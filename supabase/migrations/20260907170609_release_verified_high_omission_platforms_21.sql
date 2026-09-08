BEGIN;

-- Bridge exact production pre-repair texts to the audited migration baseline.
-- This stays inside the release transaction: the final repair must succeed.
CREATE TEMP TABLE release_source_baselines (id uuid PRIMARY KEY, person_id uuid NOT NULL, candidate_id uuid, claim_key text NOT NULL, production_text text NOT NULL, audited_text text NOT NULL) ON COMMIT DROP;
INSERT INTO release_source_baselines VALUES
('3129d1fd-2eb4-40d8-9309-57ff77345d7b'::uuid,'64338b89-0816-4e8b-8693-492770be8602'::uuid,'957c7e75-83d4-44b9-930a-86364626466d'::uuid,'cec-platform:2022:votetw-candidate-fe2905d95b889a1b','「給孩子更好的未來 !」 是我的承諾 , 打破政治記家的包袱 , 羅廷瑋是小家庭的發言人 , 更懂大家的心聲與需要 ,
我承諾市政經濟 (福利 ) 優先 , 理性問政 , 請看看我爭取的建設成績單還有識會的言論 , 請掃描 QRCODE 詳閱。
六特色好玩公園 ( 水公園 ) 等。 傘續增公幼與公托倍增。 偽健全幼教人員福利與職場人義繼爭取親子館 2 座後續增加內部軟體
傘已達成社會住宅 900 戶後再續建他監督市府老樹保護、 售將斷、 柳川整治續建下洲 0
SUES
le
OF FAMIUE @BRFAEFHRENS @RBHTRLEE ERE ai hs ed
Ost FAIREAHY @ATEAARENASEN ORI-A- Th OmEsEn OREEE |= =
[1 #A sk | 6
俯校園環境繼續改善更新傘協助申請輔具與就業問題 @ 55% R&B HEAT © Qe) =
恣推廣程式語言機器人課程。 倫兒童早療節檢補助 @ AMEX MEL RE \
OHH EMME BHERE OWS ERB HEI LH LE A
Ov FRAN BH RA (YTESR EFF TR SS OH AE REALE
:
OLEFBLANETAK Ot 1 EF RERITILT I © 4 4 kk FAR iA 下
戀搜取加強節電優惠補助 oxsnrnpammieries Omusisk wu ak IID 3 dl
AN F ee E Spry
@h& HAIER REE Hm AAR Y BUFR','「給孩子更好的未來」是我的承諾。打破政治世家的包袱，羅廷瑋是小家庭的發言人，更懂大家的心聲與需要。我承諾市政、經濟與福利優先，理性問政。

一、推動特色好玩公園及親水公園。
二、持續增加公立幼兒園與公共托育。
三、健全幼教人員福利與職場權益。
四、持續爭取親子館並增加內部軟體設施。
五、已爭取社會住宅900戶，後續持續推動社會住宅。
六、監督市府老樹保護及柳川整治。
七、持續改善更新校園環境。
八、協助民眾申請輔具及處理就業問題。
九、推廣程式語言及機器人課程。
十、推動兒童早期療育篩檢補助。
十一、爭取加強節電優惠補助。'),
('38dcce6d-31fd-41e8-9f14-bc6e9d873d8b'::uuid,'f532946d-1269-4ad6-9b1c-c13bc3794d8b'::uuid,'99cd299e-a274-4c19-bcb2-466b736d7e10'::uuid,'cec-platform:2022:votetw-candidate-6bdf5eadb39a7542','一、教育優先: Ce nea、課業與才藝並重、雙語教學、AI 教育落實,及支持老師專職教學與行政分
二、產業發展:繼續督促縣府將沿海各鄉鎮文化觀光串聯、地方創生推動、養生新農業推廣、園區設立以創造就業
機會減少人口外流,包含:1、於東勢鄉同安昌南東側台糖地規劃冷鏈物流、農產品加工園區。2、
於台西鄉、四湖鄉內設立工業或產業園區。3、於台西舊公所改建為林國基娃娃館或多功能生活館。
4、繼續爭取沿子寮漁港護堤延伸,疏沈通航再現風華。
三、長照醫療 : Are POIRIER De ELIE AEE :老人和福利、社區樂齡學才與共餐,與完善醫療照護
過、弱勢翻轉:繼續督促推廣弱勢單親、新住民、身障者第二專長培養,包含農業大學相關課程,能於沿海各鄉鎮
輪流開課,就地學習就地成長;無障礙公車、無障礙計程車、友善空間繼續加強推廣。
五、交通建設: 1、麥寮台塑工業區跨隔離水道橋樑經雲 2 道路接雲 2-1 到雲 1-1 線就停止,未連接到台 17 線將功
虧一箕,所以需強力爭取雲 1-1 停止點向東再延伸約 2 公里銜接台 17 線 ,才能真正減緩麥察市區
上下班交通問題。2、爭取麥寮-西螺北側興建「78 乙濁水溪南岸快速道路」,從六輕北堤平面道路
結合現有堤岸道路拓寬整建或高架化,連通到西曲「國道1」,以完善雲林縣北端交通網絡,帶動濁
水溪南岸各鄉鎮區域發展。3、爭取東勢鄉從北環東路與雲 158 交叉口,向南新開關扇形外環道:貴
穿三塊摸西側、 BATTAL +嘉六南路到嘉隆村銜接 153 線,以解決東勢鄉市區南北向交通問題。4、
Eee 160 縣道拓寬工程第三段(飛沙至三條窒)、雲 129 文化路 (林厝-窒北) 路面改善工程
日完成。
六、生活品質:1、協助地方爭取於台西鄉、東勢鄉內設立運動公園;台西鄉立圖書館恩建;督促改善沿海各村易淹
水區:滯洪池擴大、抽水馬力加強、定期排水清淤,以減少淹水發生。2、贊成沿海四鄉合併升格為
市,山海平衡、回饋共享、進步共榮!3、繼續反對各村莊一公里內設立風力發電或變電所,以捍衛
沿海各鄉鎮居民健康與生計。','一、教育優先
課業與才藝並重、雙語教學、AI教育落實，並支持老師專職教學與行政分工。

二、產業發展
繼續督促縣府將沿海各鄉鎮文化觀光串聯、地方創生推動、養生新農業推廣及園區設立，以創造就業機會、減少人口外流，包含：
1. 於東勢鄉同安昌南東側台糖地規劃冷鏈物流、農產品加工園區。
2. 於台西鄉、四湖鄉內設立工業或產業園區。
3. 於台西舊公所改建為林國基娃娃館或多功能生活館。
4. 繼續爭取沿子寮漁港護堤延伸，疏濬通航、再現風華。

三、長照醫療
推動老人福利、社區樂齡學習與共餐，完善醫療照護。

四、弱勢翻轉
繼續督促推廣弱勢單親、新住民、身障者第二專長培養，包含農業大學相關課程，能於沿海各鄉鎮輪流開課，就地學習、就地成長；無障礙公車、無障礙計程車、友善空間繼續加強推廣。

五、交通建設
1. 麥寮台塑工業區跨隔離水道橋樑，經雲2道路接雲2-1到雲1-1線即停止，未連接到台17線將功虧一簣；需強力爭取雲1-1停止點向東再延伸約2公里銜接台17線，才能真正減緩麥寮市區上下班交通問題。
2. 爭取麥寮至西螺北側興建「78乙濁水溪南岸快速道路」，從六輕北堤平面道路結合現有堤岸道路拓寬整建或高架化，連通到西螺國道1號，以完善雲林縣北端交通網絡，帶動濁水溪南岸各鄉鎮區域發展。
3. 爭取東勢鄉從北環東路與雲158線交叉口向南新開闢扇形外環道，貫穿三塊厝西側並銜接153線，以解決東勢鄉市區南北向交通問題。
4. 督促160縣道拓寬工程第三段（飛沙至三條崙）、雲129文化路（林厝至崙北）路面改善工程早日完成。

六、生活品質
1. 協助地方爭取於台西鄉、東勢鄉內設立運動公園及興建台西鄉立圖書館；督促改善沿海各村易淹水區，擴大滯洪池、加強抽水馬力、定期排水清淤，以減少淹水發生。
2. 贊成沿海四鄉合併升格為市，山海平衡、回饋共享、進步共榮。
3. 繼續反對各村莊一公里內設立風力發電或變電所，以捍衛沿海各鄉鎮居民健康與生計。'),
('3dc80306-500f-4640-8824-46fed3755883'::uuid,'cc250214-4368-4476-ba8a-b5a280439559'::uuid,'9e3930d9-9873-43b5-a66e-75b8883ecc46'::uuid,'cec-platform:2022:votetw-candidate-aa557b3b545c2292','福利權益：
1、爭取提升原住民社會住宅比例
2、增加公托原住民族生錄取名額
3、增加成立原住民傳統農耕示範區
教體發展：
1、協助輔導成立原住民課後輔導班
2、利用E化教學，落實原住民學生學習族語之權益
3、增加羅浮完全中學科系多樣化及發展原住民族教育特色
4、培育原住民體育人才，輔導體育人才多元發展及就業
產業文化：
1、推廣原住民傳統文化活動及技藝，常辦理相關技藝課程及建立原民技藝交流平台
2、爭取國際原住民文創園區規劃發展原住民族文創產業及農特產市集
青年扶植：
1、結合各族群成立原住民青年諮詢委員會，並定時舉辦青年論壇及交流活動
2、增加原住民多元職業訓練專班及證照班
3、增加原住民青年創業空間，輔導原住民青年創業
原鄉發展：
1、爭取自來水管線延伸至羅浮、義盛、霞雲
2、推動原鄉醫療，爭取成立醫療中心及洗腎中心
3、協助族人處理電信通訊問題
4、妥處原住地保留地、違建糾紛
6、完善市管道路及增加觀光亮點，美化部落
7、市管風景區及羅浮溫泉攤販租金優惠及長期輔導','福利權益:
1、爭取提升原住民社會住宅比例
2、增加公托原住民族生錄取名額
3、增加成立原住民傳統農耕示範區
教體發展:
1、協助輔導成立原住民課後輔導班
2、利用E化教學,落實原住民學生學習族語之權益
3、增加羅浮完全中學科系多樣化及發展原住民族教育特色
4、培育原住民體育人才,輔導體育人才多元發展及就業
產業文化:
1、推廣原住民傳統文化活動及技藝,常辦理相關技藝課程及建立原民技藝交流平台
2、爭取國際原住民文創園區規劃發展原住民族文創產業及農特產市集
青年扶植:
1、結合各族群成立原住民青年諮詢委員會,並定時舉辦青年論壇及交流活動
2、增加原住民多元職業訓練專班及證照班
3、增加原住民青年創業空間,輔導原住民青年創業
原鄉發展:
1、爭取自來水管線延伸至羅浮、義盛、霞雲
2、推動原鄉醫療,爭取成立醫療中心及洗腎中心
3、協助族人處理電信通訊問題
4、妥處原住地保留地、違建糾紛
6、市管道路及增加觀光亮點,美化部落
7、市管風景區及羅浮溫泉攤販租金優惠及長期輔導');
UPDATE public.person_claims AS c
SET claim_value=b.audited_text, claim_json=jsonb_set(c.claim_json,'{platformText}',to_jsonb(b.audited_text))
FROM release_source_baselines b
WHERE c.id=b.id AND c.person_id=b.person_id
  AND c.candidate_id IS NOT DISTINCT FROM b.candidate_id
  AND c.claim_key=b.claim_key AND c.claim_type='platform'
  AND c.claim_value=b.production_text
  AND c.claim_json->>'platformText'=b.production_text
  AND c.claim_json#>>'{contentSplit,reviewStatus}'='needs_review';


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


DO $baseline_completion$ BEGIN
 IF EXISTS (SELECT 1 FROM release_source_baselines b LEFT JOIN public.person_claims c ON c.id=b.id
 WHERE c.id IS NULL OR c.person_id IS DISTINCT FROM b.person_id
 OR c.candidate_id IS DISTINCT FROM b.candidate_id OR c.claim_key IS DISTINCT FROM b.claim_key
 OR c.claim_json#>>'{contentSplit,reviewStatus}' IS DISTINCT FROM 'reviewed'
 OR c.claim_json#>>'{platformQualityAudit,classification}' IS DISTINCT FROM 'verified_repair') THEN
 RAISE EXCEPTION 'Production baseline bridge did not finish an identity-matched verified repair';
 END IF;
END $baseline_completion$;

COMMIT;
