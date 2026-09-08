BEGIN;

-- Bridge exact production pre-repair texts to the audited migration baseline.
-- This stays inside the release transaction: the final repair must succeed.
CREATE TEMP TABLE release_source_baselines (id uuid PRIMARY KEY, person_id uuid NOT NULL, candidate_id uuid, claim_key text NOT NULL, production_text text NOT NULL, audited_text text NOT NULL) ON COMMIT DROP;
INSERT INTO release_source_baselines VALUES
('041caeef-1272-4b67-b720-c0556b321a07'::uuid,'59075080-197e-4702-92c3-56ecfad200a1'::uuid,'cfca9ada-2029-4f6a-a259-a318176d0607'::uuid,'cec-platform:2022:votetw-candidate-6571744e1efd06f0','運用科學技術產業推動的專業背景 , 以及多年關心勞工議題問題和擔任工會幹部的
服務經驗 , 因此具備了解產業與勞工問題的解決能量。
所以可以對於 「產業創新、 勞次雙贏」 兩大主軸議題 , 透過科學、 務實、 對話、 數
據、 效率 , 監督新竹縣政府在相關政策的執行細節 , 可提供更迅速的聯結與建議 , 藉此
打造以新竹縣為首的科技首都。
為了提高科技首都的生活品質 , 預計將可運用科技促成九個面向的落實發展 , 有效
提升在地的生活品質 :
1、 產業升級增加就業率 - 推動青創投交
2、 維護與提升勞工權益 - 推廣勞運平。 更多內容請參考臉書連結
3、 監督竹北交通智慧網 - 優化人工智慧
4、 監督都會安全生活網 - 掃除治安死角回全和 [還
5、 監督學生智慧營養午餐 pL
6、 監督優化戶外山野活動據點 Ne os
7、 監督托幼友善職場環境 5
8、 監督增設兒童與老人銀髮樂齡公園 [m] E44
9、 監督增設國中小班級以利居民生根 =r lL.','【樂活竹北】
1. 推動竹北在地海洋觀光遊憩環境，帶動地方觀光發展。
2. 爭取規劃自行車道，串聯竹北、新竹及新豐，打造綠色廊道。
3. 爭取鳳崎步道整建，提升整體環境，成為友善休閒登山步道。
4. 持續推動共融式遊戲場及增闢公園綠地，提升市民休閒空間。
5. 持續推動動物保護政策，推廣寵物友善環境。

【竹北好行】
1. 成功爭取設立YouBike據點，持續爭取廣設據點，串聯大眾運輸工具，增進交通路網。
2. 成功爭取經國橋延興隆路設置機車引道，持續監督建設進度。
3. 優化大眾運輸環境，爭取智慧站牌、候車亭及轉乘設施。
4. 爭取興建停車場，改善停車需求，提供優質停車環境。

【教育願景】
1. 持續檢視竹北老舊校園，致力改善學校環境，提升各校軟硬體設施設備及教學品質，教育資源合理配置，並推動特色學校。
2. 爭取竹北增設高中，推動國際實創優質高中，落實在地就學。

【經濟就業】
1. 監督AI智慧園區開發進度並促儘速營運，增加就業機會。
2. 持續推動青創基地，爭取創業低利貸款，鼓勵青年創業。
3. 爭取農特產展售站，建構多元銷售通路，提升青年返鄉。

【地方建設】
1. 爭取豆子埔溪整體水環境改善，改善水源不足、水質汙染，並復原水文風貌。
2. 爭取新月沙灘周邊整體環境改善，並解決停車不足問題。

【社福實踐】
1. 落實托育幼老福利政策，監督按時發放，減輕家庭負擔。
2. 整合長照資源，提升服務能量，完善社區醫療照護網絡。
3. 爭取社區公共空間活化利用，設置托幼托老之關懷據點。
4. 爭取敬老卡點數擴及YouBike多元用途，讓長輩走出戶外。

【共創幸福】
1. 落實新住民福利政策，協助適應生活，改善語言問題。
2. 推動產學合作，培育教育、技能，提升家庭經濟力。'),
('0742aa7b-ad12-4a8c-975c-d8b725972e7c'::uuid,'f0a760ab-2763-4806-9d15-873bdac1e97f'::uuid,'1c3a6d63-292b-4a58-b417-c1366577ae81'::uuid,'cec-platform:2024:votetw-candidate-672e631e0d18ecd6','1.任內主提案數中正萬華第1名！
2.質詢率100%！
3.成功推動特色公園改造16座！
4.爭取人本交通建設超過100件！
5.服務市民案件超過5000件！
6.開辦行動服務站1140場次！

民主台灣 世界典範
我支持：繁榮而自主的經濟，讓台灣產業與正在重組的國際供應鏈緊密連結，與世界共榮
我主張：民主且多元的台灣，堅守國家主權，不分族群、性別、背景的人民皆享有尊嚴與保障

吳沛憶進入國會 推動立法
①《最低工資法》立法，基本工資持續調高
②《交通基本法》立法，提升交通安全
③《社會救助法》修正，降低弱勢補助門檻
④《人工生殖法》修正，保障女性生育權

建設
①捷運萬大線通車，道路、人行道更新，發展沿線商圈
②串連中正區藝文廊道，催生親子美學空間

文化
①提高文化預算，促進藝術振興，保障藝文工作者權益
②支持「台流」，扶植文化內容創作，發展影視音產業

育兒
①降低育兒負擔，公托補助提升至7千元起，準公托及保母服務補助提升至1萬3千元
②增設公托、公幼，彈性育嬰假以「日」或「小時」計算

銀髮
①長照住宿式機構補助提高至每人每年18萬元，強化家庭照顧者「喘息服務」
②打造樂齡社區，增加銀髮健康運動據點

教育
①家長減壓，高中職免學費，補助私大生每年3萬5千元
②推動雙語教育環境，加強母語教育

居住
①囤房稅2.0、遏止房屋炒作、落實《平均地權條例》
②實現居住正義，加速社會住宅興建，試辦入住輪候制

體育
①主張「體育署」升級「體育部」，增加全國體育預算
②支持街舞、滑板新興運動，推展「全民體育」基層培育

性別
①落實《性騷防治法》《性平工作法》《性平教育法》
②防治數位性暴力，性平教育再升級

年輕國會
①推動國會外交，加強民主交流
②落實透明國會，資訊公開揭露','1. 任內主提案數中正萬華第1名！
2. 質詢率100%！
3. 成功推動特色公園改造16座！
4. 爭取人本交通建設超過100件！
5. 服務市民案件超過5,000件！
6. 開辦行動服務站1,140場次！

民主台灣，世界典範

我支持：繁榮而自主的經濟，讓台灣產業與正在重組的國際供應鏈緊密連結，與世界共榮。
我主張：民主且多元的台灣，堅守國家主權，不分族群、性別、背景的人民皆享有尊嚴與保障。

吳沛憶進入國會，推動立法

1. 《最低工資法》立法，基本工資持續調高。
2. 《交通基本法》立法，提升交通安全。
3. 《社會救助法》修正，降低弱勢補助門檻。
4. 《人工生殖法》修正，保障女性生育權。

建設

1. 捷運萬大線通車，道路、人行道更新，發展沿線商圈。
2. 串連中正區藝文廊道，催生親子美學空間。

文化

1. 提高文化預算，促進藝術振興，保障藝文工作者權益。
2. 支持「台流」，扶植文化內容創作，發展影視音產業。

育兒

1. 降低育兒負擔，公托補助提升至7千元起，準公托及保母服務補助提升至1萬3千元。
2. 增設公托、公幼，彈性育嬰假以「日」或「小時」計算。

銀髮

1. 長照住宿式機構補助提高至每人每年18萬元，強化家庭照顧者「喘息服務」。
2. 打造樂齡社區，增加銀髮健康運動據點。

教育

1. 家長減壓，高中職免學費，補助私大生每年3萬5千元。
2. 推動雙語教育環境，加強母語教育。

居住

1. 囤房稅2.0、遏止房屋炒作、落實《平均地權條例》。
2. 實現居住正義，加速社會住宅興建，試辦入住輪候制。

體育

1. 主張「體育署」升級「體育部」，增加全國體育預算。
2. 支持街舞、滑板新興運動，推展「全民體育」基層培育。

性別

1. 落實《性騷擾防治法》《性別平等工作法》《性別平等教育法》。
2. 防治數位性暴力，性平教育再升級。

年輕國會

1. 推動國會外交，加強民主交流。
2. 落實透明國會，資訊公開揭露。'),
('2d41ca1b-b652-45db-9ac0-208e279b68b7'::uuid,'9c6365ef-b3ed-4b49-87e7-6adbe925792a'::uuid,'e67f981c-16b4-496b-9c7a-030aa92cd23e'::uuid,'cec-platform:2022:votetw-candidate-f65b8929e0b10b5b','at C= ae
Aman BATA a ii
「桃園新選風」 共同價值 : 和 3 新
市政透明、議會問責、政策公平競爭、政治新陳代謝 = a
[桃園新選風」 共同政見 : VL pz
@要求市府加強稽查力道爭取空污、水污智慧檢測機制 ~ 風
@要求市府比照雙北1280推出桃園大眾運輸通勤月飄,爭取公車預算,培養捷運運量 ~—, ”
@要求政府推動公寓大廈管理升級,爭取政府輔導機制、提供專業諮詢服務
@要求政府嚴守財政紀律,爭取建設準時落地,反對活動大撒幣
負重前行有目標,再為銀山討公道: se
@棕線捷運進度,隨時監督、誠實回幸
@大崗高中獨立設校、大坪頂公園擴大範圍
@ 文青國中小準時落地、活化江洪池增加公園綠地
@專案預算補助荐村國宅「中庭公園化」 AT
@ 第一公墓遷莽完成,爭取大山頂萬坪共融公園 Ono
@ 幸福國中操場完成行政程序、開工動土 a ; 3
@ 電線桿地下化、增補清潔隊人力改善市容生多
@尋找迴族公有空間:活動中心、便民服務、圖書分館進駐 sere:
[TS e—Fm,!','「桃園新選風」共同價值：市政透明、議會問責、政策公平競爭、政治新陳代謝。
「桃園新選風」共同政見：
1. 要求市府加強稽查力道，爭取空污、水污智慧檢測機制。
2. 要求市府比照雙北1280推出桃園大眾運輸通勤月票，爭取公車預算，培養捷運運量。
3. 要求政府推動公寓大廈管理升級，爭取政府輔導機制、提供專業諮詢服務。
4. 要求政府嚴守財政紀律，爭取建設準時落地，反對活動大撒幣。
負重前行有目標，再為龜山討公道：
1. 棕線捷運進度，隨時監督、誠實回報。
2. 大崗高中獨立設校、大坪頂公園擴大範圍。
3. 文青國中小準時落地、活化滯洪池增加公園綠地。
4. 專案預算補助眷村國宅「中庭公園化」。
5. 第一公墓遷葬完成，爭取大山頂萬坪共融公園。
6. 幸福國中操場完成行政程序、開工動土。
7. 電線桿地下化、增補清潔隊人力改善市容。
8. 尋找迴龍公有空間：活動中心、便民服務、圖書分館進駐。'),
('748a57ef-a5cd-48d4-9689-9f77908d86de'::uuid,'639bdf4c-a801-48b7-9ca6-44a3aa016c9a'::uuid,'9e126312-18fc-4e43-81c2-19dce69b71ad'::uuid,'cec-platform:2022:votetw-candidate-90da162e9bccd7b4','BEN SLY pre riye EE DERG LYS |
廣設停車格位強化公車網絡 hl 監督幼保環境教師合理待遇
道路標線改善推動機車平權 = 全 TT 苦公托機制好護幼兒沒煩惱
保障行人安全友善老弱婦幼人 「國擴大照護員額顧長者養天年
CITE EecE EEE
要求設勞工處助勞工組工會。 「生 1 本,。 OTR REGRET
REE sawesen RYEPEE EERNAR RROREE
改善就業環境協助青年創業 HC ERAGE THERNEe
居住正義成家有太 5 ETE TTT 2
推動還房稅收抑制投機炒作。 REE MRE ame aE
正視青年成家督促社會住宅。 政見與細項新求請上拒絕稅金亂花杜絕不當關說
避免浮濫迫遷完善包租代管 Facebook 專頁觀看線上陳情王浩服務不分大小
打造重視本土語言 , 多元文化的友善城市嘉義市。','路權強化，交通有力：
一、廣設停車格位，強化公車網絡。
二、道路標線改善，推動汽機車平權。
三、保障行人安全，友善老弱婦幼。

勞動保障，就業有力：
一、要求設勞工處，協助勞工組工會。
二、保障警消權益，勞檢納入招標協議。
三、改善就業環境，協助青年創業。

居住正義，成家有力：
一、推動囤房稅收，抑制投機炒作。
二、正視青年成家，督促社會住宅。
三、避免浮濫迫遷，完善包租代管。

拒絕稅金亂花，杜絕不當關說。
線上陳情，王浩服務不分大小。
打造重視本土語言、多元文化的友善城市嘉義市。');
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
DECLARE
    review RECORD;
    affected_count INTEGER;
    total_affected INTEGER := 0;
BEGIN
    FOR review IN
        SELECT *
        FROM (
            VALUES
                ('2d41ca1b-b652-45db-9ac0-208e279b68b7'::UUID, '9c6365ef-b3ed-4b49-87e7-6adbe925792a'::UUID, 'e67f981c-16b4-496b-9c7a-030aa92cd23e'::UUID, '04a6f88d1bd5fad96794a2a6ba0cb15d'::TEXT, 399, '4f7529cf21e858d0e0b2092c98d99444'::TEXT, 'official_bulletin_visual_section_boundary_repair'::TEXT, $items$["桃園新選風共同政見：要求市府加強稽查力道，爭取空污、水污智慧檢測機制。","桃園新選風共同政見：要求市府比照雙北1280推出桃園大眾運輸通勤月票，爭取公車預算，培養捷運運量。","桃園新選風共同政見：要求政府推動公寓大廈管理升級，爭取政府輔導機制、提供專業諮詢服務。","桃園新選風共同政見：要求政府嚴守財政紀律，爭取建設準時落地，反對活動大撒幣。","負重前行有目標，再為龜山討公道：棕線捷運進度，隨時監督、誠實回報。","負重前行有目標，再為龜山討公道：大崗高中獨立設校、大坪頂公園擴大範圍。","負重前行有目標，再為龜山討公道：文青國中小準時落地、活化滯洪池增加公園綠地。","負重前行有目標，再為龜山討公道：專案預算補助眷村國宅「中庭公園化」。","負重前行有目標，再為龜山討公道：第一公墓遷葬完成，爭取大山頂萬坪共融公園。","負重前行有目標，再為龜山討公道：幸福國中操場完成行政程序、開工動土。","負重前行有目標，再為龜山討公道：電線桿地下化、增補清潔隊人力改善市容。","負重前行有目標，再為龜山討公道：尋找迴龍公有空間：活動中心、便民服務、圖書分館進駐。"]$items$::JSONB),
                ('4f478367-6fbd-4bf4-ab22-67ee22b5bc40'::UUID, '2010bd71-f748-45b3-a947-4b69ad875b40'::UUID, '657afb62-c2fb-4a1c-8472-48320861c9dc'::UUID, 'e9b7520cc1b388fd053582d41faedce7'::TEXT, 709, 'fcb7d0d4143d3b0de212e3b3190f59b5'::TEXT, 'official_council_page_user_assisted_full_resplit'::TEXT, $items$["欣儀為您完成：學童搭捷運享6折優惠；「班班有冷氣」冷氣汰換與電費不再由家長募款買單。","欣儀為您完成：恢復發放重陽敬老金及老人健保補助。","欣儀為您完成：推動北市青年尋職輔導津貼。","欣儀為您完成：設置多處捷運雙向電扶梯。","欣儀為您完成：辛亥、懷恩隧道壁體美化及更新改善。","欣儀為您完成：台北市立圖書館在舊AIT結合音樂中心興建；設置大安森林公園共融式遊具。","欣儀為您爭取：從小顧到老！提高生育獎勵金、增加公托（幼）、社區日照及長照。","欣儀為您爭取：教育是最好的投資！落實雙語及數位教育，學童營養午餐物調差額由市府補足。","欣儀為您爭取：教師權益我維護！增加學生輔導服務津貼及教師升等檢定補助。","欣儀為您爭取：搶救青年失業潮！推動「青年尋職輔導津貼2.0」、把關就業權益。","欣儀為您爭取：長者照顧智慧化！推動社區長者緊急照護及救援E化系統。","欣儀為您爭取：提供弱勢便民服務！敦促市府成立一站式窗口、簡化相關補助手續。","欣儀為您爭取：推動防災型都更修法！放寬山限區「山坡地老舊社區」都更、降低公辦都更門檻。","欣儀為您爭取：行車順暢不再塞！拓寬木柵路四、五段道路用地，推動不合理的交通路型更新。","欣儀為您爭取：力拼交通升級！加速推動「捷運南環段」，增設出口；持續廣設「捷運雙向手扶梯及電梯」。","欣儀為您爭取：打破隧道陰森印象！接續美化「莊敬隧道」壁體。","欣儀為您爭取：打造台北文化新地標！加速推動「大安音樂圖書中心」建設進度，督促舊市圖儘速轉型「社福基地」。","欣儀為您爭取：營造繽紛城市花園！優化「大安森林公園」，打造都會永續棲地。","欣儀為您爭取：落實三貓計畫！設置貓空景觀吊橋、振興貓空產業、減少貓纜虧損。","欣儀為您爭取：行銷台北走向國際！一站式便利申請北市各大景點拍攝、加碼補助新銳影音團隊。","欣儀為您爭取：向英雄致敬！維護警消及醫護權益、提升裝備效能，補足員額。"]$items$::JSONB),
                ('041caeef-1272-4b67-b720-c0556b321a07'::UUID, '59075080-197e-4702-92c3-56ecfad200a1'::UUID, 'cfca9ada-2029-4f6a-a259-a318176d0607'::UUID, '366b6427425b66a02c918272188b6de3'::TEXT, 751, '04ff03ad011ec752edf9b2803b492b5f'::TEXT, 'official_bulletin_user_assisted_full_resplit'::TEXT, $items$["樂活竹北：推動竹北在地海洋觀光遊憩環境，帶動地方觀光發展。","樂活竹北：爭取規劃自行車道，串聯竹北、新竹及新豐，打造綠色廊道。","樂活竹北：爭取鳳崎步道整建，提升整體環境，成為友善休閒登山步道。","樂活竹北：持續推動共融式遊戲場及增闢公園綠地，提升市民休閒空間。","樂活竹北：持續推動動物保護政策，推廣寵物友善環境。","竹北好行：成功爭取設立YouBike據點，持續爭取廣設據點，串聯大眾運輸工具，增進交通路網。","竹北好行：成功爭取經國橋延興隆路設置機車引道，持續監督建設進度。","竹北好行：優化大眾運輸環境，爭取智慧站牌、候車亭及轉乘設施。","竹北好行：爭取興建停車場，改善停車需求，提供優質停車環境。","教育願景：持續檢視竹北老舊校園，致力改善學校環境，提升各校軟硬體設施設備及教學品質，教育資源合理配置，並推動特色學校。","教育願景：爭取竹北增設高中，推動國際實創優質高中，落實在地就學。","經濟就業：監督AI智慧園區開發進度並促儘速營運，增加就業機會。","經濟就業：持續推動青創基地，爭取創業低利貸款，鼓勵青年創業。","經濟就業：爭取農特產展售站，建構多元銷售通路，提升青年返鄉。","地方建設：爭取豆子埔溪整體水環境改善，改善水源不足、水質汙染，並復原水文風貌。","地方建設：爭取新月沙灘周邊整體環境改善，並解決停車不足問題。","社福實踐：落實托育幼老福利政策，監督按時發放，減輕家庭負擔。","社福實踐：整合長照資源，提升服務能量，完善社區醫療照護網絡。","社福實踐：爭取社區公共空間活化利用，設置托幼托老之關懷據點。","社福實踐：爭取敬老卡點數擴及YouBike多元用途，讓長輩走出戶外。","共創幸福：落實新住民福利政策，協助適應生活，改善語言問題。","共創幸福：推動產學合作，培育教育、技能，提升家庭經濟力。"]$items$::JSONB),
                ('748a57ef-a5cd-48d4-9689-9f77908d86de'::UUID, '639bdf4c-a801-48b7-9ca6-44a3aa016c9a'::UUID, '9e126312-18fc-4e43-81c2-19dce69b71ad'::UUID, '77cc56a694fe5b367ee5d03bfeb86ffc'::TEXT, 245, 'ff8c5cae042096210ab37510bf9b3493'::TEXT, 'official_bulletin_user_assisted_multicolumn_reconstruction'::TEXT, $items$["路權強化、交通有力：廣設停車格位","路權強化、交通有力：強化公車網絡","路權強化、交通有力：道路標線改善","路權強化、交通有力：推動汽機車平權","路權強化、交通有力：保障行人安全","路權強化、交通有力：友善老弱婦幼","勞動保障、就業有力：要求設勞工處","勞動保障、就業有力：助勞工組工會","勞動保障、就業有力：保障警消權益","勞動保障、就業有力：勞檢納招標依據","勞動保障、就業有力：改善就業環境","勞動保障、就業有力：協助青年創業","居住正義、成家有力：推動囤房稅收","居住正義、成家有力：抑制投機炒作","居住正義、成家有力：正視青年成家","居住正義、成家有力：督促社會住宅","居住正義、成家有力：避免浮濫迫遷","居住正義、成家有力：完善包租代管","扶老攜幼、爸媽有力：監督幼保環境","扶老攜幼、爸媽有力：教師合理待遇","扶老攜幼、爸媽有力：準公托機制好","扶老攜幼、爸媽有力：護幼兒沒煩惱","扶老攜幼、爸媽有力：擴大照護員額","扶老攜幼、爸媽有力：顧長者養天年","環境永續、動物有力：加強汙染監測","環境永續、動物有力：推廣綠電節能","環境永續、動物有力：完善寵物公園","環境永續、動物有力：充足動保資源","環境永續、動物有力：督促文資保存","環境永續、動物有力：守護嘉義特色","議會透明、監督有力：公布助理名單","議會透明、監督有力：推動議事透明","議會透明、監督有力：拒絕稅金亂花","議會透明、監督有力：杜絕不當關說","議會透明、監督有力：線上陳情王浩","議會透明、監督有力：服務不分大小","打造重視本土語言、多元文化的友善城市嘉義市。"]$items$::JSONB),
                ('a400fa49-28bc-4e75-85a4-860e9d722582'::UUID, '2c35654e-40bd-49ff-b612-5140850c5857'::UUID, 'fc34263d-5782-413c-8800-43ac2b018d7f'::UUID, '916394783c2afae10a9e98d5d43d140d'::TEXT, 281, 'a79358cd5c0e050da21eb1e36d296a5b'::TEXT, 'official_bulletin_user_assisted_order_repair'::TEXT, $items$["放寬申請社福移工限制，取消巴氏量表，減輕長照家庭壓力","推動核二、核三延役，以核減煤，還給台灣人乾淨空氣","推動防災都更，提高40年以上老屋容積獎勵，增加都更誘因，解決都會老舊住宅防災問題","開放大陸觀光客團客來台，振興台北市觀光產業","推動松山機場新國門計畫，打造小型航空城","學貸免息，減輕背學貸年輕人負擔","追蹤政府宣傳標案，反制特定媒體壟斷政府文宣標案","重懲詐騙集團，對電信公司、金融機構課以反詐責任","強化校園反毒教育，打擊校園毒品，保障下一代健康","修法限制特別預算常態化，重建財政紀律，拒絕債留子孫"]$items$::JSONB),
                ('80ad8758-18f6-4b3a-990e-a7e499dc6e95'::UUID, 'bc670a37-1175-4d6a-853c-a1f430840455'::UUID, 'c0ce4bc6-aee2-4b71-8bb5-0ca61f28c714'::UUID, '54529e3c6ebd0b87f0e633e996f04b43'::TEXT, 465, 'dbd3d30f80462faaddee80dc5cfb6d7d'::TEXT, 'official_council_page_user_assisted_full_resplit'::TEXT, $items$["全力支持侯友宜市長連任，齊力「侯侯做代誌」，為市民服務。","長期推動汐止康寧街銜接「國道1號汐止交流道增設南入匝道工程」，並成功爭取「康寧街1、2期拓寬工程」，關注兩大重大交通工程進度，要求準時完工，以紓解汐止、東湖間長久塞車問題。","持續推動捷運「汐東線」儘速動工，督促「捷運基隆線」規劃進度。與台北市、基隆市跨市合作增闢及拓寬對外聯絡道路，逐步改善汐止、內湖、南港、基隆共同生活圈交通。","持續推動並爭取新闢「國道3號南港交流道增設南下出口橫科匝道」銜接環東大道，以紓解新台五路及大同路車流。","任內成功爭取梓樹國中升格「梓樹國際實創高中」，督促秀峰高中校舍儘速改建，致力改善各級學校運動空間及學習環境，提升教學品質、落實在地就學。","任內成功推動「金山市地重劃」、「金萬城鎮之心計畫」、改善汙水處理，打造宜居慢活、山海漫遊優質觀光遊憩環境，行銷金萬地區精緻農漁業，促進金萬地區多元發展。","堅持一路走來清廉問政，傾聽民意、爭取地方建設、監督市政、推動銀髮照護、弱勢關懷、青年服務、關注動保，打造低碳樂活城市。"]$items$::JSONB),
                ('5e0039fe-beff-4928-b9b8-e9ae7a89f77b'::UUID, '000ec4ee-d284-4df3-8ddc-0df686d59bff'::UUID, 'e52c930e-b647-4b53-9ed1-e6ff18e26039'::UUID, '5082ffd1deee4dd14e81bfd22ef4e4a0'::TEXT, 624, '6da82245e41f29521cf280d129cd0e6c'::TEXT, 'official_council_page_user_assisted_full_resplit'::TEXT, $items$["強力要求文山焚化爐新廠，必須通過環境評估，否則文山焚化爐年限到期後必須遷移至適當處。嚴格把關南屯的空氣要換新。建議文山掩埋場第零期約十公頃(環評法未通過時期掩理區域)，清除掩埋物後，規劃為綠美化公園提供民眾休憩場所。","強烈要求臺中市政府關閉南屯水肥廠，惡臭源頭不應該在密集的住宅區，應該加速家戶汙水接管率，統一將惡水排入水資源處理廠，還給居民宜居的家園。","已成功爭取溪西地區文中52國中設校，將持續監督興建校舍直到招生進度，保障當地學童就學權益。","積極爭取公共停車空間，改善停車問題，增設公共運輸站讓交通網絡更便捷。","爭取鐵路高架化銜接大慶站與烏日站三鐵共構。","爭取臺中市國中小營養午餐免費，營養加倍。社宅倍增，青創加值。長照樂齡社區化。","爭取南屯區國中小全面設置智慧教室。(成功爭取永春、大墩國小，大墩、大業國中)。","督促市府除了加強筏子溪、麻園頭溪、南屯溪水患整治外，應規劃串連自行車道及親水公園。","嚴格監督路平及整平效率，保障用路人及駕駛人的安全。打造友善的寵物空問·適當的規劃寵物運動公園。","爭取南屯區精密園區精科路打通至永春南路，中台路(培德路至台貿路)拓寬，同安坑厝幹線排水北側15公尺道路開闢(忠勇路至台貿路)。改善溪西地區交通瓶頸。","要求優先建構【臺中市數位線上遺址博物館】，比照國立故宮博物院數位典藏，因應未來數位網站博物館發展趨勢。"]$items$::JSONB),
                ('0742aa7b-ad12-4a8c-975c-d8b725972e7c'::UUID, 'f0a760ab-2763-4806-9d15-873bdac1e97f'::UUID, '1c3a6d63-292b-4a58-b417-c1366577ae81'::UUID, 'aff8263b7eb04223416989f14f7f48a3'::TEXT, 842, '54ea05fc6e53b1a7e730e4dda81ca021'::TEXT, 'official_bulletin_user_assisted_full_resplit'::TEXT, $items$["任內成果：任內主提案數中正萬華第1名！","任內成果：質詢率100%！","任內成果：成功推動特色公園改造16座！","任內成果：爭取人本交通建設超過100件！","任內成果：服務市民案件超過5,000件！","任內成果：開辦行動服務站1,140場次！","民主台灣，世界典範：我支持繁榮而自主的經濟，讓台灣產業與正在重組的國際供應鏈緊密連結，與世界共榮。","民主台灣，世界典範：我主張民主且多元的台灣，堅守國家主權，不分族群、性別、背景的人民皆享有尊嚴與保障。","推動立法：《最低工資法》立法，基本工資持續調高。","推動立法：《交通基本法》立法，提升交通安全。","推動立法：《社會救助法》修正，降低弱勢補助門檻。","推動立法：《人工生殖法》修正，保障女性生育權。","建設：捷運萬大線通車，道路、人行道更新，發展沿線商圈。","建設：串連中正區藝文廊道，催生親子美學空間。","文化：提高文化預算，促進藝術振興，保障藝文工作者權益。","文化：支持「台流」，扶植文化內容創作，發展影視音產業。","育兒：降低育兒負擔，公托補助提升至7千元起，準公托及保母服務補助提升至1萬3千元。","育兒：增設公托、公幼，彈性育嬰假以「日」或「小時」計算。","銀髮：長照住宿式機構補助提高至每人每年18萬元，強化家庭照顧者「喘息服務」。","銀髮：打造樂齡社區，增加銀髮健康運動據點。","教育：家長減壓，高中職免學費，補助私大生每年3萬5千元。","教育：推動雙語教育環境，加強母語教育。","居住：囤房稅2.0、遏止房屋炒作、落實《平均地權條例》。","居住：實現居住正義，加速社會住宅興建，試辦入住輪候制。","體育：主張「體育署」升級「體育部」，增加全國體育預算。","體育：支持街舞、滑板新興運動，推展「全民體育」基層培育。","性別：落實《性騷擾防治法》《性別平等工作法》《性別平等教育法》。","性別：防治數位性暴力，性平教育再升級。","年輕國會：推動國會外交，加強民主交流。","年輕國會：落實透明國會，資訊公開揭露。"]$items$::JSONB)
        ) AS reviews(claim_id, person_id, candidate_id, expected_md5, expected_length, expected_source_md5, repair_method, repaired_items)
    LOOP
        UPDATE public.person_claims AS claim
        SET claim_json = pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(COALESCE(claim.claim_json, '{}'::JSONB), '{items}', review.repaired_items, TRUE),
                    '{contentSplit}',
                    COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB) || pg_catalog.jsonb_build_object(
                        'reviewStatus', 'reviewed',
                        'releaseQuality', pg_catalog.jsonb_build_object('version', 'verified-high-omission-platforms-04-20260907', 'reasonCodes', '[]'::JSONB)
                    ),
                    TRUE
                ),
                '{platformQualityAudit}',
                COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB) || pg_catalog.jsonb_build_object(
                    'repairVersion', 'verified-high-omission-platforms-04-20260907',
                    'repair', review.repair_method,
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

    IF total_affected <> 8 THEN
        RAISE EXCEPTION 'Expected eight verified high-omission platform reviews, updated %', total_affected;
    END IF;
END
$review$;

WITH official_profiles (
    person_id, candidate_id, platform_claim_id, claim_scope, birth_date, gender,
    party_affiliation, education_items, experience_items
) AS (
    VALUES
        ('9c6365ef-b3ed-4b49-87e7-6adbe925792a'::UUID,'e67f981c-16b4-496b-9c7a-030aa92cd23e'::UUID,'2d41ca1b-b652-45db-9ac0-208e279b68b7'::UUID,'cec-2022-bulletin:niu-xu-ting','1990-10-17','male','無','["龜山國小","大有國中","武陵高中","政治大學外交系","倫敦政經學院（LSE）國際政治經濟學碩士"]'::JSONB,'["現任桃園市議員","「桃園新選風」連線召集人","公民記者","「龜山故事」空拍影片製作人"]'::JSONB),
        ('2010bd71-f748-45b3-a947-4b69ad875b40'::UUID,'657afb62-c2fb-4a1c-8472-48320861c9dc'::UUID,'4f478367-6fbd-4bf4-ab22-67ee22b5bc40'::UUID,'official-council-page:wang-hsin-yi','1970-06-24','female','中國國民黨','["台師大國家事務與管理法學碩士","東吳大學企管、政治雙學士"]'::JSONB,'["台北市議會國民黨黨團書記長","國民黨中央委員","國民黨台北市黨部副主任委員","工商建設研究會北區聯誼會會長","教育部部定講師TPMA百大名師","國民黨中央青年部副主任","東森／中天電視台新聞主播、記者","民眾日報副社長"]'::JSONB),
        ('59075080-197e-4702-92c3-56ecfad200a1'::UUID,'cfca9ada-2029-4f6a-a259-a318176d0607'::UUID,'041caeef-1272-4b67-b720-c0556b321a07'::UUID,'cec-2022-bulletin:wang-ping-han','1968-09-24','male','中國國民黨','["新港國小","鳳岡國中"]'::JSONB,NULL::JSONB),
        ('639bdf4c-a801-48b7-9ca6-44a3aa016c9a'::UUID,'9e126312-18fc-4e43-81c2-19dce69b71ad'::UUID,'748a57ef-a5cd-48d4-9689-9f77908d86de'::UUID,'cec-2022-bulletin:wang-hao','1990-03-13','male','時代力量','["國立臺灣大學新聞研究所碩士","國立臺灣大學農業化學系學士"]'::JSONB,'["立法委員陳椒華辦公室嘉義服務處西區主任","嘉義市產業總工會顧問","時代力量嘉義市黨部執行長","地方法院勞動調解委員","臺灣汽車貨運暨倉儲業產業工會總幹事","新北市產業總工會秘書長","桃園縣（市）產業總工會秘書"]'::JSONB),
        ('2c35654e-40bd-49ff-b612-5140850c5857'::UUID,'fc34263d-5782-413c-8800-43ac2b018d7f'::UUID,'a400fa49-28bc-4e75-85a4-860e9d722582'::UUID,'cec-2024-bulletin:wang-hung-wei','1964-07-10','female','中國國民黨','["國立政治大學新聞學系","北一女中","仁愛國中","民權國小"]'::JSONB,'["第10屆立法委員","臺北市議會第10、11、12、13、14屆議員","聯合報大台北中心主任","聯合報經濟組組長、召集人","聯合晚報經濟組組長"]'::JSONB),
        ('bc670a37-1175-4d6a-853c-a1f430840455'::UUID,'c0ce4bc6-aee2-4b71-8bb5-0ca61f28c714'::UUID,'80ad8758-18f6-4b3a-990e-a7e499dc6e95'::UUID,'official-council-page:pai-pei-ju',NULL::TEXT,NULL::TEXT,'中國國民黨','["政治大學行政管理碩士","實踐大學資訊管理學系","文德女中","誠正國中","北峰國小","南港國小"]'::JSONB,'["第16屆台北縣議員","第1、2、3屆新北市議員","中國國民黨全國黨代表","新北市核安監督委員會委員","義消第六大隊汐止防宣隊分隊長"]'::JSONB),
        ('000ec4ee-d284-4df3-8ddc-0df686d59bff'::UUID,'e52c930e-b647-4b53-9ed1-e6ff18e26039'::UUID,'5e0039fe-beff-4928-b9b8-e9ae7a89f77b'::UUID,'official-council-page:ho-wen-hai',NULL::TEXT,NULL::TEXT,'民主進步黨','["臺中市鎮平國小","臺中市崇倫國中","新民高中"]'::JSONB,'["臺中市議員","臺中市議會102及106年民進黨團總召","蔡英文競選總統臺中總部副總幹事","陳水扁競選總統臺中總部副總幹事","張廖萬堅競選立委總部總幹事","臺中市何氏宗親會榮譽理事長","鎮平國小、崇倫國中校友會創會長","新民高中校友會理事長","臺中市體育總會單車委員會主委","南屯區體育會自行車委員會主委"]'::JSONB),
        ('f0a760ab-2763-4806-9d15-873bdac1e97f'::UUID,'1c3a6d63-292b-4a58-b417-c1366577ae81'::UUID,'0742aa7b-ad12-4a8c-975c-d8b725972e7c'::UUID,'cec-2024-bulletin:wu-pei-yi','1987-01-20','female','民主進步黨','["清華大學社會學研究所碩士","台灣大學政治學系政治理論組學士","景美女中"]'::JSONB,'["第13、14屆台北市議員","美國國務院國際領袖台灣代表","新境界智庫文化政策諮詢委員","蔡英文總統競選總部副主任","民進黨發言人","台北市體育總會理事","東園球類運動推廣協會榮譽理事長","街舞小學校比賽創辦人","萬華大鬧熱共同發起人","台大景美成功校友會會長","太陽花運動參與者"]'::JSONB)
), expanded_claims AS (
    SELECT profile.person_id, profile.candidate_id, profile.claim_scope,
           source_claim.source_name, source_claim.source_url,
           claim.claim_type, claim.claim_value, claim.items, claim.field
    FROM official_profiles AS profile
    JOIN public.person_claims AS source_claim ON source_claim.id = profile.platform_claim_id
    CROSS JOIN LATERAL (
        VALUES
            ('birth_date', profile.birth_date, NULL::JSONB, 'birth_date'),
            ('gender', profile.gender, NULL::JSONB, 'gender'),
            ('party_affiliation', profile.party_affiliation, NULL::JSONB, 'recommended_party'),
            ('education', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.education_items) WITH ORDINALITY item(value, ordinal)), profile.education_items, 'education'),
            ('experience', (SELECT pg_catalog.string_agg(value, E'\n' ORDER BY ordinal) FROM pg_catalog.jsonb_array_elements_text(profile.experience_items) WITH ORDINALITY item(value, ordinal)), profile.experience_items, 'experience')
    ) AS claim(claim_type, claim_value, items, field)
    WHERE claim.claim_value IS NOT NULL
)
INSERT INTO public.person_claims (
    claim_key, person_id, candidate_id, claim_type, claim_value, claim_json,
    confidence_level, review_status, visibility, source_name, source_url,
    observed_at, is_public, review_score, scoring_version, scoring_reasons, auto_reviewed_at
)
SELECT
    'official-profile:' || claim_scope || ':' || claim_type,
    person_id, candidate_id, claim_type, claim_value,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'field', field,
        'items', items,
        'productionRelease', '20260907-official-profile-transcription-04'
    )),
    'A', 'verified', 'public', source_name, source_url,
    CASE WHEN claim_scope LIKE '%2024%' THEN '2024-01-12T16:00:00+00:00'::TIMESTAMPTZ ELSE '2022-11-25T16:00:00+00:00'::TIMESTAMPTZ END,
    TRUE, 100, 'official-source-user-assisted-profile-v1',
    '["Official election bulletin or council page","User-assisted transcription from supplied official source"]'::JSONB,
    pg_catalog.now()
FROM expanded_claims
ON CONFLICT (claim_key) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    candidate_id = EXCLUDED.candidate_id,
    claim_type = EXCLUDED.claim_type,
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
    platform_count INTEGER;
    profile_count INTEGER;
BEGIN
    SELECT pg_catalog.count(*) INTO platform_count
    FROM public.person_claims
    WHERE id = ANY (ARRAY[
        '2d41ca1b-b652-45db-9ac0-208e279b68b7','4f478367-6fbd-4bf4-ab22-67ee22b5bc40',
        '041caeef-1272-4b67-b720-c0556b321a07','748a57ef-a5cd-48d4-9689-9f77908d86de',
        'a400fa49-28bc-4e75-85a4-860e9d722582','80ad8758-18f6-4b3a-990e-a7e499dc6e95',
        '5e0039fe-beff-4928-b9b8-e9ae7a89f77b','0742aa7b-ad12-4a8c-975c-d8b725972e7c'
    ]::UUID[])
      AND claim_json #>> '{contentSplit,reviewStatus}' = 'reviewed'
      AND claim_json #>> '{contentSplit,releaseQuality,version}' = 'verified-high-omission-platforms-04-20260907'
      AND claim_json #>> '{platformQualityAudit,classification}' = 'verified_repair';

    IF platform_count <> 8 THEN
        RAISE EXCEPTION 'Expected eight verified platform repairs, found %', platform_count;
    END IF;

    SELECT pg_catalog.count(*) INTO profile_count
    FROM public.person_claims
    WHERE claim_key LIKE 'official-profile:%'
      AND claim_json ->> 'productionRelease' = '20260907-official-profile-transcription-04'
      AND review_status = 'verified'
      AND visibility = 'public'
      AND is_public IS TRUE;

    IF profile_count <> 35 THEN
        RAISE EXCEPTION 'Expected 35 verified profile claims, found %', profile_count;
    END IF;
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
