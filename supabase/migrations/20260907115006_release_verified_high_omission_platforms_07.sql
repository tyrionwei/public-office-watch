BEGIN;

DO $review$
DECLARE
    review RECORD;
    affected_count INTEGER;
    total_affected INTEGER := 0;
BEGIN
    FOR review IN
        SELECT * FROM (VALUES
            ('ca2043a1-718b-4eff-9adc-0f14869e0180'::UUID,'6f62757a-9aa8-4a39-9820-51b3711c525c'::UUID,'d7c75568-ae44-4562-9fcb-f65fdb6e3aeb'::UUID,'89b518756097429142698373cc7ea157'::TEXT,99,'3980f90b019d100c4caaeaad6a78e803'::TEXT,$items$[
                "爭取湖西重要建設",
                "推動湖西總體社造",
                "優化湖西托育環境",
                "提升湖西教育資源",
                "開發湖西觀光景點",
                "增設湖西休閒設施",
                "加值湖西地方產業",
                "打造湖西幸福家園"
            ]$items$::JSONB),
            ('e27f3386-f7e3-4c0b-9381-3e95d56a66f3'::UUID,'9d8e00d6-5386-4449-86e4-9c5c938c561a'::UUID,'7c3c050b-e4cd-4fe5-a72c-a4affdf55009'::UUID,'2e5d769971e41fdba04408199dcef436'::TEXT,659,'c9e480dbc352c76673df506cc7fffa01'::TEXT,$items$[
                "教育&體育培植：推動全齡化族語學習制度，族語教學納入補教體制，設立模範族語家庭獎勵機制。",
                "教育&體育培植：推動設立阿美族沉浸式族語實驗小學。",
                "教育&體育培植：制訂完整體育人才培育及退役後輔導計畫。(包含全國原住民運動會選手之培植)",
                "教育&體育培植：推動全國原住民族運動會「社會組別及傳統項目」運動員選拔機制設置。",
                "教育&體育培植：推動原住民族食農教育園區設置、原民作物可食地景規劃。",
                "文化發展傳承：爭取舉辦本市「原住民族嘉年華會」。",
                "文化發展傳承：要求市府重新審定族群領袖選拔制度，尊重各族群推舉方式。",
                "文化發展傳承：制訂各地區文化事務推動獎勵機制，鼓勵各族群推舉方式。",
                "文化發展傳承：文化祭儀預算，除依人口比例外，應考量少數族群需求，給予相對應資源。",
                "經濟產業升級：爭取本市境內各大產業園區之「原住民專屬空間」，前期租賃費用減半。",
                "經濟產業升級：爭取設置原住民青創產業孵化器及加速器，編訂長期預算聘請專業團隊輔導陪伴。",
                "經濟產業升級：爭取開辦原住民族傳統工藝職業訓練，並與企業合作，增加族人斜槓收入。",
                "經濟產業升級：結合新興產業趨勢，輔導中高齡傳統產族人利用已具備之技能，開創其他收入。",
                "經濟產業升級：爭取開辦新興創業工具之課程教學輔導，提升原住民族青年職場競爭力。",
                "落實居住正義：訂定本市各河海濱聚落安置短中長期計畫設置。",
                "落實居住正義：保障現有原住民國宅之河海濱聚落遷移住戶之永久居住權益，推動「以租代購」方案，取得所有權。",
                "落實居住正義：訂定本市原住民國宅及社宅自治條例。",
                "落實居住正義：爭取多處設置原住民族專屬社會住宅，持續爭取提高現有社宅原住民族人之比例。",
                "落實居住正義：整合中央及地方現有資源，增設青年購屋、族人租屋諮詢服務窗口。"
            ]$items$::JSONB),
            ('93a64f2d-79f5-4381-8b94-65e644dc5ff2'::UUID,'1a754014-7efc-4e46-9bba-d3b46b2dbfb6'::UUID,'866d7541-af35-4ab4-882e-a7fd4396fcc8'::UUID,'fc6b6f05e8987e80b1ccec3cef155947'::TEXT,758,'e8c86cf5cbf6bd961289a48667c3a42a'::TEXT,$items$[
                "堅持環保正義：實現垃圾袋免費成功爭取焚化廠售電直接回饋居民，每年每戶每人發放超商/ 超市提貨券。落實監督北投焚化爐燃燒品質，降低空氣污染。推動環保二次袋、推廣環保購物袋，達成限塑減塑，全面汰換老舊垃圾車，降低空污及碳排放，顧士林北投市民的健康，打造宜居永續城市。",
                "強化地方建設：監督市府加速北士科技園區、關渡平原、社子島整體生態開發和完善配套措施，力爭居民最大權益。推動磺港溪再造計畫並促成北投市場改建，改善三層崎公園花海品質，擴建硫磺谷泡腳池、催生河雙21公園親子共融設施、雙溪濕地公園升級改造、洲美親子共融公園及狗運動公園。",
                "促進在地繁榮：推生士林無圍牆博物館計畫與士林夜市商圈接軌，活絡在地產業，振興在地經濟、推動北投影視音科技園區發展、爭取西基地興建多座國際型多功能運動場館、爭取公有市場攤商紓困減租。",
                "打造友善交通：讓通勤族更便利，任內順利完成北投、明德、奇岩捷運站第二出口。為改善在地停車迫切需求，成功爭取福星公園、振華公園闢建地下停車場、秀山國小長照園區闢建臨時停車場。",
                "爭取長者福利：成功恢復重陽敬老金、補發110.111年敬老悠遊卡點數儲值金並要求擴大使用範圍，恢復65歲以上健保費補助，改建浩然敬老院並增建長照大樓，催生奇岩長青樂活大樓、稻香長照大樓、秀山長照園區。",
                "提升教育資源：推動增設公立幼兒園、提高私立幼兒園補助，及育兒托嬰各項補助。提升中小學校園營養午餐品質，全面落實教科書平價化，減輕家長負擔。",
                "捍衛居住正義：堅持士北科技園區專案住宅、奇岩公共住宅工程品質，監督「北投區機一基地」及「士林區福順段基地」公共住宅如期完工，讓青年市民過得安心，住得放心。",
                "維護城市治安：要求全市逐步汰換監視系統，升級監視器設備，加強監視器品質及傳輸效率，打造治安零死角。"
            ]$items$::JSONB),
            ('b145d599-69f2-4a32-84ba-edffcbcd6777'::UUID,'ea9d5f4a-8775-42a2-b8ee-1fed925cf9d8'::UUID,'f7001dd2-0938-4c40-9ec6-97c19e9f2cd9'::UUID,'31e3029ad9b9c91d36a62bbfaab4599d'::TEXT,569,'a53a6c09da5e56e844de699264d4ae23'::TEXT,$items$[
                "我認為，一座城市裡最重要的是人，以人為本，城市才能穩定發展、成長。【政治理念】好的政策，應該落實在每個人的生活中。",
                "普設YouBike2.0，推廣淨零碳排環保城市，目標新北市建置完成1500站YouBike2.0。",
                "智慧公車站牌增設，鼓勵使用大眾運輸工具，加速推動中和建置80站智慧公車站牌。",
                "持續更新整平人行道及改善淹水熱點，守護市民行的安全，構築友善通行環境。",
                "實踐雙北共同生活圈，規劃單一定期票券，不限次數搭乘雙北捷運、公車、火車及YouBike。",
                "守護學童上下學安全，改善通學廊道，爭取年底完成50所學校通學廊道改善工程。",
                "找回人口競爭力，目標增加公共托育中心達200家，形塑友善生養環境、打造樂活宜居城市。",
                "讓年輕父母敢生小孩，提升新北生育率，持續爭取提高生育補助，減輕父母育兒負擔。",
                "落實居住正義，成功爭取莒光路「公路人員訓練所中山路教練場」遷移，規劃興建青年社會住宅中。",
                "積極協助青年事務，改善低薪環境，推動青年創業輔導及補助。",
                "打造新北藍帶、擁抱親水城市，110年藤寮坑溝整治成功，加速推動瓦磘溝及中原溝改造計畫。",
                "形塑健康城市，全面增設體健設施，中和灰磘里、烘爐地山下特色籃球場規劃興建中。",
                "關懷銀髮族權益，爭取廣設日照中心及長照機構，讓長輩無後顧之憂、安享天年。"
            ]$items$::JSONB),
            ('5ada5399-91af-4cc3-bbaa-a92c0a686125'::UUID,'5f9a2d19-96ed-4981-9b2a-20f6e1acf18b'::UUID,'dd747f32-1897-4a59-aa85-7212dd669a68'::UUID,'8635a320aa7acfa627a2364ecec41b01'::TEXT,200,'3a09571a63cb66b7b61935a38ca31403'::TEXT,$items$[
                "持續推學童警鳴器，愛護學童快樂長大",
                "完善大眾運輸機制，友善安全用路環境",
                "強力監督市政預算，杜絕貪婪瀆職歪風",
                "蓬勃市場夜市商圈，帶動地區觀光發展",
                "支持性別平權觀念，多元台北友善城市",
                "爭取警政消防福利，落實台北居住安全",
                "補足醫療衛生措施，提高台北環境品質",
                "全力推動都市更新，重塑台北城市美學",
                "建構長者社福制度，良善台北首善之都",
                "鞭策公共建設品質，落實臺北宜居城市"
            ]$items$::JSONB)
        ) AS reviews(claim_id,person_id,candidate_id,expected_md5,expected_length,expected_source_md5,repaired_items)
    LOOP
        UPDATE public.person_claims AS claim
        SET claim_json = pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(COALESCE(claim.claim_json,'{}'::JSONB),'{items}',review.repaired_items,TRUE),
                '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-07-20260907','reasonCodes','[]'::JSONB)),TRUE),
            '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-07-20260907','repair','official_source_full_resplit','classification','verified_repair'),TRUE),
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
    WHERE claim_json#>>'{contentSplit,releaseQuality,version}'='verified-high-omission-platforms-07-20260907';
    IF actual<>$expected${
        "5ada5399-91af-4cc3-bbaa-a92c0a686125":10,
        "93a64f2d-79f5-4381-8b94-65e644dc5ff2":8,
        "b145d599-69f2-4a32-84ba-edffcbcd6777":13,
        "ca2043a1-718b-4eff-9adc-0f14869e0180":8,
        "e27f3386-f7e3-4c0b-9381-3e95d56a66f3":19
    }$expected$::JSONB THEN RAISE EXCEPTION 'Unexpected item counts: %',actual; END IF;
END
$validate$;

COMMIT;
