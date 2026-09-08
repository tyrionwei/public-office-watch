BEGIN;

-- Bridge exact production pre-repair texts to the audited migration baseline.
-- This stays inside the release transaction: the final repair must succeed.
CREATE TEMP TABLE release_source_baselines (id uuid PRIMARY KEY, person_id uuid NOT NULL, candidate_id uuid, claim_key text NOT NULL, production_text text NOT NULL, audited_text text NOT NULL) ON COMMIT DROP;
INSERT INTO release_source_baselines VALUES
('92125e61-820d-4403-a106-0e4b2f67038b'::uuid,'62d79cbd-48e4-4c0a-b936-ef1ce3673fbd'::uuid,'36dafa04-d36c-4a31-a2ad-787e568c91f6'::uuid,'cec-platform:2022:votetw-candidate-c15f655c303360a6','1. 落 實 基礎 建設 , 路 平 、 燈 亮 、 水 溝通 。

2. 提 升 金 色 雙 島 串 連 澎 南 旅 線 , 為 馬公 觀光 發 展 注 入 新 生 力 。

3. 市 場 改造 、 振 興 漁港 、 調 和 商 圈 、 推 廣 廟 乎 , 打 造 馬公 人 文 新 文 化 。
4. 改 善 市 立 幼兒 園 教學 設施 空間 , 營 造 安全 優質 幼兒 學 習 環境 。','做事'),
('ddfab220-fa61-45f9-bfb3-8bf9edff7529'::uuid,'75967696-d559-4570-bb92-706960800883'::uuid,'55788941-aa26-48c7-a701-88279e8629d8'::uuid,'cec-platform:2022:votetw-candidate-58bf02c7120490ae','「 政 」 要 改變 安居 嘉 南 「 傑 」 出 為 民樂
業 義 竹
銀髮 照護 : 建 立 長 照 智慧 服務 網 提高 重
陽 敬老 金 1,200 元 , 資 深 1 萬 元
創造 就 業 : 規 劃 工業 區 擴展 , 促 成 台 糖 農
Sn RBH
幸福 宜 居 : 鼓 勵 生 育 , 提 高 補助 總 額 至 三
萬 , 補 助 學 童 營養 午餐 、 點 心
校園 重生 : 推 動 廢棄 校園 成 為 老人 學 堂 、
親子 共 學 與 特 色 在 職 進 修 場 域
創 生 社區 : 設 置 青年 中 心 , 舉 辦 青年 論壇
| BEE ALES
居住 升級 : 重 新 都 市 計劃 、 交 通 建設 、 醫
療 網 絡 、 灌 溉 防洪 設施 、 青 銀
共 居 , 建 立 嘉 南 生 活 圈 最 合宜
(CP 值 ) 住 宅 區 。
便民 科技 : 推 廣 智慧 生 活 網 (例如 路 燈 、
環保 、 浪 浪 通報 ), 結 合 農 會
漁 會 推 動 義 竹 好 物 電子 商 務 平
台 , 協 助 農 漁民 產品 行 銷 。
RU
文 化 , 建 立 義 竹 特 色 市 集 、 商
圈 、 藝 文 活動 ; 與 週邊 市 鎮 共
辦 節慶 , 擴 大 舉辦 義 竹 人 市 集
並 結 合 宗教 、 路 跑 等 行 銷 活 生','「政」要改變 安居嘉南 「傑」出為民 樂
業義竹
銀髮照護：建立長照智慧服務網；提高重
     陽敬老金1,200元，資深1萬元
     。
創造就業：規劃工業區擴展，促成台糖農
     場轉型，推動科技觀光農漁產
     業。
幸福宜居：鼓勵生育，提高補助總額至三
     萬，補助學童營養午餐、點心
     。
校園重生：推動廢棄校園成為老人學堂、
     親子共學與特色在職進修場域
     。
創生社區：設置青年中心，舉辦青年論壇
     、藝文展覽，創生知識科技義
     竹。
居住升級：重新都市計劃、交通建設、醫
     療網絡、灌溉防洪設施、青銀
     共居，建立嘉南生活圈最合宜
     (CP值)住宅區。
便民科技：推廣智慧生活網(例如路燈、
     環保、浪浪通報)，結合農會
     漁會推動義竹好物電子商務平
     台，協助農漁民產品行銷。
特色聚落：整合農漁、古厝三合院及廟宇
     文化，建立義竹特色市集、商
     圈、藝文活動；與週邊市鎮共
     辦節慶，擴大舉辦義竹人市集
     並結合宗教、路跑等行銷活動
     ！');
UPDATE public.person_claims AS c
SET claim_value=b.audited_text, claim_json=jsonb_set(c.claim_json,'{platformText}',to_jsonb(b.audited_text))
FROM release_source_baselines b
WHERE c.id=b.id AND c.person_id=b.person_id
  AND c.candidate_id IS NOT DISTINCT FROM b.candidate_id
  AND c.claim_key=b.claim_key AND c.claim_type='platform'
  AND c.claim_value=b.production_text
  AND c.claim_json->>'platformText'=b.production_text
  AND c.claim_json#>>'{contentSplit,reviewStatus}'='needs_review';


-- Consolidated from 20260906181120_release_verified_wu_li_hua_platform.sql

DO $repair$
DECLARE
    repaired_items JSONB := '[
      "設置「原住民族轉型正義基金會」",
      "以「部落會議」為基礎推動部落公法人。",
      "讓部落會議主席有薪資、部落會議有業務費。",
      "建立都市原住民各族群自治組織。",
      "各項原民權益法案研議應納入原住民族意見。",
      "原住民特考職系類別擴增，提高名額。",
      "推動原住民事業單位師徒制，提供誘因及獎勵輔導原住民創業。",
      "成立專責單位協助族人處理債務協商及融資貸款。",
      "協助原鄉中醫藥材「產業化」發展。",
      "恢復辦理「原住民國民住宅」計畫。",
      "原鄉各部門閒置空間之建物及土地移撥給鄉鎮公所。",
      "普設原住民族地區住宿安養機構，提供多元公共化住宿服務。",
      "建立原鄉Uber緊急交通網、離島設停機坪，縮短後送時間",
      "設立「百億的癌症新藥基金」，降低癌症死亡率。",
      "改善原鄉醫護人員的工作條件、待遇、護病比。",
      "原鄉衛生所須優先聘用在地具語言、文化敏感度之醫事人員。",
      "結合「長照3.0」，修訂原住民族長照專章，55歲以上原住民均適用。",
      "打造居家、社區、機構、醫療、社福一體式長照服務。",
      "新增居家或社區的晚間到宅照顧與夜間緊急長照服務。",
      "改善巴氏量表計畫，依照不同類別，建立多元標準。",
      "廣設都市原住民族集會所，結合文健站、就業服務據點⋯⋯等複合功能。",
      "提升都市原住民自有住宅率，興辦都會地區中、小型社會宅。",
      "建構智慧化原住民族語音資料庫與原住民族文化資產資料庫。",
      "推動族語文化研究專書的出版推廣與再版及鄉鎮/部落正名計畫。",
      "建置原住民族轉譯人才資料庫，將重要的資訊及技術與部落及族人互通。",
      "設置原住民族文創園區，打造南島國際交流文化廊道。",
      "原住民大專生學費全免。",
      "學校、政府委託辦理原民事務事業單位及NGO，釋出實習及工讀機會。",
      "提高國小族語教師鐘點費，並依招募情形調整族語認證要求標準。",
      "讓原民公費師培生優先回鄉任敎。",
      "原鄉的本地代理教師可透過課外研習轉為正式教師。",
      "設置原住民族輔導團，輔導原住民族教育與語言的教學。",
      "輔導第一代實驗學校，改設為國小、國中到高中的12年一貫學校。",
      "公有土地增劃編為原住民保留地不受行政區域限制。",
      "原住民族禁伐補償提升至每公頃5萬元以上。",
      "設立原住民土地法庭；讓原民土地業務公務員有專業加給。",
      "建立原住民族傳統領域自然資源產業「經營事業特許制度」。",
      "推動「原住民族地區地界重測及土地清查」專案。",
      "原住民於原住民族地區內利用水資源無需申請水權登記。",
      "原住民於原住民族地區內河川區可從事低密度種植。",
      "原住民於原住民族地區內興建自用住宅或非營利目的可免申辦採取土石。",
      "制定諮商取得原住民族部落同意參與條例。",
      "制定《反族群歧視法》，訂定具體罰則及救濟管道。",
      "制定《原住民族土地銀行法》，拓增原民融資管道。",
      "持續推動《原住民族學校法》 培育「會說族語」的孩子。",
      "修正《公職人員選舉罷免法》,擴大都市原住民的參政管道。",
      "制定《原住民合作社法》，建立符合原民文化的合作社體制及法源基礎。",
      "修正《身心障礙者生活補助費發給辦法》，取消原民身心障礙者排富規定。",
      "修正《勞保條例》及《農保條例》，實際從事農作的農民，均享老農津貼及喪葬補助。"
    ]'::JSONB;
    repaired_source TEXT;
    affected_count INTEGER;
BEGIN
    SELECT pg_catalog.string_agg(item, E'\n' ORDER BY ordinal)
    INTO repaired_source
    FROM pg_catalog.jsonb_array_elements_text(repaired_items)
        WITH ORDINALITY AS expanded(item, ordinal);

    UPDATE public.person_claims AS claim
    SET
        claim_value = repaired_source,
        claim_json = pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(
                        COALESCE(claim.claim_json, '{}'::JSONB),
                        '{platformText}',
                        pg_catalog.to_jsonb(repaired_source),
                        TRUE
                    ),
                    '{items}',
                    repaired_items,
                    TRUE
                ),
                '{contentSplit}',
                COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'reviewStatus',
                        'reviewed',
                        'releaseQuality',
                        pg_catalog.jsonb_build_object(
                            'version',
                            'verified-platform-repair-20260907',
                            'reasonCodes',
                            '[]'::JSONB
                        )
                    ),
                TRUE
            ),
            '{platformQualityAudit}',
            COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                || pg_catalog.jsonb_build_object(
                    'repairVersion',
                    'verified-platform-repair-20260907',
                    'repair',
                    'official_bulletin_image_cross_checked_transcription',
                    'classification',
                    'verified_repair'
                ),
            TRUE
        ),
        updated_at = pg_catalog.now()
    WHERE claim.id = '5bda03ae-f1cf-425b-aa07-79ed2c65483b'::UUID
      AND claim.claim_type = 'platform'
      -- Both audited pre-repair variants contain Savungaz's misattributed text.
      -- The production backup differs in punctuation, whitespace and wording.
      AND claim.person_id = '8b6641f7-cdf6-4fc7-9e9b-348cf6c3cda9'::UUID
      AND claim.candidate_id = 'a60d25d9-c06f-4801-b56d-0d2d0725500c'::UUID
      AND claim.claim_key = 'cec-platform:2024:votetw-candidate-bdb05cca26bd9824'
      AND (
          (pg_catalog.md5(claim.claim_value) = '15fc5d55770a8a9cd9d7839eed5fac3e'
           AND pg_catalog.length(claim.claim_value) = 379)
          OR
          (pg_catalog.md5(claim.claim_value) = '8b36e7b1db6fc6fdb03aab117bee7073'
           AND pg_catalog.length(claim.claim_value) = 380
           AND claim.claim_json ->> 'platformText' = claim.claim_value)
      )
      AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
      AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'confirmed_content_or_split_issue';

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    IF affected_count <> 1 THEN
        RAISE EXCEPTION 'Expected to release one verified platform repair, updated %', affected_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.person_claims AS claim
        WHERE claim.id = '5bda03ae-f1cf-425b-aa07-79ed2c65483b'::UUID
          AND (
              claim.claim_value <> repaired_source
              OR claim.claim_json ->> 'platformText' <> repaired_source
              OR claim.claim_json -> 'items' <> repaired_items
              OR claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
              OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
          )
    ) THEN
        RAISE EXCEPTION 'The verified platform repair failed validation';
    END IF;
END
$repair$;


-- Consolidated from 20260906182330_release_verified_local_platform_repairs.sql

DO $repair$
DECLARE
    repair RECORD;
    repaired_source TEXT;
    affected_count INTEGER;
    total_affected INTEGER := 0;
BEGIN
    FOR repair IN
        SELECT *
        FROM (
            VALUES
                (
                    '550beb36-73fd-4ed0-8388-0a2934c06808'::UUID,
                    '90bd0fd479f713185b8b596195c8ab8c'::TEXT,
                    886,
                    'official_bulletin_cross_checked_transcription'::TEXT,
                    '[
                      "不收紅包，不拿回扣，不包工程。",
                      "成立口湖鄉（農、林、漁、牧業）四大鄉政顧問團。",
                      "結合宗教觀光、地方產業及口湖鄉各鄉村特色及景點，打造口湖一日遊。",
                      "成立新住民權益關懷協會。",
                      "恢復口湖鄉租佃委員會之運作。",
                      "重視教育，提高口湖鄉內教學軟硬體設施，引進人才，留住人才，縮小城鄉師資差距。",
                      "關懷各社區據點（長青食堂）共餐服務，實踐敬老尊嚴。",
                      "持續監控台灣海底電纜，要求台電設置電磁波偵測器，維護鄉民健康安全。",
                      "配合中央及縣府，設法改善台子村海灘流沙及周邊設施問題。",
                      "監控（離岸風電），維護海洋生態保育及漁民漁場捕魚之權益。",
                      "落實爭取地方民意，未來口湖鄉各地區重大建設及地區發展相關議題，透過與地方鄉親充分溝通及座談會，取得共識。",
                      "尊重個人政治立場，不以鄉長職權干涉個人政治自由。",
                      "為維護鄉民權益，增聘專業律師定期駐點，提供鄉民免費法律諮詢服務，協助鄉民解決日常法律問題。",
                      "重視弱勢族群及邊緣戶，加強口湖鄉之福利政策。",
                      "重視年輕族群聲音，成立口湖鄉青年顧問團。",
                      "活化（海口故事園區），打造雲林海線最美露營園區。",
                      "全民鄉長，共同努力，打造幸福口湖。"
                    ]'::JSONB
                ),
                (
                    'd3c52747-8a9c-4ed8-aedf-8be4eef93fb5'::UUID,
                    '1b4a7745d35777d83d21e1ade392ff5d'::TEXT,
                    652,
                    'official_bulletin_and_official_office_cross_checked_transcription'::TEXT,
                    '[
                      "重視並強化各村優質建設，均衡區域發展。",
                      "結合當地農特產品及特色產業，行銷瑞穗鄉村魅力，帶動觀光，引進商機，繁榮地方。",
                      "加強原住民傳統技藝傳承與特色發展、培育部落多元人力、改善部落產業發展環境及創造就業，吸引青年返鄉發展。",
                      "積極爭取各項補助經費，強化基層建設，打造最美麗、最優質的城鄉風貌。",
                      "促進農村產業升級，提升農業競爭力，增加農民收益。",
                      "強化弱勢族群社會關懷，輔導學習技能，協助自立謀生。",
                      "整合地方文化、藝術及產業，發展在地特色觀光，打造具友善度、差異化、話題性且能凸顯在地特色、橫向串連各相關產業的觀光活動，落實永續觀光理念，提高經濟效益。",
                      "深耕基層、傾聽民意、廣納建言，以鄉親需求作為未來施政方針。",
                      "清廉、誠懇、認真、努力，不分男女老幼、族群黨派，實實在在為民服務。"
                    ]'::JSONB
                )
        ) AS repairs(claim_id, expected_md5, expected_length, repair_method, repaired_items)
    LOOP
        SELECT pg_catalog.string_agg(item, E'\n' ORDER BY ordinal)
        INTO repaired_source
        FROM pg_catalog.jsonb_array_elements_text(repair.repaired_items)
            WITH ORDINALITY AS expanded(item, ordinal);

        UPDATE public.person_claims AS claim
        SET
            claim_value = repaired_source,
            claim_json = pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(
                        pg_catalog.jsonb_set(
                            COALESCE(claim.claim_json, '{}'::JSONB),
                            '{platformText}',
                            pg_catalog.to_jsonb(repaired_source),
                            TRUE
                        ),
                        '{items}',
                        repair.repaired_items,
                        TRUE
                    ),
                    '{contentSplit}',
                    COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                        || pg_catalog.jsonb_build_object(
                            'reviewStatus', 'reviewed',
                            'releaseQuality', pg_catalog.jsonb_build_object(
                                'version', 'verified-platform-repair-20260907',
                                'reasonCodes', '[]'::JSONB
                            )
                        ),
                    TRUE
                ),
                '{platformQualityAudit}',
                COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'repairVersion', 'verified-platform-repair-20260907',
                        'repair', repair.repair_method,
                        'classification', 'verified_repair'
                    ),
                TRUE
            ),
            updated_at = pg_catalog.now()
        WHERE claim.id = repair.claim_id
          AND claim.claim_type = 'platform'
          AND pg_catalog.md5(claim.claim_value) = repair.expected_md5
          AND pg_catalog.length(claim.claim_value) = repair.expected_length
          AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
          AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'confirmed_content_or_split_issue';

        GET DIAGNOSTICS affected_count = ROW_COUNT;
        IF affected_count <> 1 THEN
            RAISE EXCEPTION 'Expected to release claim %, updated %', repair.claim_id, affected_count;
        END IF;
        total_affected := total_affected + affected_count;

        IF EXISTS (
            SELECT 1
            FROM public.person_claims AS claim
            WHERE claim.id = repair.claim_id
              AND (
                  claim.claim_value <> repaired_source
                  OR claim.claim_json ->> 'platformText' <> repaired_source
                  OR claim.claim_json -> 'items' <> repair.repaired_items
                  OR claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
                  OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
              )
        ) THEN
            RAISE EXCEPTION 'Verified platform repair failed validation for claim %', repair.claim_id;
        END IF;
    END LOOP;

    IF total_affected <> 2 THEN
        RAISE EXCEPTION 'Expected two verified platform repairs, updated %', total_affected;
    END IF;
END
$repair$;


-- Consolidated from 20260906182910_release_verified_huang_zheng_jie_platform.sql

DO $repair$
DECLARE
    repaired_items JSONB := '[
      "銀髮照護：建立長照智慧服務網；提高重陽敬老金1,200元，資深1萬元。",
      "創造就業：規劃工業區擴展，促成台糖農場轉型，推動科技觀光農漁產業。",
      "幸福宜居：鼓勵生育，提高補助總額至三萬，補助學童營養午餐、點心。",
      "校園重生：推動廢棄校園成為老人學堂、親子共學與特色在職進修場域。",
      "創生社區：設置青年中心，舉辦青年論壇、藝文展覽，創生知識科技義竹。",
      "居住升級：重新都市計劃、交通建設、醫療網絡、灌溉防洪設施、青銀共居，建立嘉南生活圈最合宜（CP值）住宅區。",
      "便民科技：推廣智慧生活網（例如路燈、環保、浪浪通報），結合農會漁會推動義竹好物電子商務平台，協助農漁民產品行銷。",
      "特色聚落：整合農漁、古厝三合院及廟宇文化，建立義竹特色市集、商圈、藝文活動；與週邊市鎮共辦節慶，擴大舉辦義竹人市集並結合宗教、路跑等行銷活動！"
    ]'::JSONB;
    repaired_source TEXT;
    affected_count INTEGER;
BEGIN
    SELECT pg_catalog.string_agg(item, E'\n' ORDER BY ordinal)
    INTO repaired_source
    FROM pg_catalog.jsonb_array_elements_text(repaired_items)
        WITH ORDINALITY AS expanded(item, ordinal);

    UPDATE public.person_claims AS claim
    SET
        claim_value = repaired_source,
        claim_json = pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(
                        COALESCE(claim.claim_json, '{}'::JSONB),
                        '{platformText}',
                        pg_catalog.to_jsonb(repaired_source),
                        TRUE
                    ),
                    '{items}',
                    repaired_items,
                    TRUE
                ),
                '{contentSplit}',
                COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'reviewStatus', 'reviewed',
                        'releaseQuality', pg_catalog.jsonb_build_object(
                            'version', 'verified-platform-repair-20260907',
                            'reasonCodes', '[]'::JSONB
                        )
                    ),
                TRUE
            ),
            '{platformQualityAudit}',
            COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                || pg_catalog.jsonb_build_object(
                    'repairVersion', 'verified-platform-repair-20260907',
                    'repair', 'official_bulletin_line_join_and_item_reconstruction',
                    'classification', 'verified_repair'
                ),
            TRUE
        ),
        updated_at = pg_catalog.now()
    WHERE claim.id = 'ddfab220-fa61-45f9-bfb3-8bf9edff7529'::UUID
      AND claim.claim_type = 'platform'
      AND pg_catalog.md5(claim.claim_value) = 'dad73aecb824b656fc1dc8cffff266a2'
      AND pg_catalog.length(claim.claim_value) = 503
      AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
      AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'confirmed_content_or_split_issue';

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    IF affected_count <> 1 THEN
        RAISE EXCEPTION 'Expected to release one verified platform repair, updated %', affected_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.person_claims AS claim
        WHERE claim.id = 'ddfab220-fa61-45f9-bfb3-8bf9edff7529'::UUID
          AND (
              claim.claim_value <> repaired_source
              OR claim.claim_json ->> 'platformText' <> repaired_source
              OR claim.claim_json -> 'items' <> repaired_items
              OR claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
              OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
          )
    ) THEN
        RAISE EXCEPTION 'The verified platform repair failed validation';
    END IF;
END
$repair$;


-- Consolidated from 20260906191249_release_verified_chen_guan_ting_and_huang_wei_che_platforms.sql

DO $repair$
DECLARE
    repair RECORD;
    repaired_source TEXT;
    affected_count INTEGER;
    total_affected INTEGER := 0;
BEGIN
    FOR repair IN
        SELECT *
        FROM (
            VALUES
                (
                    '6edf8418-16a6-4b6f-ab17-cb9386ccf3dd'::UUID,
                    'd2723514f39655be35cb23101f4a14e4'::TEXT,
                    495,
                    34,
                    '[
                      "農業政策：推動農業外交，外銷農產品至國際市場。",
                      "農業政策：爭取農保品項擴大種類，分散農民種植風險。",
                      "農業政策：主張完善農田水系統，爭取擴大灌溉服務，建立補助相同標準。",
                      "農業政策：放寬老農津貼排富至800萬。",
                      "農業政策：增加農民退休儲金比例20%。",
                      "農業政策：爭取農業生物科技園區。",
                      "農業政策：爭取雲嘉南選果中心設在嘉義。",
                      "農業政策：加速辦理茶業改良場總廠南遷嘉義進度。",
                      "農業政策：青農返鄉專業協助：解決青農資金、土地取得與農村老舊三大問題。",
                      "農業政策：主張依照物價指數調漲公糧收購價。",
                      "交通觀光政策：改善山區步道，拓寬山區道路，完善無障礙設施。",
                      "交通觀光政策：打造台版療癒之森：升級奮起湖，打造療癒之森，邁向國際觀光，讓阿里山軸道重塑。",
                      "交通觀光政策：爭取梅山纜車。",
                      "交通觀光政策：道路拓寬、大巴觀光：爭取169線、159甲線、162甲線、166線拓寬經費。",
                      "交通觀光政策：爭取幸福小黃普及，建制預約機制讓鄉親有便利交通環境。",
                      "交通觀光政策：擴大輔導觀光工廠結合產業體驗。",
                      "青年政策：建設青年專屬社宅，並創造社宅生活圈。",
                      "青年政策：提出國際實習計畫，讓嘉青年每年至少100人獲補助。",
                      "產業政策：爭取台積電來嘉義設廠。",
                      "產業政策：引進微軟、思科等科技大廠培育數位人才。",
                      "產業政策：推動大埔美三期開發。",
                      "產業政策：民雄航太科技創新：爭取無人機產業研發資源，並結合低軌道衛星技術，推動嘉義為全球無人機產業的領航者。",
                      "產業政策：傳統園區環境翻新。",
                      "親子教育政策：爭取在各鄉鎮合適地點廣設共融式公園。",
                      "親子教育政策：活化閒置且評估合適的中小學校舍，作為0至2歲托育中心。",
                      "親子教育政策：全面落實高中職免學費，並補助私校生3.5萬學雜費，縮短公私立學費差距。",
                      "親子教育政策：全面升級學童營養午餐，補助提高、食材溯源、食品安全。",
                      "國防外交政策：透過國會外交與民主國家合作。",
                      "國防外交政策：支持國防自主延續潛艦國造，厚植國防產業。",
                      "國防外交政策：爭取加入CPTPP，提升台灣與他國經濟發展。",
                      "社福政策：主張老人健保補助全國一致。",
                      "社福政策：爭取村里社福長照據點設施有計畫的升級。",
                      "社福政策：建立農產地產地銷機制，爭取食農經費補助老人食堂加菜金。",
                      "社福政策：放寬巴氏量表審核標準及外籍看護申請門檻。"
                    ]'::JSONB
                ),
                (
                    'd191edc9-db0c-4945-83a6-61591ce3d735'::UUID,
                    'b955dcc8a8238c830e9b65a523b47f9b'::TEXT,
                    76,
                    26,
                    '[
                      "永續臺南，宜居首府：建構水電穩定且循環利用的生活環境，以淨零碳排為路徑邁向國際級宜居城市。",
                      "永續臺南，宜居首府：兼顧生態與產業發展，推動友善耕作與環境給付，新設工業區規劃公園與生態綠廊。",
                      "永續臺南，宜居首府：提昇排水整治率，推進下水道工程，因地制宜綜合治水，適應極端氣候挑戰。",
                      "永續臺南，宜居首府：源頭減少廢棄物，推動畜牧業沼氣發電與再利用，力拚資源回收率提升到7成。",
                      "活力臺南，全齡照顧：打造性別友善、族群平等、多元共融、全齡共好的幸福城市。",
                      "活力臺南，全齡照顧：擴增體育場館，發展體育產業和全民運動，辦理大型運動賽事。",
                      "活力臺南，全齡照顧：推動學習數位化，學習三語（母語、英語、程式語言）有資源。",
                      "活力臺南，全齡照顧：營造友善育兒環境，增加夜托、臨托量能，建設共融式特色公園。",
                      "活力臺南，全齡照顧：強化社會安全網，增補社工、警消、心理衛生等人力與設備。",
                      "活力臺南，全齡照顧：充實長照量能，提升醫療照護品質，規劃第三處市立醫院。",
                      "文化臺南，國際聚焦：邁向臺南400年，再現普羅民遮城及熱蘭遮城等歷史場域，強化考古與文化推廣能量。",
                      "文化臺南，國際聚焦：設置傳統藝術傳承基地，建設鹽份地帶文化中心，啟用原住民創意中心。",
                      "文化臺南，國際聚焦：規劃魅力旅遊地標，打造將軍扇形鹽田、關子嶺景觀、虎頭埤全齡式地景等三大園區，持續建立台南特色農遊品牌。",
                      "文化臺南，國際聚焦：推動大運河計畫，重現府城古航道風采，發展親水生態空間與水上運動風氣。",
                      "文化臺南，國際聚焦：發展台南五大歷史街區，活化歷史建築，傳承文史記憶，振興當地觀光。",
                      "便捷臺南，區域均衡：完善四橫三縱路網，改善國道交流道及周遭聯絡道路壅塞，持續建設跨區域外環道路。",
                      "便捷臺南，區域均衡：強化大眾運輸，增加小黃公車路線與低地板電動公車，推進鐵路立體化與捷運進度。",
                      "便捷臺南，區域均衡：兼顧防汛與交通，興建農漁水路及產業道路，興建跨溪橋梁與優化堤岸道路。",
                      "便捷臺南，區域均衡：持續新建立體停車場，提升停車格周轉率，運用科技疏導交通瓶頸段。",
                      "便捷臺南，區域均衡：解編閒置用地，加速市地重劃，增設公共設施，強化生活機能。",
                      "富饒臺南，壯大臺灣：穩健開發七股科工區，推動柳營科工區第三期擴編，麻豆工業區加速招商。",
                      "富饒臺南，壯大臺灣：南科三期開發同時提升生活機能，在中西區設置研發基地與產業專區，持續推動工業區立體化發展，吸引高科技與軟體業進駐。",
                      "富饒臺南，壯大臺灣：沙崙高鐵特定區三大發展主軸：型塑資安與先進技術研發基地、建置醫療服務與健康產業園區，推動下一世代的化合物半導體產業聚落。",
                      "富饒臺南，壯大臺灣：加速農業轉型發展，持續建設農村基礎設施，強化農民生產與異業合作培訓鏈結計劃，三管齊下提升農業競爭力。",
                      "富饒臺南，壯大臺灣：建造新農業三核心，將軍漁港設置水產加工運籌中心，玉井設置冷鏈物流中心，新化果菜市場升級為農產物流樞紐。",
                      "富饒臺南，壯大臺灣：協助在地創業，創造就業機會，為勞工建構安全職場環境，以多元管道落實居住正義。"
                    ]'::JSONB
                )
        ) AS repairs(claim_id, expected_md5, expected_length, expected_item_count, repaired_items)
    LOOP
        IF pg_catalog.jsonb_array_length(repair.repaired_items) <> repair.expected_item_count THEN
            RAISE EXCEPTION 'Expected % items for claim %, found %',
                repair.expected_item_count,
                repair.claim_id,
                pg_catalog.jsonb_array_length(repair.repaired_items);
        END IF;

        SELECT pg_catalog.string_agg(item, E'\n' ORDER BY ordinal)
        INTO repaired_source
        FROM pg_catalog.jsonb_array_elements_text(repair.repaired_items)
            WITH ORDINALITY AS expanded(item, ordinal);

        UPDATE public.person_claims AS claim
        SET
            claim_value = repaired_source,
            claim_json = pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(
                        pg_catalog.jsonb_set(
                            COALESCE(claim.claim_json, '{}'::JSONB),
                            '{platformText}',
                            pg_catalog.to_jsonb(repaired_source),
                            TRUE
                        ),
                        '{items}',
                        repair.repaired_items,
                        TRUE
                    ),
                    '{contentSplit}',
                    COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                        || pg_catalog.jsonb_build_object(
                            'reviewStatus', 'reviewed',
                            'releaseQuality', pg_catalog.jsonb_build_object(
                                'version', 'verified-platform-repair-20260907',
                                'reasonCodes', '[]'::JSONB
                            )
                        ),
                    TRUE
                ),
                '{platformQualityAudit}',
                COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'repairVersion', 'verified-platform-repair-20260907',
                        'repair', 'official_bulletin_image_user_assisted_transcription',
                        'classification', 'verified_repair'
                    ),
                TRUE
            ),
            updated_at = pg_catalog.now()
        WHERE claim.id = repair.claim_id
          AND claim.claim_type = 'platform'
          AND pg_catalog.md5(claim.claim_value) = repair.expected_md5
          AND pg_catalog.length(claim.claim_value) = repair.expected_length
          AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
          AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'confirmed_content_or_split_issue';

        GET DIAGNOSTICS affected_count = ROW_COUNT;
        IF affected_count <> 1 THEN
            RAISE EXCEPTION 'Expected to release claim %, updated %', repair.claim_id, affected_count;
        END IF;
        total_affected := total_affected + affected_count;

        IF EXISTS (
            SELECT 1
            FROM public.person_claims AS claim
            WHERE claim.id = repair.claim_id
              AND (
                  claim.claim_value <> repaired_source
                  OR claim.claim_json ->> 'platformText' <> repaired_source
                  OR claim.claim_json -> 'items' <> repair.repaired_items
                  OR claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
                  OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
              )
        ) THEN
            RAISE EXCEPTION 'Verified platform repair failed validation for claim %', repair.claim_id;
        END IF;
    END LOOP;

    IF total_affected <> 2 THEN
        RAISE EXCEPTION 'Expected two verified platform repairs, updated %', total_affected;
    END IF;
END
$repair$;


-- Consolidated from 20260906191711_release_verified_zhong_dong_rong_platform.sql

DO $repair$
DECLARE
    repaired_items JSONB := '[
      "打造新二崙，全面辦理都市計劃。",
      "爭取經費，整建行政中心。",
      "辦理老人日托。",
      "興建埤塘B塔，增加回饋金。",
      "加發新生兒獎勵金。"
    ]'::JSONB;
    repaired_source TEXT;
    affected_count INTEGER;
BEGIN
    SELECT pg_catalog.string_agg(item, E'\n' ORDER BY ordinal)
    INTO repaired_source
    FROM pg_catalog.jsonb_array_elements_text(repaired_items)
        WITH ORDINALITY AS expanded(item, ordinal);

    UPDATE public.person_claims AS claim
    SET
        claim_value = repaired_source,
        claim_json = pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(
                        COALESCE(claim.claim_json, '{}'::JSONB),
                        '{platformText}',
                        pg_catalog.to_jsonb(repaired_source),
                        TRUE
                    ),
                    '{items}',
                    repaired_items,
                    TRUE
                ),
                '{contentSplit}',
                COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'reviewStatus', 'reviewed',
                        'releaseQuality', pg_catalog.jsonb_build_object(
                            'version', 'verified-platform-repair-20260907',
                            'reasonCodes', '[]'::JSONB
                        )
                    ),
                TRUE
            ),
            '{platformQualityAudit}',
            COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                || pg_catalog.jsonb_build_object(
                    'repairVersion', 'verified-platform-repair-20260907',
                    'repair', 'official_bulletin_image_user_assisted_transcription',
                    'classification', 'verified_repair'
                ),
            TRUE
        ),
        updated_at = pg_catalog.now()
    WHERE claim.id = 'e2def1e0-5ef3-4d66-8f1e-4c3bf5cf5d93'::UUID
      AND claim.claim_type = 'platform'
      AND pg_catalog.md5(claim.claim_value) = 'e84c59ee04296741881fccc9e8cca1a3'
      AND pg_catalog.length(claim.claim_value) = 210
      AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
      AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'confirmed_content_or_split_issue';

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    IF affected_count <> 1 THEN
        RAISE EXCEPTION 'Expected to release one verified platform repair, updated %', affected_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.person_claims AS claim
        WHERE claim.id = 'e2def1e0-5ef3-4d66-8f1e-4c3bf5cf5d93'::UUID
          AND (
              claim.claim_value <> repaired_source
              OR claim.claim_json ->> 'platformText' <> repaired_source
              OR claim.claim_json -> 'items' <> repaired_items
              OR claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
              OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
          )
    ) THEN
        RAISE EXCEPTION 'The verified platform repair failed validation';
    END IF;
END
$repair$;


-- Consolidated from 20260906192417_release_verified_xie_hu_yuan_and_lu_qi_jun_profiles.sql

DO $release$
DECLARE
    xie_items JSONB := '[
      "基礎建設：續追蹤新舊港合併案",
      "基礎建設：續追蹤設置社區聚會所工程",
      "基礎建設：續追蹤醫療大樓建置工程",
      "基礎建設：續追蹤未改善之環島公路工程",
      "基礎建設：續追蹤自來水廠設置案",
      "基礎建設：規劃設置青年室內運動場所及風雨球場",
      "基礎建設：規劃環島公路線美化及鄉內觀光步道修繕",
      "基礎建設：規劃設置社區汙水處理場",
      "基礎建設：規劃部落社區停車場",
      "基礎建設：規劃設置公共廁所",
      "基礎建設：續推動本鄉綜合運動場建置工程",
      "基礎建設：續推動社區簡易港未完成之工程",
      "社會福利：專案處理住戶暫接水電、門牌申請手續",
      "社會福利：支持非核家園計畫並續監督遷廠事宜",
      "社會福利：補助鄉民重大傷病之醫療費用",
      "社會福利：推動設置老人照護中心",
      "社會福利：設置防疫、防災中心",
      "社會福利：致力協處推動鄉親關心公共事務",
      "社會福利：規劃推動鄉親保險種類",
      "社會福利：監督25.5億補償金支用進度",
      "觀光產業：輔導汽、機車出租業者場地之規劃",
      "觀光產業：規劃浮潛、水肺潛水、自由潛水之區域並協處維護海域安全",
      "觀光產業：積極輔導專業化導覽員",
      "觀光產業：積極研議徵收入島清潔費",
      "農漁業：推動在地化產業研發伴手禮製銷",
      "農漁業：規劃設置漁貨販售區及小型製冰廠",
      "農漁業：積極輔導鄉民申請船牌及船長執照",
      "農漁業：輔導農、漁民種植、畜牧、漁獲等並監測維護生態環境品質",
      "文化教育：規劃設置文化園區",
      "文化教育：推動拼板舟製作，小米祭典及各項文化傳承",
      "文化教育：復振族語教學",
      "文化教育：推動青、幼年參與文化祭儀",
      "文化教育：推動族群圖騰專利申請",
      "文化教育：推動地名族語正名事務",
      "宗教事務：尊重傾聽宗教團體需求"
    ]'::JSONB;
    xie_source TEXT;
    affected_count INTEGER;
BEGIN
    SELECT pg_catalog.string_agg(item, E'\n' ORDER BY ordinal)
    INTO xie_source
    FROM pg_catalog.jsonb_array_elements_text(xie_items)
        WITH ORDINALITY AS expanded(item, ordinal);

    UPDATE public.person_claims AS claim
    SET
        claim_value = xie_source,
        claim_json = pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(
                        COALESCE(claim.claim_json, '{}'::JSONB),
                        '{platformText}', pg_catalog.to_jsonb(xie_source), TRUE
                    ),
                    '{items}', xie_items, TRUE
                ),
                '{contentSplit}',
                COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'reviewStatus', 'reviewed',
                        'releaseQuality', pg_catalog.jsonb_build_object(
                            'version', 'verified-platform-repair-20260907',
                            'reasonCodes', '[]'::JSONB
                        )
                    ),
                TRUE
            ),
            '{platformQualityAudit}',
            COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                || pg_catalog.jsonb_build_object(
                    'repairVersion', 'verified-platform-repair-20260907',
                    'repair', 'official_bulletin_image_user_assisted_transcription',
                    'classification', 'verified_repair'
                ),
            TRUE
        ),
        updated_at = pg_catalog.now()
    WHERE claim.id = '7d74bc4c-aebf-4b49-b120-a950a2ff237e'::UUID
      AND claim.claim_type = 'platform'
      AND pg_catalog.md5(claim.claim_value) = 'd1f61c7a114b4ab26629d130cbed96d1'
      AND pg_catalog.length(claim.claim_value) = 924
      AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
      AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'confirmed_content_or_split_issue';

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    IF affected_count <> 1 THEN
        RAISE EXCEPTION 'Expected to repair one Xie Hu-yuan platform, updated %', affected_count;
    END IF;

    UPDATE public.person_claims AS claim
    SET
        claim_json = pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    COALESCE(claim.claim_json, '{}'::JSONB),
                    '{items}', '["做事"]'::JSONB, TRUE
                ),
                '{contentSplit}',
                COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'reviewStatus', 'reviewed',
                        'releaseQuality', pg_catalog.jsonb_build_object(
                            'version', 'verified-platform-repair-20260907',
                            'reasonCodes', '[]'::JSONB
                        )
                    ),
                TRUE
            ),
            '{platformQualityAudit}',
            COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                || pg_catalog.jsonb_build_object(
                    'repairVersion', 'verified-platform-repair-20260907',
                    'repair', 'official_bulletin_image_confirmed_short_platform',
                    'classification', 'verified_short_platform'
                ),
            TRUE
        ),
        updated_at = pg_catalog.now()
    WHERE claim.id = '92125e61-820d-4403-a106-0e4b2f67038b'::UUID
      AND claim.claim_type = 'platform'
      AND pg_catalog.md5(claim.claim_value) = '31f48c0650efede5ffb24fde64db4663'
      AND pg_catalog.length(claim.claim_value) = 2
      AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
      AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'confirmed_content_or_split_issue';

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    IF affected_count <> 1 THEN
        RAISE EXCEPTION 'Expected to verify one Lu Qi-jun short platform, updated %', affected_count;
    END IF;
END
$release$;

WITH official_profiles (
    person_id, candidate_id, person_slug, source_url, birth_date, gender,
    party_affiliation, education_items, experience_items
) AS (
    VALUES
      (
        'bb9cfe40-2bdc-425c-a55c-3b465cf5719c'::UUID,
        '1e897731-15eb-485d-ad44-9d258a1e5df0'::UUID,
        'xie-hu-yuan',
        'https://eebulletin.cec.gov.tw/111/17%E8%87%BA%E6%9D%B1%E7%B8%A3/03%E9%84%89%E9%8E%AE%E5%B8%82%E9%95%B7/%E8%98%AD%E5%B6%BC%E9%84%89%E9%84%89%E9%95%B7.pdf',
        '1967-03-12', 'male', '無',
        '["蘭嶼東清國民小學畢業","蘭嶼國民中學畢業","省立成功商業水產職業學校畢業"]'::JSONB,
        '["永興、台灣航空公司業務員","蘭嶼鄉公所總務、代理農業技士、社會課員、民政課臨時人員","第19、20屆蘭嶼鄉民代表"]'::JSONB
      ),
      (
        '62d79cbd-48e4-4c0a-b936-ef1ce3673fbd'::UUID,
        '36dafa04-d36c-4a31-a2ad-787e568c91f6'::UUID,
        'lu-qi-jun',
        'https://eebulletin.cec.gov.tw/111/18%E6%BE%8E%E6%B9%96%E7%B8%A3/03%E9%84%89%E9%8E%AE%E5%B8%82%E9%95%B7/06.%E4%B8%83%E7%BE%8E%E9%84%89%E9%84%89%E9%95%B7.pdf',
        '1966-01-23', 'male', '無',
        '["七美國小","七美國中","空軍通信電子學校專業軍官班"]'::JSONB,
        '["七美鄉第18屆鄉長","七美鄉公所秘書9年","平和村第19屆村長","澎湖縣議員助理","平和社區發展協會理事"]'::JSONB
      )
), expanded_claims AS (
    SELECT
        profile.person_id, profile.candidate_id, profile.person_slug,
        profile.source_url, claim.claim_type, claim.claim_value,
        claim.items, claim.field
    FROM official_profiles AS profile
    CROSS JOIN LATERAL (
        VALUES
          ('birth_date', profile.birth_date, NULL::JSONB, 'birth_date'),
          ('gender', profile.gender, NULL::JSONB, 'gender'),
          ('party_affiliation', profile.party_affiliation, NULL::JSONB, 'recommended_party'),
          ('education', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.education_items) WITH ORDINALITY AS item(value, ordinal)), profile.education_items, 'education'),
          ('experience', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.experience_items) WITH ORDINALITY AS item(value, ordinal)), profile.experience_items, 'experience')
    ) AS claim(claim_type, claim_value, items, field)
)
INSERT INTO public.person_claims (
    claim_key, person_id, candidate_id, claim_type, claim_value, claim_json,
    confidence_level, review_status, visibility, source_name, source_url,
    observed_at, is_public, review_score, scoring_version, scoring_reasons,
    auto_reviewed_at
)
SELECT
    'official-profile:cec-2022-bulletin:' || expanded.person_slug || ':' || expanded.claim_type,
    expanded.person_id, expanded.candidate_id, expanded.claim_type, expanded.claim_value,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'field', expanded.field,
        'items', expanded.items,
        'productionRelease', '20260907-cec-2022-profile-transcription'
    )),
    'A', 'verified', 'public', '中央選舉委員會：2022年選舉公報',
    expanded.source_url, '2022-11-25T16:00:00+00:00'::TIMESTAMPTZ,
    TRUE, 100, 'cec-official-election-bulletin-v1',
    '["Official CEC election bulletin","User-assisted transcription from supplied bulletin image"]'::JSONB,
    pg_catalog.now()
FROM expanded_claims AS expanded
ON CONFLICT (claim_key) DO UPDATE
SET
    person_id = EXCLUDED.person_id,
    candidate_id = EXCLUDED.candidate_id,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    is_public = EXCLUDED.is_public,
    review_score = EXCLUDED.review_score,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    auto_reviewed_at = EXCLUDED.auto_reviewed_at,
    updated_at = pg_catalog.now();

DO $validate$
DECLARE
    released_profile_count INTEGER;
BEGIN
    SELECT pg_catalog.count(*)
    INTO released_profile_count
    FROM public.person_claims AS claim
    WHERE claim.claim_key IN (
          'official-profile:cec-2022-bulletin:xie-hu-yuan:birth_date',
          'official-profile:cec-2022-bulletin:xie-hu-yuan:gender',
          'official-profile:cec-2022-bulletin:xie-hu-yuan:party_affiliation',
          'official-profile:cec-2022-bulletin:xie-hu-yuan:education',
          'official-profile:cec-2022-bulletin:xie-hu-yuan:experience',
          'official-profile:cec-2022-bulletin:lu-qi-jun:birth_date',
          'official-profile:cec-2022-bulletin:lu-qi-jun:gender',
          'official-profile:cec-2022-bulletin:lu-qi-jun:party_affiliation',
          'official-profile:cec-2022-bulletin:lu-qi-jun:education',
          'official-profile:cec-2022-bulletin:lu-qi-jun:experience'
      )
      AND claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public IS TRUE;

    IF released_profile_count <> 10 THEN
        RAISE EXCEPTION 'Expected 10 verified official profile claims, found %', released_profile_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.person_claims AS claim
        WHERE claim.id = '92125e61-820d-4403-a106-0e4b2f67038b'::UUID
          AND (
              claim.claim_value <> '做事'
              OR claim.claim_json -> 'items' <> '["做事"]'::JSONB
              OR claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
              OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_short_platform'
          )
    ) THEN
        RAISE EXCEPTION 'Lu Qi-jun short platform validation failed';
    END IF;
END
$validate$;


-- Consolidated from 20260907050441_release_verified_chen_guo_zai_profile.sql

DO $release$
DECLARE
    repaired_items JSONB := '[
      "推展休閒觀光，重視生態資源，永續經營。",
      "關懷老人、照顧弱勢家庭、中低收入戶及維護鄉親權益與福利。",
      "建立清淨家園。",
      "重視文化及教育，打造地方創生計畫。",
      "協助爭取並維護漁民權益，改善漁民生活。",
      "充實醫療設施。",
      "爭取新建第二艘公船，並提升營運服務品質。"
    ]'::JSONB;
    repaired_source TEXT;
    affected_count INTEGER;
BEGIN
    SELECT pg_catalog.string_agg(item, E'\n' ORDER BY ordinal)
    INTO repaired_source
    FROM pg_catalog.jsonb_array_elements_text(repaired_items)
        WITH ORDINALITY AS expanded(item, ordinal);

    UPDATE public.person_claims AS claim
    SET
        claim_value = repaired_source,
        claim_json = pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(
                        COALESCE(claim.claim_json, '{}'::JSONB),
                        '{platformText}', pg_catalog.to_jsonb(repaired_source), TRUE
                    ),
                    '{items}', repaired_items, TRUE
                ),
                '{contentSplit}',
                COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'reviewStatus', 'reviewed',
                        'releaseQuality', pg_catalog.jsonb_build_object(
                            'version', 'verified-platform-repair-20260907',
                            'reasonCodes', '[]'::JSONB
                        )
                    ),
                TRUE
            ),
            '{platformQualityAudit}',
            COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                || pg_catalog.jsonb_build_object(
                    'repairVersion', 'verified-platform-repair-20260907',
                    'repair', 'official_bulletin_image_user_assisted_transcription',
                    'classification', 'verified_repair'
                ),
            TRUE
        ),
        updated_at = pg_catalog.now()
    WHERE claim.id = 'f02df98a-ccdf-4a8d-a5c0-66091e89ba4a'::UUID
      AND claim.person_id = '8bffae7a-cb40-41c2-a6d7-2203a6461680'::UUID
      AND claim.candidate_id = 'f0b4afaa-7f3a-4356-b02f-34de9aa7127c'::UUID
      AND claim.claim_type = 'platform'
      AND pg_catalog.md5(claim.claim_value) = '28d2b09729c3853561d8e9a8fe4b89d2'
      AND pg_catalog.length(claim.claim_value) = 150
      AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
      AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'confirmed_content_or_split_issue';

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    IF affected_count <> 1 THEN
        RAISE EXCEPTION 'Expected to repair one Chen Guo-zai platform, updated %', affected_count;
    END IF;
END
$release$;

WITH official_profile (
    person_id, candidate_id, source_url, birth_date, gender,
    party_affiliation, education_items, experience_items
) AS (
    VALUES (
        '8bffae7a-cb40-41c2-a6d7-2203a6461680'::UUID,
        'f0b4afaa-7f3a-4356-b02f-34de9aa7127c'::UUID,
        'https://eebulletin.cec.gov.tw/111/14%E5%B1%8F%E6%9D%B1%E7%B8%A3/03%E9%84%89%E9%8E%AE%E5%B8%82%E9%95%B7/%E7%90%89%E7%90%83%E9%84%89/%E7%90%89%E7%90%83%E9%84%89%E5%85%AC%E5%A0%B1.pdf',
        '1982-12-22',
        'male',
        '無',
        '["白沙國小","琉球國中","國立屏東高中","國立屏東教育大學","國立高雄師範大學美術學系碩士"]'::JSONB,
        '["高雄市弔詭畫廊藝術行政","陳國在個人工作室","琉球鄉鄉長"]'::JSONB
    )
), expanded_claims AS (
    SELECT
        profile.person_id,
        profile.candidate_id,
        profile.source_url,
        claim.claim_type,
        claim.claim_value,
        claim.items,
        claim.field
    FROM official_profile AS profile
    CROSS JOIN LATERAL (
        VALUES
          ('birth_date', profile.birth_date, NULL::JSONB, 'birth_date'),
          ('gender', profile.gender, NULL::JSONB, 'gender'),
          ('party_affiliation', profile.party_affiliation, NULL::JSONB, 'recommended_party'),
          ('education', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.education_items) WITH ORDINALITY AS item(value, ordinal)), profile.education_items, 'education'),
          ('experience', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.experience_items) WITH ORDINALITY AS item(value, ordinal)), profile.experience_items, 'experience')
    ) AS claim(claim_type, claim_value, items, field)
)
INSERT INTO public.person_claims (
    claim_key, person_id, candidate_id, claim_type, claim_value, claim_json,
    confidence_level, review_status, visibility, source_name, source_url,
    observed_at, is_public, review_score, scoring_version, scoring_reasons,
    auto_reviewed_at
)
SELECT
    'official-profile:cec-2022-bulletin:chen-guo-zai:' || expanded.claim_type,
    expanded.person_id,
    expanded.candidate_id,
    expanded.claim_type,
    expanded.claim_value,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'field', expanded.field,
        'items', expanded.items,
        'productionRelease', '20260907-cec-2022-profile-transcription'
    )),
    'A',
    'verified',
    'public',
    '中央選舉委員會：2022年選舉公報',
    expanded.source_url,
    '2022-11-25T16:00:00+00:00'::TIMESTAMPTZ,
    TRUE,
    100,
    'cec-official-election-bulletin-v1',
    '["Official CEC election bulletin","User-assisted transcription from supplied bulletin image"]'::JSONB,
    pg_catalog.now()
FROM expanded_claims AS expanded
ON CONFLICT (claim_key) DO UPDATE
SET
    person_id = EXCLUDED.person_id,
    candidate_id = EXCLUDED.candidate_id,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    is_public = EXCLUDED.is_public,
    review_score = EXCLUDED.review_score,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    auto_reviewed_at = EXCLUDED.auto_reviewed_at,
    updated_at = pg_catalog.now();

DO $validate$
DECLARE
    released_profile_count INTEGER;
BEGIN
    SELECT pg_catalog.count(*)
    INTO released_profile_count
    FROM public.person_claims AS claim
    WHERE claim.claim_key IN (
          'official-profile:cec-2022-bulletin:chen-guo-zai:birth_date',
          'official-profile:cec-2022-bulletin:chen-guo-zai:gender',
          'official-profile:cec-2022-bulletin:chen-guo-zai:party_affiliation',
          'official-profile:cec-2022-bulletin:chen-guo-zai:education',
          'official-profile:cec-2022-bulletin:chen-guo-zai:experience'
      )
      AND claim.person_id = '8bffae7a-cb40-41c2-a6d7-2203a6461680'::UUID
      AND claim.candidate_id = 'f0b4afaa-7f3a-4356-b02f-34de9aa7127c'::UUID
      AND claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public IS TRUE;

    IF released_profile_count <> 5 THEN
        RAISE EXCEPTION 'Expected five verified Chen Guo-zai profile claims, found %', released_profile_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.person_claims AS claim
        WHERE claim.id = 'f02df98a-ccdf-4a8d-a5c0-66091e89ba4a'::UUID
          AND (
              pg_catalog.jsonb_array_length(claim.claim_json -> 'items') <> 7
              OR claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
              OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
          )
    ) THEN
        RAISE EXCEPTION 'Chen Guo-zai platform validation failed';
    END IF;
END
$validate$;


-- Consolidated from 20260907050854_release_verified_huang_hui_qin_profile.sql

DO $release$
DECLARE
    repaired_items JSONB := '[
      "推動單一窗口提升行政效率及執行力，公平、公正處理鄉親任何事物，以利鄉利民。",
      "改善草莓季塞車問題，將大湖、泰安露營區遊客引入大湖市區，推動亮點商家計畫，讓商機留在大湖。",
      "建立大湖鄉農業特色品牌，積極為農民透過FB、IG等媒體行銷產品，增加農民收益。",
      "加強環境整理，獎勵垃圾分類，營造清新宜居新大湖。",
      "提高生育補助費。",
      "結合善心人士落實照顧弱勢邊緣戶。",
      "解決都市計畫區內公設地未被徵收的土地，還地於民。",
      "營造大湖天敵繁殖場第二春。",
      "解決鯉魚潭水庫回饋金，以簡便的作業方式服務鄉親。",
      "推動大窩休閒農業區。",
      "成立鄉政青年顧問團。",
      "推動長照計畫照顧獨居長輩，增置關懷據點供餐服務及居家服務。",
      "繼續推動新移民及婦女學習鏈。",
      "落實體育會功能。",
      "維護「手作步道」，規劃套裝旅遊行程，打造「慢遊客庄」幸福大湖。"
    ]'::JSONB;
    repaired_source TEXT;
    affected_count INTEGER;
BEGIN
    SELECT pg_catalog.string_agg(item, E'\n' ORDER BY ordinal)
    INTO repaired_source
    FROM pg_catalog.jsonb_array_elements_text(repaired_items)
        WITH ORDINALITY AS expanded(item, ordinal);

    UPDATE public.person_claims AS claim
    SET
        claim_value = repaired_source,
        claim_json = pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(
                        COALESCE(claim.claim_json, '{}'::JSONB),
                        '{platformText}', pg_catalog.to_jsonb(repaired_source), TRUE
                    ),
                    '{items}', repaired_items, TRUE
                ),
                '{contentSplit}',
                COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'reviewStatus', 'reviewed',
                        'releaseQuality', pg_catalog.jsonb_build_object(
                            'version', 'verified-platform-repair-20260907',
                            'reasonCodes', '[]'::JSONB
                        )
                    ),
                TRUE
            ),
            '{platformQualityAudit}',
            COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                || pg_catalog.jsonb_build_object(
                    'repairVersion', 'verified-platform-repair-20260907',
                    'repair', 'official_bulletin_image_user_assisted_transcription',
                    'classification', 'verified_repair'
                ),
            TRUE
        ),
        updated_at = pg_catalog.now()
    WHERE claim.id = 'fd5c579d-225b-436f-88a2-b9aff315e1a6'::UUID
      AND claim.person_id = '82cc8601-c4d1-48ed-853d-8ddf0e25bbdd'::UUID
      AND claim.candidate_id = '4c00843c-5681-41b0-8311-90eeb442d7ad'::UUID
      AND claim.claim_type = 'platform'
      AND pg_catalog.md5(claim.claim_value) = '46133dcefa3d21b044a11ce084829ac6'
      AND pg_catalog.length(claim.claim_value) = 239
      AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
      AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'confirmed_content_or_split_issue';

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    IF affected_count <> 1 THEN
        RAISE EXCEPTION 'Expected to repair one Huang Hui-qin platform, updated %', affected_count;
    END IF;
END
$release$;

WITH official_profile (
    person_id, candidate_id, source_url, birth_date, gender,
    party_affiliation, education_items, experience_items
) AS (
    VALUES (
        '82cc8601-c4d1-48ed-853d-8ddf0e25bbdd'::UUID,
        '4c00843c-5681-41b0-8311-90eeb442d7ad'::UUID,
        'https://eebulletin.cec.gov.tw/111/09%E8%8B%97%E6%A0%97%E7%B8%A3/04%E9%84%89%E9%8E%AE%E5%B8%82%E6%B0%91%E4%BB%A3%E8%A1%A8/%E5%A4%A7%E6%B9%96%E9%84%89/%E5%A4%A7%E6%B9%96%E9%84%89%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1.pdf',
        '1958-08-08',
        'female',
        '無',
        '["桃園市立楊梅高級中等學校"]'::JSONB,
        '["第19、20、21屆鄉民代表。","大湖鄉婦女會理事長。","警察志工大湖中隊副中隊長。","大湖愛心協會總幹事。","大湖老人協會總幹事。","大窩文史生態協會總幹事。","大湖獅子會會長。"]'::JSONB
    )
), expanded_claims AS (
    SELECT
        profile.person_id, profile.candidate_id, profile.source_url,
        claim.claim_type, claim.claim_value, claim.items, claim.field
    FROM official_profile AS profile
    CROSS JOIN LATERAL (
        VALUES
          ('birth_date', profile.birth_date, NULL::JSONB, 'birth_date'),
          ('gender', profile.gender, NULL::JSONB, 'gender'),
          ('party_affiliation', profile.party_affiliation, NULL::JSONB, 'recommended_party'),
          ('education', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.education_items) WITH ORDINALITY AS item(value, ordinal)), profile.education_items, 'education'),
          ('experience', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.experience_items) WITH ORDINALITY AS item(value, ordinal)), profile.experience_items, 'experience')
    ) AS claim(claim_type, claim_value, items, field)
)
INSERT INTO public.person_claims (
    claim_key, person_id, candidate_id, claim_type, claim_value, claim_json,
    confidence_level, review_status, visibility, source_name, source_url,
    observed_at, is_public, review_score, scoring_version, scoring_reasons,
    auto_reviewed_at
)
SELECT
    'official-profile:cec-2022-bulletin:huang-hui-qin:' || expanded.claim_type,
    expanded.person_id, expanded.candidate_id, expanded.claim_type, expanded.claim_value,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'field', expanded.field,
        'items', expanded.items,
        'productionRelease', '20260907-cec-2022-profile-transcription'
    )),
    'A', 'verified', 'public', '中央選舉委員會：2022年選舉公報',
    expanded.source_url, '2022-11-25T16:00:00+00:00'::TIMESTAMPTZ,
    TRUE, 100, 'cec-official-election-bulletin-v1',
    '["Official CEC election bulletin","User-assisted transcription from supplied bulletin image"]'::JSONB,
    pg_catalog.now()
FROM expanded_claims AS expanded
ON CONFLICT (claim_key) DO UPDATE
SET
    person_id = EXCLUDED.person_id,
    candidate_id = EXCLUDED.candidate_id,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    is_public = EXCLUDED.is_public,
    review_score = EXCLUDED.review_score,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    auto_reviewed_at = EXCLUDED.auto_reviewed_at,
    updated_at = pg_catalog.now();

DO $validate$
DECLARE
    released_profile_count INTEGER;
BEGIN
    SELECT pg_catalog.count(*)
    INTO released_profile_count
    FROM public.person_claims AS claim
    WHERE claim.claim_key IN (
          'official-profile:cec-2022-bulletin:huang-hui-qin:birth_date',
          'official-profile:cec-2022-bulletin:huang-hui-qin:gender',
          'official-profile:cec-2022-bulletin:huang-hui-qin:party_affiliation',
          'official-profile:cec-2022-bulletin:huang-hui-qin:education',
          'official-profile:cec-2022-bulletin:huang-hui-qin:experience'
      )
      AND claim.person_id = '82cc8601-c4d1-48ed-853d-8ddf0e25bbdd'::UUID
      AND claim.candidate_id = '4c00843c-5681-41b0-8311-90eeb442d7ad'::UUID
      AND claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public IS TRUE;

    IF released_profile_count <> 5 THEN
        RAISE EXCEPTION 'Expected five verified Huang Hui-qin profile claims, found %', released_profile_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.person_claims AS claim
        WHERE claim.id = 'fd5c579d-225b-436f-88a2-b9aff315e1a6'::UUID
          AND (
              pg_catalog.jsonb_array_length(claim.claim_json -> 'items') <> 15
              OR claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
              OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
          )
    ) THEN
        RAISE EXCEPTION 'Huang Hui-qin platform validation failed';
    END IF;
END
$validate$;


-- Consolidated from 20260907051320_release_verified_liao_zhi_cheng_profile.sql

DO $release$
DECLARE
    repaired_items JSONB := '[
      "作伙來創新、升級埔里城：運作埔里地方創生推動委員會",
      "作伙來創新、升級埔里城：改造推動埔里車站、第三市場商圈發展計畫",
      "作伙來創新、升級埔里城：設置農產蔬菜物流中心",
      "作伙來推動、藝文埔里城：打造各項藝文節慶盛典活動",
      "作伙來推動、藝文埔里城：積極爭取辦理各級運動會",
      "作伙來推動、藝文埔里城：推動鄉鎮親子藝文教育活動",
      "作伙來推動、藝文埔里城：連結藝術家建置公共藝術造景",
      "作伙來協助、產業埔里城：「噗哩」吉祥物帶動產業品牌行銷至國際",
      "作伙來協助、產業埔里城：聯合四鄉鎮串連行銷推廣農特產品及觀光景點至全國",
      "作伙來協助、產業埔里城：設置大坪頂百香果集散貨場區",
      "作伙來協助、產業埔里城：改善活化台灣地理中心碑觀光圈園區",
      "作伙拼建設、美麗埔里城：打造兒童共融設施環境",
      "作伙拼建設、美麗埔里城：營造枇杷城大排親水環境",
      "作伙拼建設、美麗埔里城：提升鎮內路面鋪設品質",
      "作伙顧生活、優質埔里城：推動弱勢圓夢助學計畫",
      "作伙顧生活、優質埔里城：增設各里長照據點",
      "作伙顧生活、優質埔里城：生育津貼補助再加碼",
      "作伙顧生活、優質埔里城：完善鎮內社會住宅環境",
      "作伙做環保、綠色埔里城：推動農廢棄物與垃圾轉作生質燃料",
      "作伙做環保、綠色埔里城：帶動組織團體認養道路環境維護",
      "作伙做環保、綠色埔里城：開展鎮內公有設施太陽能板建置"
    ]'::JSONB;
    repaired_source TEXT;
    affected_count INTEGER;
BEGIN
    SELECT pg_catalog.string_agg(item, E'\n' ORDER BY ordinal)
    INTO repaired_source
    FROM pg_catalog.jsonb_array_elements_text(repaired_items)
        WITH ORDINALITY AS expanded(item, ordinal);

    UPDATE public.person_claims AS claim
    SET
        claim_value = repaired_source,
        claim_json = pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(
                        pg_catalog.jsonb_set(
                            COALESCE(claim.claim_json, '{}'::JSONB),
                            '{platformTitle}',
                            '"作伙生活2.0：持續創新，埔里升級！"'::JSONB,
                            TRUE
                        ),
                        '{platformText}', pg_catalog.to_jsonb(repaired_source), TRUE
                    ),
                    '{items}', repaired_items, TRUE
                ),
                '{contentSplit}',
                COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'reviewStatus', 'reviewed',
                        'releaseQuality', pg_catalog.jsonb_build_object(
                            'version', 'verified-platform-repair-20260907',
                            'reasonCodes', '[]'::JSONB
                        )
                    ),
                TRUE
            ),
            '{platformQualityAudit}',
            COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                || pg_catalog.jsonb_build_object(
                    'repairVersion', 'verified-platform-repair-20260907',
                    'repair', 'official_bulletin_image_user_assisted_transcription',
                    'classification', 'verified_repair'
                ),
            TRUE
        ),
        updated_at = pg_catalog.now()
    WHERE claim.id = '024cc348-ac5e-4398-9524-7faa7e50fb3e'::UUID
      AND claim.person_id = '82e35da8-5e6f-4a25-8cf2-852320a61349'::UUID
      AND claim.candidate_id = '8ef01bb4-db35-4b7d-9d5b-45200131f32b'::UUID
      AND claim.claim_type = 'platform'
      AND pg_catalog.md5(claim.claim_value) = '8074d6523de1059b6e47ca33d8005e7b'
      AND pg_catalog.length(claim.claim_value) = 720
      AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
      AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'confirmed_content_or_split_issue';

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    IF affected_count <> 1 THEN
        RAISE EXCEPTION 'Expected to repair one Liao Zhi-cheng platform, updated %', affected_count;
    END IF;
END
$release$;

WITH official_profile (
    person_id, candidate_id, source_url, birth_date, gender,
    party_affiliation, education_items, experience_items
) AS (
    VALUES (
        '82e35da8-5e6f-4a25-8cf2-852320a61349'::UUID,
        '8ef01bb4-db35-4b7d-9d5b-45200131f32b'::UUID,
        'https://eebulletin.cec.gov.tw/111/11%E5%8D%97%E6%8A%95%E7%B8%A3/03%E9%84%89%E9%8E%AE%E5%B8%82%E9%95%B7/%E5%8D%97%E6%8A%95%E7%B8%A3%E5%9F%94%E9%87%8C%E9%8E%AE%E9%8E%AE%E9%95%B7.%E9%8E%AE%E6%B0%91%E4%BB%A3%E8%A1%A8%E7%AC%AC1%E9%81%B8%E8%88%89%E5%8D%80%E5%8F%8A%E9%87%8C%E9%95%B7%E9%81%B8%E8%88%89.pdf',
        '1962-11-11',
        'male',
        '民主進步黨',
        '["史港國小","埔里國中","埔里高中"]'::JSONB,
        '["南投縣第15-18屆議員","南投縣第18屆埔里鎮長","埔里地方創生委員會召集人","四鄉鎮聯盟盟主","國立臺灣師範大學USR計畫諮詢專家","埔里鎮籃球發展協會顧問","埔里庚子年祈安清醮顧問團副團長","埔里鎮都市計畫委員會主委","南投縣家扶中心扶幼委員","埔里鎮河川生態保育協會顧問","交通義勇警察大隊埔里中隊顧問團榮譽團長"]'::JSONB
    )
), expanded_claims AS (
    SELECT
        profile.person_id, profile.candidate_id, profile.source_url,
        claim.claim_type, claim.claim_value, claim.items, claim.field
    FROM official_profile AS profile
    CROSS JOIN LATERAL (
        VALUES
          ('birth_date', profile.birth_date, NULL::JSONB, 'birth_date'),
          ('gender', profile.gender, NULL::JSONB, 'gender'),
          ('party_affiliation', profile.party_affiliation, NULL::JSONB, 'recommended_party'),
          ('education', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.education_items) WITH ORDINALITY AS item(value, ordinal)), profile.education_items, 'education'),
          ('experience', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.experience_items) WITH ORDINALITY AS item(value, ordinal)), profile.experience_items, 'experience')
    ) AS claim(claim_type, claim_value, items, field)
)
INSERT INTO public.person_claims (
    claim_key, person_id, candidate_id, claim_type, claim_value, claim_json,
    confidence_level, review_status, visibility, source_name, source_url,
    observed_at, is_public, review_score, scoring_version, scoring_reasons,
    auto_reviewed_at
)
SELECT
    'official-profile:cec-2022-bulletin:liao-zhi-cheng:' || expanded.claim_type,
    expanded.person_id, expanded.candidate_id, expanded.claim_type, expanded.claim_value,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'field', expanded.field,
        'items', expanded.items,
        'productionRelease', '20260907-cec-2022-profile-transcription'
    )),
    'A', 'verified', 'public', '中央選舉委員會：2022年選舉公報',
    expanded.source_url, '2022-11-25T16:00:00+00:00'::TIMESTAMPTZ,
    TRUE, 100, 'cec-official-election-bulletin-v1',
    '["Official CEC election bulletin","User-assisted transcription from supplied bulletin image"]'::JSONB,
    pg_catalog.now()
FROM expanded_claims AS expanded
ON CONFLICT (claim_key) DO UPDATE
SET
    person_id = EXCLUDED.person_id,
    candidate_id = EXCLUDED.candidate_id,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    is_public = EXCLUDED.is_public,
    review_score = EXCLUDED.review_score,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    auto_reviewed_at = EXCLUDED.auto_reviewed_at,
    updated_at = pg_catalog.now();

DO $validate$
DECLARE
    released_profile_count INTEGER;
BEGIN
    SELECT pg_catalog.count(*)
    INTO released_profile_count
    FROM public.person_claims AS claim
    WHERE claim.claim_key IN (
          'official-profile:cec-2022-bulletin:liao-zhi-cheng:birth_date',
          'official-profile:cec-2022-bulletin:liao-zhi-cheng:gender',
          'official-profile:cec-2022-bulletin:liao-zhi-cheng:party_affiliation',
          'official-profile:cec-2022-bulletin:liao-zhi-cheng:education',
          'official-profile:cec-2022-bulletin:liao-zhi-cheng:experience'
      )
      AND claim.person_id = '82e35da8-5e6f-4a25-8cf2-852320a61349'::UUID
      AND claim.candidate_id = '8ef01bb4-db35-4b7d-9d5b-45200131f32b'::UUID
      AND claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public IS TRUE;

    IF released_profile_count <> 5 THEN
        RAISE EXCEPTION 'Expected five verified Liao Zhi-cheng profile claims, found %', released_profile_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.person_claims AS claim
        WHERE claim.id = '024cc348-ac5e-4398-9524-7faa7e50fb3e'::UUID
          AND (
              pg_catalog.jsonb_array_length(claim.claim_json -> 'items') <> 21
              OR claim.claim_json ->> 'platformTitle' <> '作伙生活2.0：持續創新，埔里升級！'
              OR claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
              OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
          )
    ) THEN
        RAISE EXCEPTION 'Liao Zhi-cheng platform validation failed';
    END IF;
END
$validate$;


-- Consolidated from 20260907052027_release_verified_hsu_shu_hua_profile.sql

DO $release$
DECLARE
    repaired_items JSONB := '[
      "主軸一｜領投發展：農業－科技農業，青農回投",
      "主軸一｜領投發展：觀光－亮點軸線，亮眼南投",
      "主軸一｜領投發展：經濟－充分就業，帶投繁榮",
      "主軸一｜領投發展：交通－轉運共乘，南投好行",
      "主軸二｜全齡宜居：樂齡－全齡樂活，幸福笑容",
      "主軸二｜全齡宜居：育成－扎根南投，放眼世界",
      "主軸二｜全齡宜居：共好－城鄉兼顧，多元共好",
      "主軸三｜創新永續：永續－低碳領投，永續南投",
      "主軸三｜創新永續：創新－數位跨域，創新無限",
      "主軸三｜創新永續：智慧－科技服務，智慧治理"
    ]'::JSONB;
    repaired_source TEXT;
    affected_count INTEGER;
BEGIN
    SELECT pg_catalog.string_agg(item, E'\n' ORDER BY ordinal)
    INTO repaired_source
    FROM pg_catalog.jsonb_array_elements_text(repaired_items)
        WITH ORDINALITY AS expanded(item, ordinal);

    UPDATE public.person_claims AS claim
    SET
        claim_value = repaired_source,
        claim_json = pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(
                        COALESCE(claim.claim_json, '{}'::JSONB),
                        '{platformText}', pg_catalog.to_jsonb(repaired_source), TRUE
                    ),
                    '{items}', repaired_items, TRUE
                ),
                '{contentSplit}',
                COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'reviewStatus', 'reviewed',
                        'releaseQuality', pg_catalog.jsonb_build_object(
                            'version', 'verified-platform-repair-20260907',
                            'reasonCodes', '[]'::JSONB
                        )
                    ),
                TRUE
            ),
            '{platformQualityAudit}',
            COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                || pg_catalog.jsonb_build_object(
                    'repairVersion', 'verified-platform-repair-20260907',
                    'repair', 'official_bulletin_image_user_assisted_transcription',
                    'classification', 'verified_repair'
                ),
            TRUE
        ),
        updated_at = pg_catalog.now()
    WHERE claim.id = '1f248813-f8f5-44b9-8c8b-f02b3fa9f955'::UUID
      AND claim.person_id = 'f6b4d08c-050e-4ff4-be73-7e6165ca405b'::UUID
      AND claim.candidate_id = 'f7d75bd9-2a0e-4bc4-bf77-322dbf81b79e'::UUID
      AND claim.claim_type = 'platform'
      AND pg_catalog.md5(claim.claim_value) = '99f33b0862065b8d33054d418a51e15f'
      AND pg_catalog.length(claim.claim_value) = 307
      AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
      AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'confirmed_content_or_split_issue';

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    IF affected_count <> 1 THEN
        RAISE EXCEPTION 'Expected to repair one Hsu Shu-hua platform, updated %', affected_count;
    END IF;
END
$release$;

WITH official_profile (
    person_id, candidate_id, source_url, birth_date, gender,
    party_affiliation, education_items, experience_items
) AS (
    VALUES (
        'f6b4d08c-050e-4ff4-be73-7e6165ca405b'::UUID,
        'f7d75bd9-2a0e-4bc4-bf77-322dbf81b79e'::UUID,
        'https://eebulletin.cec.gov.tw/111/11%E5%8D%97%E6%8A%95%E7%B8%A3/01%E7%B8%A3%E9%95%B7/%E5%8D%97%E6%8A%95%E7%B8%A3%E7%B8%A3%E9%95%B7%E9%81%B8%E8%88%89.pdf',
        '1975-10-15',
        'female',
        '中國國民黨',
        '["逢甲大學經營管理碩士畢","南開技術學院附設專科進修學校畢"]'::JSONB,
        '["第8、9、10屆立法委員。","南投市第8、9屆市長。","南投縣議會第15屆議員。","中國國民黨18屆第3、4任及19屆第1、2、3、4任中常委。","南投縣商業總會第21屆理事長。","台灣省商業會94年十大傑出理事長。","95年全國社會優秀青年。","南投縣南開科技大學校友會理事長。","南投縣跆拳道主任委員。"]'::JSONB
    )
), expanded_claims AS (
    SELECT
        profile.person_id, profile.candidate_id, profile.source_url,
        claim.claim_type, claim.claim_value, claim.items, claim.field
    FROM official_profile AS profile
    CROSS JOIN LATERAL (
        VALUES
          ('birth_date', profile.birth_date, NULL::JSONB, 'birth_date'),
          ('gender', profile.gender, NULL::JSONB, 'gender'),
          ('party_affiliation', profile.party_affiliation, NULL::JSONB, 'recommended_party'),
          ('education', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.education_items) WITH ORDINALITY AS item(value, ordinal)), profile.education_items, 'education'),
          ('experience', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.experience_items) WITH ORDINALITY AS item(value, ordinal)), profile.experience_items, 'experience')
    ) AS claim(claim_type, claim_value, items, field)
)
INSERT INTO public.person_claims (
    claim_key, person_id, candidate_id, claim_type, claim_value, claim_json,
    confidence_level, review_status, visibility, source_name, source_url,
    observed_at, is_public, review_score, scoring_version, scoring_reasons,
    auto_reviewed_at
)
SELECT
    'official-profile:cec-2022-bulletin:hsu-shu-hua-nantou:' || expanded.claim_type,
    expanded.person_id, expanded.candidate_id, expanded.claim_type, expanded.claim_value,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'field', expanded.field,
        'items', expanded.items,
        'productionRelease', '20260907-cec-2022-profile-transcription'
    )),
    'A', 'verified', 'public', '中央選舉委員會：2022年選舉公報',
    expanded.source_url, '2022-11-25T16:00:00+00:00'::TIMESTAMPTZ,
    TRUE, 100, 'cec-official-election-bulletin-v1',
    '["Official CEC election bulletin","User-assisted transcription from supplied bulletin image"]'::JSONB,
    pg_catalog.now()
FROM expanded_claims AS expanded
ON CONFLICT (claim_key) DO UPDATE
SET
    person_id = EXCLUDED.person_id,
    candidate_id = EXCLUDED.candidate_id,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    is_public = EXCLUDED.is_public,
    review_score = EXCLUDED.review_score,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    auto_reviewed_at = EXCLUDED.auto_reviewed_at,
    updated_at = pg_catalog.now();

DO $validate$
DECLARE
    released_profile_count INTEGER;
BEGIN
    SELECT pg_catalog.count(*)
    INTO released_profile_count
    FROM public.person_claims AS claim
    WHERE claim.claim_key IN (
          'official-profile:cec-2022-bulletin:hsu-shu-hua-nantou:birth_date',
          'official-profile:cec-2022-bulletin:hsu-shu-hua-nantou:gender',
          'official-profile:cec-2022-bulletin:hsu-shu-hua-nantou:party_affiliation',
          'official-profile:cec-2022-bulletin:hsu-shu-hua-nantou:education',
          'official-profile:cec-2022-bulletin:hsu-shu-hua-nantou:experience'
      )
      AND claim.person_id = 'f6b4d08c-050e-4ff4-be73-7e6165ca405b'::UUID
      AND claim.candidate_id = 'f7d75bd9-2a0e-4bc4-bf77-322dbf81b79e'::UUID
      AND claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public IS TRUE;

    IF released_profile_count <> 5 THEN
        RAISE EXCEPTION 'Expected five verified Hsu Shu-hua profile claims, found %', released_profile_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.person_claims AS claim
        WHERE claim.id = '1f248813-f8f5-44b9-8c8b-f02b3fa9f955'::UUID
          AND (
              pg_catalog.jsonb_array_length(claim.claim_json -> 'items') <> 10
              OR claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
              OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
          )
    ) THEN
        RAISE EXCEPTION 'Hsu Shu-hua platform validation failed';
    END IF;
END
$validate$;


-- Consolidated from 20260907052422_release_verified_lin_zheng_xian_profile.sql

DO $release$
DECLARE
    repaired_items JSONB := '[
      "族群正義大進擊：持續爭取新住民事務科升格新住民事務局",
      "族群正義大進擊：持續推動閩南民俗文化科升格閩南事務局",
      "婦女權益大進擊：35歲以上女性凍卵補助",
      "婦女權益大進擊：補助弱勢女性衛生棉，改善「月經貧窮」。",
      "動物權益大進擊：寵物入戶籍，打造桃園成為寵物友善城市",
      "動物權益大進擊：規劃設置動物殯儀館",
      "科技桃園興發展：重點發展工業類科、培續科技人才",
      "科技桃園興發展：打造桃園成為新一座護國神山",
      "警消治安大進擊：監督小檜溪派出所盡速完工",
      "警消治安大進擊：監督埔子消防分隊盡速完工",
      "警消治安大進擊：增加警消人員權益",
      "市民空間大躍升：爭取桃園區里里有市民活動中心（含聯合場域）",
      "市民空間大躍升：規畫桃園更多元之市民活動空間",
      "交通建設再進擊：持續推動綠線、棕線捷運、桃鐵地下化之進程",
      "交通建設再進擊：爭取將捷運G08車站取名「景福宮」",
      "交通安全再晉級：持續監督桃園殯葬生命園區之規劃",
      "交通安全再晉級：持續爭取建設桃園市立醫院之設置",
      "交通安全再晉級：維護交通安全增設：（1）斑馬線推縮（2）增設庇護島",
      "交通安全再晉級：爭取桃園重要主幹道上設置人行道優化行人路權",
      "商圈發展再進擊：發展桃園區後站為南洋特色商圈",
      "商圈發展再進擊：疫後振興，提振桃園各商圈"
    ]'::JSONB;
    repaired_source TEXT;
    affected_count INTEGER;
BEGIN
    SELECT pg_catalog.string_agg(item, E'\n' ORDER BY ordinal)
    INTO repaired_source
    FROM pg_catalog.jsonb_array_elements_text(repaired_items)
        WITH ORDINALITY AS expanded(item, ordinal);

    UPDATE public.person_claims AS claim
    SET
        claim_value = repaired_source,
        claim_json = pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(
                        pg_catalog.jsonb_set(
                            COALESCE(claim.claim_json, '{}'::JSONB),
                            '{platformTitle}',
                            '"桃園市議員林政賢 九大進擊、發展晉級的桃園"'::JSONB,
                            TRUE
                        ),
                        '{platformText}', pg_catalog.to_jsonb(repaired_source), TRUE
                    ),
                    '{items}', repaired_items, TRUE
                ),
                '{contentSplit}',
                COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'reviewStatus', 'reviewed',
                        'releaseQuality', pg_catalog.jsonb_build_object(
                            'version', 'verified-platform-repair-20260907',
                            'reasonCodes', '[]'::JSONB
                        )
                    ),
                TRUE
            ),
            '{platformQualityAudit}',
            COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                || pg_catalog.jsonb_build_object(
                    'repairVersion', 'verified-platform-repair-20260907',
                    'repair', 'official_bulletin_image_user_assisted_transcription',
                    'classification', 'verified_repair'
                ),
            TRUE
        ),
        updated_at = pg_catalog.now()
    WHERE claim.id = '28d5bf95-fb15-443a-9c95-899d21a52ee4'::UUID
      AND claim.person_id = '0afebb02-17b2-4685-82fb-8ae75fc7a863'::UUID
      AND claim.candidate_id = 'ffeb99b0-a57b-42b7-acab-5921d785155d'::UUID
      AND claim.claim_type = 'platform'
      AND pg_catalog.md5(claim.claim_value) = '720be0b7ccb2fa7d817163abe43345ab'
      AND pg_catalog.length(claim.claim_value) = 401
      AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
      AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'confirmed_content_or_split_issue';

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    IF affected_count <> 1 THEN
        RAISE EXCEPTION 'Expected to repair one Lin Zheng-xian platform, updated %', affected_count;
    END IF;
END
$release$;

WITH official_profile (
    person_id, candidate_id, source_url, birth_date, gender,
    party_affiliation, education_items, experience_items
) AS (
    VALUES (
        '0afebb02-17b2-4685-82fb-8ae75fc7a863'::UUID,
        'ffeb99b0-a57b-42b7-acab-5921d785155d'::UUID,
        'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/05%E7%9B%B4%E8%BD%84%E5%B8%82%E8%AD%B0%E5%93%A1/111%E5%B9%B4/03%E6%A1%83%E5%9C%92%E5%B8%82/%E6%A1%83%E5%9C%92%E5%B8%82%E7%AC%AC1%E9%81%B8%E8%88%89%E5%8D%80.pdf',
        '1959-06-28',
        'male',
        '中國國民黨',
        '["東吳政治系","辭修高中","仁愛國中","台西國小"]'::JSONB,
        '["桃園市（縣）議員","小森林美語學校校長","國民黨桃園區主委","桃園市民管樂團團長","東吳大學校友會創會理事長","快樂遊登山創社長","福宏扶輪創社長","遠東獅子會長","雲林同鄉會理事長","桃園青創會理事長","武陵、振聲、桃小家長會長","桃園資深青商會長","桃園義勇交通促進會長","桃園圍棋委員會主委","桃園民眾服務社理事長"]'::JSONB
    )
), expanded_claims AS (
    SELECT
        profile.person_id, profile.candidate_id, profile.source_url,
        claim.claim_type, claim.claim_value, claim.items, claim.field
    FROM official_profile AS profile
    CROSS JOIN LATERAL (
        VALUES
          ('birth_date', profile.birth_date, NULL::JSONB, 'birth_date'),
          ('gender', profile.gender, NULL::JSONB, 'gender'),
          ('party_affiliation', profile.party_affiliation, NULL::JSONB, 'recommended_party'),
          ('education', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.education_items) WITH ORDINALITY AS item(value, ordinal)), profile.education_items, 'education'),
          ('experience', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.experience_items) WITH ORDINALITY AS item(value, ordinal)), profile.experience_items, 'experience')
    ) AS claim(claim_type, claim_value, items, field)
)
INSERT INTO public.person_claims (
    claim_key, person_id, candidate_id, claim_type, claim_value, claim_json,
    confidence_level, review_status, visibility, source_name, source_url,
    observed_at, is_public, review_score, scoring_version, scoring_reasons,
    auto_reviewed_at
)
SELECT
    'official-profile:cec-2022-bulletin:lin-zheng-xian:' || expanded.claim_type,
    expanded.person_id, expanded.candidate_id, expanded.claim_type, expanded.claim_value,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'field', expanded.field,
        'items', expanded.items,
        'productionRelease', '20260907-cec-2022-profile-transcription'
    )),
    'A', 'verified', 'public', '中央選舉委員會：2022年選舉公報',
    expanded.source_url, '2022-11-25T16:00:00+00:00'::TIMESTAMPTZ,
    TRUE, 100, 'cec-official-election-bulletin-v1',
    '["Official CEC election bulletin","User-assisted transcription from supplied bulletin image"]'::JSONB,
    pg_catalog.now()
FROM expanded_claims AS expanded
ON CONFLICT (claim_key) DO UPDATE
SET
    person_id = EXCLUDED.person_id,
    candidate_id = EXCLUDED.candidate_id,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    is_public = EXCLUDED.is_public,
    review_score = EXCLUDED.review_score,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    auto_reviewed_at = EXCLUDED.auto_reviewed_at,
    updated_at = pg_catalog.now();

DO $validate$
DECLARE
    released_profile_count INTEGER;
BEGIN
    SELECT pg_catalog.count(*)
    INTO released_profile_count
    FROM public.person_claims AS claim
    WHERE claim.claim_key IN (
          'official-profile:cec-2022-bulletin:lin-zheng-xian:birth_date',
          'official-profile:cec-2022-bulletin:lin-zheng-xian:gender',
          'official-profile:cec-2022-bulletin:lin-zheng-xian:party_affiliation',
          'official-profile:cec-2022-bulletin:lin-zheng-xian:education',
          'official-profile:cec-2022-bulletin:lin-zheng-xian:experience'
      )
      AND claim.person_id = '0afebb02-17b2-4685-82fb-8ae75fc7a863'::UUID
      AND claim.candidate_id = 'ffeb99b0-a57b-42b7-acab-5921d785155d'::UUID
      AND claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public IS TRUE;

    IF released_profile_count <> 5 THEN
        RAISE EXCEPTION 'Expected five verified Lin Zheng-xian profile claims, found %', released_profile_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.person_claims AS claim
        WHERE claim.id = '28d5bf95-fb15-443a-9c95-899d21a52ee4'::UUID
          AND (
              pg_catalog.jsonb_array_length(claim.claim_json -> 'items') <> 21
              OR claim.claim_json ->> 'platformTitle' <> '桃園市議員林政賢 九大進擊、發展晉級的桃園'
              OR claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
              OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
          )
    ) THEN
        RAISE EXCEPTION 'Lin Zheng-xian platform validation failed';
    END IF;
END
$validate$;


-- Consolidated from 20260907053051_release_verified_zhang_yong_de_profile.sql

DO $release$
DECLARE
    repaired_items JSONB := '[
      "賡續加速辦理礁溪擴大都市計畫內白雲段、德陽段之進度；併敦促上級政府，台二庚線、山腳道路，早日開通。",
      "持續開闢鄉內閒置公有土地，建造多元化運動場所，提供全齡共融親子休閒遊憩好去處。",
      "悉心輔導礁溪溫泉夜市永續發展，結合觀光特色，活絡地方產業，再造觀光效益。",
      "多功能社福大樓，儘速趕工興建完竣，以便提供大忠、大義、六結社區及全鄉民眾使用。",
      "賡續擘劃增設本鄉18村轄區重要路口、農路、巷弄監視器系統，強化治安死角，保障生命財產安全。",
      "全面照顧本鄉老弱婦孺、弱勢族群，輔導各社區增設長青食堂及雲水日托再升級。",
      "運用溫泉品牌識別形象編列預算，定期舉辦農漁特產網路行銷活動，增加農漁民收入。",
      "延續礁溪鄉公所既定政策，推動幼兒學雜費、營養午餐點心，減輕家庭負擔；積極推動融入式美語教學於日常教學活動課程，栽培國家未來主人翁。",
      "繼續拚鄉內十八村的公共建設，柏油路面、路燈汰換LED、反射鏡、水溝清理、修樹等持續加強辦理。",
      "改善老舊社區住宅巷弄水溝排水系統，更新提昇全鄉環境公共衛生。",
      "提案爭取代表會通過提高重陽敬老禮金暨鄰長「福利津貼事務費」。"
    ]'::JSONB;
    repaired_source TEXT;
    platform_intro TEXT := '繼續秉持二十四年，五屆鄉民代表，一屆鄉長信念腳踏實地，實在做事精神，加倍認真、勤政愛民；用優質行政團隊來服務我們十八村鄉親，並重視傾聽民意、尊重鄉親意見，建構礁溪鄉「東、西、南、北」軟硬體設施建設，且結合各村優勢均衡全鄉蓬勃發展，促進城鄉風貌、再創鄉政高峰。';
    affected_count INTEGER;
BEGIN
    SELECT pg_catalog.string_agg(item, E'\n' ORDER BY ordinal)
    INTO repaired_source
    FROM pg_catalog.jsonb_array_elements_text(repaired_items)
        WITH ORDINALITY AS expanded(item, ordinal);

    UPDATE public.person_claims AS claim
    SET
        claim_value = repaired_source,
        claim_json = pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(
                        pg_catalog.jsonb_set(
                            COALESCE(claim.claim_json, '{}'::JSONB),
                            '{platformIntro}', pg_catalog.to_jsonb(platform_intro), TRUE
                        ),
                        '{platformText}', pg_catalog.to_jsonb(repaired_source), TRUE
                    ),
                    '{items}', repaired_items, TRUE
                ),
                '{contentSplit}',
                COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'reviewStatus', 'reviewed',
                        'releaseQuality', pg_catalog.jsonb_build_object(
                            'version', 'verified-platform-repair-20260907',
                            'reasonCodes', '[]'::JSONB
                        )
                    ),
                TRUE
            ),
            '{platformQualityAudit}',
            COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                || pg_catalog.jsonb_build_object(
                    'repairVersion', 'verified-platform-repair-20260907',
                    'repair', 'official_bulletin_image_user_assisted_transcription',
                    'classification', 'verified_repair'
                ),
            TRUE
        ),
        updated_at = pg_catalog.now()
    WHERE claim.id = '545ec16f-506e-4683-9a1b-11679d2a9c80'::UUID
      AND claim.person_id = 'b7ff6754-583b-420a-b6ac-5d673d1044c6'::UUID
      AND claim.candidate_id = '421b6fdf-5689-4ef6-8d57-abe3f97442b3'::UUID
      AND claim.claim_type = 'platform'
      AND pg_catalog.md5(claim.claim_value) = '1f993a6bafd2b08afed2e27520254a2c'
      AND pg_catalog.length(claim.claim_value) = 1126
      AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
      AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'confirmed_content_or_split_issue';

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    IF affected_count <> 1 THEN
        RAISE EXCEPTION 'Expected to repair one Zhang Yong-de platform, updated %', affected_count;
    END IF;
END
$release$;

WITH official_profile (
    person_id, candidate_id, source_url, birth_date, gender,
    party_affiliation, education_items, experience_items
) AS (
    VALUES (
        'b7ff6754-583b-420a-b6ac-5d673d1044c6'::UUID,
        '421b6fdf-5689-4ef6-8d57-abe3f97442b3'::UUID,
        'https://eebulletin.cec.gov.tw/111/15%E5%AE%9C%E8%98%AD%E7%B8%A3/03%E9%84%89%E9%8E%AE%E5%B8%82%E9%95%B7/%E7%A4%81%E6%BA%AA%E9%84%89%E9%84%89%E9%95%B7%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/%E7%A4%81%E6%BA%AA%E9%84%89%E9%84%89%E9%95%B7%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1.pdf',
        '1958-09-10',
        'male',
        '中國國民黨',
        '["佛光大學公共事務學系碩士畢業","大專畢業","省立羅東高工","礁溪國中","礁溪國小"]'::JSONB,
        '["現任：礁溪鄉第十八屆鄉長","礁溪鄉五屆鄉民代表（第十五、十七、十八、十九、二十屆）"]'::JSONB
    )
), expanded_claims AS (
    SELECT
        profile.person_id, profile.candidate_id, profile.source_url,
        claim.claim_type, claim.claim_value, claim.items, claim.field
    FROM official_profile AS profile
    CROSS JOIN LATERAL (
        VALUES
          ('birth_date', profile.birth_date, NULL::JSONB, 'birth_date'),
          ('gender', profile.gender, NULL::JSONB, 'gender'),
          ('party_affiliation', profile.party_affiliation, NULL::JSONB, 'recommended_party'),
          ('education', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.education_items) WITH ORDINALITY AS item(value, ordinal)), profile.education_items, 'education'),
          ('experience', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.experience_items) WITH ORDINALITY AS item(value, ordinal)), profile.experience_items, 'experience')
    ) AS claim(claim_type, claim_value, items, field)
)
INSERT INTO public.person_claims (
    claim_key, person_id, candidate_id, claim_type, claim_value, claim_json,
    confidence_level, review_status, visibility, source_name, source_url,
    observed_at, is_public, review_score, scoring_version, scoring_reasons,
    auto_reviewed_at
)
SELECT
    'official-profile:cec-2022-bulletin:zhang-yong-de:' || expanded.claim_type,
    expanded.person_id, expanded.candidate_id, expanded.claim_type, expanded.claim_value,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'field', expanded.field,
        'items', expanded.items,
        'productionRelease', '20260907-cec-2022-profile-transcription'
    )),
    'A', 'verified', 'public', '中央選舉委員會：2022年選舉公報',
    expanded.source_url, '2022-11-25T16:00:00+00:00'::TIMESTAMPTZ,
    TRUE, 100, 'cec-official-election-bulletin-v1',
    '["Official CEC election bulletin","User-assisted transcription from supplied bulletin image"]'::JSONB,
    pg_catalog.now()
FROM expanded_claims AS expanded
ON CONFLICT (claim_key) DO UPDATE
SET
    person_id = EXCLUDED.person_id,
    candidate_id = EXCLUDED.candidate_id,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    is_public = EXCLUDED.is_public,
    review_score = EXCLUDED.review_score,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    auto_reviewed_at = EXCLUDED.auto_reviewed_at,
    updated_at = pg_catalog.now();

DO $validate$
DECLARE
    released_profile_count INTEGER;
BEGIN
    SELECT pg_catalog.count(*)
    INTO released_profile_count
    FROM public.person_claims AS claim
    WHERE claim.claim_key IN (
          'official-profile:cec-2022-bulletin:zhang-yong-de:birth_date',
          'official-profile:cec-2022-bulletin:zhang-yong-de:gender',
          'official-profile:cec-2022-bulletin:zhang-yong-de:party_affiliation',
          'official-profile:cec-2022-bulletin:zhang-yong-de:education',
          'official-profile:cec-2022-bulletin:zhang-yong-de:experience'
      )
      AND claim.person_id = 'b7ff6754-583b-420a-b6ac-5d673d1044c6'::UUID
      AND claim.candidate_id = '421b6fdf-5689-4ef6-8d57-abe3f97442b3'::UUID
      AND claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public IS TRUE;

    IF released_profile_count <> 5 THEN
        RAISE EXCEPTION 'Expected five verified Zhang Yong-de profile claims, found %', released_profile_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.person_claims AS claim
        WHERE claim.id = '545ec16f-506e-4683-9a1b-11679d2a9c80'::UUID
          AND (
              pg_catalog.jsonb_array_length(claim.claim_json -> 'items') <> 11
              OR claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
              OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
          )
    ) THEN
        RAISE EXCEPTION 'Zhang Yong-de platform validation failed';
    END IF;
END
$validate$;


-- Consolidated from 20260907053408_release_verified_lin_jun_fu_profile.sql

DO $release$
DECLARE
    repaired_items JSONB := '[
      "樂齡宜居、幸福家園：啟用0-2歲公共托育中心，提供高質量幼兒收托減輕家長負擔",
      "樂齡宜居、幸福家園：完善社區活動中心軟硬體設備，提供優質樂齡環境",
      "樂齡宜居、幸福家園：提升長青食堂補助，讓長者吃出健康吃出品質",
      "樂齡宜居、幸福家園：照顧長者，增加日托照顧中心，減輕照顧者負擔",
      "樂齡宜居、幸福家園：精進社區樂齡學習課程內容，鼓勵長者走入社區樂在生活",
      "樂齡宜居、幸福家園：關懷新住民生活與文化，加強在地深根與教育輔導",
      "健全路網、人本優先：改善鄉內學校、社區與香中路等人本通學路廊",
      "健全路網、人本優先：爭取經費進行義成路一段、梅花路等重要道路拓寬",
      "健全路網、人本優先：爭取順安都市計畫11號道路（美和路）及富農路一段拓寬工程，發展區域中心路網",
      "健全路網、人本優先：爭取宜冬橋改建，提升橋梁安全與聯外交通發展",
      "健全路網、人本優先：爭取經費興建梅花湖風景區串連中山休閒農業區自行車道",
      "低碳觀光、綠色產業：規劃營造內城潤泰水泥鐵道秘境，塑造工業風新景點",
      "低碳觀光、綠色產業：創新綠色輕碳旅行，興辦專屬冬山鄉特色活動帶動觀光",
      "低碳觀光、綠色產業：積極創造多元、多變、多效益觀光產業，帶動鄉內各項產業價值",
      "低碳觀光、綠色產業：持續盤點鄉內閒置農地，鼓勵轉型再生，提升土地利用經濟效益",
      "低碳觀光、綠色產業：建設武淵村水火同源週邊整體規畫，發展在地特色觀光",
      "低碳觀光、綠色產業：與溪南各大鄉鎮合作，打造綠色廊帶觀光聯盟",
      "強化防災、快速反應：推動順安都市計畫雨水下水道新建工程，強化市區排水系統",
      "強化防災、快速反應：重視衛生安全，加強鄉內重點環境清潔消毒，建立後疫情時代應變體系",
      "強化防災、快速反應：規劃林寶春圳排水改善，完備防災防洪設施",
      "活化資產、在地創生：執行舊有零售市場新建，樹立市區新地標，營造冬山老街新風貌",
      "活化資產、在地創生：老街活化，創造在地經濟價值",
      "活化資產、在地創生：引領冬山茶葉進軍日本，朝國際化繼續努力",
      "活化資產、在地創生：將冬山舊代表會為創業基地，鼓勵青年或特色團體進駐冬山商圈",
      "活化資產、在地創生：梅園生命紀念館二館興建工程，提供高品質服務"
    ]'::JSONB;
    repaired_source TEXT;
    platform_intro TEXT := '秉持「清廉」、「勤政」、「愛鄉土」理念，規劃「樂齡宜居」、「健全路網」、「低碳觀光」、「強化防災」與「活化創生」五大主軸，推動冬山鄉各項建設與發展。';
    affected_count INTEGER;
BEGIN
    SELECT pg_catalog.string_agg(item, E'\n' ORDER BY ordinal) INTO repaired_source
    FROM pg_catalog.jsonb_array_elements_text(repaired_items) WITH ORDINALITY AS expanded(item, ordinal);

    UPDATE public.person_claims AS claim
    SET claim_value = repaired_source,
        claim_json = pg_catalog.jsonb_set(
          pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
              pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(COALESCE(claim.claim_json, '{}'::JSONB), '{platformIntro}', pg_catalog.to_jsonb(platform_intro), TRUE),
                '{platformText}', pg_catalog.to_jsonb(repaired_source), TRUE),
              '{items}', repaired_items, TRUE),
            '{contentSplit}', COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB) || pg_catalog.jsonb_build_object(
              'reviewStatus', 'reviewed', 'releaseQuality', pg_catalog.jsonb_build_object('version', 'verified-platform-repair-20260907', 'reasonCodes', '[]'::JSONB)), TRUE),
          '{platformQualityAudit}', COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB) || pg_catalog.jsonb_build_object(
            'repairVersion', 'verified-platform-repair-20260907', 'repair', 'official_bulletin_image_user_assisted_transcription', 'classification', 'verified_repair'), TRUE),
        updated_at = pg_catalog.now()
    WHERE claim.id = 'b18a87e1-aa95-4bc7-a098-aadf1d0b56df'::UUID
      AND claim.person_id = '3df3bf1a-3760-4e03-b8bb-52d09937d913'::UUID
      AND claim.candidate_id = 'e60d892c-fedd-4979-a2ef-e09df21c47e0'::UUID
      AND claim.claim_type = 'platform'
      AND pg_catalog.md5(claim.claim_value) = '5246def20cbfdfb16052a006a568f6a6'
      AND pg_catalog.length(claim.claim_value) = 1428
      AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
      AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'confirmed_content_or_split_issue';
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    IF affected_count <> 1 THEN RAISE EXCEPTION 'Expected to repair one Lin Jun-fu platform, updated %', affected_count; END IF;
END
$release$;

WITH official_profile (person_id, candidate_id, source_url, birth_date, gender, party_affiliation, education_items, experience_items) AS (
  VALUES (
    '3df3bf1a-3760-4e03-b8bb-52d09937d913'::UUID,
    'e60d892c-fedd-4979-a2ef-e09df21c47e0'::UUID,
    'https://eebulletin.cec.gov.tw/111/15%E5%AE%9C%E8%98%AD%E7%B8%A3/03%E9%84%89%E9%8E%AE%E5%B8%82%E9%95%B7/%E5%86%AC%E5%B1%B1%E9%84%89%E9%84%89%E9%95%B7%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/%E5%86%AC%E5%B1%B1%E9%84%89%E9%95%B7%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1.pdf',
    '1969-04-18', 'male', '民主進步黨',
    '["成功國小","東光國中","宜蘭農工","蘭陽技術學院學士","佛光大學公共事務學碩士"]'::JSONB,
    '["第18屆冬山鄉鄉長","第19、20屆冬山鄉鄉民代表","民進黨宜蘭縣黨部執行長","冬山鄉觀光發展促進會理事","宜蘭縣青年公共事務協會常務理事","宜蘭縣後備憲兵協會顧問"]'::JSONB
  )
), expanded_claims AS (
  SELECT profile.person_id, profile.candidate_id, profile.source_url, claim.claim_type, claim.claim_value, claim.items, claim.field
  FROM official_profile AS profile
  CROSS JOIN LATERAL (VALUES
    ('birth_date', profile.birth_date, NULL::JSONB, 'birth_date'),
    ('gender', profile.gender, NULL::JSONB, 'gender'),
    ('party_affiliation', profile.party_affiliation, NULL::JSONB, 'recommended_party'),
    ('education', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.education_items) WITH ORDINALITY AS item(value, ordinal)), profile.education_items, 'education'),
    ('experience', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.experience_items) WITH ORDINALITY AS item(value, ordinal)), profile.experience_items, 'experience')
  ) AS claim(claim_type, claim_value, items, field)
)
INSERT INTO public.person_claims (claim_key, person_id, candidate_id, claim_type, claim_value, claim_json, confidence_level, review_status, visibility, source_name, source_url, observed_at, is_public, review_score, scoring_version, scoring_reasons, auto_reviewed_at)
SELECT 'official-profile:cec-2022-bulletin:lin-jun-fu:' || expanded.claim_type,
       expanded.person_id, expanded.candidate_id, expanded.claim_type, expanded.claim_value,
       pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('field', expanded.field, 'items', expanded.items, 'productionRelease', '20260907-cec-2022-profile-transcription')),
       'A', 'verified', 'public', '中央選舉委員會：2022年選舉公報', expanded.source_url,
       '2022-11-25T16:00:00+00:00'::TIMESTAMPTZ, TRUE, 100, 'cec-official-election-bulletin-v1',
       '["Official CEC election bulletin","User-assisted transcription from supplied bulletin image"]'::JSONB, pg_catalog.now()
FROM expanded_claims AS expanded
ON CONFLICT (claim_key) DO UPDATE SET
  person_id=EXCLUDED.person_id, candidate_id=EXCLUDED.candidate_id, claim_value=EXCLUDED.claim_value, claim_json=EXCLUDED.claim_json,
  confidence_level=EXCLUDED.confidence_level, review_status=EXCLUDED.review_status, visibility=EXCLUDED.visibility,
  source_name=EXCLUDED.source_name, source_url=EXCLUDED.source_url, observed_at=EXCLUDED.observed_at, is_public=EXCLUDED.is_public,
  review_score=EXCLUDED.review_score, scoring_version=EXCLUDED.scoring_version, scoring_reasons=EXCLUDED.scoring_reasons,
  auto_reviewed_at=EXCLUDED.auto_reviewed_at, updated_at=pg_catalog.now();

DO $validate$
DECLARE released_profile_count INTEGER;
BEGIN
  SELECT pg_catalog.count(*) INTO released_profile_count FROM public.person_claims AS claim
  WHERE claim.claim_key IN (
    'official-profile:cec-2022-bulletin:lin-jun-fu:birth_date','official-profile:cec-2022-bulletin:lin-jun-fu:gender',
    'official-profile:cec-2022-bulletin:lin-jun-fu:party_affiliation','official-profile:cec-2022-bulletin:lin-jun-fu:education',
    'official-profile:cec-2022-bulletin:lin-jun-fu:experience')
    AND claim.person_id='3df3bf1a-3760-4e03-b8bb-52d09937d913'::UUID
    AND claim.candidate_id='e60d892c-fedd-4979-a2ef-e09df21c47e0'::UUID
    AND claim.review_status='verified' AND claim.visibility='public' AND claim.is_public IS TRUE;
  IF released_profile_count <> 5 THEN RAISE EXCEPTION 'Expected five verified Lin Jun-fu profile claims, found %', released_profile_count; END IF;
  IF EXISTS (SELECT 1 FROM public.person_claims AS claim WHERE claim.id='b18a87e1-aa95-4bc7-a098-aadf1d0b56df'::UUID AND (
    pg_catalog.jsonb_array_length(claim.claim_json->'items')<>25 OR claim.claim_json#>>'{contentSplit,reviewStatus}'<>'reviewed' OR claim.claim_json#>>'{platformQualityAudit,classification}'<>'verified_repair'))
  THEN RAISE EXCEPTION 'Lin Jun-fu platform validation failed'; END IF;
END
$validate$;


-- Consolidated from 20260907053748_release_verified_chiu_fu_shun_profile.sql

DO $release$
DECLARE
  repaired_items JSONB := '[
    "防疫新作為：持續協助部落成立自主防疫站，適時提供防疫物資。",
    "防疫新作為：運用全鄉數位網路廣播系統、族語、國語提醒防疫重點。",
    "防疫新作為：加強宣導接種三劑疫苗，啟動幸福巴士接駁施打。",
    "產業發展：整合豐濱鄉旅遊資訊平台建立及觀光產業聯盟。",
    "產業發展：親不知子海上古道、月洞遊憩區持續改善工程。",
    "產業發展：推動藝術、文化及部落產業市集活動。",
    "產業發展：活化大港口營區成立地方創生聚落。",
    "產業發展：爭取歷史事件文化紀念館設立。",
    "產業發展：積極輔導協助兩處部落釀酒工坊合法化。",
    "文化發展：推動Cilangasan奇拉雅山－健康文化園區。",
    "文化發展：提高各部落祭典文化基金經費。",
    "文化發展：新社部落噶瑪蘭聚會所細部設計規劃中。",
    "文化發展：東興部落聚會所興辦事業計畫提出中。",
    "文化發展：靜浦部落聚會所細部設計規劃中。",
    "文化發展：豐富部落聚會所土地價購規劃中。",
    "文化發展：辦理Cepo''戰役紀念追思致敬活動。",
    "文化發展：推動原住民族傳統智慧傳承。",
    "社會福利健全：幸福巴士3.0智慧服務，造福鄉親接駁便利。",
    "社會福利健全：全鄉納保意外險2.0保障加值，實支實付納入意外理賠。",
    "社會福利健全：預防醫療納入長照需求，智慧手環3.0持續營運不中斷。",
    "社會福利健全：規劃豐濱鄉鄉民子女高中（職）以上助學金補助政策",
    "基礎建設：積極爭取自來水管延伸至磯崎村。",
    "基礎建設：Cilangasan聖山下的圖書館細部設計規畫中。",
    "基礎建設：推動全鄉部落道路路平、水溝疏濬專案。",
    "基礎建設：全鄉路燈維修智慧化提報系統，提升行的安全。",
    "基礎建設：改善農業產業道路及灌溉溝渠計畫。",
    "基礎建設：承諾提高各村零星工程經費，立即服務各村需求。",
    "城市交流：城鄉工藝、文化及產業交流合作意向協議簽署。",
    "城市交流：推動鄰近國際友好鄉鎮交流合作意向協議簽署。"
  ]'::JSONB;
  repaired_source TEXT;
  affected_count INTEGER;
BEGIN
  SELECT pg_catalog.string_agg(item, E'\n' ORDER BY ordinal) INTO repaired_source
  FROM pg_catalog.jsonb_array_elements_text(repaired_items) WITH ORDINALITY AS expanded(item, ordinal);
  UPDATE public.person_claims AS claim SET
    claim_value=repaired_source,
    claim_json=pg_catalog.jsonb_set(
      pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(
          pg_catalog.jsonb_set(COALESCE(claim.claim_json,'{}'::JSONB),'{platformText}',pg_catalog.to_jsonb(repaired_source),TRUE),
          '{items}',repaired_items,TRUE),
        '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-platform-repair-20260907','reasonCodes','[]'::JSONB)),TRUE),
      '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-platform-repair-20260907','repair','official_bulletin_image_user_assisted_transcription','classification','verified_repair'),TRUE),
    updated_at=pg_catalog.now()
  WHERE claim.id='cd438dec-4869-4094-9fde-fb8183ea0828'::UUID
    AND claim.person_id='bf88eae0-2e17-44dc-a8ea-473b0bbf0d1e'::UUID
    AND claim.candidate_id='9d6bfffc-0d30-4757-be47-f7f14944957a'::UUID
    AND claim.claim_type='platform'
    AND pg_catalog.md5(claim.claim_value)='d91d7ce28643f044941111c61d8ab4f5'
    AND pg_catalog.length(claim.claim_value)=1398
    AND claim.claim_json#>>'{contentSplit,reviewStatus}'='needs_review'
    AND claim.claim_json#>>'{platformQualityAudit,classification}'='confirmed_content_or_split_issue';
  GET DIAGNOSTICS affected_count=ROW_COUNT;
  IF affected_count<>1 THEN RAISE EXCEPTION 'Expected to repair one Chiu Fu-shun platform, updated %',affected_count; END IF;
END
$release$;

WITH official_profile(person_id,candidate_id,source_url,birth_date,gender,party_affiliation,education_items,experience_items) AS (
  VALUES(
    'bf88eae0-2e17-44dc-a8ea-473b0bbf0d1e'::UUID,
    '9d6bfffc-0d30-4757-be47-f7f14944957a'::UUID,
    'https://eebulletin.cec.gov.tw/111/16%E8%8A%B1%E8%93%AE%E7%B8%A3/03%E9%84%89%E9%8E%AE%E5%B8%82%E9%95%B7/%E8%B1%90%E6%BF%B1%E9%84%89%E9%84%89%E9%95%B7.pdf',
    '1967-05-06','male','無',
    '["大漢技術學院環境資源管理系工學學士"]'::JSONB,
    '["第16、19屆豐濱鄉民代表","第20屆豐濱鄉民代表會主席","現任豐濱鄉（里漏部落）發展協會理事長","暨部落會議主席"]'::JSONB
  )
), expanded_claims AS (
  SELECT profile.person_id,profile.candidate_id,profile.source_url,claim.claim_type,claim.claim_value,claim.items,claim.field
  FROM official_profile profile CROSS JOIN LATERAL (VALUES
    ('birth_date',profile.birth_date,NULL::JSONB,'birth_date'),
    ('gender',profile.gender,NULL::JSONB,'gender'),
    ('party_affiliation',profile.party_affiliation,NULL::JSONB,'recommended_party'),
    ('education',(SELECT pg_catalog.string_agg(value,E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.education_items) WITH ORDINALITY item(value,ordinal)),profile.education_items,'education'),
    ('experience',(SELECT pg_catalog.string_agg(value,E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.experience_items) WITH ORDINALITY item(value,ordinal)),profile.experience_items,'experience')
  ) claim(claim_type,claim_value,items,field)
)
INSERT INTO public.person_claims(claim_key,person_id,candidate_id,claim_type,claim_value,claim_json,confidence_level,review_status,visibility,source_name,source_url,observed_at,is_public,review_score,scoring_version,scoring_reasons,auto_reviewed_at)
SELECT 'official-profile:cec-2022-bulletin:chiu-fu-shun:'||claim_type,person_id,candidate_id,claim_type,claim_value,
  pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('field',field,'items',items,'productionRelease','20260907-cec-2022-profile-transcription')),
  'A','verified','public','中央選舉委員會：2022年選舉公報',source_url,'2022-11-25T16:00:00+00:00'::TIMESTAMPTZ,TRUE,100,'cec-official-election-bulletin-v1',
  '["Official CEC election bulletin","User-assisted transcription from supplied bulletin image"]'::JSONB,pg_catalog.now()
FROM expanded_claims
ON CONFLICT(claim_key) DO UPDATE SET person_id=EXCLUDED.person_id,candidate_id=EXCLUDED.candidate_id,claim_value=EXCLUDED.claim_value,claim_json=EXCLUDED.claim_json,confidence_level=EXCLUDED.confidence_level,review_status=EXCLUDED.review_status,visibility=EXCLUDED.visibility,source_name=EXCLUDED.source_name,source_url=EXCLUDED.source_url,observed_at=EXCLUDED.observed_at,is_public=EXCLUDED.is_public,review_score=EXCLUDED.review_score,scoring_version=EXCLUDED.scoring_version,scoring_reasons=EXCLUDED.scoring_reasons,auto_reviewed_at=EXCLUDED.auto_reviewed_at,updated_at=pg_catalog.now();

DO $validate$
DECLARE profile_count INTEGER;
BEGIN
  SELECT pg_catalog.count(*) INTO profile_count FROM public.person_claims WHERE claim_key LIKE 'official-profile:cec-2022-bulletin:chiu-fu-shun:%' AND person_id='bf88eae0-2e17-44dc-a8ea-473b0bbf0d1e'::UUID AND candidate_id='9d6bfffc-0d30-4757-be47-f7f14944957a'::UUID AND review_status='verified' AND visibility='public' AND is_public IS TRUE;
  IF profile_count<>5 THEN RAISE EXCEPTION 'Expected five verified Chiu Fu-shun profile claims, found %',profile_count; END IF;
  IF EXISTS(SELECT 1 FROM public.person_claims WHERE id='cd438dec-4869-4094-9fde-fb8183ea0828'::UUID AND (pg_catalog.jsonb_array_length(claim_json->'items')<>29 OR claim_json#>>'{contentSplit,reviewStatus}'<>'reviewed' OR claim_json#>>'{platformQualityAudit,classification}'<>'verified_repair')) THEN RAISE EXCEPTION 'Chiu Fu-shun platform validation failed'; END IF;
END
$validate$;


-- Consolidated from 20260907054228_release_verified_wu_shu_jun_profile.sql

DO $release$
DECLARE
  repaired_items JSONB := '[
    "永續環境生態共生：設置Ubike，並結合綠廊道，鋪設自行車環鄉專用道。",
    "永續環境生態共生：改造公園，以親水、寵物友善和共融式育樂為設計宗旨。",
    "永續環境生態共生：北勢溪（中正村、孝勢村）加蓋，規劃停車場，解決市區停車問題。",
    "永續環境生態共生：規劃二期王爺壟運動公園，增設地上三層室內球類運動，地下兩層停車位。",
    "永續環境生態共生：工業區設立湖口鄉多功能環保生態公園（番湖段約8.4公頃）。",
    "永續環境生態共生：每個月清淨家園，並整頓清理雜草樹木，守護環境減少蚊蟲孳生。",
    "永續環境生態共生：加強「觀星夕照、心靈的後花園」鄉內觀光串聯，整合盤點老街後山資源。",
    "永續環境生態共生：反對興建湖口生命園區。",
    "改善交通與基礎建設：打造人本步行環境，加強連續性，並檢討人行道寬度與高程，友善無障礙空間。",
    "改善交通與基礎建設：加速湖口第二交流道整體工程進度。",
    "改善交通與基礎建設：爭取更多替代道路工程，多方引導車流量，以疏導交通壅塞問題。",
    "改善交通與基礎建設：加強管制道路開挖，嚴管道路鋪設品質。",
    "改善交通與基礎建設：爭取更多國防用地，作為道路拓寬或基礎設施用途。",
    "改善交通與基礎建設：拓寬山葉路（中山路三段至德興路），規劃第二外環道。",
    "改善交通與基礎建設：檢討湖口鄉用地增設產業園區，進一步創造就業機會，促進工商發展。",
    "落實教育與文化、強化社會福利與時俱進：增設公私營幼兒園和親子館，公所提供合格空間，增加受教名額。",
    "落實教育與文化、強化社會福利與時俱進：加速湖口高中工程整體進度。",
    "落實教育與文化、強化社會福利與時俱進：國中小學營養午餐，每位學童額外補助10元，營養更均衡。",
    "落實教育與文化、強化社會福利與時俱進：增加更多文藝活動，活絡展演空間，打造湖口藝術慶典。",
    "落實教育與文化、強化社會福利與時俱進：公所服務數位全面透明化，優化陳情系統，整合縱向橫向資訊溝通。",
    "落實教育與文化、強化社會福利與時俱進：增設新住民辦公室，提供新住民協助管道，溫馨陪伴適應在地生活。",
    "落實教育與文化、強化社會福利與時俱進：增設社區長照環境，並建置平台媒合照護服務。"
  ]'::JSONB;
  repaired_source TEXT;
  affected_count INTEGER;
BEGIN
  SELECT pg_catalog.string_agg(item,E'\n' ORDER BY ordinal) INTO repaired_source FROM pg_catalog.jsonb_array_elements_text(repaired_items) WITH ORDINALITY expanded(item,ordinal);
  UPDATE public.person_claims claim SET claim_value=repaired_source,
    claim_json=pg_catalog.jsonb_set(pg_catalog.jsonb_set(pg_catalog.jsonb_set(pg_catalog.jsonb_set(COALESCE(claim.claim_json,'{}'::JSONB),'{platformText}',pg_catalog.to_jsonb(repaired_source),TRUE),'{items}',repaired_items,TRUE),'{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-platform-repair-20260907','reasonCodes','[]'::JSONB)),TRUE),'{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-platform-repair-20260907','repair','official_bulletin_image_user_assisted_transcription','classification','verified_repair'),TRUE),updated_at=pg_catalog.now()
  WHERE claim.id='e4d3ef12-84a8-4d64-a6a5-321af89316f7'::UUID AND claim.person_id='ec199236-0640-495a-8232-cec0cfc4d069'::UUID AND claim.candidate_id='33e6b304-133c-4c86-ab32-b90083db50b4'::UUID AND claim.claim_type='platform' AND pg_catalog.md5(claim.claim_value)='5503479f70e6ff1da51d85a53e53b294' AND pg_catalog.length(claim.claim_value)=1171 AND claim.claim_json#>>'{contentSplit,reviewStatus}'='needs_review' AND claim.claim_json#>>'{platformQualityAudit,classification}'='confirmed_content_or_split_issue';
  GET DIAGNOSTICS affected_count=ROW_COUNT;
  IF affected_count<>1 THEN RAISE EXCEPTION 'Expected to repair one Wu Shu-jun platform, updated %',affected_count; END IF;
END
$release$;

WITH official_profile(person_id,candidate_id,source_url,birth_date,gender,party_affiliation,education_items,experience_items) AS (
  VALUES('ec199236-0640-495a-8232-cec0cfc4d069'::UUID,'33e6b304-133c-4c86-ab32-b90083db50b4'::UUID,
    'https://eebulletin.cec.gov.tw/111/08%E6%96%B0%E7%AB%B9%E7%B8%A3/03%E9%84%89%E9%8E%AE%E5%B8%82%E9%95%B7/%E3%80%90%E6%B9%96%E5%8F%A3%E9%84%89%E3%80%91%E9%84%89%E9%95%B7%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1.pdf',
    '1971-12-07','female','中國國民黨','["中華大學運輸科技與物流管理學碩士"]'::JSONB,
    '["新竹縣第十六、十七、十八、十九屆議員","湖口鄉第十六、十七屆鄉民代表，第十七屆代表會主席","新湖國小家長會長（92-97）、湖口中學家長會長（96-102）"]'::JSONB)
), expanded_claims AS (
  SELECT profile.person_id,profile.candidate_id,profile.source_url,claim.claim_type,claim.claim_value,claim.items,claim.field FROM official_profile profile CROSS JOIN LATERAL (VALUES
    ('birth_date',profile.birth_date,NULL::JSONB,'birth_date'),('gender',profile.gender,NULL::JSONB,'gender'),('party_affiliation',profile.party_affiliation,NULL::JSONB,'recommended_party'),
    ('education',(SELECT pg_catalog.string_agg(value,E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.education_items) WITH ORDINALITY item(value,ordinal)),profile.education_items,'education'),
    ('experience',(SELECT pg_catalog.string_agg(value,E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.experience_items) WITH ORDINALITY item(value,ordinal)),profile.experience_items,'experience')) claim(claim_type,claim_value,items,field)
)
INSERT INTO public.person_claims(claim_key,person_id,candidate_id,claim_type,claim_value,claim_json,confidence_level,review_status,visibility,source_name,source_url,observed_at,is_public,review_score,scoring_version,scoring_reasons,auto_reviewed_at)
SELECT 'official-profile:cec-2022-bulletin:wu-shu-jun:'||claim_type,person_id,candidate_id,claim_type,claim_value,pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('field',field,'items',items,'productionRelease','20260907-cec-2022-profile-transcription')),'A','verified','public','中央選舉委員會：2022年選舉公報',source_url,'2022-11-25T16:00:00+00:00'::TIMESTAMPTZ,TRUE,100,'cec-official-election-bulletin-v1','["Official CEC election bulletin","User-assisted transcription from supplied bulletin image"]'::JSONB,pg_catalog.now() FROM expanded_claims
ON CONFLICT(claim_key) DO UPDATE SET person_id=EXCLUDED.person_id,candidate_id=EXCLUDED.candidate_id,claim_value=EXCLUDED.claim_value,claim_json=EXCLUDED.claim_json,confidence_level=EXCLUDED.confidence_level,review_status=EXCLUDED.review_status,visibility=EXCLUDED.visibility,source_name=EXCLUDED.source_name,source_url=EXCLUDED.source_url,observed_at=EXCLUDED.observed_at,is_public=EXCLUDED.is_public,review_score=EXCLUDED.review_score,scoring_version=EXCLUDED.scoring_version,scoring_reasons=EXCLUDED.scoring_reasons,auto_reviewed_at=EXCLUDED.auto_reviewed_at,updated_at=pg_catalog.now();

DO $validate$
DECLARE profile_count INTEGER;
BEGIN
  SELECT pg_catalog.count(*) INTO profile_count FROM public.person_claims WHERE claim_key LIKE 'official-profile:cec-2022-bulletin:wu-shu-jun:%' AND person_id='ec199236-0640-495a-8232-cec0cfc4d069'::UUID AND candidate_id='33e6b304-133c-4c86-ab32-b90083db50b4'::UUID AND review_status='verified' AND visibility='public' AND is_public IS TRUE;
  IF profile_count<>5 THEN RAISE EXCEPTION 'Expected five verified Wu Shu-jun profile claims, found %',profile_count; END IF;
  IF EXISTS(SELECT 1 FROM public.person_claims WHERE id='e4d3ef12-84a8-4d64-a6a5-321af89316f7'::UUID AND (pg_catalog.jsonb_array_length(claim_json->'items')<>22 OR claim_json#>>'{contentSplit,reviewStatus}'<>'reviewed' OR claim_json#>>'{platformQualityAudit,classification}'<>'verified_repair')) THEN RAISE EXCEPTION 'Wu Shu-jun platform validation failed'; END IF;
END
$validate$;


-- Consolidated from 20260907060312_release_verified_lin_shuo_yan_profile.sql

DO $release$
DECLARE
  repaired_items JSONB := '[
    "交通：催生高鐵橋下道路延伸至竹科力行路。",
    "交通：支持竹北與新竹市跨頭前溪新橋計劃。",
    "交通：催生興隆橋橋樑拓寬或新設橋面，南北向雙線道。",
    "交通：改善經國大橋行車用路品質，汽機慢車道分流。",
    "交通：高鐵站東西側行車動線，改善接送乘客安全與效率。",
    "交通：開闢國道1號東西側道路，改善五叉路口車流。",
    "交通：支持國道1號楊梅頭份段高架拓寬計劃。",
    "交通：打通光明一路與勝利八街涵洞。",
    "交通：科大一路與成功八路涵洞。",
    "交通：台1線替代道路，68快速路武陵路口接竹北段。",
    "交通：竹北段台鐵縱貫線高架化，化解竹北東西區瓶頸。",
    "交通：優化竹北火車站西側交通，尖峰時段增加火車班次。",
    "教育：教育是脫貧的階梯，重視弱勢者的教育機會。",
    "教育：推動STEAM教學法，結合理論與應用，活化教學法。",
    "教育：加強教育資源，提升教學品質。",
    "教育：人文素養、倫理與道德教育，培養思考解決問題力。",
    "教育：竹北重劃區持續規畫增設國中國小新學校。",
    "教育：推動特教－早療（0-6歲）服務，補足早療資源不足。",
    "教育：優質農特產品自銷國中小學營養午餐。",
    "公園與休閒觀光：參與式預算，提高公園政策的透明度與品質。",
    "公園與休閒觀光：觀光旅遊、銷售新竹縣特色農產品。",
    "公園與休閒觀光：持續科技技術引導，走向精緻觀光品質。",
    "公園與休閒觀光：催生新設竹北市立網球場及風雨球場。",
    "公園與休閒觀光：公有閒置土地開放民眾認養開心農場。",
    "公園與休閒觀光：持續推動客家文化古蹟保存，遺產保存。",
    "城市價值與美學：落實都市計畫，高汙染有煙囪產業遠離住宅區。",
    "城市價值與美學：仰德重劃區，莊敬北路向北打通到鳳山溪堤防路。",
    "城市價值與美學：監督公共工程品質，推動第三方公正單位認證。",
    "城市價值與美學：落實合法招標及驗收流程SOP，提升工程品質。",
    "城市價值與美學：喘息服務，照顧老中青幼，讓上班族安心工作。",
    "城市價值與美學：訂定自辦農地重劃廢污水排放管理條例。",
    "城市價值與美學：積極審查縣內重劃區污水排放管理與維護。",
    "智慧應用：推廣AIoT（智慧物聯網），手機APP智慧服務。",
    "智慧應用：試辦無人自駕公車路線，催生智慧大眾運輸系統。",
    "智慧應用：智慧公車系統結合YouBike，提升公車使用率。"
  ]'::JSONB;
  repaired_source TEXT;
  affected_count INTEGER;
BEGIN
  SELECT pg_catalog.string_agg(item,E'\n' ORDER BY ordinal) INTO repaired_source FROM pg_catalog.jsonb_array_elements_text(repaired_items) WITH ORDINALITY expanded(item,ordinal);
  UPDATE public.person_claims claim SET claim_value=repaired_source,
    claim_json=pg_catalog.jsonb_set(pg_catalog.jsonb_set(pg_catalog.jsonb_set(pg_catalog.jsonb_set(COALESCE(claim.claim_json,'{}'::JSONB),'{platformText}',pg_catalog.to_jsonb(repaired_source),TRUE),'{items}',repaired_items,TRUE),'{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-platform-repair-20260907','reasonCodes','[]'::JSONB)),TRUE),'{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-platform-repair-20260907','repair','official_bulletin_image_user_assisted_transcription','classification','verified_repair'),TRUE),updated_at=pg_catalog.now()
  WHERE claim.id='11b48057-0fce-4122-b59b-8b946d474533'::UUID AND claim.person_id='3b877dd4-5756-491f-a77b-503952f799b7'::UUID AND claim.candidate_id='f4a3581a-82ae-40d4-ac7e-4a5561260749'::UUID AND claim.claim_type='platform' AND pg_catalog.md5(claim.claim_value)='6d07e61a95e2001bc67e8181ea53e1fe' AND pg_catalog.length(claim.claim_value)=638 AND claim.claim_json#>>'{contentSplit,reviewStatus}'='needs_review' AND claim.claim_json#>>'{platformQualityAudit,classification}'='confirmed_content_or_split_issue';
  GET DIAGNOSTICS affected_count=ROW_COUNT;
  IF affected_count<>1 THEN RAISE EXCEPTION 'Expected to repair one Lin Shuo-yan platform, updated %',affected_count; END IF;
END
$release$;

WITH official_profile(person_id,candidate_id,source_url,birth_date,gender,party_affiliation,education_items,experience_items) AS (
  VALUES('3b877dd4-5756-491f-a77b-503952f799b7'::UUID,'f4a3581a-82ae-40d4-ac7e-4a5561260749'::UUID,
    'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/06%E7%B8%A3%E5%B8%82%E8%AD%B0%E5%93%A1/111%E5%B9%B4/07%E6%96%B0%E7%AB%B9%E7%B8%A3/%E6%96%B0%E7%AB%B9%E7%B8%A3%E7%AC%AC01%E9%81%B8%E8%88%89%E5%8D%80.pdf',
    '1976-01-23','male','台灣民眾黨','["國立中山大學電機工程碩士"]'::JSONB,
    '["國立陽明交通大學電機工程博士候選人","現任第九屆竹北市民代表","康田藥粧連鎖藥局經理人","新竹縣反污染要健康協會理事長","台灣類比科技產品部副理","瑞鼎科技產品工程部副理","聯詠科技製造工程部經理","聯華電子8C廠製程整合工程師","中山大學推廣教育課程助教","富源社區管理委員會主任委員","連鎖餐飲業經理人"]'::JSONB)
), expanded_claims AS (
  SELECT profile.person_id,profile.candidate_id,profile.source_url,claim.claim_type,claim.claim_value,claim.items,claim.field FROM official_profile profile CROSS JOIN LATERAL (VALUES
    ('birth_date',profile.birth_date,NULL::JSONB,'birth_date'),('gender',profile.gender,NULL::JSONB,'gender'),('party_affiliation',profile.party_affiliation,NULL::JSONB,'recommended_party'),
    ('education',(SELECT pg_catalog.string_agg(value,E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.education_items) WITH ORDINALITY item(value,ordinal)),profile.education_items,'education'),
    ('experience',(SELECT pg_catalog.string_agg(value,E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.experience_items) WITH ORDINALITY item(value,ordinal)),profile.experience_items,'experience')) claim(claim_type,claim_value,items,field)
)
INSERT INTO public.person_claims(claim_key,person_id,candidate_id,claim_type,claim_value,claim_json,confidence_level,review_status,visibility,source_name,source_url,observed_at,is_public,review_score,scoring_version,scoring_reasons,auto_reviewed_at)
SELECT 'official-profile:cec-2022-bulletin:lin-shuo-yan:'||claim_type,person_id,candidate_id,claim_type,claim_value,pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('field',field,'items',items,'productionRelease','20260907-cec-2022-profile-transcription')),'A','verified','public','中央選舉委員會：2022年選舉公報',source_url,'2022-11-25T16:00:00+00:00'::TIMESTAMPTZ,TRUE,100,'cec-official-election-bulletin-v1','["Official CEC election bulletin","User-assisted transcription from supplied bulletin image"]'::JSONB,pg_catalog.now() FROM expanded_claims
ON CONFLICT(claim_key) DO UPDATE SET person_id=EXCLUDED.person_id,candidate_id=EXCLUDED.candidate_id,claim_value=EXCLUDED.claim_value,claim_json=EXCLUDED.claim_json,confidence_level=EXCLUDED.confidence_level,review_status=EXCLUDED.review_status,visibility=EXCLUDED.visibility,source_name=EXCLUDED.source_name,source_url=EXCLUDED.source_url,observed_at=EXCLUDED.observed_at,is_public=EXCLUDED.is_public,review_score=EXCLUDED.review_score,scoring_version=EXCLUDED.scoring_version,scoring_reasons=EXCLUDED.scoring_reasons,auto_reviewed_at=EXCLUDED.auto_reviewed_at,updated_at=pg_catalog.now();

DO $validate$
DECLARE profile_count INTEGER;
BEGIN
  SELECT pg_catalog.count(*) INTO profile_count FROM public.person_claims WHERE claim_key LIKE 'official-profile:cec-2022-bulletin:lin-shuo-yan:%' AND person_id='3b877dd4-5756-491f-a77b-503952f799b7'::UUID AND candidate_id='f4a3581a-82ae-40d4-ac7e-4a5561260749'::UUID AND review_status='verified' AND visibility='public' AND is_public IS TRUE;
  IF profile_count<>5 THEN RAISE EXCEPTION 'Expected five verified Lin Shuo-yan profile claims, found %',profile_count; END IF;
  IF EXISTS(SELECT 1 FROM public.person_claims WHERE id='11b48057-0fce-4122-b59b-8b946d474533'::UUID AND (pg_catalog.jsonb_array_length(claim_json->'items')<>35 OR claim_json#>>'{contentSplit,reviewStatus}'<>'reviewed' OR claim_json#>>'{platformQualityAudit,classification}'<>'verified_repair')) THEN RAISE EXCEPTION 'Lin Shuo-yan platform validation failed'; END IF;
END
$validate$;


-- Consolidated from 20260907060627_release_verified_tsai_ya_hsuan_profile.sql

DO $release$
DECLARE
  repaired_items JSONB := '[
    "文化創意：持續關注竹北泉州厝汾陽堂、六家新瓦屋OT案。",
    "文化創意：定期舉辦文化議題、政策論壇，推動具體可行的文化政策。",
    "文化創意：結合古蹟、古圳、老樹等地景特色，形塑竹北文化新風貌。",
    "文化創意：關注新竹縣美術館興建設置規劃案，催生新時代的地方美術館。",
    "文化創意：推動「東興圳水圳文化復興運動」，打造東興圳沿岸成為竹北綠園道。",
    "環境永續：監督高鐵旁世興空品區蓋「室內體育場館BOT案」。",
    "環境永續：關注豆子埔溪改善計畫，還給竹北母親河美麗面容。",
    "環境永續：宣導垃圾減量，尋求各種處理垃圾的綠色替代方案。",
    "教育監督：支持普設公幼，改善公托、臨托等問題。",
    "教育監督：關注學童營養午餐食安問題，推廣食農教育。",
    "教育監督：爭取設立完全中學，改善國高中不足的排擠效應，保障受教權。",
    "教育監督：關注特教生權益，爭取設立「竹北特教資源中心」，結合早療、職能治療等全方位功能。",
    "交通及其他：持續關注新竹縣大眾捷運系統整體路網規劃案。",
    "交通及其他：持續關注國道一號楊頭段拓寬工程、新竹縣經國橋交通改善工程。",
    "交通及其他：推動竹北老舊公園廣場綠地兒童遊戲設施安全檢測。",
    "交通及其他：爭取竹北增建風雨球場、網球場等，照顧運動族群需求。"
  ]'::JSONB;
  repaired_source TEXT;
  affected_count INTEGER;
BEGIN
  SELECT pg_catalog.string_agg(item,E'\n' ORDER BY ordinal) INTO repaired_source FROM pg_catalog.jsonb_array_elements_text(repaired_items) WITH ORDINALITY expanded(item,ordinal);
  UPDATE public.person_claims claim SET claim_value=repaired_source,
    claim_json=pg_catalog.jsonb_set(pg_catalog.jsonb_set(pg_catalog.jsonb_set(pg_catalog.jsonb_set(COALESCE(claim.claim_json,'{}'::JSONB),'{platformText}',pg_catalog.to_jsonb(repaired_source),TRUE),'{items}',repaired_items,TRUE),'{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-platform-repair-20260907','reasonCodes','[]'::JSONB)),TRUE),'{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-platform-repair-20260907','repair','official_bulletin_image_user_assisted_transcription','classification','verified_repair'),TRUE),updated_at=pg_catalog.now()
  WHERE claim.id='806bc1b0-d56a-4ee1-93fd-27516ccc9965'::UUID AND claim.person_id='ff97cb3d-32ba-4ecb-b1f7-6408b8bacb3d'::UUID AND claim.candidate_id='80997b99-1847-4f3f-85ff-11ab4eb81c51'::UUID AND claim.claim_type='platform' AND pg_catalog.md5(claim.claim_value)='abb0ee4a75dda77600089e85853d3495' AND pg_catalog.length(claim.claim_value)=935 AND claim.claim_json#>>'{contentSplit,reviewStatus}'='needs_review' AND claim.claim_json#>>'{platformQualityAudit,classification}'='confirmed_content_or_split_issue';
  GET DIAGNOSTICS affected_count=ROW_COUNT;
  IF affected_count<>1 THEN RAISE EXCEPTION 'Expected to repair one Tsai Ya-hsuan platform, updated %',affected_count; END IF;
END
$release$;

WITH official_profile(person_id,candidate_id,source_url,birth_date,gender,party_affiliation,education_items,experience_items) AS (
  VALUES('ff97cb3d-32ba-4ecb-b1f7-6408b8bacb3d'::UUID,'80997b99-1847-4f3f-85ff-11ab4eb81c51'::UUID,
    'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/06%E7%B8%A3%E5%B8%82%E8%AD%B0%E5%93%A1/111%E5%B9%B4/07%E6%96%B0%E7%AB%B9%E7%B8%A3/%E6%96%B0%E7%AB%B9%E7%B8%A3%E7%AC%AC01%E9%81%B8%E8%88%89%E5%8D%80.pdf',
    '1978-01-09','female','民主進步黨','["世新大學新聞研究所碩士"]'::JSONB,
    '["現任竹北市民代表","台灣鄧雨賢音樂文化協會顧問","文化工作者，著作《重新發現鄧南光》獲國史館台灣文獻館推廣性書刊第二名"]'::JSONB)
), expanded_claims AS (
  SELECT profile.person_id,profile.candidate_id,profile.source_url,claim.claim_type,claim.claim_value,claim.items,claim.field FROM official_profile profile CROSS JOIN LATERAL (VALUES
    ('birth_date',profile.birth_date,NULL::JSONB,'birth_date'),('gender',profile.gender,NULL::JSONB,'gender'),('party_affiliation',profile.party_affiliation,NULL::JSONB,'recommended_party'),
    ('education',(SELECT pg_catalog.string_agg(value,E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.education_items) WITH ORDINALITY item(value,ordinal)),profile.education_items,'education'),
    ('experience',(SELECT pg_catalog.string_agg(value,E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.experience_items) WITH ORDINALITY item(value,ordinal)),profile.experience_items,'experience')) claim(claim_type,claim_value,items,field)
)
INSERT INTO public.person_claims(claim_key,person_id,candidate_id,claim_type,claim_value,claim_json,confidence_level,review_status,visibility,source_name,source_url,observed_at,is_public,review_score,scoring_version,scoring_reasons,auto_reviewed_at)
SELECT 'official-profile:cec-2022-bulletin:tsai-ya-hsuan:'||claim_type,person_id,candidate_id,claim_type,claim_value,pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('field',field,'items',items,'productionRelease','20260907-cec-2022-profile-transcription')),'A','verified','public','中央選舉委員會：2022年選舉公報',source_url,'2022-11-25T16:00:00+00:00'::TIMESTAMPTZ,TRUE,100,'cec-official-election-bulletin-v1','["Official CEC election bulletin","User-assisted transcription from supplied bulletin image"]'::JSONB,pg_catalog.now() FROM expanded_claims
ON CONFLICT(claim_key) DO UPDATE SET person_id=EXCLUDED.person_id,candidate_id=EXCLUDED.candidate_id,claim_value=EXCLUDED.claim_value,claim_json=EXCLUDED.claim_json,confidence_level=EXCLUDED.confidence_level,review_status=EXCLUDED.review_status,visibility=EXCLUDED.visibility,source_name=EXCLUDED.source_name,source_url=EXCLUDED.source_url,observed_at=EXCLUDED.observed_at,is_public=EXCLUDED.is_public,review_score=EXCLUDED.review_score,scoring_version=EXCLUDED.scoring_version,scoring_reasons=EXCLUDED.scoring_reasons,auto_reviewed_at=EXCLUDED.auto_reviewed_at,updated_at=pg_catalog.now();

DO $validate$
DECLARE profile_count INTEGER;
BEGIN
  SELECT pg_catalog.count(*) INTO profile_count FROM public.person_claims WHERE claim_key LIKE 'official-profile:cec-2022-bulletin:tsai-ya-hsuan:%' AND person_id='ff97cb3d-32ba-4ecb-b1f7-6408b8bacb3d'::UUID AND candidate_id='80997b99-1847-4f3f-85ff-11ab4eb81c51'::UUID AND review_status='verified' AND visibility='public' AND is_public IS TRUE;
  IF profile_count<>5 THEN RAISE EXCEPTION 'Expected five verified Tsai Ya-hsuan profile claims, found %',profile_count; END IF;
  IF EXISTS(SELECT 1 FROM public.person_claims WHERE id='806bc1b0-d56a-4ee1-93fd-27516ccc9965'::UUID AND (pg_catalog.jsonb_array_length(claim_json->'items')<>16 OR claim_json#>>'{contentSplit,reviewStatus}'<>'reviewed' OR claim_json#>>'{platformQualityAudit,classification}'<>'verified_repair')) THEN RAISE EXCEPTION 'Tsai Ya-hsuan platform validation failed'; END IF;
END
$validate$;


-- Consolidated from 20260907060916_release_verified_chou_chun_mi_profile.sql

DO $release$
DECLARE
  repaired_items JSONB := '[
    "五大核心產業－科技產業：在高鐵南延屏東的帶動下，科技部科學園區、經濟部科技產業園區、縣府六塊厝產業園區，加上現有大慶汽車工業園區，整體科技產業聚落成型，未來積極招商，帶動就業及經濟發展！",
    "五大核心產業－農金產業：屏東縣的農漁畜產值高，應建立產地輔導、內外銷通路，到外銷蒸熟冷鏈包裝廠、加工場等機制，讓產業提升，收入增加。",
    "五大核心產業－觀光產業：未來將屏東的自然景觀與歷史軸線串接，加上藝術文化音樂，促成觀光多樣性，吸引觀光人潮，帶動其他產業。",
    "五大核心產業－綠能產業：屏東的日照、風、沼氣，最適合發展再生能源，以環境永續為目標，制定綠能產業發展計畫！",
    "五大核心產業－長照產業：縣民對長照需求逐年提升，未來由縣府調整供需，提供全縣33鄉鎮市長照服務，讓長輩及家屬安心。",
    "六大發展區－屏東市及周邊鄉鎮－都會工商城：以便捷交通帶動科技及工商發展，加上醫療、文化教育環境可近性高，未來致力提升生活機能，打造宜居城市。",
    "六大發展區－屏北－農業再升級：發展精緻農業，協助提升農業技術，減少中間剝削，增加外銷通路，讓農民收入增加，培育青農，開啟新契機。",
    "六大發展區－平原地區－文化田園產業園區：潮州、六堆及萬丹的平原地區土壤肥沃，人文豐富，又有大潮州人工湖、林後四林平地森林園區、可可及咖啡、紅豆及畜牧等產業，讓文化田園產業蓬勃發展。",
    "六大發展區－沿海地區－漁業綠能之都：屏東漁業及養殖業產值都是全國之最，未來在國際規範下，兼顧漁民權益與漁業永續是重要目標。區域內的太陽能產業也應建立發展機制，兼顧環境景觀與綠能。",
    "六大發展區－半島地區－觀光領航：半島山海的自然資源渾然天成，未來應扶植生態永續的旅遊方式、強化藝術展演等，發展多樣性觀光，同步發展及提升工商產業。",
    "六大發展區－沿山地區－原鄉文化觀光加值：原鄉除傳統農耕外，未來應積極推動咖啡等產業，發展族群人文特色，支持部落生態觀光旅遊及伴手禮，提供穩定的長照、托育照顧。"
  ]'::JSONB;
  repaired_source TEXT;
  platform_intro TEXT := '春米誓言，在安居樂業的基礎下，用五大核心產業，帶動六大發展區，讓屏東向前，邁向希望城市！';
  affected_count INTEGER;
BEGIN
  SELECT pg_catalog.string_agg(item,E'\n' ORDER BY ordinal) INTO repaired_source FROM pg_catalog.jsonb_array_elements_text(repaired_items) WITH ORDINALITY expanded(item,ordinal);
  UPDATE public.person_claims claim SET claim_value=repaired_source,
    claim_json=pg_catalog.jsonb_set(pg_catalog.jsonb_set(pg_catalog.jsonb_set(pg_catalog.jsonb_set(pg_catalog.jsonb_set(COALESCE(claim.claim_json,'{}'::JSONB),'{platformIntro}',pg_catalog.to_jsonb(platform_intro),TRUE),'{platformText}',pg_catalog.to_jsonb(repaired_source),TRUE),'{items}',repaired_items,TRUE),'{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-platform-repair-20260907','reasonCodes','[]'::JSONB)),TRUE),'{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-platform-repair-20260907','repair','official_bulletin_image_user_assisted_transcription','classification','verified_repair'),TRUE),updated_at=pg_catalog.now()
  WHERE claim.id='da307a57-1b2b-4920-9afe-c9c118d31293'::UUID AND claim.person_id='3649e1b2-cabd-4d11-8aa3-5e1701c113a2'::UUID AND claim.candidate_id='c30060e1-a84e-45a0-a118-248a96651784'::UUID AND claim.claim_type='platform' AND pg_catalog.md5(claim.claim_value)='188a4a58b02b050390fd3698889b0b17' AND pg_catalog.length(claim.claim_value)=1453 AND claim.claim_json#>>'{contentSplit,reviewStatus}'='needs_review' AND claim.claim_json#>>'{platformQualityAudit,classification}'='confirmed_content_or_split_issue';
  GET DIAGNOSTICS affected_count=ROW_COUNT;
  IF affected_count<>1 THEN RAISE EXCEPTION 'Expected to repair one Chou Chun-mi platform, updated %',affected_count; END IF;
END
$release$;

WITH official_profile(person_id,candidate_id,source_url,birth_date,gender,party_affiliation,education_items,experience_items) AS (
  VALUES('3649e1b2-cabd-4d11-8aa3-5e1701c113a2'::UUID,'c30060e1-a84e-45a0-a118-248a96651784'::UUID,
    'https://eebulletin.cec.gov.tw/111/14%E5%B1%8F%E6%9D%B1%E7%B8%A3/01%E7%B8%A3%E9%95%B7/%E7%B8%A3%E9%95%B7.pdf',
    '1966-11-01','female','民主進步黨','["國立臺灣大學法律學系"]'::JSONB,
    '["第十屆立法委員","第九屆立法委員","執業律師","屏東律師公會第28屆理事長","高雄地方法院法官","屏東地方法院法官","臺灣銀行城中分行辦事員"]'::JSONB)
), expanded_claims AS (
  SELECT profile.person_id,profile.candidate_id,profile.source_url,claim.claim_type,claim.claim_value,claim.items,claim.field FROM official_profile profile CROSS JOIN LATERAL (VALUES
    ('birth_date',profile.birth_date,NULL::JSONB,'birth_date'),('gender',profile.gender,NULL::JSONB,'gender'),('party_affiliation',profile.party_affiliation,NULL::JSONB,'recommended_party'),
    ('education',(SELECT pg_catalog.string_agg(value,E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.education_items) WITH ORDINALITY item(value,ordinal)),profile.education_items,'education'),
    ('experience',(SELECT pg_catalog.string_agg(value,E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.experience_items) WITH ORDINALITY item(value,ordinal)),profile.experience_items,'experience')) claim(claim_type,claim_value,items,field)
)
INSERT INTO public.person_claims(claim_key,person_id,candidate_id,claim_type,claim_value,claim_json,confidence_level,review_status,visibility,source_name,source_url,observed_at,is_public,review_score,scoring_version,scoring_reasons,auto_reviewed_at)
SELECT 'official-profile:cec-2022-bulletin:chou-chun-mi:'||claim_type,person_id,candidate_id,claim_type,claim_value,pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('field',field,'items',items,'productionRelease','20260907-cec-2022-profile-transcription')),'A','verified','public','中央選舉委員會：2022年選舉公報',source_url,'2022-11-25T16:00:00+00:00'::TIMESTAMPTZ,TRUE,100,'cec-official-election-bulletin-v1','["Official CEC election bulletin","User-assisted transcription from supplied bulletin image"]'::JSONB,pg_catalog.now() FROM expanded_claims
ON CONFLICT(claim_key) DO UPDATE SET person_id=EXCLUDED.person_id,candidate_id=EXCLUDED.candidate_id,claim_value=EXCLUDED.claim_value,claim_json=EXCLUDED.claim_json,confidence_level=EXCLUDED.confidence_level,review_status=EXCLUDED.review_status,visibility=EXCLUDED.visibility,source_name=EXCLUDED.source_name,source_url=EXCLUDED.source_url,observed_at=EXCLUDED.observed_at,is_public=EXCLUDED.is_public,review_score=EXCLUDED.review_score,scoring_version=EXCLUDED.scoring_version,scoring_reasons=EXCLUDED.scoring_reasons,auto_reviewed_at=EXCLUDED.auto_reviewed_at,updated_at=pg_catalog.now();

DO $validate$
DECLARE profile_count INTEGER;
BEGIN
  SELECT pg_catalog.count(*) INTO profile_count FROM public.person_claims WHERE claim_key LIKE 'official-profile:cec-2022-bulletin:chou-chun-mi:%' AND person_id='3649e1b2-cabd-4d11-8aa3-5e1701c113a2'::UUID AND candidate_id='c30060e1-a84e-45a0-a118-248a96651784'::UUID AND review_status='verified' AND visibility='public' AND is_public IS TRUE;
  IF profile_count<>5 THEN RAISE EXCEPTION 'Expected five verified Chou Chun-mi profile claims, found %',profile_count; END IF;
  IF EXISTS(SELECT 1 FROM public.person_claims WHERE id='da307a57-1b2b-4920-9afe-c9c118d31293'::UUID AND (pg_catalog.jsonb_array_length(claim_json->'items')<>11 OR claim_json#>>'{contentSplit,reviewStatus}'<>'reviewed' OR claim_json#>>'{platformQualityAudit,classification}'<>'verified_repair')) THEN RAISE EXCEPTION 'Chou Chun-mi platform validation failed'; END IF;
END
$validate$;


-- Consolidated from 20260907061351_release_verified_chang_chi_kai_platform.sql

DO $release$
DECLARE
  repaired_items JSONB := '[
    "延續幸福治理：延續優質施政，推動重大建設，提升城市競爭力。",
    "照顧孩子：國中小營養午餐免費，守護食安與營養。",
    "照顧長輩：推動健保補助、完善長照，打造全齡友善城市。推動65歲以上長者，健保免費。",
    "支持青年：推動青年住宅、未來帳戶、創業與就業，讓青年留嘉、返嘉。另外幫助市民敢生敢養，提高生育補助，生第一胎5萬、第二胎10萬、第三胎20萬（全國最高）。還有0-6歲生日禮金每年2萬，讓青年朋友在嘉義安心成家。",
    "發展產業：打造北港路產業廊帶，創造就業、增加財源。",
    "完善交通：推動輕軌、鐵路高架化及完整路網建設。",
    "活絡商圈：振興商圈、市場與夜市，帶動觀光與消費。",
    "智慧城市：導入AI與數位治理，提升市政服務效率。",
    "守護環境：守護蘭潭、減煤減空污，打造健康永續城市。",
    "穩健財政：善用新增財源，讓福利、建設與產業發展都能長久推動。"
  ]'::JSONB;
  repaired_source TEXT;
  platform_title TEXT := '延續幸福執政，嘉義安心升級';
  platform_intro TEXT := '我參選嘉義市長，是為了讓嘉義更更好、更進步，延續黃敏惠市長，在幸福城市的基礎上持續升級。我將以專業治理、穩健財政，推動建設、產業、福利與交通全面進步，打造更幸福、更有競爭力的嘉義。';
  platform_commitment TEXT := '延續幸福執政，嘉義安心升級。讓嘉義不只幸福，更要更繁榮、更宜居、更有未來。';
  affected_count INTEGER;
BEGIN
  SELECT pg_catalog.string_agg(item,E'\n' ORDER BY ordinal) INTO repaired_source FROM pg_catalog.jsonb_array_elements_text(repaired_items) WITH ORDINALITY expanded(item,ordinal);
  UPDATE public.person_claims claim SET claim_value=repaired_source,
    claim_json=pg_catalog.jsonb_set(pg_catalog.jsonb_set(pg_catalog.jsonb_set(pg_catalog.jsonb_set(pg_catalog.jsonb_set(pg_catalog.jsonb_set(pg_catalog.jsonb_set(COALESCE(claim.claim_json,'{}'::JSONB),'{platformTitle}',pg_catalog.to_jsonb(platform_title),TRUE),'{platformIntro}',pg_catalog.to_jsonb(platform_intro),TRUE),'{platformCommitment}',pg_catalog.to_jsonb(platform_commitment),TRUE),'{platformText}',pg_catalog.to_jsonb(repaired_source),TRUE),'{items}',repaired_items,TRUE),'{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-platform-repair-20260907','reasonCodes','[]'::JSONB)),TRUE),'{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-platform-repair-20260907','repair','official_party_candidate_page_verified_transcription','classification','verified_repair'),TRUE),
    observed_at=pg_catalog.now(),updated_at=pg_catalog.now()
  WHERE claim.id='f370c034-1174-4a75-80aa-b97a9dd1353a'::UUID AND claim.person_id='3028bba8-3232-4d8f-8081-ab41503c9409'::UUID AND claim.candidate_id='d40b3715-5389-42de-856a-caa2bc4c6d3c'::UUID AND claim.claim_type='platform' AND pg_catalog.md5(claim.claim_value)='0d92b94e2e84a7dc45dfc9a8d7a3dd21' AND pg_catalog.length(claim.claim_value)=528 AND claim.claim_json#>>'{contentSplit,reviewStatus}'='needs_review' AND claim.claim_json#>>'{platformQualityAudit,classification}'='confirmed_content_or_split_issue';
  GET DIAGNOSTICS affected_count=ROW_COUNT;
  IF affected_count<>1 THEN RAISE EXCEPTION 'Expected to repair one Chang Chi-kai platform, updated %',affected_count; END IF;

  UPDATE public.person_claims claim SET candidate_id='d40b3715-5389-42de-856a-caa2bc4c6d3c'::UUID,observed_at=pg_catalog.now(),updated_at=pg_catalog.now()
  WHERE claim.id='c3687480-48b1-4020-b122-8833694587d5'::UUID AND claim.person_id='3028bba8-3232-4d8f-8081-ab41503c9409'::UUID AND claim.claim_type='experience' AND claim.candidate_id IS NULL AND pg_catalog.md5(claim.claim_value)='ee8684007e50aa65c078c1c66405f06a' AND pg_catalog.length(claim.claim_value)=102;
  GET DIAGNOSTICS affected_count=ROW_COUNT;
  IF affected_count<>1 THEN RAISE EXCEPTION 'Expected to attach one Chang Chi-kai experience claim, updated %',affected_count; END IF;
END
$release$;

DO $validate$
BEGIN
  IF EXISTS(SELECT 1 FROM public.person_claims WHERE id='f370c034-1174-4a75-80aa-b97a9dd1353a'::UUID AND (pg_catalog.jsonb_array_length(claim_json->'items')<>10 OR claim_json#>>'{contentSplit,reviewStatus}'<>'reviewed' OR claim_json#>>'{platformQualityAudit,classification}'<>'verified_repair')) THEN RAISE EXCEPTION 'Chang Chi-kai platform validation failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.person_claims WHERE id='c3687480-48b1-4020-b122-8833694587d5'::UUID AND candidate_id='d40b3715-5389-42de-856a-caa2bc4c6d3c'::UUID AND review_status='verified' AND visibility='public' AND is_public IS TRUE) THEN RAISE EXCEPTION 'Chang Chi-kai experience validation failed'; END IF;
END
$validate$;



DO $baseline_completion$ BEGIN
 IF EXISTS (SELECT 1 FROM release_source_baselines b LEFT JOIN public.person_claims c ON c.id=b.id
 WHERE c.id IS NULL OR c.person_id IS DISTINCT FROM b.person_id
 OR c.candidate_id IS DISTINCT FROM b.candidate_id OR c.claim_key IS DISTINCT FROM b.claim_key
 OR c.claim_json#>>'{contentSplit,reviewStatus}' IS DISTINCT FROM 'reviewed'
 OR c.claim_json#>>'{platformQualityAudit,classification}' IS DISTINCT FROM CASE WHEN b.id='92125e61-820d-4403-a106-0e4b2f67038b'::uuid THEN 'verified_short_platform' ELSE 'verified_repair' END) THEN
 RAISE EXCEPTION 'Production baseline bridge did not finish an identity-matched verified repair: %', (SELECT jsonb_agg(jsonb_build_object('id',b.id,'expectedPerson',b.person_id,'person',c.person_id,'expectedCandidate',b.candidate_id,'candidate',c.candidate_id,'keyMatches',c.claim_key=b.claim_key,'split',c.claim_json#>>'{contentSplit,reviewStatus}','class',c.claim_json#>>'{platformQualityAudit,classification}')) FROM release_source_baselines b LEFT JOIN public.person_claims c ON c.id=b.id);
 END IF;
END $baseline_completion$;

COMMIT;
