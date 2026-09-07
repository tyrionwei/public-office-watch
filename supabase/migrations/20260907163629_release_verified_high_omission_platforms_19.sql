BEGIN;

DO $review$
DECLARE repair RECORD; affected_count INTEGER;
BEGIN
    FOR repair IN
        SELECT * FROM (VALUES
            ('41236b3c-8036-4e4e-909e-c266122f8a25'::UUID,'83c02535-6d15-4203-8d94-11bbbf4d653c'::UUID,'0c3d5e20-eb70-4cbb-92c3-c24cf9544bee'::UUID,'978bac3473b8ced94768658e4f543870','5f2524b0a2c25bacafd45639fb492b1c',218,'社頭、田中、二水有山有水有人情味。但這裡少了年輕人的聲音！少了年輕人共同參政。妤亘願意為鄉親請願與發聲，貢獻年輕的熱情與創意。監督政府，建議政府，全心照顧這片土地。'::TEXT,$items$[
                "交通運輸、環境生態、社區設施，硬體要用心。",
                "社會安全、婦女權益、育兒教養，軟體要貼心。",
                "產業招商、青年創業、投資環境，經營要有心。",
                "長者照顧、弱勢福利、長照發展，服務要愛心。"
            ]$items$::JSONB),
            ('31d0bd63-eb57-4730-b05c-f27e67c99fe9'::UUID,'0d5088e5-c898-43b3-bf95-e3988d87cccd'::UUID,'9e4cd494-49c3-4b3c-838a-2079db0ab793'::UUID,'adac17a78dab24f35b979b818a16cd6a','7629252955eb4d494d6d51d7fd0194d1',506,NULL::TEXT,$items$[
                "持續捐血、做志工，推動社會善良風，帶動民代優質服務。",
                "持續堅持三不：不交際、不應酬、不包工程，全職服務、監督市府。",
                "已完成太平市民大道打通，持續打通各地巷道，改善交通。",
                "已建制全市最多路口監視器及停車場設置(育賢路 900 格停車位)，持續爭取充電樁改善太平區治安及停車不足問題。",
                "持續推動路平專案整合管線施工(已完成多數人孔蓋下地)，以減少道路修修補補問題，以保障人民行的安全。",
                "已完成多處滯洪池興建，持續督促市政府改善太平區域排水，以解決強降雨淹水問題，保障市民安全。",
                "持續爭取公車候車亭興建及公車串聯讓公車族更方便。",
                "持續督促市府培訓失業勞工第二就業專長及多舉辦就業徵才活動，以改善失業勞工就業問題。",
                "推動有利民生法案及政策，爭取綠地公園設施(已完成多處公園公廁、兒童運動器械及體健設施) 完成太平美樂地造福鄉里。",
                "持續督促市府輔導農民發展精緻農業，改善農業發展、增加農民收入，打造太平成為台中的小瑞士。",
                "持續督促市府寬列預算，充實警察、消防及救災人員之裝備設備，以維護第一線救災值勤人員之安全。",
                "關懷長者已完成社區活動中心修繕及改建，讓長者有休閒去處。"
            ]$items$::JSONB),
            ('2876ea23-53ea-4ca2-9ab3-bc59013d7999'::UUID,'3b4e68fa-56ae-4743-904f-3492805f943b'::UUID,'9d54ed2a-7c41-4a88-b05a-9ab2512567b8'::UUID,'a6142f5040e56b1b8cb264717a92d73d','4b7e289c075429a47f990d7effe3a1a3',383,NULL::TEXT,$items$[
                "優化雙語教育，提倡運動培養、幼兒美感教育學習。",
                "打造樂活公共空間和戶外公園，推動分齡、共融、性別友善的活動場域。",
                "力促新莊第二運動中心成立。",
                "推動青年友好政策，成立國際級的青年創業研發基地。",
                "提早規劃塭仔圳社福用地，提高青年社宅數量並放寬申請條件。",
                "營造性別友善公共場域，設置第一座性別友善標章廁所在新莊。",
                "弱勢保護友愛，爭取婦女保障權益，以及新住民協助輔導。",
                "公共空間美感改造設計，兼具複合式、多功能用途。",
                "寵物友善環境，爭取合格的毛孩運動場，推動動物飼養指南。",
                "改善道路和巷弄行車、行人安全，建構安全、無礙的通學廊道。",
                "平衡南北交通，增設公車路線，推動智慧電動公車，加速輕軌進程。",
                "推動地方創生2.0，發展城市價值與定位。",
                "催生塭仔圳新都心，結合性平、全齡、青年友善概念，打造為聯合國永續發展指標區域。"
            ]$items$::JSONB),
            ('0e904b1b-f02c-48fc-bef2-ef9698b2c327'::UUID,'4f75873b-c72c-4d30-8c45-b9a14affc86a'::UUID,'fe78022b-73ee-4b21-8705-f90b6db09708'::UUID,'5e989e4d478e4f57d3f6d1a862837c13','3aa9c65b819bf78b33318e6833a24729',509,'衣鳯在任內關注智慧農業、循環經濟的發展，並致力於推動青年返鄉、產業升級，為地方爭取各項建設，為民眾爭取各種福利；衣鳯有能力、有信心，跟鄉親一起建立更美好的家園。'::TEXT,$items$[
                "發展智慧農業，推動農業轉型升級：保障農民福利，爭取各種補助。",
                "發展智慧農業，推動農業轉型升級：導入智慧農工，提高農業產值。",
                "發展智慧農業，推動農業轉型升級：打通農業產銷國際及兩岸通路。",
                "發展智慧農業，推動農業轉型升級：加速及擴大農業廢棄物再利用。",
                "持續整治東螺溪，展現豐富的水岸風華：在立委任內爭取到7.66億元的「東螺溪水環境改善計畫」，東螺溪不只是生態候鳥的廊道，也是畜牧廢水循環利用的場域，更是智慧農業升級的示範點，未來東螺溪有豐富的水岸風華。",
                "活絡地方經濟，促進勞工就業：推動循環經濟，讓經濟環境雙贏。",
                "活絡地方經濟，促進勞工就業：推動產業園區蓬勃發展，吸引民眾返鄉就業。",
                "活絡地方經濟，促進勞工就業：透過地方創生，活絡在地經濟。",
                "活絡地方經濟，促進勞工就業：結合地方特色，打造觀光新亮點。",
                "重視偏鄉教育，照顧弱勢與關懷社會：修正《教師待遇條例》、落實《偏遠地區學校教育發展條例》，充實偏鄉教育的師資與資源。",
                "重視偏鄉教育，照顧弱勢與關懷社會：持續推動關懷據點，強化在地照顧服務。",
                "重視偏鄉教育，照顧弱勢與關懷社會：協助減輕弱勢家庭的負擔。",
                "重視偏鄉教育，照顧弱勢與關懷社會：推動銀髮族適用的福利設備與服務。",
                "重視偏鄉教育，照顧弱勢與關懷社會：打造友善生育環境。"
            ]$items$::JSONB),
            ('bfd69eb3-5753-4e0c-b24a-2aaca0c078a0'::UUID,'25cb124a-4947-4a7d-9f48-dfe9920c91ea'::UUID,'e39b534e-3518-4987-80ad-b8a765280a52'::UUID,'46fa347a49d6c5e319ecc8a77ac555a3','47ea8fa77b367499367502657dcc4b40',718,'市政成績單滿滿：地方建設、會勘、協調合計上萬件！問政溫和、理性，做事不作秀。佩玲主張：'::TEXT,$items$[
                "爭取定點臨時托育：爭取一區一臨時托育據點，成功爭取士林臨托中心，減輕育兒負擔。爭取跨縣市托育、幼教補助，擴大公共托育供給。",
                "強化校園安全：耐震工程補強、補足電子圍籬：全台北市校園防震工程跟電子圍籬，達成率已達到99% 以上，持續監督電子圍籬優化，家長更安心。成功爭取酷課雲無障礙專區、啟明學校設立ATM、保護特殊生權益。",
                "落實國中小情感教育，推動全市超過三十所學校參與及教案補助，培養孩子情緒智能，社會問題從根本解決。",
                "顧民生：擴大敬老卡使用項目：成功開放運動中心使用，未來持續爭取擴大至西醫、中醫保健，增加臨時托老據點。",
                "健全租屋市場：監督「租賃住宅市場展及管理條例」執行，保障房客方權益。",
                "強化青年政策，創造友善職場, 勞動權：加速推動公宅：積極強化新創及微政策。",
                "完善動保政策，關懷毛小孩，打造友善動物城市：成功爭取福順狗公園，推動寵物友善場域；監督改善收容空間。",
                "社子島拆遷安置，監督社子島開發：爭取周全的「安置」計畫及執行：成功爭取65 歲以上弱勢戶安置一輩子，持續爭取安置條件優化、放寬。",
                "爭取新創中心：監督市府於北投士林科技園區之開發，爭取功能最完善之新創中心，增加地方經濟動能及降低青年負擔，創造青年就業機會。",
                "推動落實智慧城市：要求落實電子化政府，成功爭取早療兒補助線上請領，市民線上申辦業務更方便，質詢監督市府低效系統、網頁，提升臺北市數位競爭力。",
                "強化雙語教育，協助多所學校推進雙語時程，監督市府擴充國小雙語教育、外語師資及環境，提升下一代國際競爭力。"
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
                    '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-19-20260908','reasonCodes','[]'::JSONB)),TRUE),
                '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-19-20260908','repair','official_source_full_text_resplit','classification','verified_repair'),TRUE),
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
        ('41236b3c-8036-4e4e-909e-c266122f8a25'::UUID,4),
        ('31d0bd63-eb57-4730-b05c-f27e67c99fe9'::UUID,12),
        ('2876ea23-53ea-4ca2-9ab3-bc59013d7999'::UUID,13),
        ('0e904b1b-f02c-48fc-bef2-ef9698b2c327'::UUID,14),
        ('bfd69eb3-5753-4e0c-b24a-2aaca0c078a0'::UUID,11)
    )
    SELECT pg_catalog.count(*) INTO validated_count
    FROM expected JOIN public.person_claims AS claim ON claim.id=expected.claim_id
    WHERE pg_catalog.jsonb_array_length(claim.claim_json->'items')=expected.item_count
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
      AND claim.claim_json#>>'{contentSplit,releaseQuality,version}'='verified-high-omission-platforms-19-20260908'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='official_source_full_text_resplit'
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='verified_repair';
    IF validated_count<>5 THEN RAISE EXCEPTION 'Expected five validated platform repairs, found %',validated_count; END IF;
END
$validate$;

COMMIT;
