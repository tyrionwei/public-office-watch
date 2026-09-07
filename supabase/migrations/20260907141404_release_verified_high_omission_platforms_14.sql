BEGIN;

DO $review$
DECLARE repair RECORD; affected_count INTEGER;
BEGIN
    FOR repair IN
        SELECT * FROM (VALUES
            ('53657df3-bfcd-42ce-93c0-0aefeda5dc58'::UUID,'bbee55b2-1ed6-4e8b-af34-a563c7a89e01'::UUID,'ff4d37e0-30fd-4193-8f24-ddab8e46fe7e'::UUID,'7c5db1655053bd3c46958301070a38f6','a17b803707e1d135652bfbc9a684e4d5',910,NULL::TEXT,$items$[
                "守哲幸福｜我做到了：落成前瞻計畫地下停車場（音樂公園、五權公園、忠孝國中）。",
                "守哲幸福｜我做到了：爭取育兒第三胎，補助三萬元（擔任民進黨黨團總召期間，推動成功！）。",
                "守哲幸福｜我做到了：守護行人路權，落成人行道改善計畫（漢生東路、府中商圈、板橋三民路、南雅南路）。",
                "守哲幸福｜我做到了：建立各式線上選民服務系統，承接超過萬件各類服務案件。",
                "守哲幸福｜我做到了：落成特色彩繪牆融入社區（重慶里、國泰里、民族里、華德里、信義里）。",
                "守哲幸福｜我做到了：排水系統建設／規劃（浮洲橋人行道排水改善工程、規劃僑中里污水下水道）。",
                "守哲幸福｜我做到了：推動青年局成立，完善青年政策（職涯發展、創業資源、創業空間租借）。",
                "守哲幸福｜我做到了：成功爭取板橋醫療園區（都市計畫已變更完成，待發包）。",
                "守哲健康｜銀髮生活：協助「老齡生活規劃」，爭取「銀髮族生活講座」。",
                "守哲健康｜銀髮生活：清點適合的閒置空間，爭取「日間公共托老中心」。",
                "守哲健康｜銀髮生活：守護銀髮族笑容，爭取「65歲長者免費裝假牙」。",
                "守哲健康｜銀髮生活：促進健康，爭取銀髮族公園健體設施。",
                "守哲健康｜銀髮生活：推動智慧照護，架設「IOT物聯網智慧照護設備」。",
                "守哲健康｜銀髮生活：擴大敬老卡支付範圍，爭取「敬老小黃幸福車隊」。",
                "守哲健康｜銀髮生活：推動「青銀互動社宅」，青年照顧銀髮換宿，跨世代交流社會更幸福。",
                "守哲安心｜婦幼成長：盤點閒置教室，增加公共幼托數量。",
                "守哲安心｜婦幼成長：爭取加碼新北市「育兒補助津貼」額度。",
                "守哲安心｜婦幼成長：落實建立「校園關懷機制」反霸凌／反毒品。",
                "守哲安心｜婦幼成長：關懷兒少，爭取「板橋高風險兒少中心」。",
                "守哲安心｜婦幼成長：守護婦幼夜歸安全，增設「夜間感應燈」。",
                "守哲未來｜青年發展：爭取擴大青年媒合新創產業「實習機會」。",
                "守哲未來｜青年發展：整合自媒體產學資源，爭取「雲端自媒體中心」。",
                "守哲未來｜青年發展：支持青年參政，完善「公共政策網路參與平台」。",
                "守哲未來｜青年發展：爭取「發展電競產業，辦理課程培育電競人才，爭取電競從業機會」。",
                "守哲未來｜青年發展：推動「優良租屋」評鑑減稅，鼓勵公益出租。",
                "守哲未來｜青年發展：爭取「成家基金」津貼計劃，結婚入籍補貼10萬。",
                "守哲未來｜青年發展：爭取「板橋第二國民運動中心／板橋自由車場地」。",
                "守哲幸福｜動保權益：照顧毛小孩健康，推動「寵物友善健檢」。",
                "守哲幸福｜動保權益：爭取「寵物友善公園」／「寵物洗澡設施」。",
                "守哲幸福｜動保權益：推動落實「寵物友善社區評鑑」。",
                "守哲幸福｜動保權益：捍衛「動保正義」，嚴打黑心寵物繁殖場。",
                "守哲幸福｜動保權益：提升動物收容中心環境，改善軟硬體設施。"
            ]$items$::JSONB),
            ('415a82ff-0c89-4299-a3fa-53047e9eb61f'::UUID,'71aa5a07-e3a6-482c-b17e-4cb7228e019c'::UUID,'ad70fafd-3458-456d-962e-ae0ba2520578'::UUID,'58055c71e1a26d45840a61604d100e3c','efbc2142b2e6fad0f428e26cc75c4bd3',634,'多一點用心，高雄一定會更好：',$items$[
                "敦促市府改善產業結構，建構具循環經濟思維的生態產業鏈。",
                "救空汙！儘力推動高雄及早達成無煤家園。",
                "鼓勵市府推動全市企業ESG，落實提升環境、社會與治理的企業社會責任。",
                "持續推動高雄自願檢視城市發展融入聯合國永續發展目標（SDGs）。",
                "問政與公益志業進度報告：全面推展「科丁」教育：已開辦867班、培育超過3.7萬位科丁學童、十種學程，目標人數再成長100%並列入小學課程。",
                "問政與公益志業進度報告：打造高雄「志工」社會：已培育1.2萬名合格志工，目標培訓人數再增50%。",
                "問政與公益志業進度報告：開辦「心智圖」課程：已有2.1萬名學童上課，目標人數再成長50%。",
                "問政與公益志業進度報告：籌辦「跳跳屋」：完全免費「何爺爺跳跳屋－高雄幸福水樂園」活動，共辦理8場次、3萬人進園同樂，持續辦理中。",
                "問政與公益志業進度報告：推動「微型保險」：整合公部門與民間資源，推動並擴大免費納保的弱勢族群項目與人數，目前已達5.5萬人納保，目標含低收入戶、中低收入戶、身心障礙輕度和中度有補助者、弱勢單親家庭等全市符合納保對象約12.6萬人集體納保，將推動自治條例法制化。",
                "問政與公益志業進度報告：廣徵民意：已舉辦202場「公聽會」，廣泛邀請產官學民間人士共同探討市政議題，持續辦理中。",
                "問政與公益志業進度報告：監督財政紀律：8年來為高雄減債432億元減赤，提升政府效能，改善高雄財政困境。",
                "問政與公益志業進度報告：加強土地活化：推動「公共設施保留地解編」還地於民，舒緩近千億市庫負擔，持續督促市府解編進度。"
            ]$items$::JSONB),
            ('f540fb76-2f4b-414b-b616-6a506aa3e944'::UUID,'dc5ec79a-be58-4af3-8f1b-d0ac0d1f3b49'::UUID,'af62347f-45f7-49b6-850a-6634cf010e55'::UUID,'237b9307cd18a6e96f1e82006c81cf67','d7ef8b3f8f0420c1cfb34f494ec4cba8',815,'本選區唯一高雄市公督盟評鑑優質議員，勤服務、會做事，懇請支持。',$items$[
                "打造產業升級，促進經濟就業，提升勞工薪資：推動北高雄半導體及扣件等產業聚落，加速橋頭科學園區開發並推動橋科第二園區。協助傳統產業解決用地不足困境，增加產業用地。鼓勵廠商優先晉用在地青年，友善職場環境，敦促勞工局北高開課培訓，提升勞工薪資。",
                "打造產業升級，促進經濟就業，提升勞工薪資：推動海洋經濟首都，打造高雄「農漁產品牌化」，拓展永安、梓官、彌陀、岡山、燕巢等地農漁產國際通路。美化海岸線「彌陀南寮海岸光廊」、「永安永新灣親水公園」、「蚵仔寮海洋及漁業文化親子館」及「燕巢瓊林有機農場」。",
                "完善交通建設，縮短城鄉差距：加速推動及爭取「岡山火車後站連通捷運岡山站跨站天橋」、「岡山第二交流道」、「橋科匝道」、「高鐵橋下台39線打通」、「岡山交流道下兩側連通橋科」、「高捷紫線—高雄學園線」、「捷運岡山延伸湖內」、「台鐵地下化延伸岡山」。",
                "完善交通建設，縮短城鄉差距：降低交通、消防、公安意外，持續推動巷弄打通，如岡山火車後站出口巷弄打通、岡山區新樂街15巷園道、彌陀鹽埕大排、梓官仁愛路、梓官平安街及其他都市計畫內巷弄打通。",
                "都市計畫檢討，爭取有感施政、優化宜居環境：都市計畫各區重新檢討，推動區段徵收加速繁榮地方，老舊行政中心整併重建，讓市政資源公平挹注各區發展。推動醒村成為青創基地，發展三軍眷村觀光。爭取北高雄第二座社會住宅、國民運動中心，推動防災智慧安全城市。",
                "都市計畫檢討，爭取有感施政、優化宜居環境：持續推動特色公園，成功爭取「岡山區河堤公園兒童遊戲場」、「岡山寵物公園」、「梓官智蚵公園」、「梓官運動公園」、「燕巢南燕公園」、「彌陀公園」、「一區一特色公園」改造，未來繼續推動特色公園規劃。",
                "關懷婦幼弱勢動保、促進社會和諧：維護婦女權益、安全及福利；推動北高雄兒童夜間急診、增加托嬰中心、臨時托育；持續關注弱勢者基本權益並爭取更全面性的福利照顧。致力減少流浪動物，爭取動保專業人力，增加犬貓絕育等執行預算。"
            ]$items$::JSONB),
            ('1a8ebf40-6b14-4267-992f-a92f39be8013'::UUID,'e9293e38-c3e7-4fda-87b7-799462805239'::UUID,'9dea99f7-c826-42b3-81f4-7f79125ae66a'::UUID,'6a7bfa7e9a01a215ea96f30d78494059','30a663309e14d438fd33083d84c6d91d',634,NULL::TEXT,$items$[
                "成功爭取舊社公園停車場，繼續爭取兒童公園、敦化公園停車場。",
                "成功爭取新設8688路，延駛綠1、綠2、922路，持續完善公車路網。",
                "成功爭取北屯區增設YouBike 2.0站點149站。",
                "加速推動捷運綠線大坑延伸線、藍線、屯區線。",
                "成功爭取東峰兒童運動中心，繼續增設兒童設施。",
                "成功爭取廍子地區圖書館、兒童公園圖書館改建。",
                "成功爭取北屯國民運動中心、台中巨蛋。",
                "成功推動台中市囤房稅，落實居住正義。",
                "成功爭取打通南興三路、南興北一路、興安路，繼續爭取東光路、景賢路、機捷特區及14期聯外道路。",
                "成功爭取功景橋改建，繼續爭取環太東路聯外橋闢建。",
                "成功爭取荔枝老樹公園，並推動特色公園計畫。",
                "成功爭取台中公立學校雙語教學。",
                "成功爭取823公園、民俗公園兒童遊戲場改善。",
                "成功爭取生育津貼增加至2萬元、托育補助每月5000元。",
                "繼續爭取廍子、廍興、兒童公園兒童遊戲場改善。",
                "成功爭取北屯3處公共托育，繼續爭取同榮、北屯2處社會住宅公共托育。",
                "維護公寓大廈公共安全，補助住宅加裝住宅用火災警報器、滅火器。",
                "成功爭取12單元增設國中小各1座，繼續爭取廍子國中設立。",
                "成功爭取漢神百貨進駐，持續推動招商引資、市場轉型。",
                "拒絕核食嬰幼兒食品，推動市府購買純鍺偵檢器。",
                "支持推動台中購物節、十大伴手禮票選、大坑千人宴。",
                "強化校園安全，營養午餐禁用萊豬，支持嚴懲重罰狼師。"
            ]$items$::JSONB),
            ('70dd7a7e-8b53-46ac-b768-0cb883ecd274'::UUID,'a779e071-4cc6-41e3-a5b0-cb4235fa25d0'::UUID,'7647f3f6-b99d-406d-98a8-83e9f0ad4dcc'::UUID,'06b543c370e814825b2c4b8f536bc949','5e40e90bd8410b1946d92378a3ca2a28',396,NULL::TEXT,$items$[
                "人本交通：黃捷挺黃捷！加速推動黃線捷運。",
                "人本交通：改善行人無障礙通行環境。",
                "人本交通：道路權益平等，改革交通設計。",
                "兒少權益：揭發兒虐、校園霸凌及性騷事件。",
                "兒少權益：深耕性平教育、數位性暴力防治。",
                "兒少權益：確保托育品質、訂定把關機制。",
                "藝文體育：推動運發基金、改善澄清湖球場。",
                "藝文體育：山岳安全與教育、海洋旅遊與水域解禁。",
                "藝文體育：推廣鳳山黃埔新村、明德訓練班及台鐵高雄機廠文資。",
                "動物保護：爭取寵物友善空間及設施。",
                "動物保護：訂定寵物臨終制度、修正野保相關條例。",
                "動物保護：多次揭露動物虐待事件、捍衛動物權益。",
                "居住正義：推動房屋稅制合理化。",
                "居住正義：布建青年社會住宅。",
                "居住正義：保障租屋族權益。",
                "守護勞工：挺社工！杜絕回捐、補強勞檢。",
                "守護勞工：爭取警消設備及休假制度。",
                "守護勞工：處理勞資爭議、改善勞權。",
                "環境永續：實質改善空污、燃煤機組除役。",
                "環境永續：鳳山溪水污染管制與改善。",
                "環境永續：制定韌性城市與淨零碳排。"
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
                    '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-14-20260907','reasonCodes','[]'::JSONB)),TRUE),
                '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-14-20260907','repair','official_bulletin_full_text_resplit','classification','verified_repair'),TRUE),
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
        ('53657df3-bfcd-42ce-93c0-0aefeda5dc58'::UUID,32),
        ('415a82ff-0c89-4299-a3fa-53047e9eb61f'::UUID,12),
        ('f540fb76-2f4b-414b-b616-6a506aa3e944'::UUID,7),
        ('1a8ebf40-6b14-4267-992f-a92f39be8013'::UUID,22),
        ('70dd7a7e-8b53-46ac-b768-0cb883ecd274'::UUID,21)
    )
    SELECT pg_catalog.count(*) INTO validated_count
    FROM expected JOIN public.person_claims AS claim ON claim.id=expected.claim_id
    WHERE pg_catalog.jsonb_array_length(claim.claim_json->'items')=expected.item_count
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
      AND claim.claim_json#>>'{contentSplit,releaseQuality,version}'='verified-high-omission-platforms-14-20260907'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='official_bulletin_full_text_resplit'
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='verified_repair';
    IF validated_count<>5 THEN RAISE EXCEPTION 'Expected five validated platform repairs, found %',validated_count; END IF;
END
$validate$;

COMMIT;
