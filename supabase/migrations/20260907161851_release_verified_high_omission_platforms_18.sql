BEGIN;

-- Bridge exact production pre-repair texts to the audited migration baseline.
-- This stays inside the release transaction: the final repair must succeed.
CREATE TEMP TABLE release_source_baselines (id uuid PRIMARY KEY, person_id uuid NOT NULL, candidate_id uuid, claim_key text NOT NULL, production_text text NOT NULL, audited_text text NOT NULL) ON COMMIT DROP;
INSERT INTO release_source_baselines VALUES
('883dd346-ad09-49a4-8be3-c9804677343b'::uuid,'f7f9f5ef-5906-4e4d-95f9-35cdb76c4c77'::uuid,'2b753682-8ead-4110-9de4-06c115c9abdc'::uuid,'cec-platform:2022:votetw-candidate-00706466d37ae9c0','一、 教育優先 : 活化教育內涵、 適性揚才
二、 文化多元 : 彰顯多元文化、 在地融合
三、 產業發展 : 促進農業永續、 工商協進
四、 婦幼關懷 : 構築安全家園、 婦幼安心
五、 長者照護 : 爭取長照 20、 老有所養
六、 環境永續 : 把關自然資源、 宜家宜居
七、 青年創業 : 打造友善環境、 青創圓夢
八、 宗教觀光 : 推廣宗教文化、 行銷雲林
FB、LINE、I( 請搜尋關鍵字 「蔡岳儒」
YT 請搜尋黃儒 + 蔡
回好好回 [ERA ARE] EEE
1s
和 Sian','一、教育優先：活化教育內涵、適性揚才
二、文化多元：彰顯多元文化、在地融合
三、產業發展：促進農業永續、工商協進
四、婦幼關懷：構築安全家園、婦幼安心
五、長者照護：爭取長照2.0、老有所養
六、環境永續：把關自然資源、宜家宜居
七、青年創業：打造友善環境、青創圓夢
八、宗教觀光：推廣宗教文化、行銷雲林'),
('9943d1ca-112e-4124-b25b-705b0bf15b03'::uuid,'2fda7100-b6f8-41e9-953c-dd7efe371fd4'::uuid,'3d1a72f2-9b7a-47ba-a013-a05131c443b8'::uuid,'cec-platform:2022:votetw-candidate-cd86c386824d1d9c','1. 繼續推動小東工業區休閒運動中心 (設計已進入審查 A
階段約6億) —~A Size
2. 爭取五福公園地下化停車場及街內六里的活動中心 “SHSRTA Ags
(納入前瞻計劃)
3. 督促縣府爭取 158乙永光路拓寬工程經費 (已完成可 V\ -- Sate
行性評估約7.5億) —\ =) Ee
4. 爭取經費改善斗南火車站前,閒置10多年的地下停_ SP Syl
車空間,成為機慢車停車場 (已進入設計階段) Y 和回
5. 爭取經費改善大埤農水路問題 Rs
6. 推動華山觀光基礎建設','1. 繼續推動小東工業區休閒運動中心（設計已進入審查階段，約6億）
2. 爭取五福公園地下化停車場及街內六里的活動中心（納入前瞻計劃）
3. 督促縣府爭取158乙永光路拓寬工程經費（已完成可行性評估，約7.5億）
4. 爭取經費改善斗南火車站前閒置10多年的地下停車空間，成為機慢車停車場（已進入設計階段）
5. 爭取經費改善大埤農水路問題
6. 推動華山觀光基礎建設'),
('d886f0f8-a16b-49a4-ab33-8ff0cc822c9b'::uuid,'17c9f3e3-d292-42c3-a418-8a76883a8a8f'::uuid,'9e7894a1-8563-4eb6-8707-0c1463979be3'::uuid,'cec-platform:2022:votetw-candidate-2bb0fbb8775e1bf0','ELECT ice annie Esme
EXE] =cacsnas a ny
EEE) susscmuagn | ve (4
ECE) cians >
EXIT IL) iisknasnmnse nN
BEET TL a titas crams 和
爭取機車路權用四和 NL
CREE EEE REE PE RS','1. 安心移居竹北：讓年輕人能夠安心定居竹北。
2. 公共托育：減輕年輕父母的負擔。
3. 打造孩童的空間：爭取更多公園與婦幼館。
4. 安心回家的路：全面監督路平。
5. 大眾運輸提升：加速推動公車與輕軌路網。
6. 人本交通城市：讓竹北成為步行友善城市。
7. 爭取機車路權：消弭車種歧視。');
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
DECLARE repair RECORD; affected_count INTEGER;
BEGIN
    FOR repair IN
        SELECT * FROM (VALUES
            ('ffb55e60-d2e9-481b-96ed-43c5fd20861b'::UUID,'9503926c-a05b-4c18-a0e3-e614f2c4429d'::UUID,'c8b069f2-7510-4746-80a8-5ef9c4baa5d1'::UUID,'80b8ea0388e1b267d2dbbf50ced0cf2f','b5571f9e9dc14d929a713b4eba0446be',308,NULL::TEXT,$items$[
                "教育推廣更普及：持續推動國家兒童未來館的建置。",
                "教育推廣更普及：程式及語言教育向下紮根。",
                "教育推廣更普及：持續推行公共托育中心及公立附設幼兒園的建置。",
                "教育推廣更普及：持續優化教學環境：校舍補強、老舊校舍改建，完成班班有冷氣。",
                "生活品質更提升：設置專款基金，補貼青年弱勢族群租金。",
                "生活品質更提升：優化長者照護及推廣優質課程。",
                "生活品質更提升：發展新創事業及招商，增加就業機會。",
                "生活品質更提升：爭取建置新北表演中心，推廣優質藝文活動。",
                "城市發展再進化：有效改善污水下水道工程。",
                "城市發展再進化：持續推動老舊社區都更，改善市容。",
                "城市發展再進化：推動電桿電纜地下化，整頓市容。",
                "城市發展再進化：增闢停車空間解決停車問題。",
                "城市發展再進化：持續持動泰板經浮洲輕軌，完成三環六線最後一塊拼圖。",
                "城市發展再進化：爭取建置體育局及資訊局。"
            ]$items$::JSONB),
            ('d886f0f8-a16b-49a4-ab33-8ff0cc822c9b'::UUID,'17c9f3e3-d292-42c3-a418-8a76883a8a8f'::UUID,'9e7894a1-8563-4eb6-8707-0c1463979be3'::UUID,'04ff03ad011ec752edf9b2803b492b5f','f0984cf260f1f0a01bd8418a975c3416',147,NULL::TEXT,$items$[
                "安心移居竹北：讓年輕人能夠安心定居竹北。",
                "公共托育：減輕年輕父母的負擔。",
                "打造孩童的空間：爭取更多公園與婦幼館。",
                "安心回家的路：全面監督路平。",
                "大眾運輸提升：加速推動公車與輕軌路網。",
                "人本交通城市：讓竹北成為步行友善城市。",
                "爭取機車路權：消弭車種歧視。"
            ]$items$::JSONB),
            ('883dd346-ad09-49a4-8be3-c9804677343b'::UUID,'f7f9f5ef-5906-4e4d-95f9-35cdb76c4c77'::UUID,'2b753682-8ead-4110-9de4-06c115c9abdc'::UUID,'c6d4c222f71a11ad03d65f6f3d9c5215','8650bd30e6b2a3b1ebd402f63bd60b1c',152,NULL::TEXT,$items$[
                "教育優先：活化教育內涵、適性揚才",
                "文化多元：彰顯多元文化、在地融合",
                "產業發展：促進農業永續、工商協進",
                "婦幼關懷：構築安全家園、婦幼安心",
                "長者照護：爭取長照2.0、老有所養",
                "環境永續：把關自然資源、宜家宜居",
                "青年創業：打造友善環境、青創圓夢",
                "宗教觀光：推廣宗教文化、行銷雲林"
            ]$items$::JSONB),
            ('9943d1ca-112e-4124-b25b-705b0bf15b03'::UUID,'2fda7100-b6f8-41e9-953c-dd7efe371fd4'::UUID,'3d1a72f2-9b7a-47ba-a013-a05131c443b8'::UUID,'bf2aa422232671bf184dd1ccad519f4d','6d2ecf75e188a9b84552f9ac5fd0a3f4',184,NULL::TEXT,$items$[
                "繼續推動小東工業區休閒運動中心（設計已進入審查階段，約6億）",
                "爭取五福公園地下化停車場及街內六里的活動中心（納入前瞻計劃）",
                "督促縣府爭取158乙永光路拓寬工程經費（已完成可行性評估，約7.5億）",
                "爭取經費改善斗南火車站前閒置10多年的地下停車空間，成為機慢車停車場（已進入設計階段）",
                "爭取經費改善大埤農水路問題",
                "推動華山觀光基礎建設"
            ]$items$::JSONB),
            ('f7bef694-3c7e-4779-855f-958d78934f44'::UUID,'f53bbf66-10d0-4a71-9318-340ad83c2127'::UUID,'437e6369-f32b-44e4-a64f-be460959ef48'::UUID,'880f25e91d752e0ce18c9a125a5befa9','d263e4361c5abc6a2105afb40eb259d7',635,NULL::TEXT,$items$[
                "讓愛繼續！ 票投淑君阿姨，就會幫您捐出每張選票的補助款30元，幫助林口、五股、泰山地區需協助的孩子，歷屆捐款共已累計626萬！",
                "5G服務(積極‧雞婆‧績效‧機動‧機智)有口皆碑！淑君阿姨專線~0952588598效率第一！",
                "督促市府116年以前，完成塭仔圳1.2期重劃工程。",
                "督促相關單位加速審議五股、泰山輕軌工程。",
                "支持市府建設26公頃貴子坑溪河川環境營造，打造「泰山溫仔圳-新北之心」。",
                "持續爭取「機捷票價」納入1280元方案，減輕通勤負擔並鼓勵搭乘大眾運輸和減少車流。",
                "督促加速發包林口A交流道「南出北入」立體化工程。",
                "爭取擴大林口鄰近交流道市地重劃範圍，以利於增設第三交流道之腹地使用和籌措經費並可大幅改善聯外交通。",
                "督促105市道(林口高爾夫球場到八里)環狀高架及A3.40米計劃道路(後湖&中華路文化北路口)如期通車。",
                "爭取108市道宏昌街往長道坑口以及南福路口往蘆竹的拓寬工程。",
                "持續推動「幸福到你家」計劃，主動送愛給長輩即時的關懷！",
                "督促興建南勢國中和爭取文小五設校，以便利就近就學並繼續增設公托、幼兒園。",
                "持續推動為愛貓愛犬健檢植晶片及施打狂犬病疫苗和鼓勵認養。",
                "督促林口污水處理廠二期工程如期完工。",
                "爭取公共自行車2.0租賃站設置，提供大眾運輸最後一哩路服務，向綠能、環保、減碳、 健康目標邁進。",
                "淑君阿姨將繼續全力支援選區內大小防疫工作！疫情期間共已募集捐贈1100萬 。"
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
                    '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-18-20260908','reasonCodes','[]'::JSONB)),TRUE),
                '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-18-20260908','repair','official_source_full_text_resplit','classification','verified_repair'),TRUE),
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
        ('ffb55e60-d2e9-481b-96ed-43c5fd20861b'::UUID,14),
        ('d886f0f8-a16b-49a4-ab33-8ff0cc822c9b'::UUID,7),
        ('883dd346-ad09-49a4-8be3-c9804677343b'::UUID,8),
        ('9943d1ca-112e-4124-b25b-705b0bf15b03'::UUID,6),
        ('f7bef694-3c7e-4779-855f-958d78934f44'::UUID,16)
    )
    SELECT pg_catalog.count(*) INTO validated_count
    FROM expected JOIN public.person_claims AS claim ON claim.id=expected.claim_id
    WHERE pg_catalog.jsonb_array_length(claim.claim_json->'items')=expected.item_count
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
      AND claim.claim_json#>>'{contentSplit,releaseQuality,version}'='verified-high-omission-platforms-18-20260908'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='official_source_full_text_resplit'
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='verified_repair';
    IF validated_count<>5 THEN RAISE EXCEPTION 'Expected five validated platform repairs, found %',validated_count; END IF;
END
$validate$;


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
