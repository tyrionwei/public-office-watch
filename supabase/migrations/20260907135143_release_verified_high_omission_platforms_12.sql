BEGIN;

DO $review$
DECLARE repair RECORD; affected_count INTEGER;
BEGIN
    FOR repair IN
        SELECT * FROM (VALUES
            ('76e0cd05-6a10-42c6-b427-47604441e7bf'::UUID,'1a7f3dc4-04dc-4669-a986-4befcbf81f97'::UUID,'408bac63-a6fd-4561-b69f-1622115291dd'::UUID,'fd10be41e5a9b43901bd28e197d2fb34','910e102a2eb28f7ec974cf5c5e5bcd89',887,'做事的好立委邱志偉，繼續為您顧高雄。',$items$[
                "解決產業五缺，提高實質薪資，共創安居樂業：強化供水韌性：擴大開發海淡廠、再生水廠等多元水資源，提升供水備援調度。",
                "解決產業五缺，提高實質薪資，共創安居樂業：完善防洪治水：確保北高雄河川及區域排水整體改善、水岸環境營造如期落實。",
                "解決產業五缺，提高實質薪資，共創安居樂業：海線多元發展：推動漁業生技專區、遊艇產業鏈、漁港整建活化及環境再造。",
                "解決產業五缺，提高實質薪資，共創安居樂業：提高農漁收入：擴大農業保險類別，加強農民福利措施及產業升級轉型輔導。",
                "解決產業五缺，提高實質薪資，共創安居樂業：爭取投資高雄：推動橋科二期、聖森路、嘉華等產業園區，增加高薪就業機會。",
                "解決產業五缺，提高實質薪資，共創安居樂業：加強產業政策：穩定生產要素供給，降低貿易障礙，強化地緣政治風險因應。",
                "完備公共服務，充實文化建設，打造樂活社區：擴大設置定點臨托，育兒工作兩端從容。",
                "完備公共服務，充實文化建設，打造樂活社區：廣設運動休憩場域，健康生活愜意同行。",
                "完備公共服務，充實文化建設，打造樂活社區：積極推廣社會住宅，減輕青年住屋負擔。",
                "完備公共服務，充實文化建設，打造樂活社區：爭取綜合行政中心，行政服務遍及鄉里。",
                "完備公共服務，充實文化建設，打造樂活社區：充實社區長照量能，維護長者健康尊嚴。",
                "完備公共服務，充實文化建設，打造樂活社區：醒村、樂群村活化推進，歷史記憶建構文化肌理。",
                "完備公共服務，充實文化建設，打造樂活社區：糖廠增設森林碳匯教育館，綠色教育加值林業軌跡。",
                "完備公共服務，充實文化建設，打造樂活社區：籌設岡山國際棒球村，春訓基地帶動觀光商機。",
                "完善區域交通：落實捷運建設：確保岡山路竹延伸線和高鐵右昌學園線如期完工，串聯北高雄和東高雄生活圈，提供高品質捷運服務，打造宜居北高雄。",
                "完善區域交通：強化區域路網：積極推動台39線南延仁武、台61線南延梓官、國1高科交流道東延台19甲線等公路設施，完善區域路網可及性，促進地方發展。",
                "完善區域交通：改善交通體驗：爭取道路改善拓寬，提升道路品質，紓解交通壅塞，推動北高雄公路公共運輸服務升級計畫。",
                "減輕家長負擔，打造優質校園，學校社區共好：擴增公共化幼兒園，照護品質從嚴把關，減輕家長照顧負擔。",
                "減輕家長負擔，打造優質校園，學校社區共好：提升教保人員補助，確保職場待遇合理，推動友善工作環境。",
                "減輕家長負擔，打造優質校園，學校社區共好：爭取校園建設經費，串聯在地科技資源，營造科技教學環境。",
                "減輕家長負擔，打造優質校園，學校社區共好：落實教育機會平等，協助社經弱勢學子，持續挹注獎助學金。",
                "減輕家長負擔，打造優質校園，學校社區共好：善用學校在地能量，連結社區文化歷史，營造創生帶動就業。",
                "減輕家長負擔，打造優質校園，學校社區共好：把關營養午餐品質，精進在地食材供應，擴大推動食農教育。"
            ]$items$::JSONB),
            ('d12cc49e-dfa5-4653-8438-7835d7f0390f'::UUID,'22134434-326b-4fa3-ac6d-d30cb40ecd9b'::UUID,'33378b2d-4c6b-4295-897a-4991bef35bf1'::UUID,'04ff03ad011ec752edf9b2803b492b5f','395f01a0c01bd7efcb09ee877a06b156',574,NULL::TEXT,$items$[
                "鄉親社會福利：爭取多舉辦親子活動及課程。",
                "鄉親社會福利：廣設公共托兒園，獎勵企業設置非營利幼兒園。",
                "鄉親社會福利：老人在地安養政策，協助社區活動中心辦理老人日托。",
                "鄉親社會福利：關注竹北市民居住權，提案推動社會住宅。",
                "鄉親社會福利：關懷弱勢、身心障礙者，有效利用有聲號誌，打造友善行人空間。",
                "鄉親社會福利：推動在宅醫療和長期照護的合作，掌握社區醫療照護資源與地方長照機構。",
                "學童教育與權益：實際監督竹北中小學總量管制。",
                "學童教育與權益：爭取增加公托地點及名額。",
                "學童教育與權益：強化校園霸凌與性侵通報系統。",
                "區域發展規劃：關心西區農政照顧農民，監督縣府落實農業政策，全力推廣在地特色農產品。",
                "區域發展規劃：推動公園綠化及空汙數據公開。現有公園積極推動更新設備，增加休閒去處。",
                "區域發展規劃：爭取YouBike專用道，改善與汽機車爭道問題。",
                "區域發展規劃：改善大眾運輸，提出獎勵方式以減輕市區塞車困擾。",
                "區域發展規劃：要求縣府增加交通工程預算，修整老舊橋面及路段。",
                "在地就業環境：推動地方勞工權益及中小企業輔導。",
                "在地就業環境：建立創業基地，提供青年創業者相關設施，提升縣民創業意願。",
                "在地就業環境：增設職業訓練中心，開設符合現今市場需求之課程，並幫在地企業媒合職工。",
                "個人廉潔承諾：不包政府工程，不收包商回扣。",
                "個人廉潔承諾：常設議員服務處，讓選民方便聯繫及詢問。",
                "個人廉潔承諾：推動議會透明化，讓監督議員更簡單。",
                "個人廉潔承諾：聆聽鄉親的需求，協助各種選民服務。"
            ]$items$::JSONB),
            ('a9034ba4-9944-445b-a82d-479afeabc386'::UUID,'32d0f51a-dc11-4061-8814-d1e6ba5cc92b'::UUID,'99e51402-b3e4-4325-8475-f5d24018ca45'::UUID,'1322b8612cef291aa69d50c8feb14d97','978420d33e388fe37e1c5767791a3348',581,NULL::TEXT,$items$[
                "青年敢追夢：青年政策：督促桃園市青年事務局善用每年2億2千餘萬元預算，落實照顧青年。",
                "青年敢追夢：青年政策：青年返鄉工作更有力：整合青年社團和大專校院學生團隊，對接公部門、企業和傳統產業。",
                "青年敢追夢：青年政策：建置青年諮商師系統：桃園為多元族群，在求學、就業期間，青年更需要專業人才提供諮詢及追蹤制度。",
                "女性敢作為：女性政策：孕產婦心理自費諮商適當補助。",
                "女性敢作為：女性政策：35歲以上女性市民凍卵一次性補助和免費卵巢功能檢測。",
                "女性敢作為：女性政策：婦女的二度就業身心陪伴及輔導補助點。",
                "家庭敢生養：家庭政策：桃園公立幼兒園重點擴增「二歲、三歲專班」；小學下課後4至6點安親的部分，由政府全額補助。",
                "家庭敢生養：家庭政策：不分公幼、私幼應建立「幼兒園課程與教學品質評估表」，透明化檢視。",
                "家庭敢生養：家庭政策：拒絕萊豬、基因改造食品進校園。",
                "家庭敢生養：家庭政策：協助國中生多元選擇、適才適所的升學管道。",
                "多元敢精彩：多元族群政策：監督國中小學、公務機關無障礙空間。",
                "多元敢精彩：多元族群政策：保障特教生和一般生學子的基本受教權，讓「融合」不是口號；多元共融政策，每個學校及班級都應因適性制宜。",
                "多元敢精彩：多元族群政策：保障特殊教育教師助理員的薪資福利與每年受訓裝備、國中小重症身心障礙學子的特教員時數。",
                "多元敢精彩：多元族群政策：推動成立「兒童發展早期療育中心」。",
                "長者敢安居：長照／醫療政策：推動「桃園區失智老人家庭專屬活動中心」。",
                "長者敢安居：長照／醫療政策：廣設市民活動中心，帶給長者舒適關懷據點空間。"
            ]$items$::JSONB),
            ('68b51740-af0c-42c2-b8a5-a54ec079c1df'::UUID,'be7f8b49-536c-4b83-9ca9-d0c6ecb68d6b'::UUID,'10df4e37-c0bf-4fcb-a249-d11518e7cdb1'::UUID,'3b8020665b6c59c1b569619d84deeca4','3e56896ee29fe3186e8d64ae46910ebf',155,NULL::TEXT,$items$[
                "督促台76線東西向快速道路之品質、號誌、照明、排水、聯外道路路口安全等事項。",
                "爭取廠商進駐中科二林園區。",
                "爭取精密機械園區儘速通過。",
                "推動西南角之觀光發展，縮短城鄉差距。",
                "為弱勢團體發聲，爭取更多福利。",
                "監督政府，服務人民，為人民做好與政府的橋樑。",
                "各鄉鎮之農特產品推廣及城市行銷。"
            ]$items$::JSONB),
            ('66ad8978-325e-49a2-a7db-a1ec271c1620'::UUID,'6cf9771b-bd86-4d87-9a68-89cf65d44f0c'::UUID,'d531cdc3-4398-4128-b4b5-9e0d08716f96'::UUID,'6ed197fd4823fdbe70684d3a8e59f36d','aaaaa82a0d86fb9cb7191b4d2a6cb455',1165,'農家子弟、公益律師，取之社會、用之社會，追求公平正義，力求溪南溪北城鄉均衡發展。',$items$[
                "交通建設方面：爭取新建南41線道路，大塭寮跨曾文溪進入安南區海佃路及新吉工業區。",
                "交通建設方面：爭取擴建南44、45線道路，西港跨曾文溪進入安定到南科的交通路網，以疏解麻豆交流道、麻善大橋、台19線、西港大橋，解決塞車之苦，並避免人口流失。",
                "交通建設方面：督促儘速執行台61線西濱快速公路跨曾文溪景觀大橋。",
                "交通建設方面：拓寬台17線國姓橋以北之道路，因應未來「七股科技工業區」龐大車流和通行安全。",
                "產業發展建設方面：督促加速開發「七股科技工業區」、「麻豆工業區」，促進地方經濟發展。",
                "產業發展建設方面：檢討與擴建「學甲工業區」、「佳里工業區」，發揮產業價值。",
                "產業發展建設方面：繼續推動「鹽分地帶藝文中心」，應彰顯鹽分地帶特色，永續教育與形塑文藝聚落產業。",
                "產業發展建設方面：推動設置「農牧專區」活用土地，農業及觀光畜牧並重，並減低因牧場設置造成紛擾。",
                "產業發展建設方面：健全農漁牧業生產行銷機制，確保農漁民生計，增進農、漁、牧產業發展。",
                "產業發展建設方面：整合沿海觀光資源，推動生態旅遊、藍色公路、遊艇碼頭、休閒遊憩、循環經濟及生態保育並重。",
                "永續都市計畫發展方面：啟動規劃「麻豆與佳里和七股都市計畫區約1120公頃都市縫合」執行進度，並結合西港區的興起，促進區域永續繁榮發展。",
                "永續都市計畫發展方面：爭取佳里區中山路公園預定地與金唐殿後方停五停車場用地，納入公共設施用地解編後供停車場使用，疏解佳里市中心嚴重停車問題。",
                "永續都市計畫發展方面：為因應七股工業區發展，應加快「七股都市計畫」執行進度。",
                "永續都市計畫發展方面：監督台南大學七股校區利用計畫。",
                "永續環境與生態方面：爭取規劃興建「佳里、麻豆污水下水道系統」，避免污水流入七股潟湖和北門潟湖。",
                "永續環境與生態方面：反對興建「將軍區青鯤鯓海水淡化廠」的鹵水回放機制，衝擊漁民生計和海洋生態。",
                "永續環境與生態方面：加強整飭疏濬工程和取締排污：清除曾文溪水庫淤沙，鞏固海堤。",
                "永續環境與生態方面：加強整飭疏濬工程和取締排污：清除七股潟湖、北門潟湖淤沙和污染，解決海岸線持續退縮的問題。",
                "永續環境與生態方面：加強整飭疏濬工程和取締排污：加強劉厝大排（七股溪）、大塭寮大排（三股溪）、大寮排水（西寮）等治水防洪工程和取締排污。",
                "永續環境與生態方面：加強整飭疏濬工程和取締排污：加強將軍溪、急水溪河川整飭與景觀營造。",
                "永續環境與生態方面：加強整飭疏濬工程和取締排污：推動西港佳里花旗木文藝活動，為永續休憩景點。",
                "制定「台南市設置太陽能光電設施審查自治條例」，納入台61線以西不種電；大北門區光電嚴重超量，應實施總量管制，顧農漁民、保護生態。",
                "民生社教福利機制方面：爭取全市65歲以上比照五都，免繳健保費。",
                "民生社教福利機制方面：要求加強婦幼福利方案，讓年輕人敢結婚、生育。",
                "民生社教福利機制方面：百人以下國中小學學生免費提供營養午餐。",
                "強化律師服務團隊，並防制政府機關憑藉公權力違法徵課等侵害人民權利的行為，維護人權，追求公平正義。"
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
                    '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-12-20260907','reasonCodes','[]'::JSONB)),TRUE),
                '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-12-20260907','repair','official_bulletin_full_text_resplit','classification','verified_repair'),TRUE),
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
        ('76e0cd05-6a10-42c6-b427-47604441e7bf'::UUID,23),
        ('d12cc49e-dfa5-4653-8438-7835d7f0390f'::UUID,21),
        ('a9034ba4-9944-445b-a82d-479afeabc386'::UUID,16),
        ('68b51740-af0c-42c2-b8a5-a54ec079c1df'::UUID,7),
        ('66ad8978-325e-49a2-a7db-a1ec271c1620'::UUID,26)
    )
    SELECT pg_catalog.count(*) INTO validated_count
    FROM expected JOIN public.person_claims AS claim ON claim.id=expected.claim_id
    WHERE pg_catalog.jsonb_array_length(claim.claim_json->'items')=expected.item_count
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
      AND claim.claim_json#>>'{contentSplit,releaseQuality,version}'='verified-high-omission-platforms-12-20260907'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='official_bulletin_full_text_resplit'
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='verified_repair';
    IF validated_count<>5 THEN RAISE EXCEPTION 'Expected five validated platform repairs, found %',validated_count; END IF;
END
$validate$;

COMMIT;
