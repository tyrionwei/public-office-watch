BEGIN;

-- Bridge exact production pre-repair texts to the audited migration baseline.
-- This stays inside the release transaction: the final repair must succeed.
CREATE TEMP TABLE release_source_baselines (id uuid PRIMARY KEY, person_id uuid NOT NULL, candidate_id uuid, claim_key text NOT NULL, production_text text NOT NULL, audited_text text NOT NULL) ON COMMIT DROP;
INSERT INTO release_source_baselines VALUES
('2730e39b-a90a-4540-ab2c-4c9d01d4c3eb'::uuid,'f2b71c92-997e-4061-84fb-cbef68d0b202'::uuid,'2fc3b5a7-5b32-4784-9d7e-969816da6743'::uuid,'cec-platform:2022:votetw-candidate-bc820ec16ee48447','1. 守護兒少成長 , 為地方爭取設立公共化托嬰中心 , 爭取公幼增班 , 檢討托育品質 , 監督評鑑制
度 ; 爭取親子館 , 提供婦幼安心休舌時間 , 傾聽地方婦幼心聲 , 提高婦幼健康補助 , 積極協助
婦女就業。
2. 強化在地語言及雙語教育 , 趨養國家未來人才 , 順利接軌國際。
3. 發揚傳統宗教文化價值 , 並爭取廟會傳承交流補助。
4. 提侶運動風氣及教育 , 推廣體育活動 , 監督及爭取全民運動館。
5. 重視文化保存、 環境教育 , 監督及爭取活化中央廣播電台鹿港分台用地。
6. 積極發展鹿港觀光產業 , 結合鄰近鄉鎮特色產業 , 爭取假日市集 , 提供街頭藝人表演平台。
7. 落實長期照護 , 整合社區與鄰里資源 , 打造友善高齡環境 ; 媒合義診醫護人員 , 為弱勢族群強
化醫療照護需求及相關資訊上的供給。
8. 促請縣府加強並推廣青年職業訓練 , 成立青創基地協助青年創業 , 建立創業平台 , 增加青年朋
友互動的機會 , 提升各領域的創新能量 , 及職場競爭力。
9. 加強推廣癇物登記及飼主責任教育 , 增加預算對寵物絕育、 疫苗 , 推動認養代替購買 , 改善寵
物殯華問題 , 洗實生命教育 , 及爭取寵物公園。
@ 超越黨派 , 爭取建設 , 監督縣政 , 勤跑基層 , 傾聽民意 , 做好服務 , 落實社福 , 關懷弱勢。','1. 守護兒少成長，為地方爭取設立公共化托嬰中心，爭取公幼增班，檢討托育品質，監督評鑑制度；爭取親子館，提供婦幼安心休憩時間，傾聽地方婦幼心聲，提高婦幼健康補助，積極協助婦女就業。
2. 強化在地語言及雙語教育，培養國家未來人才，順利接軌國際。
3. 發揚傳統宗教文化價值，並爭取廟會傳承交流補助。
4. 提倡運動風氣及教育，推廣體育活動，監督及爭取全民運動館。
5. 重視文化保存、環境教育，監督及爭取活化中央廣播電台鹿港分台用地。
6. 積極發展鹿港觀光產業，結合鄰近鄉鎮特色產業，爭取假日市集，提供街頭藝人表演平台。
7. 落實長期照護，整合社區與鄰里資源，打造友善高齡環境；媒合義診醫護人員，為弱勢族群強化醫療照護需求及相關資訊上的供給。
8. 促請縣府加強並推廣青年職業訓練，成立青創基地協助青年創業，建立創業平台，增加青年朋友互動的機會，提升各領域的創新能量及職場競爭力。
9. 加強推廣寵物登記及飼主責任教育，增加預算對寵物絕育、疫苗，推動認養代替購買，改善寵物殯葬問題，落實生命教育及爭取寵物公園。
10. 超越黨派，爭取建設，監督縣政，勤跑基層，傾聽民意，做好服務，落實社福，關懷弱勢。'),
('28ee7985-cb15-45df-a423-6126faf35f50'::uuid,'16132a70-c7a7-497f-9b8d-bde17ccb4aad'::uuid,'fac161c9-f6e4-4d21-9456-72921b6e636f'::uuid,'cec-platform:2022:votetw-candidate-b39af6e932dcff01','AWE RA RR > 守護民主 , RUA , 不水政治口水. 郭建盟為高雄做過什麼9 fel [a]
殷堅持公說、市民權益、政府權力三方權力對等立法原則. 2848 OR Code 一
Ae Fi > WEAR A AIA BMA. Roca
殷彌濟&觀光發蝴: (L旋拼台積電六廠建廠營運,建裡半導骨產業鏈,扭轉人口外移低薪產業困境. (2)推社
宅、技職教育、勞訓、合作事業,緩和高科技轉型衍生伙富差距、靜年爰忙、結構性失業,(@y產製以高雄為
主題之自產國際手廓,將遊戲產業發展策略由「鼓勵玩」扭轉為「設計生產 ),推展結合元宇宙、區塊鏈數
位影音內容產業. )訂定以產值、獲利、就業人口成長為KPI 指標之能源轉型、5GAIOT 產業發展計畫.
''5)推動以海音中心、衛武營、晉二、旅鏈大樓、會展中心營運為主架構的高階服務業轉型與夜經濟發展計
劃.(6)推動以社群主題、文創事業為內涵的傳統商圈發展計畫. 0)建構主攻日韓中觀光客來客數為主軸的觀
光政策, (8)推動癌光發展基金自償興建跨中鳥、旗津、柴山纜車推動亞灣海洋休閒專區.
扯婦幼弱勢保護 : (1力倡0 到6歲國家養政策與育兒環境. (2)防兒虛家其,扶助20 歲下小爸媽. (9強化社會安
全網社區聯防,鼓勵民眾通報.d)就法、預算、政策面推展合作事業,助中高齡弱勢旅群就業,經濟脫貧,
殷交通&城市安全 : 01)危險儲槽恩管線碼頭全面搬離亞灣. (@)嚴促交通、警政耦行降低高雄車禍死傷率相關措
施.《3)智慧號誌讓警消車輛安全通過紅綠燈. 4杜絕陷阱式的行政檢查與交通裁點.
委銀髮照護: 社區 c 化連結照護高齡獨居長華,
殷空汗&環保 : (1)焚化廠拒收外縣市事業鹿奈物. (2市府自營南區焚化廠力推垃圾減量. (9)大眾交通運具人全面電
動化 ''力推共享運具.
委食安: (])獎勵食安吹足者. @學童營養午餐 100%採購光源標章食材. (@)質譜儀進駐果菜市場為農藥超標把
關. @)加強農產品、食材、食品溯源標示與源頭檢驗.
Abs 47 ( DSEP RAB PRS RE OCR ORBVBRARA ARE OO VARA ARES.','從政首重民生經濟，守護民主，不作秀，不涉政治口水。
堅持公益、市民權益、政府權力三方權力對等法原則。
如有酒駕，立即辭去市議員職務。

經濟與觀光發展：
1. 力拚台積電六廠建廠營運，建構半導體產業鏈，扭轉人口外移、低薪產業困境。
2. 推社宅、技職教育、勞訓、合作事業，緩和高科技轉型衍生貧富差距、青年窮忙、結構性失業。
3. 產製以高雄為主題之自產國際手遊，將遊戲產業發展策略由「鼓勵玩」扭轉為「設計生產」，推展結合元宇宙、區塊鏈數位影音內容產業。
4. 訂定以產值、獲利、就業人口成長為KPI指標之能源轉型、5G AIoT產業發展計畫。
5. 推動以海音中心、衛武營、駁二、旅運大樓、會展中心營運為主架構的高階服務業轉型與夜經濟發展計畫。
6. 推動以社群主題、文創事業為內涵的傳統商圈發展計畫。
7. 建構主攻日韓中觀光客來客數為主軸的觀光政策。
8. 推動觀光發展基金自償，興建跨中島、旗津、柴山纜車，推動亞灣海洋休閒專區。

婦幼弱勢保護：
1. 力倡0到6歲國家養政策與育兒環境。
2. 防兒虐家暴，扶助20歲以下小爸媽。
3. 強化社會安全網社區聯防，鼓勵民眾通報。
4. 就法、預算、政策面推展合作事業，助中高齡弱勢族群就業、經濟脫貧。

交通與城市安全：
1. 危險儲槽及管線碼頭全面搬離亞灣。
2. 嚴促交通、警政執行降低高雄車禍死傷率相關措施。
3. 智慧號誌讓警消車輛安全通過紅綠燈。
4. 杜絕陷阱式的行政檢查與交通裁罰。

銀髮照護：社區C化連結照護高齡獨居長者。

空污與環保：
1. 焚化廠拒收外縣市事業廢棄物。
2. 市府自營南區焚化廠，力推垃圾減量。
3. 大眾交通運具全面電動化，力推共享運具。

食安：
1. 獎勵食安吹哨者。
2. 學童營養午餐100%採購溯源標章食材。
3. 質譜儀進駐果菜市場，為農藥超標把關。
4. 加強農產品、食材、食品溯源標示與源頭檢驗。'),
('7bfc192d-e933-457f-a961-426d6d47e4af'::uuid,'cd8a6c0c-69ed-4101-a059-d3ad36d9f411'::uuid,'1f2f0d1b-aa8d-47d2-b3f7-114d2e06a751'::uuid,'cec-platform:2024:votetw-candidate-bcf087cf9a9c3fc4','政見
1. 建設鳳山車站6十10層「空中鳳城」 ,打造全臺首座有影城、商場的車站,要求2024年底與
大家見面! 成為全臺第一個擁有電影院的車站,並提供商場、運動中心、空中禮堂、青創中心
等多樣化的服務進駐。
2. 成功招商三井 Lalaport 投資鳳山,陳其偶市長直言 :許智傑化不可能為可能!打造佔地 4
甲多、建地2甲多,地上6層地下2層的超大型百貨公司,帶來鳳山經濟好光景。
3. 推動捷運黃線核定成功,要求2028年全線通車。並增加設計連接三井百貨公司、衛武營國
家藝術文化中心及衛武營公園的地下街或地下聯通道。
4. 推動高雄陸海空城市,督促高雄小港國際機場改造如期如質完成,各航線盡快復飛以及打造
高雄港埠旅運中心,吸引國際郵輪作為母港,發展觀光互動旅運服務。
5. 推動國道七號核定,爭取1537.9億元,督促114年動工119年全線通車。
6. 在立法院推動並通過長照及幼章津貼預算,照顧更多長輩和孩子們,並持續爭取長青照護、
社會住宅及幼兒教育之社福預算與教育補助。
7. 成功推動客家電視台與客家廣播電台的成立。並催生鳳山客家文 創中心進駐黃埔新村,持
續推動客家文化的提升。','1. 建設鳳山車站6＋10層「空中鳳城」，打造全臺首座有影城、商場的車站，要求2024年底與大家見面！成為全臺第一個擁有電影院的車站，並提供商場、運動中心、空中禮堂、青創中心等多樣化的服務進駐。
2. 成功招商三井LaLaport投資鳳山，陳其邁市長直言：「許智傑化不可能為可能！」打造佔地4甲多、建地2甲多，地上6層、地下2層的超大型百貨公司，帶來鳳山經濟好光景。
3. 推動捷運黃線核定成功，要求2028年全線通車。並增加設計連接三井百貨公司、衛武營國家藝術文化中心及衛武營公園的地下街或地下聯通道。
4. 推動高雄陸海空城市，督促高雄小港國際機場改造如期如質完成，各航線盡快復飛，以及打造高雄港埠旅運中心，吸引國際郵輪作為母港，發展觀光互動旅運服務。
5. 推動國道七號核定，爭取1,537.9億元，督促114年動工、119年全線通車。
6. 在立法院推動並通過長照及幼童津貼預算，照顧更多長輩和孩子們，並持續爭取長青照護、社會住宅及幼兒教育之社福預算與教育補助。
7. 成功推動客家電視台與客家廣播電台的成立，並催生鳳山客家文創中心進駐黃埔新村，持續推動客家文化的提升。'),
('a05abc8d-5a33-402f-b3d3-1347a1f34b6d'::uuid,'a89660cb-b58a-441b-a09f-c0972ac81073'::uuid,'f6d65780-2609-4848-951b-f556df487d2d'::uuid,'cec-platform:2022:votetw-candidate-aca615f73ca43f90','台以台灣民眾黑區誰 4 還多 af):3 罰張雪如需要您
社會福利 {大型公益 |
1. 婦功 : 建構完整社會安全網、 橫向立即通報機制 , 從 | 1. 推動無喪葬費善終計畫。
里鄰長、 視區 , 保護婦幼免於恐懼、 防家暴、 防性侵 , | 2. 持疆舉辦彰化縣低收、 獨老、 邊緣戶、 街友等寒冬送
從幼兒園、 國小禁根。 暖千人饗宴。
2. 老人 : 福區銀髮多元照護計畫 , 招募退休志工至各視 | 3. 持疆舉辦低收學童我愛寶貝夏令營。
區參與陪伴與活動 , 讓老人健康照護落實到各角落。 4. 不定期舉辦助貧活動。
3. 弱勢 : 監督政府興建社會住宅 , 提供弱勢族群安穩住 | 5. 致力推動各社區志工隊、 慈善會、 校園等巡迴演講。
所 , 強化中低收入戶以外之急難救助網、 絆勢供餐、 了臨
時住所服務。
爭取國中小程式教育數位載具補助 , 鄉士教材在地化 , (
品 J
色公 © SPR a R=
a EA Tg Te A
a TT 和
Hh SCSRINEE © HE aE maNS Ee RRS Xe «| Efdapnaiges apa JOEL
農特產推廣 , 定期舉辦地方特色活動 , 推動產業觀光 EE 和 a = 5
聚落。','● 社會福利
1. 婦幼：建構完整社會安全網、橫向立即通報機制，從里鄰長、社區，保護婦幼免於恐懼、防家暴、防性侵，從幼兒園、國小紮根。
2. 老人：社區銀髮多元照護計畫，招募退休志工至各社區參與陪伴與活動，讓老人健康照護落實到各角落。
3. 弱勢：監督政府興建社會住宅，提供弱勢族群安穩住所，強化中低收入戶以外之急難救助網、弱勢供餐、臨時住所服務。

● 教育
爭取國中小程式教育數位載具補助，鄉土教材在地化，法治教育列入國中小課程，加強校園安全，打造共融特色公園。

● 休閒文化
地方文史導覽、推廣，強化各鄉鎮特色景點結合美食、農特產推廣，定期舉辦地方特色活動，推動產業觀光聚落。

● 大型公益
1. 推動無喪葬費善終計畫
2. 持續舉辦彰化縣低收、獨老、邊緣戶、街友等寒冬送暖千人饗宴
3. 持續舉辦低收學童我愛寶貝夏令營
4. 不定期舉辦助貧活動
5. 致力推動各社區志工隊、慈善會、校園等巡迴演講'),
('ea5ee72f-9981-4b5f-b6ba-787a86ebf068'::uuid,'a7a50e51-cae5-49d7-a664-c4bd25b3abb2'::uuid,'d19a94d2-976c-43cf-98aa-58965c4e2007'::uuid,'cec-platform:2022:votetw-candidate-a52210aebdd090da',''' 嘉倍幸福 , 一言為定」 郭定緯以細膩、 堅定態度 , 站在第一線 , 把關市政、 挺身捍衛市民權益 , 讓嘉義更宜居、
SHEE ©
@ EE TEC EE © 1 堅持理性問政 , 捍衛公益與市民權益。 2. 專業嚴審預算 , 為市民荷包把關。
伍服務市民一定衝 :1. 勤奮走動基層 , 親力親為替市民發聲。
馬青年就業一定穩 : 1. 放寬青年創業補助門檻 , 並發展創業募資平台 , 吸引青年回嘉創業。2. 閒置公有地增建青年
住宅 , 讓青年返鄉買得起房。
人馬教育扎根一定好 : 1. 推動嘉義市圖書總館 , 豐富城市精神食糧。2. 增加重點體育學校經費 , 培植優秀體育選手。
伍文化傳承一定行 :1. 市內公園的主題串連 , 編織嘉義在地故事。
便高齡照護一定優 : 1. 閒置空間增設日照中心 , 創造友善銀髮城市。2. 普設居家照護鈴 , 塑造老齡友善社區環境。
全交通一定順 :1. 增加行人徒步區 , 擴大市區無障礙步行空間。2. 增設自行車專用道 , 提高公共空間自行車停車設
施。
馬生育一定安 :1. 提高生育津貼 , 並推動施行坐月子津貼。2. 爭取增設公辦托育、 幼兒園 , 落實社區保母優質化。
伍毛孩一定樂 :1. 爭取推動市立動物醫院 , 並規劃專屬寵物公園。2. 增設公園狗便清潔箱 , 兼具美化與境教功能。','「嘉倍幸福，一言為定」郭定緯以細膩、堅定態度，站在第一線，把關市政、挺身捍衛市民權益，讓嘉義更宜居、更幸福。

●監督市政一定強：
1. 堅持理性問政，捍衛公益與市民權益。
2. 專業嚴審預算，為市民荷包把關。

●服務市民一定衝：
1. 勤奮走動基層，親力親為替市民發聲。

●青年就業一定穩：
1. 放寬青年創業補助門檻，並發展創業募資平台，吸引青年回嘉創業。
2. 閒置公有地增建青年住宅，讓青年返鄉買得起房。

●教育扎根一定好：
1. 推動嘉義市圖書總館，豐富城市精神食糧。
2. 增加重點體育學校經費，培植優秀體育選手。

●文化傳承一定行：
1. 市內公園的主題串連，編織嘉義在地故事。

●高齡照護一定優：
1. 閒置空間增設日照中心，創造友善銀髮城市。
2. 普設居家照護鈴，塑造老齡友善社區環境。

●交通一定順：
1. 增加行人徒步區，擴大市區無障礙步行空間。
2. 增設自行車專用道，提高公共空間自行車停車設施。

●生育一定安：
1. 提高生育津貼，並推動施行坐月子津貼。
2. 爭取增設公辦托育、幼兒園，落實社區保母優質化。

●毛孩一定樂：
1. 爭取推動市立動物醫院，並規劃專屬寵物公園。
2. 增設公園狗便清潔箱，兼具美化與境教功能。');
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
            ('a05abc8d-5a33-402f-b3d3-1347a1f34b6d'::UUID,'a89660cb-b58a-441b-a09f-c0972ac81073'::UUID,'f6d65780-2609-4848-951b-f556df487d2d'::UUID,'578a610e224f392ffc96f854a7f96465','0391dcf04da79905b6dd654d4ff4f96d',404,NULL::TEXT,$items$[
                "社會福利／婦幼：建構完整社會安全網、橫向立即通報機制，從里鄰長、社區，保護婦幼免於恐懼、防家暴、防性侵，從幼兒園、國小紮根。",
                "社會福利／老人：社區銀髮多元照護計畫，招募退休志工至各社區參與陪伴與活動，讓老人健康照護落實到各角落。",
                "社會福利／弱勢：監督政府興建社會住宅，提供弱勢族群安穩住所，強化中低收入戶以外之急難救助網、弱勢供餐、臨時住所服務。",
                "教育：爭取國中小程式教育數位載具補助，鄉土教材在地化，法治教育列入國中小課程，加強校園安全，打造共融特色公園。",
                "休閒文化：地方文史導覽、推廣，強化各鄉鎮特色景點結合美食、農特產推廣，定期舉辦地方特色活動，推動產業觀光聚落。",
                "大型公益：推動無喪葬費善終計畫。",
                "大型公益：持續舉辦彰化縣低收、獨老、邊緣戶、街友等寒冬送暖千人饗宴。",
                "大型公益：持續舉辦低收學童我愛寶貝夏令營。",
                "大型公益：不定期舉辦助貧活動。",
                "大型公益：致力推動各社區志工隊、慈善會、校園等巡迴演講。"
            ]$items$::JSONB),
            ('7bfc192d-e933-457f-a961-426d6d47e4af'::UUID,'cd8a6c0c-69ed-4101-a059-d3ad36d9f411'::UUID,'1f2f0d1b-aa8d-47d2-b3f7-114d2e06a751'::UUID,'53d84a0472080dbe6b7b0fd249d6d2b4','67a3f696fd00b33f83d56a84cf5b5203',489,NULL::TEXT,$items$[
                "建設鳳山車站6＋10層『空中鳳城』，打造全臺首座有影城、商場的車站，要求2024年底與大家見面！成為全臺第一個擁有電影院的車站，並提供商場、運動中心、空中禮堂、青創中心等多樣化的服務進駐。",
                "成功招商三井LaLaport投資鳳山，陳其邁市長直言：『許智傑化不可能為可能！』打造佔地4甲多、建地2甲多，地上6層、地下2層的超大型百貨公司，帶來鳳山經濟好光景。",
                "推動捷運黃線核定成功，要求2028年全線通車。並增加設計連接三井百貨公司、衛武營國家藝術文化中心及衛武營公園的地下街或地下聯通道。",
                "推動高雄陸海空城市，督促高雄小港國際機場改造如期如質完成，各航線盡快復飛，以及打造高雄港埠旅運中心，吸引國際郵輪作為母港，發展觀光互動旅運服務。",
                "推動國道七號核定，爭取1,537.9億元，督促114年動工、119年全線通車。",
                "在立法院推動並通過長照及幼童津貼預算，照顧更多長輩和孩子們，並持續爭取長青照護、社會住宅及幼兒教育之社福預算與教育補助。",
                "成功推動客家電視台與客家廣播電台的成立，並催生鳳山客家文創中心進駐黃埔新村，持續推動客家文化的提升。"
            ]$items$::JSONB),
            ('ea5ee72f-9981-4b5f-b6ba-787a86ebf068'::UUID,'a7a50e51-cae5-49d7-a664-c4bd25b3abb2'::UUID,'d19a94d2-976c-43cf-98aa-58965c4e2007'::UUID,'2cd53771027844408b782009019a5e9d','b4bc4dd96fc64acba663174d83ad4421',534,'「嘉倍幸福，一言為定」郭定緯以細膩、堅定態度，站在第一線，把關市政、挺身捍衛市民權益，讓嘉義更宜居、更幸福。',$items$[
                "監督市政一定強：堅持理性問政，捍衛公益與市民權益。",
                "監督市政一定強：專業嚴審預算，為市民荷包把關。",
                "服務市民一定衝：勤奮走動基層，親力親為替市民發聲。",
                "青年就業一定穩：放寬青年創業補助門檻，並發展創業募資平台，吸引青年回嘉創業。",
                "青年就業一定穩：閒置公有地增建青年住宅，讓青年返鄉買得起房。",
                "教育扎根一定好：推動嘉義市圖書總館，豐富城市精神食糧。",
                "教育扎根一定好：增加重點體育學校經費，培植優秀體育選手。",
                "文化傳承一定行：市內公園的主題串連，編織嘉義在地故事。",
                "高齡照護一定優：閒置空間增設日照中心，創造友善銀髮城市。",
                "高齡照護一定優：普設居家照護鈴，塑造老齡友善社區環境。",
                "交通一定順：增加行人徒步區，擴大市區無障礙步行空間。",
                "交通一定順：增設自行車專用道，提高公共空間自行車停車設施。",
                "生育一定安：提高生育津貼，並推動施行坐月子津貼。",
                "生育一定安：爭取增設公辦托育、幼兒園，落實社區保母優質化。",
                "毛孩一定樂：爭取推動市立動物醫院，並規劃專屬寵物公園。",
                "毛孩一定樂：增設公園狗便清潔箱，兼具美化與境教功能。"
            ]$items$::JSONB),
            ('28ee7985-cb15-45df-a423-6126faf35f50'::UUID,'16132a70-c7a7-497f-9b8d-bde17ccb4aad'::UUID,'fac161c9-f6e4-4d21-9456-72921b6e636f'::UUID,'bf1c2c144c171e45bffbfedfc0036459','78c5b630b3d916da6a7463d67c21c1e3',804,'從政首重民生經濟，守護民主，不作秀，不涉政治口水。堅持公益、市民權益、政府權力三方權力對等法原則。如有酒駕，立即辭去市議員職務。',$items$[
                "經濟與觀光發展：力拚台積電六廠建廠營運，建構半導體產業鏈，扭轉人口外移、低薪產業困境。",
                "經濟與觀光發展：推社宅、技職教育、勞訓、合作事業，緩和高科技轉型衍生貧富差距、青年窮忙、結構性失業。",
                "經濟與觀光發展：產製以高雄為主題之自產國際手遊，將遊戲產業發展策略由『鼓勵玩』扭轉為『設計生產』，推展結合元宇宙、區塊鏈數位影音內容產業。",
                "經濟與觀光發展：訂定以產值、獲利、就業人口成長為KPI指標之能源轉型、5G AIoT產業發展計畫。",
                "經濟與觀光發展：推動以海音中心、衛武營、駁二、旅運大樓、會展中心營運為主架構的高階服務業轉型與夜經濟發展計畫。",
                "經濟與觀光發展：推動以社群主題、文創事業為內涵的傳統商圈發展計畫。",
                "經濟與觀光發展：建構主攻日韓中觀光客來客數為主軸的觀光政策。",
                "經濟與觀光發展：推動觀光發展基金自償，興建跨中島、旗津、柴山纜車，推動亞灣海洋休閒專區。",
                "婦幼弱勢保護：力倡0到6歲國家養政策與育兒環境。",
                "婦幼弱勢保護：防兒虐家暴，扶助20歲以下小爸媽。",
                "婦幼弱勢保護：強化社會安全網社區聯防，鼓勵民眾通報。",
                "婦幼弱勢保護：就法、預算、政策面推展合作事業，助中高齡弱勢族群就業、經濟脫貧。",
                "交通與城市安全：危險儲槽及管線碼頭全面搬離亞灣。",
                "交通與城市安全：嚴促交通、警政執行降低高雄車禍死傷率相關措施。",
                "交通與城市安全：智慧號誌讓警消車輛安全通過紅綠燈。",
                "交通與城市安全：杜絕陷阱式的行政檢查與交通裁罰。",
                "銀髮照護：社區C化連結照護高齡獨居長者。",
                "空污與環保：焚化廠拒收外縣市事業廢棄物。",
                "空污與環保：市府自營南區焚化廠，力推垃圾減量。",
                "空污與環保：大眾交通運具全面電動化，力推共享運具。",
                "食安：獎勵食安吹哨者。",
                "食安：學童營養午餐100%採購溯源標章食材。",
                "食安：質譜儀進駐果菜市場，為農藥超標把關。",
                "食安：加強農產品、食材、食品溯源標示與源頭檢驗。"
            ]$items$::JSONB),
            ('2730e39b-a90a-4540-ab2c-4c9d01d4c3eb'::UUID,'f2b71c92-997e-4061-84fb-cbef68d0b202'::UUID,'2fc3b5a7-5b32-4784-9d7e-969816da6743'::UUID,'84e0046b093c13611c498d4f82fa95a0','ee3e5dc1717bb075196e58ffb23c98a2',502,NULL::TEXT,$items$[
                "守護兒少成長，為地方爭取設立公共化托嬰中心，爭取公幼增班，檢討托育品質，監督評鑑制度；爭取親子館，提供婦幼安心休憩時間，傾聽地方婦幼心聲，提高婦幼健康補助，積極協助婦女就業。",
                "強化在地語言及雙語教育，培養國家未來人才，順利接軌國際。",
                "發揚傳統宗教文化價值，並爭取廟會傳承交流補助。",
                "提倡運動風氣及教育，推廣體育活動，監督及爭取全民運動館。",
                "重視文化保存、環境教育，監督及爭取活化中央廣播電台鹿港分台用地。",
                "積極發展鹿港觀光產業，結合鄰近鄉鎮特色產業，爭取假日市集，提供街頭藝人表演平台。",
                "落實長期照護，整合社區與鄰里資源，打造友善高齡環境；媒合義診醫護人員，為弱勢族群強化醫療照護需求及相關資訊上的供給。",
                "促請縣府加強並推廣青年職業訓練，成立青創基地協助青年創業，建立創業平台，增加青年朋友互動的機會，提升各領域的創新能量及職場競爭力。",
                "加強推廣寵物登記及飼主責任教育，增加預算對寵物絕育、疫苗，推動認養代替購買，改善寵物殯葬問題，落實生命教育及爭取寵物公園。",
                "超越黨派，爭取建設，監督縣政，勤跑基層，傾聽民意，做好服務，落實社福，關懷弱勢。"
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
                    '{contentSplit}',COALESCE(claim.claim_json->'contentSplit','{}'::JSONB)||pg_catalog.jsonb_build_object('reviewStatus','reviewed','releaseQuality',pg_catalog.jsonb_build_object('version','verified-high-omission-platforms-11-20260907','reasonCodes','[]'::JSONB)),TRUE),
                '{platformQualityAudit}',COALESCE(claim.claim_json->'platformQualityAudit','{}'::JSONB)||pg_catalog.jsonb_build_object('repairVersion','verified-high-omission-platforms-11-20260907','repair','official_bulletin_full_text_resplit','classification','verified_repair'),TRUE),
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
        ('a05abc8d-5a33-402f-b3d3-1347a1f34b6d'::UUID,10),
        ('7bfc192d-e933-457f-a961-426d6d47e4af'::UUID,7),
        ('ea5ee72f-9981-4b5f-b6ba-787a86ebf068'::UUID,16),
        ('28ee7985-cb15-45df-a423-6126faf35f50'::UUID,24),
        ('2730e39b-a90a-4540-ab2c-4c9d01d4c3eb'::UUID,10)
    )
    SELECT pg_catalog.count(*) INTO validated_count
    FROM expected JOIN public.person_claims AS claim ON claim.id=expected.claim_id
    WHERE pg_catalog.jsonb_array_length(claim.claim_json->'items')=expected.item_count
      AND claim.claim_json#>>'{contentSplit,reviewStatus}'='reviewed'
      AND claim.claim_json#>>'{contentSplit,releaseQuality,version}'='verified-high-omission-platforms-11-20260907'
      AND claim.claim_json#>>'{platformQualityAudit,repair}'='official_bulletin_full_text_resplit'
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
