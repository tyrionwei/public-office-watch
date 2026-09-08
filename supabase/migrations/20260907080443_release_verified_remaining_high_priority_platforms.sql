BEGIN;

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
                ('17a101c6-4047-471b-a2d6-ec6dbbbcc9e0'::UUID, '602552a0-7c6a-4a1d-b9d3-491ccc19fecb'::UUID, 'dbc3419b-5a0f-4c69-bb36-f963c84814b6'::UUID, 'cec-platform:2022:votetw-candidate-4b9a35d90ca4d78b'::TEXT, 'db2c1f45c4da603ea160a22bfdbb59e3'::TEXT, 136, '25217f13f1734b82710268e3b510f1d4'::TEXT, 'official_bulletin_visual_ocr_correction'::TEXT, $items$["扮演政府及民眾溝通管道，加強為民謀福利","籌辦公民論壇，培育青年參政","加強族群融合，共存共好共榮","監督公部門經費支出及效能，提升台東全民實質幸福感","為弱勢、孤老、身心障礙、中低收經濟弱勢者爭取更周全福利","導入大型企業投資，增加縣民就業機會"]$items$::JSONB),
                ('1a559ded-e439-4804-9e35-8c2b9d02789d'::UUID, 'a4f35596-4472-4372-b650-2525d43c3a1e'::UUID, '5984c280-4a3a-4dcc-9407-a7b96facd941'::UUID, 'cec-platform:2024:votetw-candidate-45c61010c15107d4'::TEXT, 'b0d27264f5bbd3aa864fd1d75fd49862'::TEXT, 1117, '9c642eb96f9e84f8f16aa0f153fb1936'::TEXT, 'official_bulletin_exclude_explicit_completed_section'::TEXT, $items$["自治：設置部落公法人。制定原住民族自治法。推動共管區或先導自治區計畫。","土地：立法要求政府將《臺灣省土地權利清理辦法》第8條收歸國有之土地劃設為原住民族保留地。制定原住民族土地及海域法。","住宅：興建原住民族社會住宅，提高租屋、購屋及修繕補助。","教育：0至6歲公私立托育托教實質免費。提高原住民大學（專）生學雜費減免，學貸免利息。設立原住民族學校。","經濟就業：推動銀行專案辦理原住民低利率貸款、儲蓄互助社專案利率。擴大政府、公營事業及公設財團法人進用原住民。","都市原住民：增加都原發展經費，興建集會所、祭典場所，強化安居、就學、就業、融資、就養、健康及社會適應等發展方案。","語言文化：提高族語老師及語推人員待遇，增加部落、教會及同鄉會等語言文化扎根據點。設置族群領袖、頭目文化傳承事務補助費。","自然資源：立法開放使用安全有效之制式獵槍，推動都會區漁獵及海河岸採集權。","福利：原民勞保補助。勞工退休、老農津貼、台鐵及高鐵敬老票等原民調降至55歲。提升原鄉醫護資源。開辦原民長照保險。加速增設文健站。","預算及建設：設置原住民族建設發展基金，增加部落、文化、體育發展經費，持續推動花東鐵路雙軌化、花東快速道路、蘇花改二期工程，加強經濟產業及農田灌溉建設。普及機動幸福巴士。"]$items$::JSONB),
                ('205dd2ba-a3b0-4c92-9908-997ffe9e3451'::UUID, '3d3ebc9a-6fc0-44fc-94dd-ace3b446182c'::UUID, 'b99fc42c-0f8a-4827-96c5-847fe3736776'::UUID, 'cec-platform:2022:votetw-candidate-b3bc45e8d7005658'::TEXT, 'b8c74bd65e055ff616f9077573ba4223'::TEXT, 432, '04ff03ad011ec752edf9b2803b492b5f'::TEXT, 'official_bulletin_section_split_repair'::TEXT, $items$["爭取教育資源：爭取高中擴校或增建，讓學生就近入學優質高中。","爭取教育資源：爭取特教資源與課程，擴大照顧特教生與其家庭。","爭取教育資源：整合各階段創客資源，提供各年齡孩子由淺入深的科技教育規劃。","爭取教育資源：增加教育預算投注於軟體之比例，含獎勵優良師資、提升老師福利、鼓勵創新教學。","升級社會福利：責成縣府積極舉辦親職講座、活動，提供家長育兒教養之完整協助。","升級社會福利：推動銀髮俱樂部，鼓勵長者多運動，落實以長健代替長照。","升級社會福利：擴大敬老卡使用範圍，可用於敬老消費，讓竹縣成為友善樂齡城市。","友善智慧城市｜環境再造：推動豆子埔溪再造，讓豆子埔溪與周邊景觀成為竹北的驕傲！","友善智慧城市｜便捷交通：增加公車路線與YouBike站點，讓竹北成為綠色交通友善城市。","友善智慧城市｜開放政府：責成縣府整合公共服務之資通訊共同管溝，掌握數據並應用數據，增加便民創新服務。","友善智慧城市｜科技應用：增加固定式噪音照相維護夜間安寧、推動科技長照以科技輔助長者照顧、深化智慧交通應用，舒緩塞車問題。"]$items$::JSONB),
                ('3f6d392c-7fff-4ac8-ac78-edddb78423b0'::UUID, '290d741b-1198-4a10-92f3-b7cfec015a7d'::UUID, 'b68a6e87-5acc-4478-b021-4fb7048b99af'::UUID, 'cec-platform:2022:votetw-candidate-b33e8e376227df5d'::TEXT, '92359242f63a3ed83f5e08aed6869e9f'::TEXT, 239, '11591cf8267fe3a16e12f6121c43476d'::TEXT, 'official_bulletin_cross_checked_no_text_change'::TEXT, NULL::JSONB),
                ('3f892f33-bc4d-46b4-b1a1-1cb08c1c121d'::UUID, '8d618fdd-0f66-43b7-85e5-f933642cccdf'::UUID, 'c5ca0c2f-527d-45ff-977b-f6c85e47c707'::UUID, 'cec-platform:2024:votetw-candidate-f29f8a5f224aaeeb'::TEXT, '6860ac3a034491b3abf7384a0ca1df6c'::TEXT, 1036, '9c3f70eec047fd399440da6917ccbfcd'::TEXT, 'official_bulletin_exclude_achievement_intro'::TEXT, $items$["推動AI科技廊道！ 極力推動土城、三峽AI科技園區，結合捷運、快速道路及高速公路整體路網，串聯各科學園區，並透過立法院與行政院來共同推動，培養國家下一個兆元產業，帶動地方發展與就業，讓在地青年有未來。","推動親子守護大聯盟！ ①到6歲國家養2.0，青年學生國家挺！ 爭取親子陪伴票，在地推動年年有紙風車，兒童星光電影院，支持凍卵補助、產婦心諮，改善產育環境。","全面電線電纜地下化！ 推動台電電纜、電箱地下化，保護市民行走空間，恢復清潔的天空。","積極推動地方建設！ 推動樹林雙向交流道，解決北大塞車困境，爭取長福立體停車場改善三峽停車問題。續推學校地下停車場，改善都市停車問題，推動公館溝改善計畫，打造兩岸櫻花親水廊道。闢建零碳公園，創造減碳綠化生活。","打造三峽文化之都推動三峽觀光！ 爭取觀光署資助，推動三峽好行旅遊巴士。重新規劃整合連結，打造觀光熱點。","推動長照3.0 爭取老人全面照護 爭取土城、三峽捷運站站有社宅、解決青年居住問題！ 興建中1294戶、已決標423戶、規劃中782戶。"]$items$::JSONB),
                ('40367687-3c3a-4597-9b8e-28cebe100fbb'::UUID, '6950878a-9a09-4c70-8512-757b50af9293'::UUID, 'c4b7dd59-a103-4375-b0fb-f1a54677629f'::UUID, 'cec-platform:2024:votetw-candidate-32e40e93ebed6a0a'::TEXT, 'b30e1f8b968135da1440ed274c512ddb'::TEXT, 928, '4400485968c55041bfbb450a4e09ae56'::TEXT, 'official_bulletin_remove_contact_footer'::TEXT, $items$["行車安全的里程碑：建立台灣車輛撞擊測試制度（TNCAP），提供消費者公開完整車輛安全資訊，讓消費者有更多安全的車輛可選擇，降低道路意外事故傷亡率。","強化「銀新未來城」公益性：要求擴大日照中心服務量能與納入市價租金打八折的友善銀髮宅規劃。","督促地方建設如期如質施工：中央全額負擔工程款33.36億五股交流道改善工程動工；中央核定補助2.67億的汙水下水道倒閉工程也決標復工；爭取中央全額負擔五股疏左堤防增高工程共15.24億元，守護五股居民生命財產安全；爭取中央建設五股水環境治理及親水空間營造，109年起投資五股地區約25億元！","改善觀音山硬漢嶺通訊品質：成功協調中華電信完成基地台架設，緊急救援無阻礙，第二階段持續與其他電信業者溝通協調。","爭取空大校園社區化：空中大學分兩階段拆除保和街與中正路圍牆，形成友善人行步道空間。","升級、翻新學校建設：國中、小學班班有冷氣，設施設備、跑道、操場、老舊廁所全面更新，爭取經費超過億元，讓學生開心，家長放心。"]$items$::JSONB),
                ('53d21944-f4ac-424d-b8be-f2cd60369e3f'::UUID, '770313c5-9a0e-4bc9-8820-ab11168a29de'::UUID, '89bab075-f30b-4955-a844-5a1bfaa5a02f'::UUID, 'cec-platform:2024:votetw-candidate-39cd930b868b40f2'::TEXT, 'c7ba4c07a36530f7dbdff2ad2bf1b4db'::TEXT, 1114, 'ada5957bb67ac4c3d8c3e5cc48cf5d5e'::TEXT, 'official_bulletin_cross_checked_future_commitments'::TEXT, NULL::JSONB),
                ('571f28ef-da0f-4281-b1e6-6ced5ece8042'::UUID, '359ec9cb-1cf9-4610-a34d-6d64c1799b11'::UUID, 'dd0e64c1-e6cc-4e2c-a11f-53c337ea9a4a'::UUID, 'cec-platform:2022:votetw-candidate-ddd755e001b173b3'::TEXT, '8cc9bb234ac9dcec71b0704fc5cd5994'::TEXT, 633, '4f8664e323ef9d9079dbe470d7a755ef'::TEXT, 'official_bulletin_section_repair'::TEXT, $items$["安｜托老扶幼：惟有安全，才有安居樂業。以智慧安全城、智慧醫療、好日子愛心大平台2.0照顧每位市民；迎接2030年百萬銀髮族，完成百家社區長照機構，讓長者在地安老；新北公托全國第一，2022年達120家，加速優化托育環境，讓年輕人敢生能養。","居｜韌性宜居：落實居住正義，建構多元社宅，增加租屋供給，也讓青銀共居創造多贏。以市民為本、韌性宜居、永續環境為核心，推動都更三箭，再造都市環境。打造蘆南蘆北到新店的微笑曲線，加上新板特區、新莊副都心、三重行政中心等三核心，帶動新北整體發展。","樂｜永續人文：新北六都第一，是台灣最早實踐SDGs聯合國永續發展目標，用國際標準與全世界交朋友。優化城市美學、重現歷史脈絡，推動永續觀光、運動城市、藝文生活讓新北更宜居。用萬金石、水金九、微笑山線、淡蘭古道等，讓青春山海線成為台灣最美麗的皇冠。","業｜智慧科技：新北串聯雙空港與雙海港，以智慧科技、數位轉型為核心，善用既有製造業優勢，驅動六大區域經濟引擎，林口八里淡水智慧物流、汐止瑞芳生技資通訊、新店中和電動車與醫材、新五泰三蘆智慧傳產和金融科技、土城樹林智慧製造重鎮，以及三峽鶯歌新文創。"]$items$::JSONB),
                ('66b9fd50-5d49-431b-97e8-0f774aca9733'::UUID, '262236bd-047b-4e59-9e8f-cddf6aaaae3a'::UUID, '5565c9fa-1e83-4a2d-be80-416ee00d8634'::UUID, 'official-profile:new-taipei-city-council-current-councilors:e4d8b40b816b:262236bd-047b-4e59-9e8f-cddf6aaaae3a:platform'::TEXT, 'c7eb90fcee070f069ad4b20a00a6f944'::TEXT, 744, '25ac01c70ab676cbee9f10059a7b5e4f'::TEXT, 'official_council_page_cross_checked_no_text_change'::TEXT, NULL::JSONB),
                ('67ef984f-b965-49ed-ad44-f8627d1265ff'::UUID, '971320cf-8050-41e1-8d5b-57617cc14297'::UUID, 'e2429d3e-6574-45bc-902e-e9cfdb6220bc'::UUID, 'cec-platform:2022:votetw-candidate-8e7964fb579bfc1e'::TEXT, 'ce04bb5e672221d679cf37b267470ae9'::TEXT, 365, '7c5db1655053bd3c46958301070a38f6'::TEXT, 'official_bulletin_section_split_and_achievement_exclusion'::TEXT, $items$["本屆政見說到做到，下屆持續推動：已設立板橋首座天幕籃球場，將持續爭取第二座、第三座……","本屆政見說到做到，下屆持續推動：已在13座公園增設長輩新式體健設施，將持續改善公園環境。","本屆政見說到做到，下屆持續推動：國中小全面裝設冷氣，將繼續改善學校設備。","本屆政見說到做到，下屆持續推動：爭取公共托育中心設立。","本屆政見說到做到，下屆持續推動：協助社區汙水下水道接管。","本屆政見說到做到，下屆持續推動：關心民眾倒垃圾問題，為新社區爭取垃圾車站點。","本屆政見說到做到，下屆持續推動：開放板橋放送所、拍攝影片行銷板橋。","真正教育專業，關心各項教育議題：關注學校社團運動發展、校園安全、促進代理教師薪資合理化等議題。","推動設立銀髮事務局：建立銀髮業務單一窗口，推動活躍老化，完善長輩休閒空間，重視高齡人力。"]$items$::JSONB),
                ('702f6bc1-0726-4e3c-b685-fd5cb3ebd181'::UUID, 'c2e117ce-ca1f-4fa6-97fb-8decbbbc014f'::UUID, '73120e63-e44f-460f-8300-a50c0c58e29a'::UUID, 'cec-platform:2022:votetw-candidate-24626cca34417174'::TEXT, '73d909debc0982b8d724f7c1a666e8c1'::TEXT, 626, '9ef9a5ce35e067f8688078754e39f1ef'::TEXT, 'official_bulletin_cross_checked_no_text_change'::TEXT, NULL::JSONB),
                ('a810f38b-2f05-4622-8de6-058c10bd9435'::UUID, '5659db62-9f6e-4151-95b1-6118d287e1ff'::UUID, '50cd4304-ce86-4ad5-8d20-2fd1bfcb6432'::UUID, 'cec-platform:2022:votetw-candidate-4940c817a059b9f1'::TEXT, 'c8fa9ca23dcafc6915dae878d9093ce1'::TEXT, 589, '986a28004704c12c6034b854cd438f94'::TEXT, 'official_bulletin_visual_ocr_cross_check_no_text_change'::TEXT, NULL::JSONB),
                ('b2b89529-4a8b-4387-84d0-63e068a1f928'::UUID, '0db18c89-a071-4584-9202-6d46d91bf8f1'::UUID, '34a9156c-dc7a-4f8f-84bb-a811deca688d'::UUID, 'cec-platform:2022:votetw-candidate-6a03bcecb9b4172a'::TEXT, '86c61c75121e652923f1eea46b688dd1'::TEXT, 1236, '6f3a915892b955f2a154b740f2a45d9a'::TEXT, 'official_bulletin_section_repair'::TEXT, $items$["好好工作｜交通不塞車：加強北北基桃交通合作平台的策略深度，以科技創新管理解決交通壅塞與行動不便族群出行需求，打造以公共運輸為核心的智慧交通城市。","好好工作｜城市新創力：從資金、市場、人才三大面向出發，讓台北保持充沛新創動能：成立城市級投資公司、讓市民一起當新創公司股東，盤點市府資源擘劃沙盒專區，快速驗證新創商業模式。提供見習津貼讓北市青年到合格新創企業實習，推動「2025世界人才首都計畫」吸引海外創業家無痛移居台北。","好好工作｜女性大舞台：女性閣員比例提高至三分之一，推動具實質功能的友善家庭企業認證，打造更友善家庭的就業環境，擴大親子館功能，加強弱勢婦女支持系統。","好好工作｜商圈拼活化：落實商圈定位與分級制度，結合資源推動改善計畫，透過「點、線、面」串連商圈資源帶動觀光消費，推動市府認證品牌守護台北觀光品質，季季有主題、月月有活動、週週都精彩，以特色主題活動再造台北商圈百年風華。","好好生活｜青年舞空間：打造適合青少年練舞的據點，鼓勵民間進駐以課程擴展使用年齡層。市府也將帶頭加速釋出閒置公有空間、提供青少年課餘活動進修，並祭出補助鼓勵民間共同投入；以台北通 app 打造預約平台，便利查詢、即時預約、輕鬆使用。","好好生活｜毛孩最友善：內湖流浪動物之家儘速動工，全面啟動校園生命教育課程、公私協力建立不當飼養案件調查、送醫救治機制。推廣動物保險、補助動物預防針，設置社區狗公園、增設捷運寵物車廂與寵物公車。","好好生活｜重振藝文風：擴大舉辦藝文活動。透過社區大學與長照場域推動終身藝術教育，鬆綁藝文團體租借場地法規，參考韓國「劇場一條街」打造更多展演空間，積極推動台北文學館的設立。","好好生活｜運動換好康：透過公私協力將台北打造成市民運動場，市民享有三個月內免費12次的運動體驗；還可以透過 APP 累積健康紅利點數，一邊運動一邊集點，兌換交通票券、藝文展演門票等各項生活消費折扣。此外，也將建置體育運動資料中心，發展競技運動、爭取舉辦國際賽事。","好好居住｜安心孕生養：減低生養小孩經濟負擔，推出孕婦一年12次產檢愛心專車、新生兒生育獎勵加碼、提高補助托育、私幼學費費用，並提供兩成社會住宅給肯生第二胎的家庭優先入住，減輕年輕爸媽經濟負擔。","好好居住｜拼公辦都更：下修參與公辦都更意願書門檻，讓政府提早介入來獲得民眾信任。針對有公安疑慮及特殊歷史的整宅，以專案方式檢討基準容積率，增加民眾參與誘因，增加預算與服務人力辦理擴大服務量能。","好好居住｜青銀來換居：主動出擊調查長輩居住狀況、盤點社會住宅與老舊房舍分布狀況，讓長者搬至社宅、原本住宅以包租代管租予年輕人，市府再提供修繕補助。長者獲得安居、空屋成為青年新選擇，打造全齡化的都市再生、推動危樓都更正循環。"]$items$::JSONB),
                ('b98f9729-37f3-492d-927b-305832f455bc'::UUID, '475c7752-0db6-4ac5-91d2-155430667f0e'::UUID, '271aafee-58e3-4682-9a2d-79737ebe27b4'::UUID, 'cec-platform:2022:votetw-candidate-9102bd417a3a40d1'::TEXT, 'cc62a968dd84040fa60f8dda2a9a8e60'::TEXT, 1302, '1322b8612cef291aa69d50c8feb14d97'::TEXT, 'official_bulletin_cross_checked_no_text_change'::TEXT, NULL::JSONB),
                ('ba844082-78ea-48e7-a2cb-dd6a1dc53d15'::UUID, 'dc6a8178-2ba9-4b0a-8b3e-3a0f74ee7ccc'::UUID, 'ebb089e9-c339-4087-885e-ba48513eefea'::UUID, 'cec-platform:2022:votetw-candidate-1f928f6d07d0b491'::TEXT, '7e672e156e410cfc1b47e13e6b02b56c'::TEXT, 771, '7186809e82abd21375c0c1b25bfd5f2e'::TEXT, 'official_bulletin_cross_checked_no_text_change'::TEXT, NULL::JSONB),
                ('cc5fb095-ed3d-43ed-bc58-fc0b7e7ae8a0'::UUID, 'bf02aaf0-9a18-4d56-a1b2-d1e398720663'::UUID, '3fd33e16-d0c9-4dee-9ecb-1c6dcbdc97fc'::UUID, 'cec-platform:2022:votetw-candidate-2e8f1938d38a827e'::TEXT, '69c22197bf6bb6c38d561ec5d3f139fc'::TEXT, 376, '5dd89e8c4eb3bdce936adbd87e9ec4c4'::TEXT, 'official_bulletin_visual_section_repair'::TEXT, $items$["文教（培養人才）：辦理各校課業競賽、扎根文化。","文教（培養人才）：本鄉各校特色培育與延續。","文教（培養人才）：地方文化、藝文、體育、觀光、生態各社團扶植與推展、培養特色人才。","健康（老幼照護）：老人、長者、弱勢家庭長照領域提升。（整合社區、寺廟、教會、恆春地區醫療資源，照顧家鄉老人及弱勢家庭）","健康（老幼照護）：幼兒補助（幼兒園交通費補助）。","觀光（創新開發）：公共造產深度活化，重啟佳樂水風景區、168關道營運，進而活絡本鄉經濟命脈。","觀光（創新開發）：提升飛魚季、候鳥季活動的能見度，增進觀光產值。","觀光（創新開發）：戀戀滿州系列活動結合在地商家及農漁牧產業，讓遊客旅人、流連佇足，提高異鄉遊子回鄉服務的意願。","觀光（創新開發）：行銷滿州發展觀光開創新的景點。","原民（優質文化）：體育：各項動態文化交流。","原民（優質文化）：藝文：音樂、藝術。","原民（優質文化）：部落日推行：收穫、豐年祭……等。"]$items$::JSONB),
                ('df0b4204-a19c-4a66-a813-1d8523727181'::UUID, '588cabea-89b3-45b2-87f8-cb3a4f5019cd'::UUID, 'b87db885-ce08-47b4-827f-d276834183bf'::UUID, 'cec-platform:2022:votetw-candidate-d8a4a86928adf710'::TEXT, '1ccb52bdd34cfec149ff123d63ecc61e'::TEXT, 185, 'bbb55501f2283f5be8bc4c732a5cfda7'::TEXT, 'official_bulletin_visual_section_repair'::TEXT, $items$["關山再造：臺東最大親子探索共融式樂園","關山再造：關山歷史風貌特區營造計畫","關山再造：創造友善運動場域","關山再造：提升基礎建設之品質","打造樂活宜居小鎮：努力做好社會福利，幼有所依，老有所終","打造樂活宜居小鎮：強調族群融合，傾聽各方意見","打造樂活宜居小鎮：建立全民通報系統，即時傳播政策資訊","打造樂活宜居小鎮：鎮內設施優質化","榮景再現：打造高效率公所，重視鎮民心聲","榮景再現：青年創意X領路人計畫","榮景再現：找回關山的榮景"]$items$::JSONB),
                ('f3754f44-ba01-4edd-a08e-e4ef1e0b1b3b'::UUID, '31aacd68-e42c-4bf9-be2b-4790bce6657b'::UUID, '47e7058d-f0a8-485d-a7ce-9e7745f288bd'::UUID, 'cec-platform:2022:votetw-candidate-561c97a012db5ead'::TEXT, 'd50c5c045b33cdcb7e6f3de3a8c20017'::TEXT, 522, 'f412310b8fecfd89a51921e397a3d4fe'::TEXT, 'official_bulletin_cross_checked_no_text_change'::TEXT, NULL::JSONB),
                ('f4f77c32-5eaf-456d-8095-b929056ddc48'::UUID, '9a397842-d6cb-46ec-bcff-409cfa9e80f8'::UUID, 'f22dc1be-4b36-4c9e-9a9d-5cc501db3dfc'::UUID, 'cec-platform:2022:votetw-candidate-a37a518ab9c9cded'::TEXT, '766fcd60b680ab9138954aaacf38692c'::TEXT, 722, '00dc6824e884c811ce2c9ed5292547c2'::TEXT, 'official_bulletin_visual_section_repair'::TEXT, $items$["建設力：打造24小時環市運動光廊、特色公園、寵物友善公園與河岸運動廊道。","建設力：盤點市內土地空間，推動增設網球場、籃球場等多點專項球場。","建設力：優化公共設施、公園綠地；強化維管與公設檢修系統化。","建設力：協調縣府共同推動社會宅，讓年輕人有自己的家、敢生敢養。","建設力：爭取創建竹北文創綠廊帶，打造活動展演基地，揉合林蔭步道。","建設力：中央與地方合作，振興西區，打造樂活休閒農業區。","親子力：增加育兒津貼，3至6歲孩童每年補助6000元。廣辦親子教養免費講座。","親子力：孕婦至大新竹轄內醫院、婦產科產檢，補助計程車接駁費。","親子力：廣辦嬰兒出生前至3歲育兒照護教育免費講座，幫助新手爸媽育兒知識及技巧。","親子力：提供0至3歲幼兒免費早療評估服務及免費課程。","親子力：營養午餐加碼，讓孩子吃得好。","交通力：路平專案優先，路燈亮、馬路平，竹北好行。","交通力：改善人行道，建構自行車及行人友善騎行步道。","交通力：打通大新竹國道交通網，從竹北做起，向中央爭取新闢環北路交流道。","交通力：推動竹北設立客運轉運站。","交通力：優化市民公車路網。增設U-bike站點。","交通力：爭取新設竹北至新竹跨溪大橋。","交通力：改善市內重要樞紐路口交通，解決塞車問題。","交通力：改善各國小學童上下學，家長接送時段周邊交通問題。","文教力：推動親子館，並強化共學、自學資源。","文教力：規劃親子藝文活動，增進家庭情感交流，同步擴充藝文資源。","文教力：拓植科技教育。設立專案獎學金與獎補助績優學生。","文教力：活絡各里活動中心，廣納具證照優質教師，打造終生教育城市。","科技力：建構竹北便民e化系統，提升服務效率。","科技力：升級市管停車空間，全面e化停車系統。","科技力：廣設智慧燈桿，點亮竹北。","科技力：加速設立公有停車充電樁，協力私有社區銜接設置。"]$items$::JSONB),
                ('f7c8ee98-6ecd-42f5-be45-d409749c3246'::UUID, '6ebea9fb-76c6-471d-b2e8-82b580e4fb92'::UUID, '879dd5c5-e14d-4252-b157-490ec0cb7cef'::UUID, 'cec-platform:2022:votetw-candidate-2823dd3e8ab180d1'::TEXT, '2aaa148e22cd50bbf8ff3905129c406a'::TEXT, 595, '108a36aa26049cf91f7ce4527a70a520'::TEXT, 'official_bulletin_visual_section_repair'::TEXT, $items$["希望城市：打造五堵基隆科學園區，串連北北基科技廊帶，結合六堵工業區及大武崙工業區發展產業升級，創造就業機會。","希望城市：捍衛家園安全，維護基隆港發展，支持海洋保育，以最高標準審查第四接氣站興建計畫。基隆捷運傾聽民意，保留台鐵併行，爭取增設城際公路運輸路線，有效利用空間增設停車場。","美好∞基隆：全力支持十八歲公民權複決同意，打造在地文創聚落與青創空間，導入商業模式解決創生困境。","美好∞基隆：發展基隆特色觀光，打造兒童海洋樂園，讓潮境公園或外木山成為亞洲知名景點，爭取國際組織與國際名校設點進駐基隆。","美好∞基隆：提升生育與托育津貼補助，落實公托倍增，促進人口質量成長。","美好∞基隆：提升教育競爭力，導入國際知名教育方法，強化國高中特色專班，豐富學習歷程與產業交流；活化閒置校舍，實現青、幼、銀、特教大學共融空間。","美好∞基隆：深化城市生活美學，引進24小時人文書店，發展「一區一特色」室內親子遊樂空間，設置社區型運動中心及微型寵物室內樂園，友善照顧。","亞洲最有愛♥城市：打造亞洲最有愛的城市，發放「天使券」打造無礙、有愛消費環境。","亞洲最有愛♥城市：有條件提供就業青年環保電動機車，公益回饋志工時數。","亞洲最有愛♥城市：運用閒置公有空間推動日照中心倍增，加強無障礙交通接送，爭取長者公費疫苗資源，健康樂齡。","亞洲最有愛♥城市：市長親自定期召開多元族群會議，推動特色教育培養族群人才。保障就業環境與創業輔助，提升多元族群權益與文化品質。"]$items$::JSONB),
                ('fc000505-0790-4108-a2f4-18430b31340d'::UUID, '447055bb-7efc-483a-95f5-a226eaae81c6'::UUID, 'f7a812ba-79c0-40eb-8a7e-e8a372f6e591'::UUID, 'official-profile:new-taipei-city-council-current-councilors:7cd67055798c:447055bb-7efc-483a-95f5-a226eaae81c6:platform'::TEXT, '9aacec8d2f3b2e5d9b2492ef90638123'::TEXT, 544, '2f6e96a70337a3b580a314989b29a869'::TEXT, 'official_council_page_exclude_explicit_current_achievements'::TEXT, $items$["玲繼續「用心聽，努力做」，您與玲在相信和信任的路上幸福同行！"]$items$::JSONB)
        ) AS reviews(claim_id, person_id, candidate_id, claim_key, expected_md5, expected_length, expected_source_md5, repair_method, repaired_items)
    LOOP
        UPDATE public.person_claims AS claim
        SET claim_json = pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(
                        COALESCE(claim.claim_json, '{}'::JSONB),
                        '{items}',
                        COALESCE(review.repaired_items, claim.claim_json -> 'items'),
                        TRUE
                    ),
                    '{contentSplit}',
                    COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                        || pg_catalog.jsonb_build_object(
                            'reviewStatus', 'reviewed',
                            'releaseQuality', pg_catalog.jsonb_build_object(
                                'version', 'verified-platform-remaining-high-priority-20260907',
                                'reasonCodes', '[]'::JSONB
                            )
                        ),
                    TRUE
                ),
                '{platformQualityAudit}',
                COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'repairVersion', 'verified-platform-remaining-high-priority-20260907',
                        'repair', review.repair_method,
                        'classification', 'verified_repair'
                    ),
                TRUE
            ),
            updated_at = pg_catalog.now()
        WHERE claim.id = review.claim_id
          AND claim.person_id = review.person_id
          AND claim.candidate_id = review.candidate_id
          AND claim.claim_key = review.claim_key
          AND claim.claim_type = 'platform'
          AND pg_catalog.md5(claim.source_url) = review.expected_source_md5
          AND pg_catalog.md5(claim.claim_value) = review.expected_md5
          AND pg_catalog.length(claim.claim_value) = review.expected_length
          AND claim.claim_json ->> 'platformText' = claim.claim_value
          AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
          AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'requires_source_or_rule_review';

        GET DIAGNOSTICS affected_count = ROW_COUNT;
        IF affected_count <> 1 THEN
            RAISE EXCEPTION 'Expected to release remaining high-priority claim %, updated %', review.claim_id, affected_count;
        END IF;
        total_affected := total_affected + affected_count;

        IF EXISTS (
            SELECT 1
            FROM public.person_claims AS claim
            WHERE claim.id = review.claim_id
              AND (
                  claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
                  OR claim.claim_json #>> '{contentSplit,releaseQuality,version}' <> 'verified-platform-remaining-high-priority-20260907'
                  OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
                  OR claim.claim_json #>> '{platformQualityAudit,repair}' <> review.repair_method
                  OR (review.repaired_items IS NOT NULL AND claim.claim_json -> 'items' IS DISTINCT FROM review.repaired_items)
              )
        ) THEN
            RAISE EXCEPTION 'Remaining high-priority source review failed validation for claim %', review.claim_id;
        END IF;
    END LOOP;

    IF total_affected <> 21 THEN
        RAISE EXCEPTION 'Expected twenty-one verified high-priority platform reviews, updated %', total_affected;
    END IF;
END
$review$;

COMMIT;
