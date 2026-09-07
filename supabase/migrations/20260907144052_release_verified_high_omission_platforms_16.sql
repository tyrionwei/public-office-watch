BEGIN;

DO $review$
DECLARE repair RECORD; affected_count INTEGER;
BEGIN
    FOR repair IN
        SELECT * FROM (VALUES
            ('81a98426-40d6-46fd-b889-25b18ec68493'::UUID,'49a7d775-31da-413c-aa2a-f9e6190fcade'::UUID,'9823e42f-6277-4c7a-a6d5-967b25aa2ecd'::UUID,'9ca04da276df5f5dba9379ae72f8f84a','0ae82538cbf1b64951bc05d4c9f890e8',1042,NULL::TEXT,$items$[
                "生育扶助｜樂享天倫：公托全免費，私托全補助。",
                "生育扶助｜樂享天倫：盤點幼教師資及空間，增加公托班級數。",
                "生育扶助｜樂享天倫：生育獎勵再提高，托育津貼再擴大。",
                "生育扶助｜樂享天倫：營造安心育兒環境，打造職場友善臨托。",
                "生育扶助｜樂享天倫：爭取婦幼停車位，增加哺集乳室及公共尿布台。",
                "生育扶助｜樂享天倫：爭取擴大不孕症治療補助。",
                "安心慢老｜銀髮福利：長照2.0再進化，擴展照護據點培育專業照護員。",
                "安心慢老｜銀髮福利：推動「社區在宅老化、社區居家照顧」。",
                "安心慢老｜銀髮福利：一里一長者據點，擴大敬老卡使用範團。",
                "安心慢老｜銀髮福利：打造友善長者環境，獨居長者免費共餐。",
                "安心慢老｜銀髮福利：爭取老人照護輔具補助，佈建無障礙環境設備。",
                "雙語教育｜接軌國際：推動校園全雙語教育與國際接軌。",
                "雙語教育｜接軌國際：強化學生英語聽說讀寫能力。",
                "雙語教育｜接軌國際：培養雙語師資、一校一外師。",
                "雙語教育｜接軌國際：落實英語能力應用，營造校園英語生活化。",
                "雙語教育｜接軌國際：中小學教材雙語化，搭配數位科技學習。",
                "都更有力｜市容美麗：成立都更特戰隊，各區成立推動協調小組。",
                "都更有力｜市容美麗：積極推動公辦都更，協助危老改建更順利。",
                "都更有力｜市容美麗：增加獎勵容積率，一坪換一坪、一户一車位。",
                "都更有力｜市容美麗：改善住宅生活機能，打造安心宜居新容貌。",
                "社宅擴充｜租屋輕鬆：盤點閒置土地，供給更多社宅數量。",
                "社宅擴充｜租屋輕鬆：包租代管獎勵再加碼，提升公益出租人數量。",
                "社宅擴充｜租屋輕鬆：放寬租賃資格限制，完善社宅居住環境。",
                "社宅擴充｜租屋輕鬆：主張社宅入住「輪候制」、杜絕社宅二房東。",
                "社宅擴充｜租屋輕鬆：提高租金補貼，擴大請領族群。",
                "捷運衝刺｜松信加速：加速民生汐止線、環東線115年動工。",
                "捷運衝刺｜松信加速：推動捷運離峰優惠票價，充實公車路網串連。",
                "捷運衝刺｜松信加速：擴建Youbike2.0，增加大眾運輸轉乘優惠。",
                "捷運衝刺｜松信加速：末班車啟動警網協助，護送婦幼安全返家。",
                "客家精神｜文化傳承：成立客語實驗小學，傳承文化。",
                "客家精神｜文化傳承：培育客語師資及成立客語語文班競賽。",
                "客家精神｜文化傳承：辦理客家美食祭，推廣客家觀光行程。",
                "客家精神｜文化傳承：深耕北市客家網絡，完備客庄創生基礎。",
                "青年夢想｜啟動理想：相挺18歲公民權，讓青年聲音聽得見。",
                "青年夢想｜啟動理想：成立臺北市青年局，創造青年發展新方向。",
                "青年夢想｜啟動理想：資源空間再利用，打造青年創業園區。",
                "青年夢想｜啟動理想：媒合青年就業機會，培養職能技術提高薪資。",
                "青年夢想｜啟動理想：放寬青年貸款資格，利率優惠補貼利息。",
                "河岸友善｜松信完善：基隆河岸再進化，打造臺北新灣區。",
                "河岸友善｜松信完善：河濱公園增設監視器，放心活動安全無死角。",
                "河岸友善｜松信完善：增加共融式公園，讓孩子遊戲更安全。",
                "河岸友善｜松信完善：推動松山監理所遷移、南松山市場改建。",
                "河岸友善｜松信完善：活化松菸文創園區，成為首都藝文新亮點。",
                "毛孩友善｜動保實踐：打造動物友善都市，廣設友善空間與設施。",
                "毛孩友善｜動保實踐：全面化推動毛小孩植入晶片。",
                "毛孩友善｜動保實踐：防範惡意棄養，提高罰鍰金額。",
                "毛孩友善｜動保實踐：成立貓犬訓練機構，增加毛小孩寄宿場域。",
                "毛孩友善｜動保實踐：實施街犬絕育防疫TNVR計畫。"
            ]$items$::JSONB),
            ('a5ecd655-c756-4b71-89a4-c4e2b704f40e'::UUID,'b5f35050-cde1-4630-8eac-2a8e542ce640'::UUID,'8cc1cda5-1eb2-4a11-96c4-277ade250515'::UUID,'8e6cc03340ac15017012794b8b074761','c7e7d7dc2eb93d1d84f1c41b6b27388c',329,NULL::TEXT,$items$[
                "保障幼兒福利補助，落實公托、公幼倍增；成功爭取西屯第一座親子館及大公托。",
                "確保各級校園軟、硬體設施完善，落實教育建設預算優先補助校園。",
                "鼓勵青年回鄉就業輔導，增加在地創業補助，設立青年局保障青年權益。",
                "成立新住民科，協助新住民融入在地風俗習慣及生活。",
                "堅持落實老人長照工作，督促社區老人照護及老人日托體系完成。",
                "協助婦女就業及建置婦幼安全網，保護受虐兒及遭家暴婦女。",
                "堅持保護家園有效遏止空污，強力監督中火發電各項違失。",
                "敦促水湳經貿園區各項建設開發進度，儘速完成以造福鄉里。",
                "重視治安維護，增設監視系統，加強警民連線，聯防社區安全。",
                "改善老舊公園設施，推動共融式遊樂場、讓「玩」變成大家的權利。"
            ]$items$::JSONB),
            ('d2407541-aed5-463c-8e69-114fb3b5f643'::UUID,'e34c3d98-dbf0-433e-bbd3-4b0a7e7f3ce4'::UUID,'2908c02f-f350-4d0b-8794-647dc7b3fdbb'::UUID,'bbfee296fb45022e8fae2ee61e6a506d','7492309f40989c935fc98d5f24d70515',1091,NULL::TEXT,$items$[
                "已成功爭取3歲、4歲私托補助及公托及非營利幼兒園建置，同為照顧0歲至2歲嬰幼兒，持續要求政府增設托嬰中心及多元化補助政策。",
                "發展多元學習管道，積極推動官方第二美語政策，要求增加雙語教學制度、與強化特色學校的設立，並推動國際姐妹市學童交流。",
                "積極協助推動學校成立棒球、足球校隊，培育選手強化足球與棒球根基，與協助建置國手培養的升學管道。",
                "增加毒品防治政策預算，強化緝查與推動立法強制感化機制，建置防護網預防毒品進入校園殘毒年輕學子。",
                "嚴格把關校園營養午餐並建置安全食品供應鏈，讓學童吃的放心；推動老舊校舍改建，維護學童就學安全，藉由改建爭取興建地下停車場，規劃獨立出入口讓學童安心上課。",
                "爭取擴大不孕症的補助，包含年齡放寬及取卵次數的增加等項目。",
                "積極推動台灣無形與有形文化資產古蹟保存；爭取松菸文化園區與台北機廠鐵道博物館串連與活化再利用，讓文化價值與人文資源得以傳承。",
                "積極推動都市更新及老屋更新，協助文化藝術及活力注入社區型塑新風貌，並爭取放寬老舊房屋附掛電梯或爬梯機之條件及法規。",
                "鼓勵都更加速，爭取大眾運輸導向型發展TOD 升級版，將公共建設的「社會住宅」周邊500 公尺範圍納入都更推動區，提高容積獎勵回饋公共空間設置托嬰托老設施。",
                "已爭取完工的健康公宅、動工中的廣慈公宅與即將發包的三興公宅及六張犁公宅規畫及興建預算超過315 億元，並爭取降低住宅租金費用，未來也會持續協助中央住都中心興建社宅數量。",
                "以尊重民意協助推動催生民生汐止線興建；積極爭取中央預算補助捷運南北向東環段興建，建置完整捷運路網，改善信義區縱向交通便利。",
                "已爭取台北市動物保護專戶設立，由動保處規劃設立執行方針，擴大動物救援、媒合民間協助，以利動保資源整合。",
                "針對虐待動物累犯已正式提案除加重處分及刑事責任外，並須強制接受感化，協助中央與地方推動立法。",
                "法制化寵物飼養與照顧指南，提升飼主的責任；並建立其他非犬貓小動物絕育補助、及收容場所的規劃。",
                "已完成推動限塑、廚餘減量及再生、太陽能建置等友善環境政策，持續推動綠能能源政策並爭取汰換電動汽、機車補助金額提高。",
                "持續推動市府閒置空間作為青年創業辦公室及青年創業貸款零利率，鼓勵青年創業。",
                "支持國內服裝設計產業，全力媒合在地設計師與國際接軌；推動時尚設計平台，提供設計師由校園育成階段至創業之協助。",
                "落實長照在地化，建置社區照護機構爭取照服員居家照顧，並持續要求市府恢復發放重陽敬老禮金及推動滿65歲長者假牙補助與視力健檢。"
            ]$items$::JSONB),
            ('09e85e28-e73e-45e8-9e5e-fa6b3f0c3771'::UUID,'53f5e2f0-8f8b-4224-820c-aadfd5c66eab'::UUID,'ab1b0818-52df-4993-aa30-52515e5f441b'::UUID,'dfb1084debfae8f97057a7ab80f0b154','408ae7dea0c66b216fe789cd879b6738',505,'親愛的市民朋友，這是一份選舉公報也是競選連任的成績單，更是一份政治承諾書！政見是有想法、有做法的政策承諾，不是作文比賽，更不可以亂開空頭支票！明義從政二十四個年頭，問政及地方選民服務都落實了「說真話、做實事」的承諾，擔任八年鄉民代表，近十六年的縣市議員，二十四年來「敢說、肯做」，明義向您報告：「我沒有辜負投票給我的每一位市民朋友，我交出了漂亮的成績單。」未來四年，明義將再接再勵，用清晰的頭腦，勤快的行動，為您打拚！我們用行動兌現承諾，新北民意哥Uber Service！',$items$[
                "二十四年成績單：成功推動林口交流道立體化，增設引道紓解龜山、林口車流。",
                "二十四年成績單：成功阻擋全台最大殯葬特區設置五股觀音山。",
                "二十四年成績單：成功推動「五股、泰山輕軌捷運」並獲得國家發展研究院審核通過。",
                "二十四年成績單：成功爭取五股國民運動中心。",
                "二十四年成績單：成功爭取五股第一座公有零售市場。",
                "未來四年：加速推動五股泰山輕軌捷運早日動工。",
                "未來四年：爭取國道一號五股出口增設匝道直接銜接台64快速道路，恢復新五路正常車流。",
                "未來四年：加速辦理五股洲子洋公園闢建地下停車場。",
                "未來四年：爭取林口41B交流道改善工程，化解未來工一工業區交通衝擊。",
                "未來四年：爭取國道一號增設泰山大科一路北出匝道，縮短泰山市民行車時間。"
            ]$items$::JSONB),
            ('8eb5f66e-e8f2-41a7-b73f-764ddc257f4c'::UUID,'0d2828f1-499c-4314-bf88-26b4ddaece7c'::UUID,'939b405e-67cc-49ca-ba9a-759f12d93ed0'::UUID,'eae174af82f33035b657214e392a3560','3c0c34b612a41c1d57a0a64b53d2f56f',709,'認真做事、用心服務。愛、關懷。把民眾的事放在心上，總是想盡辦法做好。',$items$[
                "主張台灣中國、一邊一國。",
                "爭取增設公立幼兒園、非營利幼兒園、親子館，減輕家庭育兒負擔；強化婦幼安全維護與長照系統。",
                "爭取提高生育補助、育兒津貼、學校營養午餐費，檢討並放寬各項福利津貼申請標準，簡化申請手續。",
                "督促市府積極改善空氣污染，加速汰換台中火力發電廠燃煤機組，保障市民身心健康。",
                "督促市府4年任內完成8千户社會住宅，地點平均分配、讓年輕人有房子住，宜居宜業，不再為高房價煩惱。",
                "爭取警消健康檢查全面補助，提升警消人員裝備經費，加速老舊設備換新，以維護第一線救災執勤人員安全。",
                "爭取敬老愛心卡擴大使用範圍，可搭乘台鐵、高鐵等交通工具，並全額折抵搭乘計程車費與看診醫療費用。",
                "督促市府積極推動『東南草悟道』(城南之心計劃)；東南區在地產業經濟、文化、休閒全面升級，增進商機。",
                "督促市府於公園增設地下停車場：全面檢討公園綠地友善空間，維護公園綠地，充實市民優質休閒運動場域。",
                "督促市府積極推動各項體育運動，廣闢室內外運動場所，培養市民運動風氣：重視寵物活動友善空間。",
                "督促市府加快汙水接管進度，改善市民住家品質，減少河川污染，提升城市競爭力。",
                "督促市府檢討無障礙生活環境空間，並寬列預算修繕維護，提供更安全、便利的生活品質。",
                "督促市府增設新住民關懷據點與培力中心，增加就業機會，保障新住民權益。",
                "督促市府推動全民閱讀文化，提高市民擁書率；充實東南區文化軟硬體建設，豐富市民藝文生活內涵。",
                "督促市府落實捷運藍線規劃，增進東區東西交通動能；落實機場捷運線規畫，提升南區南北交通效益。"
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
                    '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-16-20260907','reasonCodes','[]'::JSONB)),TRUE),
                '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-16-20260907','repair','official_source_full_text_resplit','classification','verified_repair'),TRUE),
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
        ('81a98426-40d6-46fd-b889-25b18ec68493'::UUID,48),
        ('a5ecd655-c756-4b71-89a4-c4e2b704f40e'::UUID,10),
        ('d2407541-aed5-463c-8e69-114fb3b5f643'::UUID,18),
        ('09e85e28-e73e-45e8-9e5e-fa6b3f0c3771'::UUID,10),
        ('8eb5f66e-e8f2-41a7-b73f-764ddc257f4c'::UUID,15)
    )
    SELECT pg_catalog.count(*) INTO validated_count
    FROM expected JOIN public.person_claims AS claim ON claim.id=expected.claim_id
    WHERE pg_catalog.jsonb_array_length(claim.claim_json->'items')=expected.item_count
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
      AND claim.claim_json#>>'{contentSplit,releaseQuality,version}'='verified-high-omission-platforms-16-20260907'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='official_source_full_text_resplit'
      AND claim.claim_json#>>'{platformQualityAudit,classification}'='verified_repair';
    IF validated_count<>5 THEN RAISE EXCEPTION 'Expected five validated platform repairs, found %',validated_count; END IF;
END
$validate$;

COMMIT;
