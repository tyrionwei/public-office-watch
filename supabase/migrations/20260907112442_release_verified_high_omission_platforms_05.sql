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
                    '3f761d22-15bc-4091-9f59-51618167cd27'::UUID,
                    'a789abe0-6f41-4777-8abf-dd5042de6201'::UUID,
                    '408a3d61-07d3-4a34-8cc8-bb6acbdebbac'::UUID,
                    'b46f9cc14cdbb92a1ca07ab5bed1f218'::TEXT,
                    1346,
                    '317c8cddcc1a1a3de973f09ef78116c2'::TEXT,
                    $items$[
                        "3個保護｜保護金融，防詐護財：持續健全金融服務、打擊詐騙、監督租賃及融資公司金融風險、保障民眾權益及財產。",
                        "3個保護｜保護弱勢，擴大守護：放寬救助條件，提升補助，落實關懷機制，擴大社會安全網。",
                        "3個保護｜保護主權，安全永續：維護台灣和平穩定、提升防衛力量、強化經濟安全，確保民主永續。",
                        "4個利民｜利民生養，快樂育兒：提高育兒補助，優化育兒制度及產業，提升育兒人員待遇，早產兒養育照護，爭取凍卵補助，提高不孕症協助，減輕生兒、育兒壓力。",
                        "4個利民｜利民居住，安心成家：提高青年房貸及租金補貼，推動興建社會住宅，減輕居住壓力。",
                        "4個利民｜利民照護，守護銀髮：長照制度再優化，提高照護補助、擴大服務範圍、增加照護彈性、強化服務品質、串聯長照資源，守護不中斷，減輕照護家庭壓力。",
                        "4個利民｜利民生活，降低負擔：推動減稅利民，降低工作者的負擔，續行改善水電等民生基礎設施。",
                        "5個升級｜升級交通，好行好停：成功爭取並加速五股交流道完工、台65新設新莊南出匝道、捷運環狀線二期、捷運萬大樹林線二期完工、爭取泰板輕軌、西盛支線落實、持續優化交通瓶頸、改善行人通行環境，解決停車問題。",
                        "5個升級｜升級文教，多元發展：促進在地與多元文化發展，爭取國家電影文化中心二期儘早落成；爭取減輕、平衡受教育成本，提高補貼人才培育，持續改善新莊學校設施設備。",
                        "5個升級｜升級經濟，扶持創新：督促解決產業面臨的困境、加強扶持新興產業發展，監督國內外經濟風險，強化輔導青年創業，改善勞動權益。",
                        "5個升級｜升級健康，完善醫護：成功爭取並加速台北醫院新大樓完工，促進醫療產業發展及相關醫護人員待遇改善，強化兒少守護及心理輔導，提高對孕幼、長者的健康照護。",
                        "5個升級｜升級環境，友善樂活：續行改善新莊居住環境，持續優化水環境，解決廢水排放問題，推動電纜地下化，解放居住環境天際線，爭取增加綠地及休憩空間。"
                    ]$items$::JSONB
                ),
                (
                    '66bbb3d9-bca1-4776-b109-e604851bf3b5'::UUID,
                    '68f6c2b0-d1b2-48ff-abc3-99025d5e3db2'::UUID,
                    'cffe2268-8860-424d-b5cf-28db301d60a4'::UUID,
                    '6dd139d8300bddadbc1af2cab8f7afca'::TEXT,
                    514,
                    'b0c2e519072970c74aff6dff3cefc7e3'::TEXT,
                    $items$[
                        "顧孩子｜我是二寶爸 我懂養育負擔大：推動生育／育兒津貼再加碼 減輕家長們負擔",
                        "顧孩子｜我是二寶爸 我懂養育負擔大：推行0-6歲國家養、0-22歲投資未來世代",
                        "顧孩子｜我是二寶爸 我懂養育負擔大：推動特色公園 打造孩子遊戲城堡",
                        "顧孩子｜我是二寶爸 我懂養育負擔大：提升整體公托量能 爭取公托與非營利幼兒園",
                        "顧產業｜成功爭取台積電設廠！工業城市轉型科技城市：加速楠梓產業園區 爭取科技大廠進駐",
                        "顧產業｜成功爭取台積電設廠！工業城市轉型科技城市：推動5G AIoT產業，打造智慧科技城市",
                        "顧產業｜成功爭取台積電設廠！工業城市轉型科技城市：加速橋頭科學園區 打造南部科技S廊帶核心",
                        "顧長輩｜落實長輩照顧 柏毅一直都在：爭取中油宿舍區旗艦型日照中心 照顧所有宿舍區在地長輩",
                        "顧長輩｜落實長輩照顧 柏毅一直都在：持續增設巷弄長照據點、日照中心、住宿型長照機構與一社宅一日照",
                        "顧長輩｜落實長輩照顧 柏毅一直都在：推行「長照3.0」延長長輩健康年齡",
                        "顧安全｜守護國防預算 帶給人民安全感：支持潛艦國造 堅實國防自主",
                        "顧安全｜守護國防預算 帶給人民安全感：推動國防自主產業 守護台灣安全",
                        "顧安全｜守護國防預算 帶給人民安全感：推動資安聯防網絡 打擊網路犯罪",
                        "顧交通｜交通運輸更暢通 左楠再進化：加速翠華路拓寬 重視機車族通行安全",
                        "顧交通｜交通運輸更暢通 左楠再進化：力拚新台17線2026年完工",
                        "顧交通｜交通運輸更暢通 左楠再進化：推動捷運紫線（從高鐵站進右昌、從高雄大學到橋科）",
                        "顧交通｜交通運輸更暢通 左楠再進化：推動左營楠梓橋頭鐵路立體化",
                        "顧交通｜交通運輸更暢通 左楠再進化：爭取楠梓交流道設置引道直通楠梓產業園區",
                        "顧交通｜交通運輸更暢通 左楠再進化：改善人行道問題 用路人走得安全、行得放心"
                    ]$items$::JSONB
                ),
                (
                    '50bc9a00-7af7-4ac5-9e33-e17e2d7d59a9'::UUID,
                    '42eca615-32ee-4667-8f01-58e082b79e22'::UUID,
                    'd498e63e-112b-4b21-b623-13edf272d997'::UUID,
                    '8681c5736c75b451a7c8b4db60507948'::TEXT,
                    501,
                    '913a84586cddb39eb638e19e66b8bd84'::TEXT,
                    $items$[
                        "南松山再生計畫：已爭取城市舞台7億預算更新，年底完工！",
                        "南松山再生計畫：爭取監理站、南松市場改建。",
                        "南松山再生計畫：成功爭取2023台灣燈會在大巨蛋周邊。",
                        "南松山再生計畫：大巨蛋、松菸、鐵道博物館開放，讓信義區與松山區交通更順暢。",
                        "親子空間再升級：已成功完成信義區景勤一號、松山區民生公園兩座共融式公園。",
                        "親子空間再升級：未來將持續推動特色公園，並爭取建設「兒童體適能運動館」。",
                        "智慧城市 更新台北：爭取3000萬元治水工程預算，針對松山區易淹水區域進行排水工程改善。",
                        "智慧城市 更新台北：持續推動都市更新相關政策，讓台北發展更迅速、市容更年輕。",
                        "智慧城市 更新台北：推動設置違建處理委員會，讓違章建築狀況更公開透明。",
                        "社會福利與正義：增設公共托嬰中心、幼兒園，要求降低師生比，重視學生權益。",
                        "社會福利與正義：持續推動日照中心、老人共餐，並且加強推廣樂齡學習與運動，要求運動中心納入無障礙設備。",
                        "社會福利與正義：持續與動保團體合作，推動各項動物保護政策。",
                        "都市再生 台北回春：增設公托、公幼，提高生育補助，緩解少子化危機。",
                        "都市再生 台北回春：加速城市更新，打造更宜居、安全、美觀的台北。",
                        "都市再生 台北回春：推動青年住宅，提供年輕人起步階段的居住保障。",
                        "都市再生 台北回春：持續爭取共融式公園，實現不分世代的同樂。",
                        "都市再生 台北回春：強力監督執政者與市府，為市民爭權益、為人民討公道！"
                    ]$items$::JSONB
                ),
                (
                    '952cf790-77bc-45a7-9e65-e43c75ed1aa5'::UUID,
                    '65362966-cfcc-40bf-ab74-a32df24939d7'::UUID,
                    'ccc9f139-b626-44e7-8fe0-920af8d8e91b'::UUID,
                    '73bab5f3db216649f92824e0e5477f76'::TEXT,
                    389,
                    'a015db2f1e09644d066bff26bdacbfec'::TEXT,
                    $items$[
                        "涂權吉主張：監督落實航空城五大承諾",
                        "涂權吉主張：修法加重詐欺罪刑期至20年",
                        "涂權吉主張：重啟特偵組追查高端疫苗、進口蛋",
                        "涂權吉主張：80歲及高齡重症廢除巴氏量表",
                        "涂權吉主張：全面檢討課綱，重建國家認同",
                        "涂權吉主張：調漲公糧收購價，保障農民收益",
                        "涂權吉主張：檢討解編特定農業區，活化活用價漲歸農",
                        "涂權吉反對：反對官派，「水利會還給農民」",
                        "涂權吉反對：反對「SRF垃圾發電」進駐觀音",
                        "涂權吉反對：反對執政黨「實質廢除死刑」",
                        "涂權吉反對：反對「1年義務役」，兩岸和平青年不用上戰場",
                        "涂權吉反對：反對「非核家園能源政策」，以核減煤養綠",
                        "爭取經費，建設地方！大園、觀音、新屋、楊梅，共融共好"
                    ]$items$::JSONB
                )
        ) AS reviews(claim_id, person_id, candidate_id, expected_md5, expected_length, expected_source_md5, repaired_items)
    LOOP
        UPDATE public.person_claims AS claim
        SET claim_json = pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(COALESCE(claim.claim_json, '{}'::JSONB), '{items}', review.repaired_items, TRUE),
                    '{contentSplit}',
                    COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB) || pg_catalog.jsonb_build_object(
                        'reviewStatus', 'reviewed',
                        'releaseQuality', pg_catalog.jsonb_build_object(
                            'version', 'verified-high-omission-platforms-05-20260907',
                            'reasonCodes', '[]'::JSONB
                        )
                    ),
                    TRUE
                ),
                '{platformQualityAudit}',
                COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB) || pg_catalog.jsonb_build_object(
                    'repairVersion', 'verified-high-omission-platforms-05-20260907',
                    'repair', 'official_bulletin_visual_full_resplit',
                    'classification', 'verified_repair'
                ),
                TRUE
            ),
            updated_at = pg_catalog.now()
        WHERE claim.id = review.claim_id
          AND claim.person_id = review.person_id
          AND claim.candidate_id = review.candidate_id
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
    END LOOP;

    IF total_affected <> 4 THEN
        RAISE EXCEPTION 'Expected four verified high-omission platform reviews, updated %', total_affected;
    END IF;
END
$review$;

DO $validate$
DECLARE
    platform_count INTEGER;
    item_counts JSONB;
BEGIN
    SELECT pg_catalog.count(*),
           pg_catalog.jsonb_object_agg(id::TEXT, pg_catalog.jsonb_array_length(claim_json -> 'items'))
    INTO platform_count, item_counts
    FROM public.person_claims
    WHERE id = ANY (ARRAY[
        '3f761d22-15bc-4091-9f59-51618167cd27',
        '66bbb3d9-bca1-4776-b109-e604851bf3b5',
        '50bc9a00-7af7-4ac5-9e33-e17e2d7d59a9',
        '952cf790-77bc-45a7-9e65-e43c75ed1aa5'
    ]::UUID[])
      AND claim_json #>> '{contentSplit,reviewStatus}' = 'reviewed'
      AND claim_json #>> '{contentSplit,releaseQuality,version}' = 'verified-high-omission-platforms-05-20260907'
      AND claim_json #>> '{platformQualityAudit,classification}' = 'verified_repair';

    IF platform_count <> 4 THEN
        RAISE EXCEPTION 'Expected four verified platform repairs, found %', platform_count;
    END IF;

    IF item_counts <> $expected${
        "3f761d22-15bc-4091-9f59-51618167cd27": 12,
        "50bc9a00-7af7-4ac5-9e33-e17e2d7d59a9": 17,
        "66bbb3d9-bca1-4776-b109-e604851bf3b5": 19,
        "952cf790-77bc-45a7-9e65-e43c75ed1aa5": 13
    }$expected$::JSONB THEN
        RAISE EXCEPTION 'Unexpected repaired item counts: %', item_counts;
    END IF;
END
$validate$;

COMMIT;
