BEGIN;

-- Bridge exact production pre-repair texts to the audited migration baseline.
-- This stays inside the release transaction: the final repair must succeed.
CREATE TEMP TABLE release_source_baselines (id uuid PRIMARY KEY, person_id uuid NOT NULL, candidate_id uuid, claim_key text NOT NULL, production_text text NOT NULL, audited_text text NOT NULL) ON COMMIT DROP;
INSERT INTO release_source_baselines VALUES
('408da69e-9e37-42e3-892c-ec5498c1517c'::uuid,'1daa1817-3963-41cb-aa6a-e570e0f1d635'::uuid,'78cd5eed-5522-4067-b785-40591540801a'::uuid,'cec-platform:2022:votetw-candidate-41fe147b9017731a','一、主張安全與環境最少破壞下興建外環道改善關西交通問題。
二、督促縣府加強查緝遏止環境污染事件發生。
三、爭取關西地區急重症醫療機構。
四、推銷關西休閒觀光、傳承客家多元文化。
五、打造創生機會、鼓勵青年返鄉創業。
六、加強高齡化照顧及社區關懷據點服務。
七、落實社會福利提高育兒津貼及學齡前教育補助。
八、爭取監視系統建置釐清交通事故責任、打擊不法。
九、提倡社區營造及農村再生，打造關西為宜居鄉鎮。
十、建立與縣府良好溝通機制，監督把關縣府各項施政。','1. 爭取風雨球場建設；讓運動民眾更便利提昇運動人口
2. 推動寵物友善空間
3. 公園景點增設洗手台及廁所
4. 協助爭取自來水資源普及化
5. 新住民友善就業環境
6. 捍衛勞工權益
7. 閒置校園空間轉型活化為銀髮日照中心
8. 推動新埔產業打造特色鄉鎮
9. 爭取早期療育服務'),
('f098cca2-0d71-4b5c-8b8a-a043a9b8fe8f'::uuid,'b423857b-aaf0-4414-99e8-a0071859d18e'::uuid,'28fce42c-139a-42cf-8803-c7b2037297f3'::uuid,'cec-platform:2022:votetw-candidate-9824e22d55d13d81','一、主張安全與環境最少破壞下興建外環道改善關西交通問題。
二、督促縣府加強查緝遏止環境污染事件發生。
三、爭取關西地區急重症醫療機構。
四、推銷關西休閒觀光、傳承客家多元文化。
五、打造創生機會、鼓勵青年返鄉創業。
六、加強高齡化照顧及社區關懷據點服務。
七、落實社會福利提高育兒津貼及學齡前教育補助。
八、爭取監視系統建置釐清交通事故責任、打擊不法。
九、提倡社區營造及農村再生，打造關西為宜居鄉鎮。
十、建立與縣府良好溝通機制，監督把關縣府各項施政。','1. 持續協助改善教育環境。
2. 協助強化公共運輸貼合民眾需求。
3. 提高生活環境質感。
• 運動（提高運動風氣、健全運動環境、舉辦運動活動）。
• 環境保護。
• 排解各式糾紛。
• 舉辦引進藝文運動活動。
4. 照顧銀髮族生活各面向。
5. 持續爭取縣府相關資源挹注芎林鄉。
6. 協助鄉內人民團體爭取資源舉辦公益活動。
7. 關懷新住民生活各面向。
8. 協助改善五華工業區環境。
9. 監督芎林鄉衛生所興建，平衡芎林鄉各村醫療資源。
10. 協助照顧芎林農業與農民。');
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
                ('f41d6aea-e5b3-4a32-b9ae-8b12c2bc2c71'::UUID, '8508c411-d767-4ef0-b25e-2fa883dc69e0'::UUID, '4898db37-1e29-425b-a179-63a75ec77909'::UUID, 'cec-platform:2022:votetw-candidate-adeab6057131d95f'::TEXT, 'a0aa07f604048039292f7a95336b4e32'::TEXT, 669, 'f9dcb4d7d0c3fb1bfa2836c4c19a9c20'::TEXT, 'official_bulletin_visual_wrong_person_replacement'::TEXT, $items$["監督縣府落實原住民族相關法律原住民族教育法、原住民族基本法、原住民族語言發展法及原住民身分法等法，並持續追蹤原住民學校法在中央立法的進度。","監督國土規劃法絕不能傷及原住民族傳統領域的劃設，更不能影響原住民族現有土地使用權益。","爭取縣府提高編列經費，落實原住民就業、就學、住宅、語言、文化傳承。","爭取原住民就業媒合並加強友善的工作環境，利用文健站發展原住民文創工藝觀光，都會區設立文化農場。","爭取水環境建設計畫，協助各部落簡易自來水管委會協會化。","強烈建請縣府立刻恢復原民中心為原民處提升服務效能。","爭取並監督縣府執行苗62線道實質動工，處理部落內部對外連通道路。","爭取並監督縣府落實完善原住民社會安全網，建立孩童及高齡者友善環境。","建請縣府與立委合作向中央反映修法讓部落會議具有公法人的位階。","制定原住民族單行法規，如露營法，原住民族文資法⋯等。","爭取原住民敬老津貼，身心障礙者、老人、婦女福利、遠距醫療、長期照護部落化等經費。","都市原住民，爭取增加預算經費，提供安居、融資、就養、就醫與健康及原住民長期照護保險。","爭取縣府規劃雪霸、鳥嘴山、虎頭山和冬瓜山觀光廊道套裝行程。"]$items$::JSONB),
                ('1fb9a0a3-0356-42a6-b4f9-ef271898cd18'::UUID, '1ba34ead-f0e7-44fb-a46b-ce3e4d4e6603'::UUID, '0d004633-f9fa-4f9d-a124-b335e30b2c8a'::UUID, 'cec-platform:2022:votetw-candidate-f94fdf314958e5e2'::TEXT, 'f42c60a5121db4784ca26db142a78561'::TEXT, 205, '2af23a07b4f83e6f28a68ee35a17393e'::TEXT, 'official_bulletin_visual_wrong_person_replacement'::TEXT, $items$["爭取多元智能教育資源挹注","爭取遠端智慧健康平台建立","爭取建構多元職能培訓場域","爭取婦女銀青技能專培課程","爭取長者賦能運動設備投入","爭取銀髮族俱樂部落地拓展","爭取銀青輔導媒合創造就業","爭取特色產業電商平台鏈結","爭取在地文化維護深耕資源"]$items$::JSONB),
                ('63913ed5-cdd8-42e7-a071-ee62a0f70241'::UUID, '938bf3ca-ffc6-4dd7-a826-9fcd81de6d4a'::UUID, '73c6f487-c2d2-4ccd-a2c8-5e24f6fc779a'::UUID, 'cec-platform:2022:votetw-candidate-02d521e1b407f7a1'::TEXT, 'b9e7043fea41eb6e2bcb217090a00cc8'::TEXT, 199, '82c57d400c64332e22767262445f9a3c'::TEXT, 'official_bulletin_visual_missing_items_reconstruction'::TEXT, $items$["督促新臺馬輪依計畫期程啟航營運，完善海運交通系統。","興建多功能長照服務中心，落實多元長照在地化政策。","推動示範住宅，提供青年安居樂業。","鼓勵青年返鄉參與地方創生，為家鄉注入新活力。","提升醫療品質，緊急後送程序標準化爭取時效。","爭取多功能運動場館設備，推廣休閒運動風氣。","充實觀光軟硬體設施，建構友善旅遊環境。","提升港埠設施，改善中柱港整體景觀。","推動建置台馬第四海纜，穩定通訊安全及品質。","持續爭取經費推動基礎建設，優化鄉親居家生活空間。"]$items$::JSONB),
                ('d39b24ae-f59a-46fe-8a8c-b95caf7b6542'::UUID, 'e7495cc6-9e9b-4f5a-915f-dd5e11e2960d'::UUID, '4b042dc7-cac5-4d11-9e65-0c6ffc960fe2'::UUID, 'cec-platform:2022:votetw-candidate-982703e3885fa011'::TEXT, '7dc8554904057c03cd11beff974c9cd1'::TEXT, 65, '038855777632c9b0ed19f6d9e0f6f613'::TEXT, 'official_bulletin_visual_missing_item_reconstruction'::TEXT, $items$["全力爭取鄉親權益","專業監督政府施政","督促政府發展產業","爭取實列原鄉預算","推展原鄉傳統文化","協助扶持培力青年"]$items$::JSONB),
                ('803078d5-9607-4c01-9055-88cbecf82034'::UUID, '7a21cdd7-80ef-47b0-bd87-2a91febeb7de'::UUID, 'ab334430-11c0-4bf0-b016-88233b4cb19b'::UUID, 'cec-platform:2024:votetw-candidate-2bf861dafd385695'::TEXT, '247a4ff8324d533704f215fff8f427dc'::TEXT, 514, 'fddf03071e5115da5b4d7724cfc38277'::TEXT, 'official_bulletin_visual_wrong_election_replacement'::TEXT, $items$["交通專業！就是洪孟楷！：林口、五股交流道改善完工，圓山交流道改善開工","交通專業！就是洪孟楷！：淡江大橋2025完工、淡北道路農曆年前正式開工","交通專業！就是洪孟楷！：爭取八里－淡水輕軌、泰山－板橋輕軌、林口－龜山輕軌","青年發展、在地就業，經濟優先、婦幼關懷！：淡海科技園區，增加在地就業機會","青年發展、在地就業，經濟優先、婦幼關懷！：林口影視園區、國際AI智慧園區帶動經濟發展","青年發展、在地就業，經濟優先、婦幼關懷！：泰山塭仔圳全區零碳建築、八里台北港設置自由經濟專區","觀光大發展、北海岸大繁榮！：淡水灣、白沙灣自行車串連，北台灣最佳騎乘線","觀光大發展、北海岸大繁榮！：三芝海上觀景平台親水園區、石門洞打造國家級風景區","肅槍緝毒打詐、治安掃黑","0～6歲國家養、協助育兒養老","老人健保免費、減少城鄉差距","80歲以上長者免除巴氏量表","擴大投資醫療、補助防癌篩檢","設特偵專案組、重啟兩岸交流","依法執行死刑、杜絕假釋黑箱"]$items$::JSONB),
                ('408da69e-9e37-42e3-892c-ec5498c1517c'::UUID, '1daa1817-3963-41cb-aa6a-e570e0f1d635'::UUID, '78cd5eed-5522-4067-b785-40591540801a'::UUID, 'cec-platform:2022:votetw-candidate-41fe147b9017731a'::TEXT, '58844beb44aa2ac00630a402e17eaaea'::TEXT, 142, 'b1451f6bc6d36fd3fc0129a15b1debc6'::TEXT, 'official_bulletin_visual_section_boundary_repair'::TEXT, $items$["爭取風雨球場建設；讓運動民眾更便利提昇運動人口","推動寵物友善空間","公園景點增設洗手台及廁所","協助爭取自來水資源普及化","新住民友善就業環境","捍衛勞工權益","閒置校園空間轉型活化為銀髮日照中心","推動新埔產業打造特色鄉鎮","爭取早期療育服務"]$items$::JSONB),
                ('81030de4-84a0-431b-9513-b2f495ca8693'::UUID, 'd3663c23-dbef-43bb-b425-20c0883bc380'::UUID, 'f9caafd6-4ec6-4477-8f95-cac72c0cbe52'::UUID, 'cec-platform:2022:votetw-candidate-ae98e42247fbec61'::TEXT, '65c062e9f6bcb7da44888e24b98bb874'::TEXT, 133, 'b1451f6bc6d36fd3fc0129a15b1debc6'::TEXT, 'official_bulletin_visual_wrong_person_replacement'::TEXT, $items$["爭取新埔鎮首座特色公園。","爭取新埔鎮YouBike站點設立。","針對鎮內三街六巷九宗祠等古蹟建築，持續發展其記憶與文化，並結合文創、觀光產業，讓新埔風華再現。","積極爭取加速完成新埔埔東聯道（水車頭段至高鐵）興建工程，及竹16縣文山里水車頭段至關西鎮段之拓寬工程，以利交通，並串聯竹縣生活圈。","協助新埔鎮公所推動新埔鎮都市計畫第四次通盤檢討，加速田新外環道路（新埔鎮公所對面）南側農業區、區段徵收都市計畫之開發，以增進新埔的繁榮。","爭取加強照顧老年、身心障礙及弱勢族群各項福利措施及生活補助。","督促縣府重視並有效管制汙染源，鎮內環保、垃圾等問題。","推動鎮觀光休閒精農業，促銷新埔農特產品，提高農民收益，發展富麗農村。","堅持「只包水餃、不包工程。」傾聽民意、為民喉舌，豐富之從政經驗，監督縣府各項施政，創造民眾福祉。"]$items$::JSONB),
                ('f098cca2-0d71-4b5c-8b8a-a043a9b8fe8f'::UUID, 'b423857b-aaf0-4414-99e8-a0071859d18e'::UUID, '28fce42c-139a-42cf-8803-c7b2037297f3'::UUID, 'cec-platform:2022:votetw-candidate-9824e22d55d13d81'::TEXT, '83b874f74504a91aee410679e7921eae'::TEXT, 239, '6b766b6c65030c064068d0877e076b2a'::TEXT, 'official_bulletin_visual_missing_items_reconstruction'::TEXT, $items$["持續協助改善教育環境。","協助強化公共運輸貼合民眾需求。","提高生活環境質感：運動（提高運動風氣、健全運動環境、舉辦運動活動）。","提高生活環境質感：環境保護。","提高生活環境質感：排解各式糾紛。","提高生活環境質感：舉辦引進藝文運動活動。","照顧銀髮族生活各面向。","持續爭取縣府相關資源挹注芎林鄉。","協助鄉內人民團體爭取資源舉辦公益活動。","關懷新住民生活各面向。","協助改善五華工業區環境。","監督芎林鄉衛生所興建，平衡芎林鄉各村醫療資源。","協助照顧芎林農業與農民。"]$items$::JSONB)
        ) AS reviews(claim_id, person_id, candidate_id, claim_key, expected_md5, expected_length, expected_source_md5, repair_method, repaired_items)
    LOOP
        UPDATE public.person_claims AS claim
        SET claim_json = pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(COALESCE(claim.claim_json, '{}'::JSONB), '{items}', review.repaired_items, TRUE),
                    '{contentSplit}',
                    COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB) || pg_catalog.jsonb_build_object(
                        'reviewStatus', 'reviewed',
                        'releaseQuality', pg_catalog.jsonb_build_object('version', 'verified-high-omission-platforms-03-20260907', 'reasonCodes', '[]'::JSONB)
                    ),
                    TRUE
                ),
                '{platformQualityAudit}',
                COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB) || pg_catalog.jsonb_build_object(
                    'repairVersion', 'verified-high-omission-platforms-03-20260907',
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
            SELECT 1 FROM public.person_claims AS claim
            WHERE claim.id = review.claim_id
              AND (
                  claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
                  OR claim.claim_json #>> '{contentSplit,releaseQuality,version}' <> 'verified-high-omission-platforms-03-20260907'
                  OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
                  OR claim.claim_json #>> '{platformQualityAudit,repair}' <> review.repair_method
                  OR claim.claim_json -> 'items' IS DISTINCT FROM review.repaired_items
              )
        ) THEN
            RAISE EXCEPTION 'Verified high-omission review failed validation for claim %', review.claim_id;
        END IF;
    END LOOP;

    IF total_affected <> 8 THEN
        RAISE EXCEPTION 'Expected eight verified high-omission platform reviews, updated %', total_affected;
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
