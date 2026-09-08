BEGIN;

-- Bridge exact production pre-repair texts to the audited migration baseline.
-- This stays inside the release transaction: the final repair must succeed.
CREATE TEMP TABLE release_source_baselines (id uuid PRIMARY KEY, person_id uuid NOT NULL, candidate_id uuid, claim_key text NOT NULL, production_text text NOT NULL, audited_text text NOT NULL) ON COMMIT DROP;
INSERT INTO release_source_baselines VALUES
('72c762be-1e05-4ff9-9b66-f492d5f4befb'::uuid,'1f5373e1-707c-41a1-8f5b-4712a9e371ab'::uuid,'f4b35f5a-d695-4fb6-ac1f-b1404daf718a'::uuid,'cec-platform:2024:votetw-candidate-ace2593e330616df','優化・強化・深化，以戰鬥力、執行力、親和力來建設新時代的富麗金門。

一、新建馬山港；六大長照床位倍增。
二、推動金廈通大橋；設立醫療特區。
三、爭取貨物零稅率；縮減國家公園範圍。
四、爭取金門興建榮民之家；增加觀光資源。
五、設立腫瘤中心；推動離島基本法。','優化・強化・深化
以戰鬥力・執行力・親和力來建設新時代的富麗金門
「優化」金門聯外交通・「強化」金門醫療照護・「深化」金門觀光資源

一、新建馬山港，東半島看漲
二、金廈通大橋，兩岸保和平
三、貨物零稅率，經濟拚永續
四、金門蓋榮家，老兵有個家
五、設腫瘤中心，免台金奔波
六、長照床倍增，老人顧得好
七、設醫療特區，鄉親好安居
八、縮國家公園，爭還地於民
九、增觀光資源，護史蹟文化
十、離島基本法，發展會更好

戰鬥力：持續爭取建設經費
執行力：落實對鄉親各項承諾
親和力：做好為民服務工作'),
('884d41e3-68e1-4ae2-9faa-549f1994426f'::uuid,'35118713-e1d7-4b70-85d6-8edfa094aa47'::uuid,'521c5920-f5c9-46e8-b055-6c47fc356c8a'::uuid,'official-profile:tainan-city-council-current-councilors:aff972cb12c1:35118713-e1d7-4b70-85d6-8edfa094aa47:platform','1. 推動南41線佳里、西港段跨曾文溪至安南區段之交通系統建設，連結西港、佳里都市計畫與新吉工業區、臺南市主要計畫區的生活圈聯絡道路。
2. 推動國道一號增設西港交流道紓解麻豆、佳里丶西港等地區通勤民眾前往南科的交通雍塞問題。
3. 一區一特色公園，重視城市綠化、結合地方創生、打造樂居城市應有的共融式特色主題公園。
4. 全力配合台61沿線濱海水陸遊憩軸帶規劃建設，發展打造臺南濱海大北門區遊憩觀光並帶動地方產業生計。
5. 爭取提高青年生育補助津貼、延長育兒補助津貼。
6. 爭取臺南市65歲以上長者免健保費。
7. 爭取房屋稅凍漲、停徵追溯15年，減輕民眾負擔。
8. 加速臺南七股科技工業區開發完成為南科供應鏈衛星基地，帶動大北門區就業機會及居住繁榮。
9. 爭取西港區拓寬東側外環道北段建設，多年爭取的東外環道南段已完工。
發布日期','1. 推動南41線佳里、西港段跨曾文溪至安南區段之交通系統建設，連結西港、佳里都市計畫與新吉工業區、臺南市主要計畫區的生活圈聯絡道路。
2. 推動國道一號增設西港交流道紓解麻豆、佳里丶西港等地區通勤民眾前往南科的交通雍塞問題。
3. 一區一特色公園，重視城市綠化、結合地方創生、打造樂居城市應有的共融式特色主題公園。
4. 全力配合台61沿線濱海水陸遊憩軸帶規劃建設，發展打造臺南濱海大北門區遊憩觀光並帶動地方產業生計。
5. 爭取提高青年生育補助津貼、延長育兒補助津貼。
6. 爭取臺南市65歲以上長者免健保費。
7. 爭取房屋稅凍漲、停徵追溯15年，減輕民眾負擔。
8. 加速臺南七股科技工業區開發完成為南科供應鏈衛星基地，帶動大北門區就業機會及居住繁榮。
9. 爭取西港區拓寬東側外環道北段建設，多年爭取的東外環道南段已完工。'),
('938b21a3-ff01-4edb-9d42-731507e17691'::uuid,'e794fd0c-d492-4ded-bea8-393c5a87ec3e'::uuid,'b9b8b1c4-da30-43f4-9be6-8eb3cefe422c'::uuid,'cec-platform:2022:votetw-candidate-0dfc67a57b00cf9a','鳳山女兒李雅靜 , 點亮鳳山、 鳳山亮起來 !
一、 青年新希望 : 全力支持 18 歲公民權修憲 | 推動青年就業、 創業輔導機制 , 降低青年失業率 , 提高生育補助、 提升托育政策 ,
讓年輕人敢生、 能養。
二、 鳳山健康醫療產業園區 : 爭取五甲農業區轉型 , 打造鳳山健康醫療產業轅區, 引進醫學中心等級醫院進駐 , 強化鳳山醫療量
能及資源 , 引進智慧醫材產業鍵 , 讓鳳山成為南台灣健康醫療產業重地。
三、 活化國有土地 : 成功爭取誠智里灣頭南巷圖有地 , 為鳳山留下淨土 , 持續推動開發教育文化學禿、 專職技能訓練場域等文教
社福建設 , 符合鄉親公共利益使用項目。
四、 強化社會安全網 : 爭取補足治安、 公安、 勞安專業人員員額 , 並爭取汰換老舊裝備 , 強化社會安全網 , 讓市民安心。
五、 再現黃埔過華 : 持續推動地方創生結合黃埔新村 , 連結周邊經濟產業、 文化 , 重現黃埔風華 , 打造成為全台唯一活的眷村博
物館。
六、 璀璨鳳山溪 : 持續推動改善鳳山溪流域水質整治 , 美化沿岸親水空間 , 打造區段親水公園、 裝置藝術燈區 , 夜晚蛻變為璀下
燈河 , 吸引人潮、 帶動商機。
七、 商圈生態共榮 : 打造全齡無差別化特色形象商圈、 市場、 夜市 , 結合地方生態活絡在地商機 , 形成底民經濟生態回 , 全面振
興庶民經濟。
入、 推動便利停車 : 繼成功爭取鳳山運動園區地下停車場、 北昌路停車場 , 持續推動設置停車場 , 解決鳳山停車困境。
九、 活化閒置空間 : 盤點、 推動活化市有閒置空間 , 增設育幼、 銀髮樂活空間、 國民運動中心、 兒童運動中心等。','鳳山女兒李雅靜,點亮鳳山、鳳山亮起來!
一、青年新希望:全力支持18歲公民權修憲!推動青年就業、創業輔導機制,降低青年失業率,提高生育補助、提升托育政策,讓年輕人敢生、能養。
二、鳳山健康醫療產業園區:爭取五甲農業區轉型,打造鳳山健康醫療產業園區,引進醫學中心等級醫院進駐,強化鳳山醫療量能及資源,引進智慧醫材產業鏈,讓鳳山成為南台灣健康醫療產業重地。
三、活化國有土地:成功爭取誠智里灣頭南巷國有地,為鳳山留下淨土,持續推動開發教育文化學苑、專職技能訓練場域等文教社福建設,符合鄉親公共利益使用項目。
四、強化社會安全網:爭取補足治安、公安、勞安專業人員員額,並爭取汰換老舊裝備,強化社會安全網,讓市民安心。
五、再現黃埔風華:持續推動地方創生結合黃埔新村,連結周邊經濟產業、文化,重現黃埔風華,打造成為全台唯一活的眷村博物館。
六、璀璨鳳山溪:持續推動改善鳳山溪流域水質整治,美化沿岸親水空間,打造區段親水公園、裝置藝術燈區,夜晚蛻變為璀璨燈河,吸引人潮、帶動商機。
七、商圈生態共榮:打造全齡無差別化特色形象商圈、市場、夜市,結合地方生態活絡在地商機,形成庶民經濟生態圈,全面振興庶民經濟。
八、推動便利停車:繼成功爭取鳳山運動園區地下停車場、北昌路停車場,持續推動設置停車場,解決鳳山停車困境。
九、活化閒置空間:盤點、推動活化市有閒置空間,增設育幼、銀髮樂活空間、國民運動中心、兒童運動中心等。'),
('9644c26a-ddd5-4cc4-98ca-6ad1d2ae7969'::uuid,'80082cee-85ef-40a3-bb95-0e427771edbd'::uuid,'80e29c35-168f-4a70-97f1-15557bb06491'::uuid,'cec-platform:2022:votetw-candidate-16668e746656a0aa','苗栗縣議員陳光軒 | 苗栗 NEXT 進步有我。 |
@ 爭取縣府第二行政中心於竹南頭份共同生活圈設立。
@ 持續推動全縣人手孔蓋地下化 , 並提案修正自治條例 , 要求管線挖掘後應即刻全
車道修復以確保道路平整 ; 推動共同管溝 , 減少道路因挖角而毀損。
@ 爭取非營利幼兒園增設幼幼班 , 盤點閒置空間建置公辦民營托嬰中心。
@ 持續推動設置頭份第二交流道 (2017 年提案爭取。 現已完成可行性評估報告 )。
@ 讓長輩活得健康有尊嚴 , 爭取 65 歲以上長輩免費安裝假牙。
@ 盤點閒置空間 , 爭取建設頭份竹南地區寵物公園。
依持續提案完成各項自治條例、 行政規章的制定、 修正。','1. 爭取縣府第二行政中心於竹南頭份共同生活圈設立。
2. 持續推動全縣人手孔蓋地下化，並提案修正自治條例，要求管線挖掘後應即刻全車道修復以確保道路平整；推動共同管溝，減少道路因挖掘而毀損。
3. 爭取非營利幼兒園增設幼幼班，盤點閒置空間建置公辦民營托嬰中心。
4. 持續推動設置頭份第二交流道（2017年提案爭取，現已完成可行性評估報告）。
5. 讓長輩活得健康有尊嚴，爭取65歲以上長輩免費安裝假牙。
6. 盤點閒置空間，爭取建設頭份竹南地區寵物公園。
7. 持續提案完成各項自治條例、行政規章的制定、修正。'),
('d5435035-0f80-4952-9816-b7aede1eefee'::uuid,'fe9e8dfe-eb13-48da-8797-fbdfc4504172'::uuid,'a27ecf7e-8b97-41bd-8c07-1b0cea9dcd6f'::uuid,'cec-platform:2022:votetw-candidate-647d01b42270fcd2','LL 成立各里公辦老人日照中心
2. 爭取增設公立幼兒園 , 並協助私立幼兒園公共化
3. 爭取補助老屋健檢及裝設住宅火災警報器
4. 推廣在地食物銀行計畫
5. 爭取成立寵物公園
6. 鏈結國際 , 中等以下學校全面推動 SDGs 教育
7. 監督市府興建平價公宅 , 落實居住正義','1.成立各里公辦老人日照中心
2.爭取增設公立幼兒園，並協助私立幼兒園公共化
3.爭取補助老屋健檢及裝設住宅火災警報器
4.推廣在地食物銀行計畫
5.爭取成立寵物公園
6.鏈結國際，中等以下學校全面推動SDGs教育
7.監督市府興建平價公宅，落實居住正義');
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
DECLARE
    review RECORD;
    affected_count INTEGER;
    total_affected INTEGER := 0;
BEGIN
    FOR review IN
        SELECT *
        FROM (
            VALUES
                ('7d18f839-e0be-450c-b5fc-011cb2a36af6'::UUID, '0d33c1ca-17f5-4ad3-bf5b-832d6eebe3ff'::UUID, 'ef7c9721-212c-4c59-b4c3-f03aaedbb695'::UUID, 'official-profile:taichung-city-council-current-councilors:86987d20656b:0d33c1ca-17f5-4ad3-bf5b-832d6eebe3ff:platform'::TEXT, '2f1b90d071c7bfc3d7771e34398ad21f'::TEXT, 503, 'bed766cc037952644591072fd243ce99'::TEXT, 'official_council_page_section_repair'::TEXT, $items$["青年友善政策：落實居住正義，推動社宅四年8000戶，建立多元空間共享計畫。","青年友善政策：建立青年友善城市，推動成立青年事務局，整合資源孕育青創力。","青年友善政策：支持青年創業，成立青年創業基金，打造優質創業環境。","教育優先尊重文化：強化學校各項硬體設施，打造優質教學環境，提升教學品質。","教育優先尊重文化：實踐學校特色教學，創造學童多元學習環境。","教育優先尊重文化：推動國際、校際交流活動，開創學童視野與國際觀。","教育優先尊重文化：落實古蹟空間再利用，連結歷史及文化資產區域，再現土地與人民的歷史。","教育優先尊重文化：推動文化資產導覽系統，達成文化資產推廣及教育的功能。","重視環保與生態：因應環境氣候變遷，推動減塑政策。","重視環保與生態：持續要求減碳，嚴查空污，保護地球生存環境。","重視環保與生態：重視水土保持，推動成立國家自然公園。","推動建設繁榮經濟：推動在地特色大型共融公園，打造具有多元刺激、互動、有趣且舒適的遊戲環境。","推動建設繁榮經濟：海線雙捷運，捷運藍線四年內動工，捷運橘線通過可行性評估。","推動建設繁榮經濟：以輕軌連結海線沿途觀光景點，串連台中三井outlet、高美濕地、梧棲觀光漁港等景點，創造觀光產值。","開創優質政治：清廉參選、重視民意，積極服務。","開創優質政治：拒絕貪汙、利益勾結。"]$items$::JSONB),
                ('00679afa-4cc7-42ac-9404-9fe38c15b9f8'::UUID, 'd2d3c2cb-c307-40e1-a7c9-c4c39617810d'::UUID, '4ec9a23c-331c-4326-a79b-f21c36397bd6'::UUID, 'official-profile:hsinchu-city-council-current-councilors:2152917a766a:d2d3c2cb-c307-40e1-a7c9-c4c39617810d:platform'::TEXT, 'ecb5a91a765e5b0c2b417a41526a0388'::TEXT, 816, '6d97712f06b25532f95ed4db538d17ac'::TEXT, 'official_council_page_section_and_footer_repair'::TEXT, $items$["觀光要盈：規劃市集推廣在地農產品：海山漁港規劃販賣區外設置假日市集、原住民特色市集。","觀光要盈：優化海山漁港自行車道：強化導覽功能與旅遊深度。","觀光要盈：海山漁港週邊導入藝術展演空間：提升在地觀光量能與就業機會。","香民要盈：婚後孕前健康檢查補助，創造更友善父母的環境。","香民要盈：好孕專車加強2.0版：孕期補助產檢外，更延伸到產後帶寶寶回診的健兒門診。","香民要盈：爭取大湖里市民活動中心：設置關懷據點、共餐食堂，照顧長輩。","香民要盈：香山建設預算倍增：香山區面積超過本市一半，力推香山區公所工程預算倍增，有效提升鄉親生活品質。","交通要盈：運輸載具官方媒合平臺：導入預約服務，將社區關懷據點結合幸福小黃，建立更有彈性與安全的公共運輸。","交通要盈：Youbike新設站點：鹽水圖書館、內湖國小周邊增設新站點，將站點延伸至內湖國中、中隘、南隘等，讓Youbike發揮在地通勤、山海串聯的觀光移動功能。","交通要盈：友善車友：中華路沿線（特別是五段至六段）規畫自行車道及導覽說明。","交通要盈：高使用率人行步道優先重新舖設：例如：中華路沿線、香山國小至公道三間，以及中華路進入元培街之人行步道等學校、商圈周邊。","教育要盈：落實科技教育：香山區中小學建立完整科技教育課程與教學推動計畫，包含程式設計與運算思維等，培養學生學習興趣。","教育要盈：設置通勤專車：面臨公車減班次及路線，設置通勤專車保障學生通勤便利。","教育要盈：續推華德福教育：目前已招收幼兒園與國中小，其校舍將於今年完竣啟用，後續規劃高中部設置。","教育要盈：完成富禮國中射箭館：全力協助學校，盡快完成富禮國中射箭館。","教育要盈：規劃香山體育園區、香山圖書館：推動都市計畫檢討，規劃設置體育或文教設施，如香山體育園區、香山圖書館等。","教育要盈：培育射箭人才：推廣射箭運勤，增聘射箭教練、國中、小學扎根培育射箭人才。"]$items$::JSONB),
                ('884d41e3-68e1-4ae2-9faa-549f1994426f'::UUID, '35118713-e1d7-4b70-85d6-8edfa094aa47'::UUID, '521c5920-f5c9-46e8-b055-6c47fc356c8a'::UUID, 'official-profile:tainan-city-council-current-councilors:aff972cb12c1:35118713-e1d7-4b70-85d6-8edfa094aa47:platform'::TEXT, 'c9eeac6d9d0a70d25e31bd21e471a932'::TEXT, 366, '5241fce956e4f5ac65773627320a94e6'::TEXT, 'official_council_page_cross_checked_no_text_change'::TEXT, NULL::JSONB),
                ('d5435035-0f80-4952-9816-b7aede1eefee'::UUID, 'fe9e8dfe-eb13-48da-8797-fbdfc4504172'::UUID, 'a27ecf7e-8b97-41bd-8c07-1b0cea9dcd6f'::UUID, 'cec-platform:2022:votetw-candidate-647d01b42270fcd2'::TEXT, '528e69cf13422093ae41cab7437ea205'::TEXT, 127, 'ff8c5cae042096210ab37510bf9b3493'::TEXT, 'official_bulletin_visual_cross_check_no_text_change'::TEXT, NULL::JSONB),
                ('938b21a3-ff01-4edb-9d42-731507e17691'::UUID, 'e794fd0c-d492-4ded-bea8-393c5a87ec3e'::UUID, 'b9b8b1c4-da30-43f4-9be6-8eb3cefe422c'::UUID, 'cec-platform:2022:votetw-candidate-0dfc67a57b00cf9a'::TEXT, 'a4a62849956ac12dea7a4a77168209b1'::TEXT, 602, '06b543c370e814825b2c4b8f536bc949'::TEXT, 'official_bulletin_visual_cross_check_no_text_change'::TEXT, NULL::JSONB),
                ('9644c26a-ddd5-4cc4-98ca-6ad1d2ae7969'::UUID, '80082cee-85ef-40a3-bb95-0e427771edbd'::UUID, '80e29c35-168f-4a70-97f1-15557bb06491'::UUID, 'cec-platform:2022:votetw-candidate-16668e746656a0aa'::TEXT, '027e1ef959256d8ff58dc6edb9005b3f'::TEXT, 256, 'df1f0b76891dd385731b486cf402e128'::TEXT, 'official_bulletin_visual_cross_check_no_text_change'::TEXT, NULL::JSONB),
                ('72c762be-1e05-4ff9-9b66-f492d5f4befb'::UUID, '1f5373e1-707c-41a1-8f5b-4712a9e371ab'::UUID, 'f4b35f5a-d695-4fb6-ac1f-b1404daf718a'::UUID, 'cec-platform:2024:votetw-candidate-ace2593e330616df'::TEXT, 'b8eb51a70ca007ab2af503bf83632486'::TEXT, 247, '0bafdac51732855b2aaed3a6f0403409'::TEXT, 'official_bulletin_visual_cross_check_no_text_change'::TEXT, NULL::JSONB)
        ) AS reviews(claim_id, person_id, candidate_id, claim_key, expected_md5, expected_length, expected_source_md5, repair_method, repaired_items)
    LOOP
        UPDATE public.person_claims AS claim
        SET claim_json = pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(
                        COALESCE(claim.claim_json, '{}'::JSONB),
                        '{items}',
                        COALESCE(review.repaired_items, claim.claim_json -> 'items'),
                        TRUE
                    ),
                    '{contentSplit}',
                    COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                        || pg_catalog.jsonb_build_object(
                            'reviewStatus', 'reviewed',
                            'releaseQuality', pg_catalog.jsonb_build_object(
                                'version', 'verified-high-omission-platforms-01-20260907',
                                'reasonCodes', '[]'::JSONB
                            )
                        ),
                    TRUE
                ),
                '{platformQualityAudit}',
                COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'repairVersion', 'verified-high-omission-platforms-01-20260907',
                        'repair', review.repair_method,
                        'classification', 'verified_repair'
                    ),
                TRUE
            ),
            updated_at = pg_catalog.now()
        WHERE claim.id = review.claim_id
          AND claim.person_id = review.person_id
          AND claim.candidate_id = review.candidate_id
          AND claim.claim_key = review.claim_key
          AND claim.claim_type = 'platform'
          AND pg_catalog.md5(claim.source_url) = review.expected_source_md5
          AND pg_catalog.md5(claim.claim_value) = review.expected_md5
          AND pg_catalog.length(claim.claim_value) = review.expected_length
          AND claim.claim_json ->> 'platformText' = claim.claim_value
          AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
          AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'confirmed_content_or_split_issue'
          AND claim.claim_json #>> '{platformQualityAudit,repair}' = 'recovered_missing_item_from_stored_source';

        GET DIAGNOSTICS affected_count = ROW_COUNT;
        IF affected_count <> 1 THEN
            RAISE EXCEPTION 'Expected to release verified high-omission claim %, updated %', review.claim_id, affected_count;
        END IF;
        total_affected := total_affected + affected_count;

        IF EXISTS (
            SELECT 1
            FROM public.person_claims AS claim
            WHERE claim.id = review.claim_id
              AND (
                  claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
                  OR claim.claim_json #>> '{contentSplit,releaseQuality,version}' <> 'verified-high-omission-platforms-01-20260907'
                  OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
                  OR claim.claim_json #>> '{platformQualityAudit,repair}' <> review.repair_method
                  OR (review.repaired_items IS NOT NULL AND claim.claim_json -> 'items' IS DISTINCT FROM review.repaired_items)
              )
        ) THEN
            RAISE EXCEPTION 'Verified high-omission review failed validation for claim %', review.claim_id;
        END IF;
    END LOOP;

    IF total_affected <> 7 THEN
        RAISE EXCEPTION 'Expected seven verified high-omission platform reviews, updated %', total_affected;
    END IF;
END
$review$;


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
