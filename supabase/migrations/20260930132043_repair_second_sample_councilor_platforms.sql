BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';
-- 兩筆既有公開政見的定點修正；不新增人物、不改候選人關聯、不改公開狀態。
-- 原文與審核基準逐筆雜湊比對，任一資料漂移則全筆回滾；已有票不得重建條目。
CREATE TEMP TABLE sampled_councilor_repairs ON COMMIT DROP AS
SELECT * FROM jsonb_to_recordset($repairs$[{"id":"eebadac3-e479-4ef5-8749-79c1c860fd30","name":"黃豪杰","claim_key":"cec-platform:2022:votetw-candidate-e0ffcd658eaa6f3a","person_id":"63d13e1f-9751-4cca-a5bf-c1a62f421cc4","candidate_id":"0e9fc2ab-4d30-4e79-8132-785411758944","candidate_person_id":"63d13e1f-9751-4cca-a5bf-c1a62f421cc4","candidate_name":"黃豪杰","race_id":"c281df8b-57e8-4f41-9088-5fee5230b2bf","election_id":"4c34ad35-6f97-4766-9cd1-2212373dd969","source_url":"https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/06%E7%B8%A3%E5%B8%82%E8%AD%B0%E5%93%A1/111%E5%B9%B4/07%E6%96%B0%E7%AB%B9%E7%B8%A3/%E6%96%B0%E7%AB%B9%E7%B8%A3%E7%AC%AC08%E9%81%B8%E8%88%89%E5%8D%80.pdf","source_sha256":"26b9bf6e9261a6130d65efeb47240dd61e0d4f75e7d544415a8c1cb85ffb3836","after_text":"城鎮發展\n1. 積極爭取新竹縣輕軌鏈結科技生活圈串連設站竹東站，完善公共運輸缺口與提升交通系統效率，改善現有交通瓶頸。\n2. 積極推動中興河道水岸生活空間再造二期計畫，打造水與綠新市鎮。\n3. 積極爭取鎮內閒置空間綠美化、打造無齡別特色空間，提供鎮民、銀髮族、孩童等休憩場域。\n4. 積極要求通盤檢討暨可行性評估都市計畫外五里（頭、二、三重等地區）新外環道路開闢，完善交通建設解決交通困境。\n\n社會福利推行\n1. 多元社會福利持續力爭推行，老人年金發放及幸福升級長照2.0。\n2. 因應新竹縣外移人口增加，要求研議提高生育補助津貼、育兒津貼、提升學童營養午餐品質，並且推動社區型公共托育家園，完善嬰幼托育制度。\n3. 要求持續發放身心障礙福利及低收入戶補助等。\n4. 要求研議通盤檢討新竹縣民意外保險額度及範圍，健全縣民生命保障制度。\n5. 推動早期兒童療育相關政策納入政府補助，通盤檢討增加個案管理中心人力及物力資源、廣推融合教育，並研議開放全年特殊生托育中心及特教員培訓課程，以健全遲緩兒童教育權。\n\n教育面向\n1. 強力要求推動英語教學，積極爭取外師制度，提升竹縣學子國際競爭力。\n2. 推動母語教學及全民閱讀習慣，培養學子族群認同。\n3. 強力爭取外五里地區非營利幼兒園結合親子圖書館。\n\n青年面向\n1. 積極要求支持青年創業、根留竹東。\n2. 要求研議健全青年創業計畫與補助方案。\n\n其他\n1. 嚴格監督落實地方建設品質，完善竹東生活機能。\n2. 爭取竹東外五里新建衛生所。\n3. 要求落實執法飼主寵物登記、植晶片，有效杜絕棄養，支持領養代替購買。\n4. 爭取輔導農民保險及農損補償機制，輔導農產品加工製成計畫暨設備補助。","patch":{"platformText":"城鎮發展\n1. 積極爭取新竹縣輕軌鏈結科技生活圈串連設站竹東站，完善公共運輸缺口與提升交通系統效率，改善現有交通瓶頸。\n2. 積極推動中興河道水岸生活空間再造二期計畫，打造水與綠新市鎮。\n3. 積極爭取鎮內閒置空間綠美化、打造無齡別特色空間，提供鎮民、銀髮族、孩童等休憩場域。\n4. 積極要求通盤檢討暨可行性評估都市計畫外五里（頭、二、三重等地區）新外環道路開闢，完善交通建設解決交通困境。\n\n社會福利推行\n1. 多元社會福利持續力爭推行，老人年金發放及幸福升級長照2.0。\n2. 因應新竹縣外移人口增加，要求研議提高生育補助津貼、育兒津貼、提升學童營養午餐品質，並且推動社區型公共托育家園，完善嬰幼托育制度。\n3. 要求持續發放身心障礙福利及低收入戶補助等。\n4. 要求研議通盤檢討新竹縣民意外保險額度及範圍，健全縣民生命保障制度。\n5. 推動早期兒童療育相關政策納入政府補助，通盤檢討增加個案管理中心人力及物力資源、廣推融合教育，並研議開放全年特殊生托育中心及特教員培訓課程，以健全遲緩兒童教育權。\n\n教育面向\n1. 強力要求推動英語教學，積極爭取外師制度，提升竹縣學子國際競爭力。\n2. 推動母語教學及全民閱讀習慣，培養學子族群認同。\n3. 強力爭取外五里地區非營利幼兒園結合親子圖書館。\n\n青年面向\n1. 積極要求支持青年創業、根留竹東。\n2. 要求研議健全青年創業計畫與補助方案。\n\n其他\n1. 嚴格監督落實地方建設品質，完善竹東生活機能。\n2. 爭取竹東外五里新建衛生所。\n3. 要求落實執法飼主寵物登記、植晶片，有效杜絕棄養，支持領養代替購買。\n4. 爭取輔導農民保險及農損補償機制，輔導農產品加工製成計畫暨設備補助。","items":["城鎮發展：積極爭取新竹縣輕軌鏈結科技生活圈串連設站竹東站，完善公共運輸缺口與提升交通系統效率，改善現有交通瓶頸。","城鎮發展：積極推動中興河道水岸生活空間再造二期計畫，打造水與綠新市鎮。","城鎮發展：積極爭取鎮內閒置空間綠美化、打造無齡別特色空間，提供鎮民、銀髮族、孩童等休憩場域。","城鎮發展：積極要求通盤檢討暨可行性評估都市計畫外五里（頭、二、三重等地區）新外環道路開闢，完善交通建設解決交通困境。","社會福利推行：多元社會福利持續力爭推行，老人年金發放及幸福升級長照2.0。","社會福利推行：因應新竹縣外移人口增加，要求研議提高生育補助津貼、育兒津貼、提升學童營養午餐品質，並且推動社區型公共托育家園，完善嬰幼托育制度。","社會福利推行：要求持續發放身心障礙福利及低收入戶補助等。","社會福利推行：要求研議通盤檢討新竹縣民意外保險額度及範圍，健全縣民生命保障制度。","社會福利推行：推動早期兒童療育相關政策納入政府補助，通盤檢討增加個案管理中心人力及物力資源、廣推融合教育，並研議開放全年特殊生托育中心及特教員培訓課程，以健全遲緩兒童教育權。","教育面向：強力要求推動英語教學，積極爭取外師制度，提升竹縣學子國際競爭力。","教育面向：推動母語教學及全民閱讀習慣，培養學子族群認同。","教育面向：強力爭取外五里地區非營利幼兒園結合親子圖書館。","青年面向：積極要求支持青年創業、根留竹東。","青年面向：要求研議健全青年創業計畫與補助方案。","其他：嚴格監督落實地方建設品質，完善竹東生活機能。","其他：爭取竹東外五里新建衛生所。","其他：要求落實執法飼主寵物登記、植晶片，有效杜絕棄養，支持領養代替購買。","其他：爭取輔導農民保險及農損補償機制，輔導農產品加工製成計畫暨設備補助。"],"platformIntro":"","contentSplit":{"version":"election-content-items-v1","method":"source_checked_second_sample_repair_20260930","reviewStatus":"reviewed","confidence":100},"platformSampleRepair":{"version":"second-sampled-councilor-repair-20260930","basis":"沿用已公開且保存的官方公報轉錄原文，5個主題各4／5／3／2／4項；只修正分類前綴及誤黏至前項的標題，不改寫18個政策子項或完整原文。","sourceSha256":"26b9bf6e9261a6130d65efeb47240dd61e0d4f75e7d544415a8c1cb85ffb3836","previousContentSplit":{"method":"numbered","version":"election-content-items-v1","confidence":98,"reviewStatus":"auto_approved"},"authorization":"User requested correction of the two reported defects; original public approval retained, not a new manual review."}},"items":["城鎮發展：積極爭取新竹縣輕軌鏈結科技生活圈串連設站竹東站，完善公共運輸缺口與提升交通系統效率，改善現有交通瓶頸。","城鎮發展：積極推動中興河道水岸生活空間再造二期計畫，打造水與綠新市鎮。","城鎮發展：積極爭取鎮內閒置空間綠美化、打造無齡別特色空間，提供鎮民、銀髮族、孩童等休憩場域。","城鎮發展：積極要求通盤檢討暨可行性評估都市計畫外五里（頭、二、三重等地區）新外環道路開闢，完善交通建設解決交通困境。","社會福利推行：多元社會福利持續力爭推行，老人年金發放及幸福升級長照2.0。","社會福利推行：因應新竹縣外移人口增加，要求研議提高生育補助津貼、育兒津貼、提升學童營養午餐品質，並且推動社區型公共托育家園，完善嬰幼托育制度。","社會福利推行：要求持續發放身心障礙福利及低收入戶補助等。","社會福利推行：要求研議通盤檢討新竹縣民意外保險額度及範圍，健全縣民生命保障制度。","社會福利推行：推動早期兒童療育相關政策納入政府補助，通盤檢討增加個案管理中心人力及物力資源、廣推融合教育，並研議開放全年特殊生托育中心及特教員培訓課程，以健全遲緩兒童教育權。","教育面向：強力要求推動英語教學，積極爭取外師制度，提升竹縣學子國際競爭力。","教育面向：推動母語教學及全民閱讀習慣，培養學子族群認同。","教育面向：強力爭取外五里地區非營利幼兒園結合親子圖書館。","青年面向：積極要求支持青年創業、根留竹東。","青年面向：要求研議健全青年創業計畫與補助方案。","其他：嚴格監督落實地方建設品質，完善竹東生活機能。","其他：爭取竹東外五里新建衛生所。","其他：要求落實執法飼主寵物登記、植晶片，有效杜絕棄養，支持領養代替購買。","其他：爭取輔導農民保險及農損補償機制，輔導農產品加工製成計畫暨設備補助。"],"after_json_md5":"099cba2d32f01fe1a0140793646b48b4","before_json_md5":"ef9f6cfdf4542639bc66c6b593820850","before_text_md5":"56c6f9809389dc4ac9f268fe489e351e"},{"id":"79b3a3ea-f629-491c-8a99-eb027eaa6417","name":"曹爾章","claim_key":"cec-platform:2022:votetw-candidate-ed907ec772f8ea6e","person_id":"38bc8cf6-1b94-4e04-b318-311665dfdb55","candidate_id":"6fab2d4f-d7b8-4448-9a38-0ab5697714f2","candidate_person_id":"38bc8cf6-1b94-4e04-b318-311665dfdb55","candidate_name":"曹爾章","race_id":"487ee560-f29b-45d4-b0f2-45e5d24ca023","election_id":"c254bb70-ffe2-4f05-8857-af83f1704c63","source_url":"https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/06%E7%B8%A3%E5%B8%82%E8%AD%B0%E5%93%A1/111%E5%B9%B4/19%E9%80%A3%E6%B1%9F%E7%B8%A3/%E9%80%A3%E6%B1%9F%E7%B8%A3%E7%AC%AC01%E9%81%B8%E8%88%89%E5%8D%80.pdf","source_sha256":"a1b1c51b339fe286b15f44d0c512db8540c0860393dc1798f237972d92533fd3","after_text":"一、督促全面檢討都市計畫並進行土地重劃，使土地更有效利用。\n二、要求推動人才培育計劃，協助青年回鄉服務，解決地區人才斷層問題。\n三、要求積極維護海洋生態資源，杜絕非法籠漁具捕撈作業。\n四、督促政府有效運用公彩基金，擴建老人安養設施及推動各項社會福利。\n五、推動興建停車場，解決民眾停車問題。\n六、繼續推動興建合宜住宅，解決民眾居住問題。\n七、興建復興村入村道路，改善目前入村交通困境。\n八、推動牛角大澳老街復興，增加地區具特色觀光資源。\n九、督促保護馬祖戰地及閩東文化特色，強化內涵，以獨特性吸引觀光人潮。","patch":{"platformText":"一、督促全面檢討都市計畫並進行土地重劃，使土地更有效利用。\n二、要求推動人才培育計劃，協助青年回鄉服務，解決地區人才斷層問題。\n三、要求積極維護海洋生態資源，杜絕非法籠漁具捕撈作業。\n四、督促政府有效運用公彩基金，擴建老人安養設施及推動各項社會福利。\n五、推動興建停車場，解決民眾停車問題。\n六、繼續推動興建合宜住宅，解決民眾居住問題。\n七、興建復興村入村道路，改善目前入村交通困境。\n八、推動牛角大澳老街復興，增加地區具特色觀光資源。\n九、督促保護馬祖戰地及閩東文化特色，強化內涵，以獨特性吸引觀光人潮。","items":["督促全面檢討都市計畫並進行土地重劃，使土地更有效利用。","要求推動人才培育計劃，協助青年回鄉服務，解決地區人才斷層問題。","要求積極維護海洋生態資源，杜絕非法籠漁具捕撈作業。","督促政府有效運用公彩基金，擴建老人安養設施及推動各項社會福利。","推動興建停車場，解決民眾停車問題。","繼續推動興建合宜住宅，解決民眾居住問題。","興建復興村入村道路，改善目前入村交通困境。","推動牛角大澳老街復興，增加地區具特色觀光資源。","督促保護馬祖戰地及閩東文化特色，強化內涵，以獨特性吸引觀光人潮。"],"platformIntro":"","contentSplit":{"version":"election-content-items-v1","method":"source_checked_second_sample_repair_20260930","reviewStatus":"reviewed","confidence":100},"platformSampleRepair":{"version":"second-sampled-councilor-repair-20260930","basis":"保存官方公報第1頁第1選舉區1號曹爾章本人9項，影像及文字層交叉核對；補回行首動詞及第9項續行「潮。」；移除下一列2號曹丞君第一項，不移轉或修改曹丞君資料。","sourceSha256":"a1b1c51b339fe286b15f44d0c512db8540c0860393dc1798f237972d92533fd3","previousContentSplit":{"method":"line","version":"election-content-items-v1","confidence":85,"reviewStatus":"auto_approved"},"authorization":"User requested correction of the two reported defects; original public approval retained, not a new manual review."},"sourceDocument":{"url":"https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/06%E7%B8%A3%E5%B8%82%E8%AD%B0%E5%93%A1/111%E5%B9%B4/19%E9%80%A3%E6%B1%9F%E7%B8%A3/%E9%80%A3%E6%B1%9F%E7%B8%A3%E7%AC%AC01%E9%81%B8%E8%88%89%E5%8D%80.pdf","file":"tmp/cec-representative-platforms/2022-councilor/pdfs/435ef1611f56908e2b3c8ca3.pdf","page":1,"sha256":"a1b1c51b339fe286b15f44d0c512db8540c0860393dc1798f237972d92533fd3","layoutFile":null,"extractionMethod":"source_checked_whole_candidate_block","supersededCropFile":"tmp/cec-representative-platforms/2022-councilor/crops-2/6fab2d4f-d7b8-4448-9a38-0ab5697714f2-a1b1c51b339fe286-28b3f67fcd0d.png","candidateNumber":1}},"items":["督促全面檢討都市計畫並進行土地重劃，使土地更有效利用。","要求推動人才培育計劃，協助青年回鄉服務，解決地區人才斷層問題。","要求積極維護海洋生態資源，杜絕非法籠漁具捕撈作業。","督促政府有效運用公彩基金，擴建老人安養設施及推動各項社會福利。","推動興建停車場，解決民眾停車問題。","繼續推動興建合宜住宅，解決民眾居住問題。","興建復興村入村道路，改善目前入村交通困境。","推動牛角大澳老街復興，增加地區具特色觀光資源。","督促保護馬祖戰地及閩東文化特色，強化內涵，以獨特性吸引觀光人潮。"],"after_json_md5":"ac6b68b036de488a02efd6cfd9f2ad31","before_json_md5":"6c102ed164381696b80c524af05a1132","before_text_md5":"227bcc8da2e6dbb007ff142cba893bda"}]$repairs$::jsonb)
AS r(id uuid,name text,claim_key text,person_id uuid,candidate_id uuid,candidate_person_id uuid,candidate_name text,
 race_id uuid,election_id uuid,source_url text,source_sha256 text,after_text text,patch jsonb,items jsonb,
 before_text_md5 text,before_json_md5 text,after_json_md5 text);

-- 與並行投票寫入互斥，避免基準核對後才進來的票被留在舊 item key。
LOCK TABLE public.platform_fulfillment_votes IN SHARE MODE;
DO $guard$
BEGIN
 IF (SELECT count(*) FROM sampled_councilor_repairs)<>2
 OR (SELECT count(DISTINCT id) FROM sampled_councilor_repairs)<>2
 OR (SELECT sum(jsonb_array_length(items)) FROM sampled_councilor_repairs)<>27 THEN
  RAISE EXCEPTION 'Unexpected sampled councilor repair scope';
 END IF;
 PERFORM c.id FROM public.person_claims c JOIN sampled_councilor_repairs r ON r.id=c.id FOR UPDATE OF c;
 IF EXISTS (
  SELECT 1 FROM sampled_councilor_repairs r LEFT JOIN public.person_claims c ON c.id=r.id
  LEFT JOIN public.candidates k ON k.id=c.candidate_id
  LEFT JOIN public.person_canonical_map cm ON cm.person_id=k.person_id
  LEFT JOIN public.person_canonical_map pm ON pm.person_id=c.person_id
  LEFT JOIN public.races race ON race.id=k.race_id
  LEFT JOIN public.elections e ON e.id=race.election_id
  WHERE c.id IS NULL OR c.claim_key IS DISTINCT FROM r.claim_key
  OR c.person_id IS DISTINCT FROM r.person_id OR c.candidate_id IS DISTINCT FROM r.candidate_id
  OR k.person_id IS DISTINCT FROM r.candidate_person_id OR k.candidate_name IS DISTINCT FROM r.candidate_name
  OR coalesce(cm.canonical_person_id,k.person_id) IS DISTINCT FROM coalesce(pm.canonical_person_id,c.person_id)
  OR k.race_id IS DISTINCT FROM r.race_id OR e.id IS DISTINCT FROM r.election_id
  OR e.year IS DISTINCT FROM 2022 OR race.race_type IS DISTINCT FROM 'councilor_district'
  OR k.is_elected IS DISTINCT FROM true OR k.election_result IS DISTINCT FROM 'elected' OR k.is_public IS DISTINCT FROM true
  OR c.claim_type IS DISTINCT FROM 'platform' OR c.review_status IS DISTINCT FROM 'verified'
  OR c.visibility IS DISTINCT FROM 'public' OR c.is_public IS DISTINCT FROM true
  OR c.source_url IS DISTINCT FROM r.source_url OR c.claim_json#>>'{sourceDocument,sha256}' IS DISTINCT FROM r.source_sha256
  OR ((md5(c.claim_value)=r.before_text_md5 AND md5(c.claim_json::text)=r.before_json_md5)
   OR (c.claim_value=r.after_text AND md5(c.claim_json::text)=r.after_json_md5)) IS NOT TRUE
 ) THEN RAISE EXCEPTION 'Sampled councilor baseline, source, approval or identity changed'; END IF;
 IF EXISTS(SELECT 1 FROM sampled_councilor_repairs r JOIN public.person_claims c ON c.id=r.id
  JOIN public.platform_fulfillment_votes v ON v.claim_id=c.id
  WHERE md5(c.claim_json::text) IS DISTINCT FROM r.after_json_md5) THEN
  RAISE EXCEPTION 'Existing platform votes require explicit item mapping';
 END IF;
END;
$guard$;
UPDATE public.person_claims c SET claim_value=r.after_text,claim_json=c.claim_json||r.patch,updated_at=now()
FROM sampled_councilor_repairs r WHERE c.id=r.id AND
 (c.claim_value IS DISTINCT FROM r.after_text OR md5(c.claim_json::text) IS DISTINCT FROM r.after_json_md5);
DO $verify$
DECLARE r record; actual_items jsonb;
BEGIN
 FOR r IN SELECT * FROM sampled_councilor_repairs LOOP
  IF NOT EXISTS(SELECT 1 FROM public.person_claims c WHERE c.id=r.id
   AND c.claim_value=r.after_text AND md5(c.claim_json::text)=r.after_json_md5) THEN
   RAISE EXCEPTION 'Sampled councilor post-update mismatch: %',r.id;
  END IF;
  SELECT jsonb_agg(f.promise_text ORDER BY f.display_order)
  INTO actual_items FROM published.platform_fulfillment_results(r.id) f;
  IF actual_items IS DISTINCT FROM r.items THEN
   RAISE EXCEPTION 'Repaired items not readable: %',r.id;
  END IF;
 END LOOP;
END;
$verify$;
COMMIT;
