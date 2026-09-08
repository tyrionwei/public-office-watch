BEGIN;

DO $review$
DECLARE repair RECORD; affected_count INTEGER;
BEGIN
    FOR repair IN
        SELECT * FROM (VALUES
            ('7566783b-0637-4228-a61c-07262019e640'::UUID,'e79f1b88-6248-4bea-ac6b-7f0c0e7b6f96'::UUID,'a98820af-fa15-4598-9795-dc82db419688'::UUID,'c96e1c5c1df162f52e30f85815f08974','7c9dad58916d4e430b45e2363afa5034',663,NULL::TEXT,$items$[
                "台灣國家正常化：修改政黨法，政黨名稱不得冠有他國國名，或足以使人誤認為他國之政黨。",
                "台灣國家正常化：推動國營事業及機關正名，鞏固台灣主體性。",
                "台灣國家正常化：訂定中共代理人法，嚇阻中國滲透。",
                "民主鞏固與深化：檢討區域及不分區立委名額，充分反映多元民意。",
                "民主鞏固與深化：立法院應邀請總統進行國情報告，依憲法精神不答詢。",
                "民主鞏固與深化：縣市議會增設不分區政黨代表席次，以利青年及專業人士參政。",
                "社會安定、保障民生：打詐用重法，電信公司應建立查核及調查機制，如有疏失應負連帶賠償責任。",
                "社會安定、保障民生：提高公糧收購價格，每公斤增加3元，每4年定期檢討；公糧收購納入有機米。",
                "社會安定、保障民生：各類社會保險投保年資併計，政府應負最終給付責任。",
                "宜蘭關鍵、黃金十年：堅決反對重啟核四。",
                "宜蘭關鍵、黃金十年：督促未來5年6,000億元建設：改善國五壅塞：北宜高鐵10年完工，爭取第二條北宜快速道路（台62線），台北－礁溪55分鐘。",
                "宜蘭關鍵、黃金十年：督促未來5年6,000億元建設：加速完成鐵路高架。",
                "宜蘭關鍵、黃金十年：督促未來5年6,000億元建設：加速台2庚山腳觀光道路開闢。",
                "宜蘭關鍵、黃金十年：督促未來5年6,000億元建設：加速國5銜接蘇花改，解決蘇澳市區塞車；東澳－南澳路廊截彎取直，蘇澳到花蓮1小時。",
                "宜蘭關鍵、黃金十年：督促未來5年6,000億元建設：加速縣內四縱六橫交通路網建構。",
                "宜蘭關鍵、黃金十年：督促未來5年6,000億元建設：T-PASS通勤月票常態化。",
                "宜蘭關鍵、黃金十年：爭取陽交大醫學院遷校宜蘭，增加經費改善醫療設施，提升醫療品質成為醫學中心。",
                "宜蘭關鍵、黃金十年：爭取成立「宜蘭國家風景區管理處」，推動宜蘭溫泉大縣計畫，發展觀光。",
                "宜蘭關鍵、黃金十年：爭取老舊漁船收購、釋出船席，發展海上休閒運動。",
                "宜蘭關鍵、黃金十年：爭取宜蘭治山防災及橋梁改建，加速蘇澳分洪道工程、農路、野溪整治。",
                "宜蘭關鍵、黃金十年：督促農業部應優先價購收回保安林地承租權，以保障林農權益。"
            ]$items$::JSONB),
            ('8c7bd277-3bb7-435c-8469-e214d9d4da88'::UUID,'32e6597a-ffe6-4dbb-a66f-7d4292276952'::UUID,'1c670438-1a02-4403-81a5-7942b4764b6e'::UUID,'f948c75e51695c4124bc135a4eb2b1e4','815af21e8c491eaf360b3e0d1c42906d',826,NULL::TEXT,$items$[
                "教育：爭取每校有公立幼兒園、公立托嬰中心。",
                "教育：活化國中小閒置教室，設置全齡進修學堂，持續推展母語教學與老人樂齡學習與運動。",
                "教育：督促市府加速南勢文心國小發包動工。",
                "教育：持續把關國中小營養午餐供餐督導。",
                "交通：要求市府重新規劃機場捷運線由A22中壢老街溪站繼續往南延伸至平鎮山仔頂。",
                "交通：密集人口地區增設公私立停車場，檢討街道紅、黃線規劃，改善車位不足問題。",
                "交通：高流量道路規劃機車專屬車道，保障機車騎士安全。",
                "居家安全：正視老屋問題，提升老舊建物的防災性能、耐震補強專案經費補助。",
                "居家安全：爭取老舊社區巷道安全24小時全天候防護網絡建置，普設居家防護鈴，保護夜歸民眾。",
                "居家安全：督促市府持續興設智能社宅，並優先平價出租給在地工作青年、年輕小家庭夫妻，減輕負擔，間接鼓勵生育意願。",
                "健康醫療：全面推動8020口腔健康法則，要使未來的80歲長者能擁有20顆以上真牙，有效提升年老生活健康品質。",
                "健康醫療：爭取市府以BOT模式引進優質醫療機構進駐平鎮，設立兒童專責醫院、教學醫院，擴大南桃園醫療量能。",
                "健康醫療：推動「微型保險」納入地方自治條例法制化，將低收入戶、中低收入戶、身心障礙者、弱勢單親家庭全面納保，以補現行市府急難救助制度之不足。",
                "環境友善規劃：發展一公園一特色，增加共融式遊戲場。",
                "環境友善規劃：爭取現有公園環保廁所全面汰換，改以大方美觀之簡易廁所取代，提升公園環境品質。",
                "環境友善規劃：爭取老街溪源頭整治，步道貫通至龍潭，打造南桃園最美河川。",
                "環境友善規劃：爭取現有公園規劃寵物狗狗友善活動專區。",
                "青年、農民、勞工：放寬青年創業基金申請門檻，並提供貸款利息補貼或延長繳款期間。",
                "青年、農民、勞工：加強扶植青農、農業復育，打造精緻農業，推廣農特產品行銷，以提高農民收益。",
                "青年、農民、勞工：強化非典型勞工（類勞工）保險機制並提供補助，實質照顧勞工朋友。",
                "青年、農民、勞工：爭取婦女二度就業、單親家庭創業貸款利息補貼，廣開專長培育課程。"
            ]$items$::JSONB),
            ('6842e0bd-ec61-47f2-9fb2-47069678db8c'::UUID,'867c25b7-4017-4865-9fe2-4e870dd7e13c'::UUID,'08a427ab-256f-4b89-8e67-977a018a18d9'::UUID,'237b9307cd18a6e96f1e82006c81cf67','07bf93616ac479408f24346065520f41',595,'陸淑美將強力監督政府完成「智慧心高雄、美好生活圈」目標：',$items$[
                "交通：捷運紅線延伸至湖內。",
                "交通：新建捷運紫線，延伸至高科大及高師大燕巢校區，並直通佛光山。",
                "交通：闢建國道一號交流道，直通橋頭科學園區。",
                "交通：連結海線濱海步道及自行車道。",
                "農漁：輔導協助農漁民對冷鏈的需求，提高農漁產品質。",
                "農漁：落實整合養殖漁業特區管線路，促成產業升級。",
                "農漁：因應氣候變遷因素，提高天災農漁業災損補助金。",
                "觀光：發展北高雄海岸線觀光，並開發海上遊憩業務。",
                "觀光：系統化行銷大岡山美食觀光，如眷村、海味及在地特色料理。",
                "觀光：整合機場及眷村，舉辦空軍主題節慶活動。",
                "觀光：建置觀光軸線，串聯阿公店水庫及月世界觀光特色。",
                "產業：配合高科技園區成長，檢討土地政策，因應住商需求。",
                "產業：輔導傳統產業解決土地使用與環保問題。",
                "產業：輔導農漁工產業轉型升級，改善低薪並協助青年返鄉就業。",
                "城鎮：因應社區發展規模，調整鄰里編制。",
                "城鎮：持續關注區域排水整治，解決水患。",
                "城鎮：持續爭取焚化爐、掩埋場、污水廠及國營事業回饋金。",
                "城鎮：嚴格要求工安及環保，確保居住安全與品質。",
                "社福：增設公托、公幼，廣納準公共化托嬰及幼兒園，減輕家長負擔。",
                "社福：降低中低收入戶門檻；整合長照資源，推動各里設立關懷據點，落實長照在地安老。",
                "社福：持續推動社會住宅計畫。"
            ]$items$::JSONB),
            ('f7a9e1af-404c-4c10-8cdb-c2a7f0dd19d2'::UUID,'ce92e37b-7af6-42ac-a114-8b8ddf340c63'::UUID,'2a0178dd-f928-4ad1-98e2-7da4f1255885'::UUID,'df1f0b76891dd385731b486cf402e128','c1497c3757d242e96c7c0aa22e502d4c',483,NULL::TEXT,$items$[
                "守護健康安全：提升醫療品質，強化院際合作。",
                "守護健康安全：加強石虎保育、提升動物福利。",
                "守護健康安全：守護山林土地，要求縣府妥善監督嫌惡設施。",
                "友善育兒環境：增設公立托嬰中心，鼓勵企業設立托兒設施。",
                "友善育兒環境：推動智慧托育，讓家長安心、老師教學更順心。",
                "友善育兒環境：補助自然產減痛分娩與剖腹產術後止痛。",
                "友善育兒環境：公共場所落實親子廁所與集哺乳室設置。",
                "升級教育資源：改建頭份圖書館，爭取頭份市區設立高中，提升頭份文教資源。",
                "升級教育資源：推動沉浸式客語教學與非營利幼兒園，積極營造母語學習環境。",
                "活化空間利用：推動中港溪河濱公園，增加休閒遊憩及親水環境。",
                "活化空間利用：活化頭份、竹南交流道下空間。",
                "活化空間利用：加速推動社會住宅，加碼鼓勵包租代管。",
                "改善交通環境：落實道路平權，整合偏鄉運具，便利長途移動。",
                "改善交通環境：持續推動頭份第二交流道，爭取串接北橫。",
                "改善交通環境：設立頭份轉運站，辦理快速公車，改善塞車問題。",
                "革新縣府組織：設立交通專業局處與運動發展中心。",
                "革新縣府組織：恢復原住民族行政處。",
                "革新縣府組織：裁撤酬庸機關工商策進會。",
                "革新縣府組織：爭取頭份、竹南第二行政中心。"
            ]$items$::JSONB),
            ('cb6b0210-a874-40c7-8af6-af25aba15df2'::UUID,'245b0ccd-ea20-48ab-826d-c98d0cf2dd84'::UUID,'2e967cad-6872-4bce-a04a-e0ce1144fd96'::UUID,'bf1c2c144c171e45bffbfedfc0036459','c1e5d807c3ee8aae66ec8483249c11cb',477,NULL::TEXT,$items$[
                "要提高公幼、公托及準公托的質與量：增設公幼及公托中心，提高生育津貼補助，減輕家長育兒負擔。",
                "要打造高齡友善環境：增設社區照顧關懷據點，優化長照服務，減輕家庭照顧長者的壓力。",
                "改善空汙：反對南電北送，加速淨零排放時程，加速發展氫能及綠能產業，加速電動公車全面化、設立電動汽機車充電樁（站）。",
                "要解決熱區停車位不足問題：增設立體停車場。",
                "持續推動社會住宅：四年內再興建2萬戶社會住宅，增加青年及弱勢族群居住比例，落實居住正義。",
                "持續加碼租金補貼，減輕租屋族負擔。",
                "持續推廣城市運動風氣：成功推動高雄銀行培育在地優秀體育選手之後，繼續推動公營事業單位培育在地優秀體育選手，完善學校三級培訓制度，並優化現有場館設施。",
                "協助青年就業：迎接未來高科技產業人才需求，積極培育在地人才就業，接軌在地工作機會。",
                "強化監控警示系統：持續改善現有道路監視系統良率，增設巷弄監視器，確保婦幼人身安全。",
                "持續爭取路平：嚴格把關高雄市各道路的施工品質，並減少人孔蓋的設置，確保民眾行的安全。",
                "持續改造傳統市場：全面補強傳統市場硬體設備及改善公廁環境品質，增設機車停車位，提供安全、舒適的購物環境。"
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
                    '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-13-20260907','reasonCodes','[]'::JSONB)),TRUE),
                '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-13-20260907','repair','official_bulletin_full_text_resplit','classification','verified_repair'),TRUE),
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
        ('7566783b-0637-4228-a61c-07262019e640'::UUID,21),
        ('8c7bd277-3bb7-435c-8469-e214d9d4da88'::UUID,21),
        ('6842e0bd-ec61-47f2-9fb2-47069678db8c'::UUID,21),
        ('f7a9e1af-404c-4c10-8cdb-c2a7f0dd19d2'::UUID,19),
        ('cb6b0210-a874-40c7-8af6-af25aba15df2'::UUID,11)
    )
    SELECT pg_catalog.count(*) INTO validated_count
    FROM expected JOIN public.person_claims AS claim ON claim.id=expected.claim_id
    WHERE pg_catalog.jsonb_array_length(claim.claim_json->'items')=expected.item_count
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
      AND claim.claim_json#>>'{contentSplit,releaseQuality,version}'='verified-high-omission-platforms-13-20260907'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='official_bulletin_full_text_resplit'
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='verified_repair';
    IF validated_count<>5 THEN RAISE EXCEPTION 'Expected five validated platform repairs, found %',validated_count; END IF;
END
$validate$;

COMMIT;
