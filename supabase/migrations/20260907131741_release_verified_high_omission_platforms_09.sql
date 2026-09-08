BEGIN;

DO $review$
DECLARE
    repair RECORD;
    affected_count INTEGER;
BEGIN
    FOR repair IN
        SELECT * FROM (VALUES
            (
                '059160b7-9ab1-4010-b8a8-0c42930b5ab0'::UUID,
                'abf2082c-c7c9-4493-aabd-cc9392298b9d'::UUID,
                '2ec28c65-dfde-4b8f-95b9-ec946c2d6fe8'::UUID,
                '41dea6a35847c70dbac6803c0b805d0c',
                'fd6d9065b4532c25d17b55e44e592ea8',
                393,
                $items$[
                    "推動高雄捷運延伸屏東，經台1線進入客家鄉鎮之環狀路廊，促進地方發展。",
                    "推動公墓遷葬種電，在綠電下增建體育休閒園區和公益設施。",
                    "推動汙水下水道接管率，改善河川汙染環境衛生。",
                    "推動建設客家鄉鎮交通網連結便捷性：185線沿山公路枋寮鄉（隆山村）至內埔鄉（隘寮村）高架快速道路並延伸國道3號。",
                    "推動建設客家鄉鎮交通網連結便捷性：『高雄－屏東第二東西向快速公路』延伸至內埔鄉境內為終點。",
                    "推動建設客家鄉鎮交通網連結便捷性：國道3號於竹田鄉南勢、頭崙段設立體交流道。",
                    "推動建設客家鄉鎮交通網連結便捷性：屏107線拓寬工程（內埔鄉文化路通往萬巒鄉五溝村道路）。",
                    "推動建設客家鄉鎮交通網連結便捷性：屏86線拓寬工程（內埔鄉豐田村至東勢村）。",
                    "推動建設客家鄉鎮交通網連結便捷性：屏85線拓寬工程（內埔鄉振豐村新東路並改善排水溝）。",
                    "推動建設客家鄉鎮交通網連結便捷性：開闢內埔鄉豐田地區都市計畫區15米外環道路。",
                    "推動龍頸溪、五溝村水系環狀水岸環境營造、淨水設施，發展聚落觀光。",
                    "加強整治區域排水功能；推廣在地滯洪，增加承洪韌性。"
                ]$items$::JSONB
            ),
            (
                'adcaaf12-8e2b-4fbb-a2b5-6d9fda543e29'::UUID,
                '79c23b82-d62f-45c5-b819-59b90e882b8e'::UUID,
                'f9ca8fcf-4be3-4254-8341-71ed29d22f55'::UUID,
                'd0a29ec708cbecf42c7f62a90f059860',
                'be3831cf844eef25424182c4ecca3de2',
                590,
                $items$[
                    "支持陳其邁市長的產業政策：創造高雄產業轉型，力爭台積電，催生橋頭科學園區，打造高雄時代。",
                    "支持陳其邁市長的社宅政策：面對高房價，積極興建社會住宅，並放寬社會住宅限制。",
                    "支持陳其邁市長的交通政策：規劃從高鐵進右昌、高雄大學、橋頭科學園區的捷運紫線。",
                    "支持陳其邁市長的交通政策：規劃左營楠梓段鐵路立體化。",
                    "支持陳其邁市長的交通政策：台積電（原中油）南側園區南路通翠華路到民族路；縫合左營楠梓交通，2020完成打通新莊一路銜接勝利路，縮短新舊部落距離；改善國道十號交流道，持續推動國十生活圈路網便捷性。",
                    "支持陳其邁市長的交通政策：新台17線到左營南門圓環全段已於2022經行政院協調，軍方定案，明年動工，拼2025全線通車。",
                    "支持陳其邁市長的交通政策：翠華路拓寬10公尺。",
                    "友善育兒環境，爭取政府編列育兒津貼到每月五千元，推動非營利及公立幼兒園，減輕年輕家庭負擔。",
                    "將兒童共融遊具搬入藍田公園、右昌森林公園、國昌公園、清豐公園、福山公園、蓮池潭兒童公園。",
                    "監督楠仔坑運動中心2024年如期啟用，並爭取到外環步道，給楠仔坑市民朋友散步。",
                    "打造溫暖、疼惜長輩的友善城市，讓長輩在年輕人上班時間可以走出家門，到巷弄照護站兼顧健康與休閒。",
                    "保存左營在地眷村文化，結合見城計畫與眷村重整，打造左營眷村觀光資產，找回左營老記憶。",
                    "推動中油宿舍區的保存與未來，宏毅宿舍應做保留，宏南宿舍空間活化，與市政府合作產業住宅，給宿舍居民一個末來。"
                ]$items$::JSONB
            ),
            (
                '4a6da7e9-6f69-471f-88ac-a9f6ba7091d8'::UUID,
                'dd044d90-04e9-4419-be4f-74b3864c1a94'::UUID,
                '41db1cbd-ecb3-42cd-9e0c-76d9ddc89323'::UUID,
                '32a7025663e9e44a26d2e713d045a8df',
                'aa27260247223f2249655ac61814b739',
                182,
                $items$[
                    "簡化長照申請流程。",
                    "廣設托育，減輕家長的負擔。",
                    "推廣藝文活動，支持在地藝術家。",
                    "加速推行地方／行政機關支付e化。",
                    "解決『月經貧窮』，守護婦女權益。",
                    "整合社會資源，落實弱勢族群之生活。",
                    "增設完善人行道、自行車道，增加用路安全。",
                    "推行南投旅遊電子套票、促進觀光，增加觀光財。",
                    "青銀共生，創造新世代。",
                    "推展創客，提升南投軟實力。"
                ]$items$::JSONB
            ),
            (
                'eb9a9042-3511-4373-9db9-390a0e637761'::UUID,
                '941b6b2c-d225-40c3-b68f-86fcd05828f3'::UUID,
                '7d3d1590-f02b-4b25-a66a-bb800ed45b13'::UUID,
                '396461a9200cf599c6190f24f06635c1',
                'a5c6f62c9ca15fd45769cd7a450e7262',
                276,
                $items$[
                    "監督縣政：反對家族干政，建立廉能宜蘭縣政。",
                    "監督縣政：推動地方自治修法與立法。",
                    "增進婦女權益：建構零死角監視器網絡。",
                    "增進婦女權益：落實性別平等教育。",
                    "推動多元教育：強化各語系母語傳承。",
                    "推動多元教育：建立閒置教育資源使用機制。",
                    "推動多元教育：增設新住民及原住民族第二母語學習課程。",
                    "落實長輩樂齡生活：建立長青食堂特色。",
                    "落實長輩樂齡生活：提倡社區園藝與無毒菜園。",
                    "活化地方觀光：活化社區，強化社區自身特色。",
                    "活化地方觀光：完善公車路線與英語標示。",
                    "活化地方觀光：推動修正水域開放申請等相關法規。",
                    "活化地方觀光：結合現有民宿及周邊社區景點，建立特色套裝行程。"
                ]$items$::JSONB
            ),
            (
                'bfee0c02-8db3-4d9e-9915-4bcc44ef56e3'::UUID,
                '368d7251-58d5-4cdb-86e0-a91bc663a5df'::UUID,
                'da0871d4-a737-4a59-87db-3c29f69350e0'::UUID,
                'eab63721318bac0b3b2f0ea2e9c15d20',
                '0bee993bf92cc62fb7dcef983f29b700',
                213,
                $items$[
                    "加強縣內防災救難人員組織培訓：提高保險額度保障加倍。",
                    "加強縣內防災救難人員組織培訓：防護設備要升級。",
                    "加強縣內防災救難人員組織培訓：更新救難機具、守護縣民生命財產。",
                    "加強警察、消防、救難人員裝備升級。",
                    "整合社會福利資源：日間照顧服務。",
                    "整合社會福利資源：外籍配偶多元服務。",
                    "整合社會福利資源：兒童青少年學習。",
                    "整合社會福利資源：樂齡學習與傳承中心。",
                    "強化社區互動與聯結，設置社區福利餐廳與課輔教室。",
                    "加強青少年戶外體適能活動，補助設施及經費，爭取運動場地，以強健體魄。",
                    "加強校園安全。"
                ]$items$::JSONB
            ),
            (
                'd493a215-b575-4996-a520-b6195af0ed33'::UUID,
                '2ffa1d96-4a57-44b5-983f-805221f3281e'::UUID,
                'f07ed24e-ae36-4aad-9502-884c0cdcb579'::UUID,
                '24d18590a99334edfb9a68d2506007f6',
                '844b8a36778dee131144b95c89a64fa8',
                171,
                $items$[
                    "督促縣政府對於人民申請案件，建立透明查詢機制，以掌握時效。",
                    "打造南投一日生活圈，建構更便利的交通網絡。",
                    "推廣在地產業文化，結合休閒觀光，以利民益。",
                    "建請縣政府盤點公有土地，主動釋出，以共營方式提供地方創生、生產場域，留住青年。",
                    "重視長輩的身心照護，加強推動各項福利措施，營造友善環境讓老有所養、老有所依，人人能安居樂業。"
                ]$items$::JSONB
            )
        ) AS row(claim_id,person_id,candidate_id,source_md5,value_md5,value_length,items)
    LOOP
        UPDATE public.person_claims AS claim
        SET claim_json = pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(COALESCE(claim.claim_json,'{}'::JSONB),'{items}',repair.items,TRUE),
                    '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-09-20260907','reasonCodes','[]'::JSONB)),TRUE),
                '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-09-20260907','repair','official_bulletin_full_text_resplit','classification','verified_repair'),TRUE),
            updated_at=pg_catalog.now()
        WHERE claim.id=repair.claim_id
          AND claim.person_id=repair.person_id
          AND claim.candidate_id=repair.candidate_id
          AND claim.claim_type='platform'
          AND pg_catalog.md5(claim.source_url)=repair.source_md5
          AND pg_catalog.md5(claim.claim_value)=repair.value_md5
          AND pg_catalog.length(claim.claim_value)=repair.value_length
          AND claim.claim_json->>'platformText'=claim.claim_value
          AND claim.claim_json#>>'{contentSplit,reviewStatus}'='needs_review'
          AND claim.claim_json#>>'{platformQualityAudit,classification}'='confirmed_content_or_split_issue'
          AND claim.claim_json#>>'{platformQualityAudit,repair}'='recovered_missing_item_from_stored_source';
        GET DIAGNOSTICS affected_count=ROW_COUNT;
        IF affected_count<>1 THEN
            RAISE EXCEPTION 'Expected one platform update for %, found %',repair.claim_id,affected_count;
        END IF;
    END LOOP;
END
$review$;

DO $validate$
DECLARE validated_count INTEGER;
BEGIN
    WITH expected(claim_id,item_count) AS (VALUES
        ('059160b7-9ab1-4010-b8a8-0c42930b5ab0'::UUID,12),
        ('adcaaf12-8e2b-4fbb-a2b5-6d9fda543e29'::UUID,13),
        ('4a6da7e9-6f69-471f-88ac-a9f6ba7091d8'::UUID,10),
        ('eb9a9042-3511-4373-9db9-390a0e637761'::UUID,13),
        ('bfee0c02-8db3-4d9e-9915-4bcc44ef56e3'::UUID,11),
        ('d493a215-b575-4996-a520-b6195af0ed33'::UUID,5)
    )
    SELECT pg_catalog.count(*) INTO validated_count
    FROM expected
    JOIN public.person_claims AS claim ON claim.id=expected.claim_id
    WHERE pg_catalog.jsonb_array_length(claim.claim_json->'items')=expected.item_count
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
      AND claim.claim_json#>>'{contentSplit,releaseQuality,version}'='verified-high-omission-platforms-09-20260907'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='official_bulletin_full_text_resplit'
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='verified_repair';
    IF validated_count<>6 THEN
        RAISE EXCEPTION 'Expected six validated platform repairs, found %',validated_count;
    END IF;
END
$validate$;

COMMIT;
