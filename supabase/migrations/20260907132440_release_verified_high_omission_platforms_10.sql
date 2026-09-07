BEGIN;

DO $review$
DECLARE repair RECORD; affected_count INTEGER;
BEGIN
    FOR repair IN
        SELECT * FROM (VALUES
            ('30312a75-dd49-4d1c-9351-4e2b48e803f7'::UUID,'3072766a-5917-44fc-94ad-89477bb0ec84'::UUID,'ead9f8cf-245a-42fe-845d-b8bb0358126f'::UUID,'9ebc04a5f4d7e1af77f5076d9457578d','019365e1cce179417788906854e45516',194,$items$[
                "監督縣政。",
                "推動彰化市東區盡速完成擴大都市計劃。",
                "推動彰化鐵路高架化工程早日動工。",
                "台中市捷運延伸至彰化市。",
                "支持警政、消防及防災預算，打擊犯罪，強化防災。",
                "老舊社區盡速更新。",
                "盡速解除高速公路特定區之限制。",
                "爭取婦女朋友福利，提升生育率，並支持增加婦女第二、第三胎生育補助及幼兒教育補助金。",
                "督促政府關懷婦幼安全及權益，弱勢族群照護，銀髮族身心保健。"
            ]$items$::JSONB),
            ('4cd0e0ca-8782-4858-a067-468e19d7a9ec'::UUID,'e978b4be-4f90-4c87-812a-cdb162b71be1'::UUID,'3d10a17a-c025-4eec-b945-0e78caea225d'::UUID,'58055c71e1a26d45840a61604d100e3c','0917e3a51d207faefab1a74975821613',301,$items$[
                "成功爭取建置寶業滯洪池遊戲場。",
                "持續推動鄰里公園成為特色公園，兼顧長輩與兒童發展與社區運動的共融理念。",
                "監督交通建設（輕軌、黃線捷運）不要有交通黑暗期。督促市府提出周延交通計劃、提供足夠停車空間，並與市民溝通。",
                "成功監督市府還債71億，持續監督市府減債績效。",
                "高雄要有好空氣，監督中區焚化廠如期於2025年除役。",
                "關心年輕人就業與創業，持續監督市府青創績效，協助在地青年圓夢。",
                "關心弱勢：持續督促市府將閒置空間轉為老人長照及幼兒托育的據點。",
                "關心弱勢：持續督促市府扶助弱勢家庭，法規鬆綁並整合公私資源落實之。",
                "反毒政見：持續打造無毒高雄，為毒品防制擔任反毒志工。"
            ]$items$::JSONB),
            ('0593d0c5-e868-4460-850a-6df9c6e4d35e'::UUID,'518bf5cd-e4be-4824-90a0-942b14efcca7'::UUID,'753cdbd7-f8fb-49df-aa19-a4fcc2eb35c4'::UUID,'a3bf12b9ff75e410822d4a336efd8c97','6aac0c5667fa3801535c081111381531',480,$items$[
                "候車空間改善：安樂沿線候車空間，過去四年顯著改善，長庚醫院站擴建、友善人行道，之豪將繼續監督改善。",
                "路平品質改善：麥金路示範道路計畫、基金一二三路改善計畫，皆在過去四年內陸續推動完工，之豪將繼續監督推動地下管線更換與路面改善。",
                "親子特色公園：過去四年，成功催生安樂三期（四維）親子公園；基隆市內尚有眾多公園空間安全、品質、可玩性有提升之空間，之豪將持續監督改善。",
                "監督基隆捷運：基隆捷運計畫在過去四年內升級為中運量捷運，目前已在綜合規畫階段，預計近期可完成報部報院進行核定。屆時，捷運與基隆各區之間的接駁方案，將會決定基隆市未來之通勤模式，之豪將持續監督捷運進度。",
                "推動國際交流：過去四年，台灣躍升國際矚目焦點；基隆市在後疫情時代需要積極拓展國際交流，不僅是商機，更是城市發展之關鍵。之豪將持續監督基隆的國際交流。",
                "推動行政改革：基隆市行政制度需要在國土規劃與區域整合下，審慎重新思考各種可能性。基隆未來發展之利基關鍵為能否有效創建有效率之機構單位，吸引優質行政擘劃官僚，處理捷運與新市鎮發展之複雜課題，之豪將持續監督行政改革。"
            ]$items$::JSONB),
            ('52978743-36d0-4f5b-a8ae-6a92d9b9eff0'::UUID,'0c0232df-8fed-42ef-b806-c271a327e14d'::UUID,'9b26a58f-23fb-41c3-ab31-39ef97967c01'::UUID,'8e8aff945d7cfcdab69d89455ae3dccc','ce4c0459840e866c3916e60b2a88d868',200,$items$[
                "落實老人長期照護、日間照護及社區老人食堂開辦。",
                "振興山區觀光產業，建設經濟、特色之旅遊動線規劃。",
                "保護農民特殊產業推廣，青年返鄉種植各項優惠方案。",
                "推行閒置空間再利用，創造更多生活學習運動空間。",
                "推廣公共托嬰政策，減輕青年成家負擔。",
                "選區內路平、排水、平坦順暢，讓回家之路安全，讓生命財產得以保障。",
                "融入地方文化，推廣13庄頭嘉年華會。",
                "關懷弱勢權益，保障勞工權利。"
            ]$items$::JSONB),
            ('297e28ec-4cc0-4ba0-9624-9350f0b25f44'::UUID,'e2920a30-0b27-430d-b644-3b5cb5601ce6'::UUID,'f4a7a161-ffe9-43b5-9c27-223ee8af8977'::UUID,'82865ce2268c19825c84c7f714a21bd7','bf08c20d54cace515c5eafb8df71bcf8',202,$items$[
                "爭取全縣生育補助津貼。",
                "爭取弱勢老年人社會福利補助。",
                "萬丹、新園區域排水規劃改善。",
                "東港第一排水渠道規劃整修。",
                "推廣有機農漁業邁向國際化。",
                "即早完成烏龍大排、改善南龍大橋橋面低陷，儘速改造完成。",
                "發展海灣城市觀光文化交流，增加年輕人就業機會。",
                "萬丹、新園、東港三鄉鎮地方建設未完成部份繼續爭取。",
                "爭取大烏龍、港西西線低窪地區增設大型排水溝再匯入台17線下水道。"
            ]$items$::JSONB)
        ) AS row(claim_id,person_id,candidate_id,source_md5,value_md5,value_length,items)
    LOOP
        UPDATE public.person_claims AS claim
        SET claim_json=pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(COALESCE(claim.claim_json,'{}'::JSONB),'{items}',repair.items,TRUE),
                    '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-10-20260907','reasonCodes','[]'::JSONB)),TRUE),
                '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-10-20260907','repair','official_bulletin_full_text_resplit','classification','verified_repair'),TRUE),
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
        IF affected_count<>1 THEN RAISE EXCEPTION 'Expected one platform update for %, found %',repair.claim_id,affected_count; END IF;
    END LOOP;
END
$review$;

DO $validate$
DECLARE validated_count INTEGER;
BEGIN
    WITH expected(claim_id,item_count) AS (VALUES
        ('30312a75-dd49-4d1c-9351-4e2b48e803f7'::UUID,9),
        ('4cd0e0ca-8782-4858-a067-468e19d7a9ec'::UUID,9),
        ('0593d0c5-e868-4460-850a-6df9c6e4d35e'::UUID,6),
        ('52978743-36d0-4f5b-a8ae-6a92d9b9eff0'::UUID,8),
        ('297e28ec-4cc0-4ba0-9624-9350f0b25f44'::UUID,9)
    )
    SELECT pg_catalog.count(*) INTO validated_count
    FROM expected JOIN public.person_claims AS claim ON claim.id=expected.claim_id
    WHERE pg_catalog.jsonb_array_length(claim.claim_json->'items')=expected.item_count
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
      AND claim.claim_json#>>'{contentSplit,releaseQuality,version}'='verified-high-omission-platforms-10-20260907'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='official_bulletin_full_text_resplit'
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='verified_repair';
    IF validated_count<>5 THEN RAISE EXCEPTION 'Expected five validated platform repairs, found %',validated_count; END IF;
END
$validate$;

COMMIT;
