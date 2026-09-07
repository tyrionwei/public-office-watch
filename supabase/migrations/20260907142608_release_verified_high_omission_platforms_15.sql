BEGIN;

DO $review$
DECLARE repair RECORD; affected_count INTEGER;
BEGIN
    FOR repair IN
        SELECT * FROM (VALUES
            ('6e45b6bb-b945-478b-b880-1257b464cc8d'::UUID,'3d811542-4709-409e-b133-8d40b1477b4c'::UUID,'d80e9a05-731d-42a8-a368-cd5ed55e197f'::UUID,'bf1c2c144c171e45bffbfedfc0036459','40ae1b553306e83bee16ceb6a6ef7207',353,'高雄景氣蕭條、風華不再，人口不增反減，尤其苓雅、新興、前金為最。紹庭提出「重振港都雄風三箭」、「安居樂業五大良方」。',$items$[
                "重振三箭｜交通：推動台灣高鐵南延至高雄車站，帶來豐沛人潮，以促進南高雄之發展。",
                "重振三箭｜產業：推動IC設計產業進駐「亞洲新灣區」，打造高雄「北台積、南IC」產業鏈，讓半導體產業延伸到南高雄，繁榮南高雄。",
                "重振三箭｜居住：加速市區危老大樓都更與改建，維護居住安全及美化城市景觀。",
                "安居五方：解決高雄空污問題，讓高雄人呼吸新鮮空氣。",
                "安居五方：廣設社會住宅，讓居者有其屋，落實居住正義。",
                "安居五方：增設日照、長青中心，顧老護幼，讓青壯市民無後顧之憂。",
                "安居五方：爭取警消人員福利，體恤辛勞，保障市民生命財產之安全。",
                "安居五方：拒絕市府隨意提高地價稅、房屋稅、污水費等，為市民看緊荷包。"
            ]$items$::JSONB),
            ('ddf580b9-92ca-4970-a73b-4b86b2a30c07'::UUID,'d40001ae-5431-41be-8f28-875b13e57155'::UUID,'968b0b4d-4680-44f8-b4d7-5c95ae915e56'::UUID,'9fdaba400c8d66d9d51207f4157ca11e','09d657eaf16bb3f7214eee34fa2a24bd',414,'為婦幼點燈，嫈珺正全力爭取：',$items$[
                "生育津貼一胎2萬以上，添購新生兒用品。",
                "每位產婦坐月子津貼1萬，保障產婦基礎營養。",
                "補助每位新生兒之安全座椅4千，保障嬰幼兒童乘車安全。",
                "讓全縣155間國中小營養午餐優化，從最低標案方式改成最有利標，讓學童吃更好。",
                "邀約跨局處把關學童交通車安全、稽查補習班師資良民證。",
                "不定期稽查校園飲水機濾心品質，學童喝得更安心。",
                "建置食農教育教學資源平臺，讓國產食材內容深入校園。",
                "繼續盤點地方需求，爭取中央與地方建設工程經費。",
                "舉辦法律座談會，與民共同提升法律知識。",
                "推動性平講座，同時支持18歲的青年爭取公民權。",
                "打造嘉義縣最大運動賽事「跑若飛天公盃路跑」，共創地方商機。",
                "推動社區營造、農村再生及地方創生，帶動地方多元發展。",
                "栽培地方學子成為舞蹈運動國手，將來為國爭光。",
                "復興朴子真人藝閣文化，維護地方傳統。"
            ]$items$::JSONB),
            ('1324dba3-bd10-4851-95cf-ec4e6ac6cfca'::UUID,'ee824add-3d6a-4d3b-a2c2-acc4fae63c55'::UUID,'e10b7be5-0649-48a1-ae8d-757fe464ba26'::UUID,'a1b73b51a1503a091ce173e80e6a932c','1deb4ed54ee1f7887ae93e19c7b42675',407,NULL::TEXT,$items$[
                "花蓮吉安鐵路高架雙軌電氣化（花蓮－吉安），108年已完成可行性評估，爭取吉安鄉段全程高架化。",
                "國土規劃，擴大花蓮土地利用價值及經濟效益，吉安鄉東側海岸線土地規劃為風景休閒區。",
                "大花蓮都市計畫，擴大吉安鄉、花蓮市、新城鄉都市計畫，以利地方繁榮發展。",
                "國土計畫新增宗教用地，補辦寺廟登記，比照工業輔導法辦理，以利宗廟納管與輔導。",
                "因天候異常，災難頻傳，基礎建設非常重要，地方防洪工程及排水系統，應確實規劃並爭取經費辦理。",
                "為照顧農民，增加資材補助，協助農業加工升級，鼓勵青年返鄉投入有機農業生產，扶植有機農業並結合觀光休閒，增加農民收益。",
                "落實照顧婦女、老人、殘疾、低收入戶及弱勢團體，結合社會資源，爭取閒置空間，成立老人日托中心，提供完善照顧及加強各社區關懷福氣站功能。",
                "黃馨期待以豐富完整的資歷及經驗，繼續營造花蓮，讓花蓮成為樂活友善、安全、養生、觀光、休閒的魅力城市。"
            ]$items$::JSONB),
            ('05cd932d-2d1c-4b05-a02a-2ce06835cf9d'::UUID,'b346dc00-d690-43ef-9545-24068fa10df3'::UUID,'7a65fdab-7456-4405-aa06-733b3c1d06e4'::UUID,'9ebc04a5f4d7e1af77f5076d9457578d','a8de2bfc3fb178a9ec5e610ae9b18ced',314,NULL::TEXT,$items$[
                "挺青年，紮根家鄉：簡化青創輔導申請程序。",
                "挺青年，紮根家鄉：落實勞動權益與性別友善。",
                "拼永續，宜居環境：台化廠區轉型都市新綠肺。",
                "拼永續，宜居環境：爭取增建特色共融式公園。",
                "拼永續，宜居環境：守護八卦山脈水土環境保持。",
                "整交通，以人為本：監督工程、減緩彰化交流道區域壅塞問題。",
                "整交通，以人為本：檢討不合理待轉、人本設計強化行人安全。",
                "續文化，觀光加值：推動台鐵宿舍村為國家級園區。",
                "續文化，觀光加值：加強住宿產業創造觀光新動能。",
                "新樂齡，在地安老：引介公私部門資源協助社區據點。",
                "新樂齡，在地安老：增加據點、不老健身房進入社區。",
                "好教養，親子共好：打造母語環境、提升外語教育資源。",
                "好教養，親子共好：新增0到3歲幼兒公共托育系統。",
                "好教養，親子共好：擴展兒童親子館服務內容與範圍。"
            ]$items$::JSONB),
            ('a5497a9a-b560-436d-b7f3-bada38074ab4'::UUID,'c97b365d-6112-4bd6-8038-bfc9dc5c0304'::UUID,'b699d590-d1df-4f77-8d4f-542a6debbb0b'::UUID,'56082fb9c77ce6f13a8be5ddfc1aa268','06318a43c05cfb0bdea503ff68af2720',407,'市政歷練和教育博士，最專業認真的民意代表。市政府歷練近8年，目前擔任議員，具有教育專業，勇敢為民發聲、爭取建設！',$items$[
                "建設板橋，說到做到，絕不割稻尾：任職議員期間爭取到新北首座天幕籃球場、公園體健設施、道路開闢、人行道改善、社區污水下水道接管、更新學校設備等建設。未來至中央爭取更多預算，積極建設板橋。",
                "加速推動都市更新。",
                "浮洲區盡快通過都市計畫，興建污水下水道。",
                "發揮教育專業，改善教育政策。",
                "檢討教育制度，讓孩子快樂學習，支持多元社團活動。",
                "讓長輩得到更好的照顧：元之博士論文研究活躍老化，會給長輩最高的尊重，改良長照制度，提升長者休閒設施，增設優質養老院，申請看護免巴氏量表。",
                "翻轉國會，不做黨意立委。",
                "立委職責是監督政府，不管哪一黨執政，都會勇敢為民發聲。",
                "修法杜絕詐騙，守護人民辛苦血汗錢。",
                "強健電網，不要動不動停電；推動電線桿下地。",
                "檢討交通記點制度，推動友善人本交通，取消區間測速。"
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
                    '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-15-20260907','reasonCodes','[]'::JSONB)),TRUE),
                '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-15-20260907','repair','official_bulletin_full_text_resplit','classification','verified_repair'),TRUE),
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
        ('6e45b6bb-b945-478b-b880-1257b464cc8d'::UUID,8),
        ('ddf580b9-92ca-4970-a73b-4b86b2a30c07'::UUID,14),
        ('1324dba3-bd10-4851-95cf-ec4e6ac6cfca'::UUID,8),
        ('05cd932d-2d1c-4b05-a02a-2ce06835cf9d'::UUID,14),
        ('a5497a9a-b560-436d-b7f3-bada38074ab4'::UUID,11)
    )
    SELECT pg_catalog.count(*) INTO validated_count
    FROM expected JOIN public.person_claims AS claim ON claim.id=expected.claim_id
    WHERE pg_catalog.jsonb_array_length(claim.claim_json->'items')=expected.item_count
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
      AND claim.claim_json#>>'{contentSplit,releaseQuality,version}'='verified-high-omission-platforms-15-20260907'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='official_bulletin_full_text_resplit'
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='verified_repair';
    IF validated_count<>5 THEN RAISE EXCEPTION 'Expected five validated platform repairs, found %',validated_count; END IF;
END
$validate$;

COMMIT;
