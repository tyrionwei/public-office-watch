BEGIN;

DO $review$
DECLARE
    review RECORD;
    affected_count INTEGER;
    total_affected INTEGER := 0;
BEGIN
    FOR review IN
        SELECT * FROM (VALUES
            ('f252682d-91f9-4102-9bec-54c9314d1a75'::UUID,'d81651b9-b65f-40ba-a368-20e900e34dc3'::UUID,'d4ede86a-973b-4b91-8425-08fbc298177b'::UUID,'05015995c09de530476e8f4068181f17'::TEXT,484,'8dc562c13d311d1a89b9fa4b18ce461d'::TEXT,$items$[
                "雙語教育，邁向國際：與大專院校英語、翻譯系所合作成立中小學雙語教學專責單位，開發雙語教材，減輕教師負擔",
                "雙語教育，邁向國際：運用線上資源培訓雙語師資，協助推廣中小學雙語教育",
                "雙語教育，邁向國際：與國內外英語、教育相關系所合作，辦理沈浸式營隊，在臺灣營造雙語學習環境",
                "教育均值化、優質化：因應人口需求，重新檢討學區劃分",
                "教育均值化、優質化：推廣「就近入學」，規劃增班設校（國小到高中）",
                "教育均值化、優質化：合理分配中小學教育資源，達到「校校皆是明星學校」的目標",
                "教育均值化、優質化：爭取代理教師權益、減少教師流動率、保障教學品質",
                "推廣中小學「心理衛生教育」：與國內外民間單位合作，讓學生及早認識並且預防憂鬱症、躁鬱症等心理疾病",
                "改善交通安全：完成「光埔空橋」建設、保障學童通學安全",
                "改善交通安全：關埔重劃區增設機車格、減少交通亂象",
                "改善交通安全：規劃增設人行道，讓學生安心走路上下學",
                "改善交通安全：即時填補道路坑洞，減少安全疑慮",
                "改善交通安全：檢討公車路線及班次，推廣大眾運輸與共乘",
                "落實居住正義：推動囤房稅、空屋稅，限制不合理囤房、炒房",
                "落實居住正義：支持興建社會住宅，落實居住正義",
                "落實居住正義：推廣包租代管，保障租客權益",
                "推動長照服務：要求市府規畫未來長照服務的財源",
                "推動長照服務：推動身心障礙者、低收入戶等弱勢族群的長照服務"
            ]$items$::JSONB),
            ('f8efab6c-8056-4018-9d50-79498ba1ae86'::UUID,'77171388-00f0-4dcd-a709-db4496b1d3f4'::UUID,'b570ad7f-50c9-4646-b011-377eb7c77452'::UUID,'7eeaa9534d84ac643188f8fc8597755e'::TEXT,753,'1f8fe19dbdc90729642f29edd2006415'::TEXT,$items$[
                "交通：監督確保忠孝路擴寬20米計畫道路如期完工，並延伸至中興街五叉路口，提前結合二王公墓市地重劃計畫。",
                "交通：監督永康次17-1號新闢道路完工並加速17-2號、17-3號計畫道路開闢，以利區域整體規劃發展。",
                "交通：大橋三街優先開闢直通東橋一路。",
                "交通：爭取自強路經永科北路至王行東路跨橋連接許縣溪對岸新化永新路，打通除台一線、台二十線外，增加第三連結道，以利永康、新化區域發展。",
                "交通：加速開闢已列入都市計劃但未開闢之道路徵收及公園綠地，爭取預算編列收購私人既成巷道，減少民眾權益受損。",
                "交通：南下大灣交流道高速二街右轉復興路增設右轉道與機慢車專用道；另復興路右轉高速二街、迴轉道，徵收路邊五米作為正式右轉專用道，取代現有暫時性S型右轉道。",
                "建設：延續監督成功里立體停車塔(一、二樓為活動中心)進度，再續爭取忠孝運動公園全民運動館與風雨球場設置，及納骨塔新設電梯與立體停車塔(一、二樓為活動中心)。",
                "建設：監督光復里活動中心施作進度，爭取大灣里活動中心用地取得與預算編列",
                "建設：保留修護永康奇美醫院旁的飛雁新村歷史建築，打造成為華山文創產業園區",
                "治水：下水道是一個城市的主動脈，加強水利局、工務局水溝巡檢與淤積排除列為緊急業務。",
                "治水：協助已申請中央經費核撥效率，以加速永康易淹水區域整體改善與健診(中正路歐洲世界、中山南路吉村飯店、大灣交流道、裕農路交流道下方等)。",
                "居住：監督社會住宅(只租不售)興建品質、數量提升與生活機能強化，協助社會住宅申請資格條件制定，增強包租代管、租屋補助、安心成家貸款效能，實現居住正義。",
                "教育與社會福利：國中小營養午餐免費、65歲以上長輩健保費全額補助、減少流浪教師數額、提供代理教師完整聘期、落實特教生就學權益降低師生比保障師資。"
            ]$items$::JSONB),
            ('0b478152-dfb2-4403-a98d-b834ccd56c02'::UUID,'81bb7edb-a5af-4d85-899c-05a01f2f7bf0'::UUID,'2860ff92-4a0c-4743-8e59-7ae717a84918'::UUID,'890147a534387db173cf58418985e6f8'::TEXT,658,'4258ccf08124fa629e40d900c33ad74d'::TEXT,$items$[
                "監督市政工程，提升市民參與：督促市政資訊公開，強化議會及公民監督功能。",
                "監督市政工程，提升市民參與：嚴格要求工程落實查核驗收，杜絕「未驗收就敔用」。",
                "監督市政工程，提升市民參與：嚴格把關棒球場缺失改善，避免市府重蹈覆轍。",
                "監督市政工程，提升市民參與：推動舉辦「重大施政前期公聽會」，讓民間團體及市民充分參與。",
                "把關財政預算，看緊市民荷包：嚴格審議預算，資源妥善分配。",
                "把關財政預算，看緊市民荷包：把關追加預算合理性，杜絕市府浮報經費、重複施工。",
                "把關財政預算，看緊市民荷包：監督各項活動辦理成效，納入在地參與並留下永續效益。",
                "把關財政預算，看緊市民荷包：督促活化閒置資產，訂定合理租金及權利金。",
                "促進交通安全，推動人本環境：監督改善道路標誌標線設計，降低交通事故率。",
                "促進交通安全，推動人本環境：推動車速車向分流，逐步取消強制機車兩段式左轉。",
                "促進交通安全，推動人本環境：督促新設人行道、整平騎樓，保障行人權益。",
                "促進交通安全，推動人本環境：檢討大眾運輸現況，力促改善市區公車。",
                "營造友善育兒、多元教育環境：加速推動建置社會住宅、公托中心。",
                "營造友善育兒、多元教育環境：督促提高國中小正式教師比率，穩定教育品質。",
                "營造友善育兒、多元教育環境：促進學校教育均質化，發展各校特色教學。",
                "營造友善育兒、多元教育環境：推廣體育活動，督促設置運動場地及設施。",
                "振興舊城商圈，促進南寮升級：督促改善市場環境，活化武昌街活動中心、中正台夜市。",
                "振興舊城商圈，促進南寮升級：協助推動舊城復興計畫及都市更新，媒合空間及青創團隊。",
                "振興舊城商圈，促進南寮升級：鼓勵藝文團體在地發展，以城市為舞台，創造舊城新魅力。",
                "振興舊城商圈，促進南寮升級：推廣南寮漁村及造船文化，協助發展漁港觀光。"
            ]$items$::JSONB),
            ('ce9c8860-3d80-4b8f-b691-cf987fef152d'::UUID,'a25ac9b5-98a8-467e-8d3e-4f48fb7a11b4'::UUID,'c486a92f-2503-4366-955f-56c12b975575'::UUID,'92ac0f921d99c4b2b3ea06793f9d0c5b'::TEXT,223,'c333a441613e0534744844ecfa6dfa3e'::TEXT,$items$[
                "正。幸福：爭取續發65歲以上安老津貼",
                "正。幸福：爭取65歲以上長輩免費健康檢查",
                "正。幸福：擴大敬老愛心卡補助適用範圍",
                "正。幸福：增加學童營養午餐每人補助額",
                "正。樂活：爭取社區關懷據點共餐、課程開辦補助",
                "正。樂活：爭取北區第二座親子館的增設",
                "正。樂活：爭取改造士林市場門面與周邊環境",
                "正。樂活：爭取南寮第五公墓遷移後，規劃南寮森林公園",
                "正。好行：爭取微笑單車UBIKE一里一站點",
                "正。好行：爭取輕軌二階段經國路─南寮",
                "正。好行：加速新建台68武陵連通竹北"
            ]$items$::JSONB),
            ('b2b41815-66b9-4083-b3b0-ecb890f48407'::UUID,'f9860a9c-7ba3-45cc-bc9d-3269d60d4548'::UUID,'af457c66-eeb9-4384-8371-9c7d63f4f8ce'::UUID,'9edc00b0aa6b5dc4ce99eeb6649a7bd8'::TEXT,581,'16ba6a867a2921a1120c7db9c5425717'::TEXT,$items$[
                "打造宜居安南：遊子返南！定居樂業！年輕城鄉！翻轉安南區！",
                "推動「便捷交通網」，發展安南區大眾捷運系統：「安南直達專車」：往返直達沙崙高鐵站、南科。",
                "推動「便捷交通網」，發展安南區大眾捷運系統：「護長顧學公車」：長者照護專車、學生通學專車。",
                "推動「便捷交通網」，發展安南區大眾捷運系統：「綠色交通佈點」：爭取共享電動機車進入安南區。",
                "產業品牌化發展，共創永續家園：「製鞋產業優化」：爭取全國鞋展在台南舉辦，催生「鞋藝創新據點」，向下扎根並推廣製鞋職人精神，推進台南鞋業為世界級精品的目標努力。",
                "產業品牌化發展，共創永續家園：「農漁產業升級」：推動智慧漁業，促進養殖產業升級與提高產值，爭取延伸冷鏈公共建設、加強產銷調節能力，有效改善及提升農漁民生活品質，改善地方投資環境、實現區域均衡發展。",
                "產業品牌化發展，共創永續家園：「特色商圈營造」：打造安南區專屬的特色商圈，帶動安南區商業經濟發展，使安南區生活機能更加完善。",
                "衡量市府財政狀況，爭取逐步增加65歲以上年長者之健保費至全額補助、提高各項老年醫療補助。",
                "爭取增設安南區特色公園以及溪畔休閒空間。",
                "減輕房租、買房經濟壓力，並確保住宅消防安全。",
                "長期耕耘基層運動隊伍，呼應112年台南全運會：「提高奪牌獎金」：參加全運會、全中運選手的奪牌獎金增加。",
                "長期耕耘基層運動隊伍，呼應112年台南全運會：「導入運動科學」：強化基層運動隊伍訓練品質，以運動科學為基礎，提供運動傷害防護員、物理治療師、專業體能訓練等，照顧基層選手的身體。"
            ]$items$::JSONB)
        ) AS reviews(claim_id,person_id,candidate_id,expected_md5,expected_length,expected_source_md5,repaired_items)
    LOOP
        UPDATE public.person_claims AS claim
        SET claim_json = pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(COALESCE(claim.claim_json,'{}'::JSONB),'{items}',review.repaired_items,TRUE),
                '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-06-20260907','reasonCodes','[]'::JSONB)),TRUE),
            '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-06-20260907','repair','official_council_page_full_resplit','classification','verified_repair'),TRUE),
            updated_at=pg_catalog.now()
        WHERE claim.id=review.claim_id AND claim.person_id=review.person_id AND claim.candidate_id=review.candidate_id
          AND claim.claim_type='platform' AND pg_catalog.md5(claim.source_url)=review.expected_source_md5
          AND pg_catalog.md5(claim.claim_value)=review.expected_md5 AND pg_catalog.length(claim.claim_value)=review.expected_length
          AND claim.claim_json->>'platformText'=claim.claim_value
          AND claim.claim_json#>>'{contentSplit,reviewStatus}'='needs_review'
          AND claim.claim_json#>>'{platformQualityAudit,classification}'='confirmed_content_or_split_issue'
          AND claim.claim_json#>>'{platformQualityAudit,repair}'='recovered_missing_item_from_stored_source';
        GET DIAGNOSTICS affected_count=ROW_COUNT;
        IF affected_count<>1 THEN RAISE EXCEPTION 'Expected one update for %, found %',review.claim_id,affected_count; END IF;
        total_affected:=total_affected+affected_count;
    END LOOP;
    IF total_affected<>5 THEN RAISE EXCEPTION 'Expected five updates, found %',total_affected; END IF;
END
$review$;

DO $validate$
DECLARE actual JSONB;
BEGIN
    SELECT pg_catalog.jsonb_object_agg(id::TEXT,pg_catalog.jsonb_array_length(claim_json->'items')) INTO actual
    FROM public.person_claims
    WHERE claim_json#>>'{contentSplit,releaseQuality,version}'='verified-high-omission-platforms-06-20260907';
    IF actual<>$expected${
        "0b478152-dfb2-4403-a98d-b834ccd56c02":20,
        "b2b41815-66b9-4083-b3b0-ecb890f48407":12,
        "ce9c8860-3d80-4b8f-b691-cf987fef152d":11,
        "f252682d-91f9-4102-9bec-54c9314d1a75":18,
        "f8efab6c-8056-4018-9d50-79498ba1ae86":13
    }$expected$::JSONB THEN RAISE EXCEPTION 'Unexpected item counts: %',actual; END IF;
END
$validate$;

COMMIT;
