BEGIN;

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
                (
                    '4b00c2ce-640c-46b9-9a7f-944db15f48ff'::UUID,
                    'e18dec17-5797-4666-8b00-6169d2b47135'::UUID,
                    'aa834cf9-1e32-430e-8465-65a3ebee73eb'::UUID,
                    'official-profile:new-taipei-city-council-current-councilors:4517c8dd02f3:e18dec17-5797-4666-8b00-6169d2b47135:platform'::TEXT,
                    '76aeb54dba12a05892357671fe2ce651'::TEXT,
                    736,
                    'https://www.ntp.gov.tw/councilor-detail?program=37&A=5&C=624'::TEXT,
                    'official_council_page_cross_checked_item_scope_and_section_repair'::TEXT,
                    $items$["婦幼權益：提高生育補助、育兒津貼，減輕家長負擔","婦幼權益：爭取特色公園及符合規範的共融式遊具，營造親子休憩空間","婦幼權益：建立婦女就業創業媒合平台，公私協力改善女性就業環境","教育資源：定期防毒宣導，有效阻止毒品進入校園","教育資源：依據各區幼兒人口比例，滾動式調整公托、幼班級數","教育資源：強化師資培育，注重學童品德教育，優化教（托）育品質","青年就業：增加青年創業基地，鼓勵青年紮根板橋","青年就業：強化招商，增加青年就業機會","青年就業：職訓與就業媒合，幫助青年培養專業技能提升就業率","銀髮照護：推動各里至少一處社區關懷據點或銀髮俱樂部，提供里內長者休閒好去處","銀髮照護：保障銀髮族醫療需求","銀髮照護：增設日照及長照機構，專業照護長者健康","交通安全：符合用路人需求重新完善道路規劃","交通安全：滾動式改善紅綠燈秒數問題","交通安全：增設左轉附加車道及標示牌","公辦都更：合理調整公辦都更同意比例","公辦都更：增加都更誘因，提升居民意願","公辦都更：積極推動危老建築防災型都更","居住正義：囤房稅收用於青年、弱勢租金補貼","居住正義：打造健全租屋市場，改善租屋黑市","居住正義：爭取增設社會住宅","市政透明：主張新北政府及市議會會議記錄公開透明化，避免特定人士黑箱作業","市政透明：都更資訊透明，落實都更排黑","市政透明：推動參與式民主，讓市民直接參與市政規劃共同決策"]$items$::JSONB
                ),
                (
                    'ea7d1627-79b0-4c9c-a190-0a5ac9f3ed36'::UUID,
                    '04106fcd-9869-4a75-af3d-28a9061eb620'::UUID,
                    '53881dfa-91cc-4030-82fe-957bab2de1d9'::UUID,
                    'official-profile:new-taipei-city-council-current-councilors:1a3d5ac36702:04106fcd-9869-4a75-af3d-28a9061eb620:platform'::TEXT,
                    '18fccc886ac983e10df5890c5187e0b2'::TEXT,
                    667,
                    'https://www.ntp.gov.tw/councilor-detail?program=37&A=5&C=478'::TEXT,
                    'official_council_page_cross_checked_no_text_change'::TEXT,
                    NULL::JSONB
                ),
                (
                    '761223ba-0643-4947-98cb-df01e74d472f'::UUID,
                    '0ddfccd4-a250-40ff-bd33-d96ce562eeb9'::UUID,
                    '90ec32e5-8751-4136-ba9a-a12fdced8173'::UUID,
                    'official-profile:new-taipei-city-council-current-councilors:4bf4b2e7d99d:0ddfccd4-a250-40ff-bd33-d96ce562eeb9:platform'::TEXT,
                    'fc7a8a1d4ce7835835c9e09b5dce5667'::TEXT,
                    779,
                    'https://www.ntp.gov.tw/councilor-detail?program=37&A=8&C=531'::TEXT,
                    'official_council_page_cross_checked_no_text_change'::TEXT,
                    NULL::JSONB
                ),
                (
                    'c6a18d49-8f03-4ee4-a0ba-ec400d235cd1'::UUID,
                    '51dae898-e914-4040-94b7-0ec0b1302143'::UUID,
                    '2dec92fb-dad0-48ac-9d4b-26022bb7ba9b'::UUID,
                    'official-profile:new-taipei-city-council-current-councilors:683a6133d67a:51dae898-e914-4040-94b7-0ec0b1302143:platform'::TEXT,
                    'e8440ac82fcace7abde9ff741aed3469'::TEXT,
                    271,
                    'https://www.ntp.gov.tw/councilor-detail?program=37&A=4&C=540'::TEXT,
                    'official_council_page_cross_checked_no_text_change'::TEXT,
                    NULL::JSONB
                ),
                (
                    '657f6512-5c78-4537-a7d6-4382214fc2e5'::UUID,
                    '1df4c34c-8404-494f-bade-2a53cf60be68'::UUID,
                    'af29546a-af94-4c54-a374-8536976ff809'::UUID,
                    'official-profile:taipei-city-council-current-councilors:31b64dad3b56:1df4c34c-8404-494f-bade-2a53cf60be68:platform'::TEXT,
                    '77b51a960b5aa21e7a70e167962c3a91'::TEXT,
                    258,
                    'https://www.tcc.gov.tw/Councilor_Content.aspx?n=13898&s=2588'::TEXT,
                    'official_council_page_cross_checked_item_scope_and_section_repair'::TEXT,
                    $items$["城市更新：監督一殯遷建，強力推動【全齡化照護基地】 (托嬰、托幼、托老、日照長照中心、運動及商展空間)。","城市更新：擴大危老都更，改善都市景觀、確保市民居住安全。","全齡照護：推動幸福喘息、增設長照、日照、居家服務補助及時數。","全齡照護：提升外籍師資比例，落實雙語首都向下紮根。","全齡照護：監督北市各級學校、補習班落實使用台灣食材，守護食安。","減壓補助：增設北市青年新婚獎勵；推動社宅前二年租金半價優惠。","減壓補助：滾動式檢討私幼補助金額，減輕家長撫養教育負擔。","減壓補助：推動領養補助、領養代替購買，擴充北市寵物公園數量。"]$items$::JSONB
                ),
                (
                    'd14ac998-0394-4e2c-b666-93216b707bf2'::UUID,
                    'a58b6fcb-094d-45ec-81d3-35e0084930d8'::UUID,
                    'fb4e3bd2-dab1-4a33-bd38-16eb1c98d3ae'::UUID,
                    'official-profile:taipei-city-council-current-councilors:d3676e263502:a58b6fcb-094d-45ec-81d3-35e0084930d8:platform'::TEXT,
                    'a0370489beeb1eb0132d7265a5ef3ef3'::TEXT,
                    733,
                    'https://www.tcc.gov.tw/Councilor_Content.aspx?n=13898&s=2591'::TEXT,
                    'official_council_page_cross_checked_item_scope_and_section_repair'::TEXT,
                    $items$["嶄新市容|翻轉西區|國際城市：廣告招牌管理、巷道纜線清整、電桿地下化，設立市容委員會，找回城市歷史紋路。","嶄新市容|翻轉西區|國際城市：花博園區回歸會展用途，打造北市第三座世貿展覽中心，帶動中山、大同區域發展，結合在地文化走向世界。","嶄新市容|翻轉西區|國際城市：增進國際交流，議會互訪，分享地方自治經驗。提升台灣首都能見度，強化城市外交關係。","用路平權|以人為本|交通安全：提倡以車向分流為主的交通計畫，減少車流交織，汽機車路權平等。","用路平權|以人為本|交通安全：增設實體人行道，檢討巷弄違停、騎樓佔用問題，營造友善行人、輪椅族及嬰兒車的通行環境。","用路平權|以人為本|交通安全：廣設行人庇護島、增設導盲行穿線、設置通學巷、公車全面安裝智慧防撞系統，提升用路安全。","居住正義|力挺青年|綠能減碳：調降社會住宅租金，確保家戶可負擔。","居住正義|力挺青年|綠能減碳：提高租屋補貼、簡化申請手續隨到隨辦，減輕年輕家庭經濟負擔。","居住正義|力挺青年|綠能減碳：加速更新電動公車、公有房舍導入綠能、檢討氣候預算，跟上全球2050淨零碳排腳步。","友善育兒|關懷長者|愛護毛孩：校園閒置空間轉為公共托育家園及非營利幼兒園、提升準公共化參與、增進教保員勞動環境，讓育兒更輕鬆。","友善育兒|關懷長者|愛護毛孩：增加日照中心據點、媒合高齡長輩就業、重視長者心理健康，營造樂齡生活。","友善育兒|關懷長者|愛護毛孩：推動市立動物醫療單位、增設寵物活動空間，毛小孩也是城市的一分子。"]$items$::JSONB
                ),
                (
                    '87177be4-e9f5-4e72-9631-5b528681d781'::UUID,
                    'ae47b892-578c-4c46-8ed5-e6e0f3607a96'::UUID,
                    '350affd2-d8d8-444a-81eb-007fe7bbb5d5'::UUID,
                    'official-profile:taipei-city-council-current-councilors:f9b8a929f668:ae47b892-578c-4c46-8ed5-e6e0f3607a96:platform'::TEXT,
                    '7196b13e15b86267672fa874fd3a987c'::TEXT,
                    940,
                    'https://www.tcc.gov.tw/Councilor_Content.aspx?n=13898&s=2555'::TEXT,
                    'official_council_page_cross_checked_item_scope_and_section_repair'::TEXT,
                    $items$["護學童：賢蔚熱愛棒壘球、出身體育圈，強化學童體育發展，增進健康。協助學區安全聯盟運作、持續提升校園治安及校外通學安全。加強動物保護、生命及情緒教育，確保學童安全學習、快樂成長。校園納入共融式遊具設置處所。優化學童營養餐點。積極處置不適任教師。","助父母：提升優質托嬰服務、增設幼兒園班級數、提升幼教師資及品質。建置彈性課後照顧系統。強化社區鄰里公園活動休憩。完善親子廁所、哺乳室設置。加強第2胎及3胎以上鼓勵生育措施。爭取育嬰假彈性運用。積極招募校園志工。改善校園家長接送區設置。","顧女性：加強性別平權教育。公共工程、政策加強公民參與、納入女性視角及觀點。強化女性報案保障措施。打造女性友善生活空間。","撐青年：支持18歲公民權。監督社會住宅進度。鼓勵未婚交友聯誼活動。強化職訓機會、就業媒合。完善娛樂休閒處所、鼓勵藝文活動。","扶長青：提升長照、安養機構數。增設長者共餐共學據點、促進長者醫療用藥社區化、強化偏遠地區及行動不便者居家醫藥服務、提升醫藥護理師權益及服務量能。協助老舊公寓無障礙環境設置。促進中高齡就業措施。關懷獨居長者。加強宣導防止詐騙集團。","挺身障：協助身心障礙、罕見疾病朋友解決困境，增加福利保障、強化社區服務、推廣身障人士運動聯誼、建立電子科技網絡服務系統。","拚建設：提升北投士林科技園區產業、交通發展。整治北投溪、復育北投石、強化北投無圍牆博物館、士林文史觀光。加強危老重建、都市更新、公共工程生態工法、保存綠地增加植樹、清理河川汙水廢棄物、發展綠能及完善綠色運輸。監督促成社子島、關渡平原開發。"]$items$::JSONB
                ),
                (
                    '15c02d94-beb4-43d5-982d-e5c1d80758b7'::UUID,
                    '273ba31f-fbe8-4b21-902e-d65744036fa8'::UUID,
                    '11b2a2d4-ebac-4707-baec-e112455d08e1'::UUID,
                    'official-profile:hsinchu-city-council-current-councilors:3f2c5e327889:273ba31f-fbe8-4b21-902e-d65744036fa8:platform'::TEXT,
                    'a890e14169b656cba44ffdf07da8c505'::TEXT,
                    540,
                    'https://www.hsinchu-cc.gov.tw/tc/councilor.aspx?mid=39&c=11'::TEXT,
                    'official_council_page_cross_checked_no_text_change'::TEXT,
                    NULL::JSONB
                ),
                (
                    '69447996-6d72-4b09-b73e-bd7ad7f9675a'::UUID,
                    '66690a52-efc7-4477-8b5a-3f42a3d949f9'::UUID,
                    '11880e67-8fb8-4094-a6b4-27c099bbeee5'::UUID,
                    'official-profile:hsinchu-city-council-current-councilors:9a941a5d60f2:66690a52-efc7-4477-8b5a-3f42a3d949f9:platform'::TEXT,
                    '07a23d84f83adce7c5f46eb00e603bba'::TEXT,
                    560,
                    'https://www.hsinchu-cc.gov.tw/tc/councilor.aspx?mid=39&c=10'::TEXT,
                    'official_council_page_cross_checked_no_text_change'::TEXT,
                    NULL::JSONB
                ),
                (
                    '3d14d54d-2645-457e-9fb4-7c00dbc3d317'::UUID,
                    '42724a57-ec78-48fe-829c-6647b094d4ec'::UUID,
                    '3cec9b5b-ed0b-458b-84cc-f2edcfdc4de5'::UUID,
                    'official-profile:hsinchu-city-council-current-councilors:4fd34c5d40c3:42724a57-ec78-48fe-829c-6647b094d4ec:platform'::TEXT,
                    '1a340524509bb54b5735a4f0106f6128'::TEXT,
                    234,
                    'https://www.hsinchu-cc.gov.tw/tc/councilor.aspx?mid=39&c=34'::TEXT,
                    'official_council_page_cross_checked_item_scope_and_section_repair'::TEXT,
                    $items$["強力監督重大工程品質 精準把關市府預算，有陳慶齡在！","促進海山漁港活化，帶動漁港整體經濟與觀光效應","爭取老人福利加碼，敬老卡點數加倍及使用範圍擴大","青青草原再進化，打造新竹後十八尖山遊憩觀光區","傳統產業統整及升級，成立香山精密機械園區","設立香山攤販零售據點，規畫屬於香山的菜市場","照顧社區據點及關懷站，豐富課程及加強守望","舊城區活化重生，商圈活絡永續市中心，重返榮景"]$items$::JSONB
                )
        ) AS reviews(
            claim_id,
            person_id,
            candidate_id,
            claim_key,
            expected_md5,
            expected_length,
            expected_source_url,
            repair_method,
            repaired_items
        )
    LOOP
        UPDATE public.person_claims AS claim
        SET
            claim_json = pg_catalog.jsonb_set(
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
                                'version', 'verified-platform-council-source-cross-check-20260907',
                                'reasonCodes', '[]'::JSONB
                            )
                        ),
                    TRUE
                ),
                '{platformQualityAudit}',
                COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'repairVersion', 'verified-platform-council-source-cross-check-20260907',
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
          AND claim.source_url = review.expected_source_url
          AND pg_catalog.md5(claim.claim_value) = review.expected_md5
          AND pg_catalog.length(claim.claim_value) = review.expected_length
          AND claim.claim_json ->> 'platformText' = claim.claim_value
          AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
          AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'requires_source_or_rule_review';

        GET DIAGNOSTICS affected_count = ROW_COUNT;
        IF affected_count <> 1 THEN
            RAISE EXCEPTION 'Expected to release verified council claim %, updated %',
                review.claim_id, affected_count;
        END IF;
        total_affected := total_affected + affected_count;

        IF EXISTS (
            SELECT 1
            FROM public.person_claims AS claim
            WHERE claim.id = review.claim_id
              AND (
                  claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
                  OR claim.claim_json #>> '{contentSplit,releaseQuality,version}'
                      <> 'verified-platform-council-source-cross-check-20260907'
                  OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
                  OR claim.claim_json #>> '{platformQualityAudit,repair}' <> review.repair_method
                  OR (
                      review.repaired_items IS NOT NULL
                      AND claim.claim_json -> 'items' IS DISTINCT FROM review.repaired_items
                  )
              )
        ) THEN
            RAISE EXCEPTION 'Verified council source review failed validation for claim %',
                review.claim_id;
        END IF;
    END LOOP;

    IF total_affected <> 10 THEN
        RAISE EXCEPTION 'Expected ten verified council platform reviews, updated %',
            total_affected;
    END IF;
END
$review$;

COMMIT;
