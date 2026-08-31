BEGIN;

ALTER TABLE public.party_list_race_results
ADD COLUMN platform_items JSONB NOT NULL DEFAULT '[]'::JSONB,
ADD COLUMN platform_items_reviewed_at TIMESTAMPTZ;

ALTER TABLE public.party_list_race_results
ADD CONSTRAINT party_list_race_results_platform_items_array
CHECK (pg_catalog.jsonb_typeof(platform_items) = 'array');

COMMENT ON COLUMN public.party_list_race_results.platform_items IS
    'Human-reviewed, independently assessable promise splits derived from the official party-list election bulletin.';
COMMENT ON COLUMN public.party_list_race_results.platform_items_reviewed_at IS
    'Timestamp at which the official bulletin transcription and split were reviewed for publication.';

CREATE TABLE public.party_platform_fulfillment_votes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    party_result_id UUID NOT NULL
        REFERENCES public.party_list_race_results(result_id)
        ON DELETE CASCADE,
    item_key TEXT NOT NULL CHECK (item_key ~ '^[0-9a-f]{64}$'),
    participant_hash TEXT NOT NULL CHECK (participant_hash ~ '^[0-9a-f]{64}$'),
    vote_status TEXT NOT NULL CHECK (vote_status IN (
        'fulfilled',
        'in_progress',
        'not_fulfilled',
        'insufficient_information'
    )),
    submission_count INTEGER NOT NULL DEFAULT 1 CHECK (submission_count > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT party_platform_fulfillment_votes_participant_item
        UNIQUE (party_result_id, item_key, participant_hash)
);

CREATE INDEX party_platform_fulfillment_votes_result_item_status_idx
    ON public.party_platform_fulfillment_votes (party_result_id, item_key, vote_status);
CREATE INDEX party_platform_fulfillment_votes_participant_result_idx
    ON public.party_platform_fulfillment_votes (participant_hash, party_result_id);

ALTER TABLE public.party_platform_fulfillment_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.party_platform_fulfillment_votes
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, DELETE ON TABLE public.party_platform_fulfillment_votes TO service_role;
REVOKE ALL ON SEQUENCE public.party_platform_fulfillment_votes_id_seq
FROM PUBLIC, anon, authenticated, service_role;

CREATE TEMP TABLE _party_platform_source (
    election_year INTEGER NOT NULL,
    party_ballot_number SMALLINT NOT NULL,
    items TEXT[] NOT NULL,
    PRIMARY KEY (election_year, party_ballot_number)
) ON COMMIT DROP;

INSERT INTO _party_platform_source (election_year, party_ballot_number, items)
VALUES
    (2020, 1, ARRAY[
        '人工流產施行前設置六天（144小時）思考期，並提供諮商及輔導',
        '國有財產改良土地改以設定地上權或租賃為原則，並阻斷不公義的區段徵收',
        '另立專法，以公開透明制度依專業、資歷與績效遴聘公職及公營事業人員，杜絕政治酬庸',
        '以協商代替對抗發展兩岸和平經濟，並拒絕一國兩制',
        '修法訂定非煤時間表，民國109年至129年每年降低5%燃煤發電，最遲129年關閉燃煤電廠',
        '恢復國統綱領，表明拒絕中共政權統治及一國兩制'
    ]),
    (2020, 2, ARRAY[
        '維護台灣安全並提升人民所得',
        '打破立法黑箱作業，重建立法行政效率',
        '終結教改亂象並恢復聯考制度，提供公平升學機會',
        '照顧新住民、原住民及弱勢團體，爭取陸配與外配享有同等國民權益'
    ]),
    (2020, 3, ARRAY[
        '主張兩岸對等分治、對話與和平發展，在中國尚未完全自由民主法治前維持現狀',
        '修法將政黨票席次門檻由5%降為3%，政黨補助款門檻由3%降為1.5%',
        '修訂遊說法增加強制透明條款，防止不當關說與利益輸送',
        '將民法成年年齡下修至18歲，並推動人民參與的陪審制度',
        '國民義務教育向下延伸三年，並對0至2歲兒童發放津貼、鼓勵家長親自養育',
        '維持一例一休精神，依不同產業制定兼顧彈性與保障的勞動規範',
        '興建生活機能完善的智慧平價住宅，保障國人購屋與換屋需求',
        '清查照顧貧困榮民、榮眷、老農與勞工，並成立軍警消生活安定基金及身心障礙保險基金',
        '成立新住民委員會與青年委員會，協助新住民融入並處理青年就學、就業、創業、成家與育兒問題',
        '修法發展新科技產業、建立員工平均分紅制度並調整稅制以吸引及留住人才',
        '制定專法支援台商建立海外產業聚落，並推動自主安樂死立法'
    ]),
    (2020, 4, ARRAY[
        '守護一夫一妻婚姻制度',
        '以政策解決少子化問題',
        '推動長照3.0',
        '向下延伸國民教育',
        '推動校園零毒品、監督教材、廢除不當性平教育並強化品格教育',
        '重視技職教育並連結產官學以培育產業人才',
        '擴大青年國際視野、跨境能力與跨境電商創業機會',
        '培養多元技能，支持青年發展斜槓職涯',
        '推動無條件基本收入',
        '落實居住正義，讓人民租得起屋、買得起房',
        '反貪腐並打破權貴政治',
        '恢復公民投票權利'
    ]),
    (2020, 5, ARRAY[
        '推動中國代理人相關法制，並使民代及重要公職在中國的投資透明化',
        '對抗性別、地域、城鄉、語言、身心障礙、階級與國族認同等不平等及歧視',
        '集中資源改善環境污染、長照不足、少子化、教育與社會脫節及農民與原住民權益問題',
        '以國土均衡與分散首都機能因應高房價',
        '透過官方及非官方管道聯合民主國家與社會力量，主動參與區域外交'
    ]),
    (2020, 6, ARRAY[
        '訂定金融旋轉門條款，以公開徵才取代特權酬庸並健全金融監理',
        '設立金融消費者保護局',
        '改善學生宿舍與租屋環境，並推動青年可負擔住宅',
        '制定反併吞滲透法、管制紅色媒體並強化機敏產業保障',
        '抑制土地炒作，鼓勵資金投資實體與創新經濟',
        '監督頻譜釋照權利金用途並消弭數位落差',
        '落實司法改革、消除權貴司法並強化被害人權利保障',
        '強化勞檢、降低組織工會門檻並制定最低工資法',
        '修訂礦業法、精進空污與水源保護規範',
        '保障動物用藥權，推動寵物友善公共運輸、寵物登記與飼主教育',
        '精進高齡照顧、反詐騙與高齡友善醫療',
        '推動憲改及18歲公民權入憲',
        '守護性別平等教育，打造多元友善社會',
        '推廣食農教育並改善校園食安',
        '保障教保員權益、鼓勵育兒友善企業並建立親子大眾運輸規範'
    ]),
    (2020, 7, ARRAY[
        '依憲法推動兩岸和平統一論述，維護兩岸和平',
        '推動兩岸簽署和平協議並逐年降低對美軍購，將預算轉作青年住宅、老人照護與弱勢福利',
        '打擊貪腐、反制台獨並組成立委戰鬥團隊',
        '將大陸配偶取得身分證年限縮短為四年，保障平等權益',
        '修正去中國化課綱，恢復中小學中國史與倫理道德教育',
        '全面檢討並廢除或修正蔡英文任內通過的違憲違法法案'
    ]),
    (2020, 8, ARRAY[
        '推動台灣獨立建國',
        '推動正名制憲',
        '以公民投票推動加入聯合國',
        '推動與美國、日本建立同盟',
        '廢除一例一休',
        '建立公民陪審制度'
    ]),
    (2020, 9, ARRAY[
        '捍衛中華民國主權，反對台獨與一國兩制，維持兩岸和平穩定並鞏固民主法治',
        '推動自由經貿特區、加入區域經濟組織、成立國家主權基金並促進產業轉型升級',
        '推動0至6歲國家協助養育政策',
        '充實醫藥衛生資源並推動長照保險制度',
        '重新檢討年金改革並提升基金投資效益',
        '支持青年學貸免息、出國遊學、三語教育、體育及多元文化教育',
        '改善失業與低薪、輔導婦女及勞工就業創業並保障原住民與新住民權益',
        '改善能源配比、穩定供電電價、確保核安並逐年減煤減碳',
        '強化國防實戰能力、培育國軍幹部並保障軍人與榮民福利'
    ]),
    (2020, 10, ARRAY[
        '提高老農津貼至每月一萬元、老人年金至六千元，並補助友善病房看護',
        '發放每月一萬元育兒津貼',
        '補助學貸零利率',
        '由勞資協商落實週休二日，基本工資提高至三萬元並使本外勞工資脫鉤',
        '堅持台灣國民身分證並反對中國台灣身分證',
        '推動正名制憲、內閣制與三權分立，廢止公投不得綁大選規定',
        '推動司法陪審制並建立司法官退場機制',
        '歸還住民原墾地並追討不義國產',
        '降低菸稅並設置公共吸菸室',
        '廢除違法函釋、將合理稅賦入法並檢討統籌分配款'
    ]),
    (2020, 11, ARRAY[
        '推動兩岸和解、終結內戰敵對狀態並簽訂和平協議',
        '將國防預算降至GDP的1%，節省經費用於社會福利',
        '禁止派遣與假承攬、反對責任制，並保障勞工離線權',
        '強制五人以下企業為勞工投保勞保，政府補助微型企業部分保費',
        '對富人與資本利得增稅，將租稅負擔率提高至GDP的20%',
        '在不降低給付下將勞保改採隨收隨付制',
        '將長照經費提高至GDP的1%並建立類似健保的分擔制度',
        '取消大學假服務學習課程，改為勞工權益教育學分',
        '要求日本政府對日軍慰安婦道歉、賠償並納入教科書',
        '放寬失業及自願離職者在六個月後請領就業保險金',
        '將產假延長至100天，延長部分由就業保險負擔',
        '陸配比照外籍配偶四年取得身分證，並放寬新移民孝親與探親權'
    ]),
    (2020, 12, ARRAY[
        '與全球綠黨合作，推動台灣外交正名',
        '廢核並發展地熱、風電等再生能源',
        '停止對耗能產業的水電補貼，推動減碳與儲能',
        '協助青年農民取得耕地並推動有機學校午餐',
        '提升動物權並取締非法繁殖',
        '禁止販賣魚翅、設立石虎保護區並以環境信託保護棲地',
        '廣設社會住宅並阻斷炒房資金鏈',
        '以反歧視、稅制改革與公費教育縮小貧富差距',
        '開放成年者人工生殖或代孕，並允許同性伴侶領養',
        '保障機車路權並補助離島居民免費機票',
        '將酒駕罰款用於強制治療，依法納管加熱菸並終結黑市',
        '在花東增設原住民副縣長，推動部落法人化與民族自治',
        '廣設公托公幼並禁止宗教內容教材進入校園',
        '保障重症癌末者安樂死自主權並使藥用大麻合法化'
    ]),
    (2020, 13, ARRAY[
        '制定宗教團體法，保障宗教信仰自由',
        '重新開放未登記寺廟及神壇補辦登記並輔導合法化',
        '由政府與宗教合作推動傳統文化與倫理教育',
        '將宗教救援動員納入重大災害救災體系',
        '成立整合政府與民間慈善團體的急難救助平台',
        '推動反毒與反愛滋教育進入校園',
        '各縣市設置專用環保金爐',
        '發展減碳科技以取代封爐政策',
        '依107年公投第11案調整校園性教育內容',
        '成立家庭發展委員會，推動婚姻及家庭制度政策',
        '在年金永續前提下適度回復軍公教退休年金給付',
        '使民間流浪動物收容場合法化並納入管理',
        '全面檢討稅制並推動賦稅轉型正義',
        '恢復勞工週休二日並由勞資協商調整工時',
        '開放聘僱家庭幫傭並由政府統一辦理',
        '使外勞與本勞薪資脫鉤並統一訂定外勞薪資',
        '在全國分區設置宗教法令服務平台'
    ]),
    (2020, 14, ARRAY[
        '拒絕一國兩制、鞏固民主防衛並完備國安立法',
        '強化與美國的戰略夥伴關係並連結民主國家',
        '提升國防自主、國防科技研發製造與人才培育',
        '加值低薪產業與勞工所得，縮短貧富差距',
        '扶植新創、智慧科技、綠色與觀光產業並擴大投資台灣',
        '建立因應少子化的托育與長照體系，保障居住正義與弱勢族群權益',
        '推動均衡教育，使學生認識本土並連結國際',
        '增加基礎建設經費與品質，平衡區域發展',
        '改善空污、推動循環經濟與友善農業並提高農民所得',
        '擴大青年就學及就業投資'
    ]),
    (2020, 15, ARRAY[
        '將民法成年年齡降至18歲，擴大青年政治參與',
        '改革立法院職權行使與黨團協商制度，回歸委員會專業審查並尊重少數聲音',
        '降低不分區立委政黨票席次分配門檻',
        '推動稅制調整、實價登錄與社會住宅等居住正義政策',
        '完成私立學校退場法制，將退場校地轉作社福或社宅用途',
        '修訂就業服務法並設置移工初入境短期安置及專責服務機制',
        '制定外送平台管理法規，保障平台勞動者',
        '加強制式及非制式槍枝管理',
        '強化財政紀律、提高預算執行率並避免浮濫追加預算'
    ]),
    (2020, 16, ARRAY[
        '推動分稅制，企業與個人稅收一半留在地方',
        '成立專責單位檢討政府對各行業不合理的管制',
        '恢復六都各區地方自治、民選公職與自主財源權限',
        '地方選舉採委員會制與政黨比例代表制，部分議員席次採政黨比例',
        '設置社區保母中心並發放0至6歲每月4500元育兒津貼',
        '保障全民每月8000元基本生活所得',
        '課徵空屋稅、擴大囤房稅並制定租金管制法',
        '全面實施長照社會保險',
        '推動老農離農退休與農地活化，協助青年農民取得耕地'
    ]),
    (2020, 17, ARRAY[
        '促使中華民國政府公開承認戰後並未取得台澎主權',
        '促使政府承認舊金山和約所形成的台灣地位未定法律狀態',
        '保障台澎住民依去殖民化原則行使自決權並建立國家法人格'
    ]),
    (2020, 18, ARRAY[
        '推動薪資倍增並鬆綁投資限制',
        '使國會運作回歸正軌並停止藍綠惡鬥',
        '建立中央與地方連線的服務機制',
        '保障弱勢平權與身心障礙者無障礙行動',
        '落實司法改革並提升裁判品質',
        '健全年金制度並優化基金收益',
        '推動兩岸和平雙贏並終止政治對立',
        '穩定能源發展並支持以核養綠',
        '協助青年安心就業並將學貸延後十年償還',
        '改革教育與升學制度，恢復公平升學',
        '建立友善育兒環境並增加生育獎勵',
        '發展高齡友善生活並提高長照執行',
        '打破酬庸並改革國營事業',
        '健全住宅市場並促進合理房價',
        '保障勞工權益並嚴格執行勞動檢查',
        '反對毒品除罪化並加速毒品列管'
    ]),
    (2020, 19, ARRAY[
        '制定反統戰暨反滲透法及中國代理人法',
        '推動正名制憲並建立新國家',
        '禁止中國政府、中資與親中台商操控台灣媒體',
        '檢討一例一休、落實週休二日並以勞資協商保障基本工時',
        '本外勞工資制度分流，本勞起薪三萬元並以聘僱比例保障本勞工作',
        '建立司法官退場、陪審團、國會調查與聽證制度',
        '義務教育自五歲開始，強化技職教育並完成私立大學退場',
        '調整中小學地理、歷史、文學及文化教育，以台灣為中心',
        '將義務役年資納入勞保並補償陸一特服役者',
        '廢除以菸捐支應長照，並由國家照顧75歲以上長者',
        '強化新南向及全球化政策，降低經濟對中國的依賴'
    ]);

INSERT INTO _party_platform_source (election_year, party_ballot_number, items)
VALUES
    (2024, 1, ARRAY[
        '增強危機意識、做好戰時及大型災害準備，並制定社區層級糧食儲備計畫',
        '設立公共看板、廣播設備與民眾提案平台，降低參政門檻並促進公平選舉',
        '擴大社會參與空污與氣候政策制定，保障受影響群體需求及權益',
        '新增親職假、推動雙親平等育兒、普設育兒支持據點並建立親子友善環境',
        '將兒童人權法制化，強化兒少醫療、心理照顧、特教人力與預算',
        '建立性暴力受害者保護制度、縮小性別就業與薪資差距，並納入LGBTQ+群體的高齡照護需求'
    ]),
    (2024, 2, ARRAY[
        '將大麻施用除罪改為治療，並放寬醫療用大麻適應症',
        '建立公益代孕媒合制度，兼顧委託人與代孕者權益',
        '保障重症末期病人自主選擇尊嚴及舒適離世',
        '改革菸捐用途與菸業政策，將資源用於吸菸者健康並促進本土種植',
        '制定平等法以消除歧視、促進弱勢賦權、多元成家與世代族群正義',
        '減少工時、提高工資、強化勞動組織並推動合作社經濟',
        '將原住民族對等締約地位納入憲法總綱，擴大國會參政權',
        '保障婚姻移民居留自主，移工採公辦仲介並全面適用勞基法',
        '在義務教育強化心理輔導與早期預防，補助心理諮詢',
        '落實性別教育並保障所有性別認同者的身體自主權',
        '將家庭照顧假延長至14天並提供津貼，且適用於照顧長輩及家人',
        '保障個人性工作者勞動權，輔導組織工會並建立合法管理管道',
        '反核、發展綠能、推動碳稅中立與防災電網',
        '以永續金融支持傳統碳匯，落實部落知情同意',
        '保障身心障礙者與行人路權，並規劃機車安全用路',
        '以環境信託保護棲地，推動友善畜牧、寵物源頭管理並杜絕虐待'
    ]),
    (2024, 3, ARRAY[
        '英文課綱依循閱讀科學，先教習語音覺識（PA）再教自然發音（Phonics）'
    ]),
    (2024, 4, ARRAY[
        '推動代理人法、強化國安法案並落實國防改革',
        '改善勞動與青年處境、促進產業升級及國土平衡',
        '移除威權象徵、修正轉型正義法制、追求歷史真相並常設促轉機構',
        '推動尊嚴就業、健康福祉、優質教育、性別平等、非核家園與消除貧窮等政策'
    ]),
    (2024, 5, ARRAY[
        '作為兩岸和平的大使',
        '積極開拓中國大陸市場',
        '維護台灣安全並提升人民所得'
    ]),
    (2024, 6, ARRAY[
        '以兒童交通安全與特色公園經驗，提供兒童多元友善的成長空間',
        '推動0至6歲國家一起養2.0、高中職免學費及私立大專每年3.5萬元學雜費補助',
        '擴大社會住宅、包租代管與租金補貼',
        '以中華民國台灣與四個堅持維持兩岸現狀，追求台海和平',
        '強化公民識讀、抵抗錯假資訊並連結國際民主夥伴',
        '推動長照3.0、擴大社區長照服務並設立百億癌症新藥基金',
        '完成最低工資法並支持勞保財務穩定',
        '推動全齡性別平等教育與族群主流化政策',
        '提高文化預算，發展多元綠能、深度節能、科技儲能與韌性電網',
        '投資人才、帶動創新成長，完善農民福利、地方創生與區域均衡'
    ]),
    (2024, 7, ARRAY[
        '推動憲改，使國際法高於國內法並直接保障人民權利義務',
        '以永久和平憲章及制度改革防制貪腐',
        '推動永久和平憲章取得國際支持並以憲法約束政治權力',
        '讓人民透過和平憲章直接掌握制度權力',
        '避免任何單一政黨在國會過半'
    ]),
    (2024, 8, ARRAY[
        '增加幼教投資並推動幼托幼教全面公共化',
        '改善幼師與教保員待遇並降低幼兒園師生比',
        '強化幼教監督管理，保障兒童安全',
        '強化青少年心理健康支持與自殺防治',
        '推動租屋實價登錄、鼓勵房東申報出租並加速社會住宅',
        '增訂建築安全罰則並淘汰危害公安的建商',
        '改革道路工程與駕照訓練，改善行人安全',
        '廢除機車強制兩段式左轉及內線禁行機車規定',
        '建立官方二手車履歷並強制車輛配備主動安全系統',
        '在選舉公報增列候選人刑事前科紀錄',
        '增訂不法關說罪與不法餽贈罪，並通過吹哨者保護法',
        '打擊詐騙、強化犯罪所得沒收並阻斷詐騙金流'
    ]),
    (2024, 9, ARRAY[
        '創新政府並推動政治革新',
        '維護兩岸關係和平穩定',
        '促進經濟發展並由全民共享成果',
        '推動經濟轉型並改善低薪',
        '實現全民居住正義',
        '補助長者健保費用',
        '廢除長照服務申請的巴氏量表限制',
        '提升長者長期照顧服務',
        '發展綠能、延續核能並減少燃煤',
        '改革撥補制度並搶救勞保財務',
        '打擊槍枝、毒品、詐騙與暴力犯罪',
        '加倍投資教育'
    ]),
    (2024, 10, ARRAY[
        '追查重大公共爭議事件，包括論文、選舉與疫苗採購',
        '推動法庭直播',
        '推行陪審制度',
        '廢除國家賠償法第13條',
        '部分法官改由民選，全體檢察長改由民選',
        '廢除訴願與行政訴訟制度，使民事與行政救濟一元化',
        '制定證據法',
        '建立律師對案件事實的證據調查權',
        '廢除偵查庭',
        '在台北、台中、高雄地檢署設置特偵組並廢除法務部廉政署',
        '廢除因個案產生的業務獎金與績效獎金',
        '放寬法官與檢察官迴避事由',
        '由法官審查假釋、廢除累犯制度並推動全國性減刑',
        '放寬低收入戶及中低收入戶資格並逐年提高涵蓋率至15%',
        '增加資本所得稅並降低薪資所得稅',
        '婦女懷孕及生產期間留職停薪且年資不中斷，並保障回任原職',
        '將勞工年金替代率由1.55提高至2.0並溯及已退休勞工',
        '對65歲退休的勞保年金領取者加發20%並溯及既往',
        '重新修正勞基法以保障勞工權益',
        '政府基金交由獨立機構管理，政府僅監督而不介入護盤',
        '將中國大陸新住民取得身分證年限由六年縮短為四年',
        '限制卡債更生債權為本金加一倍利息，超過部分不得請求'
    ]),
    (2024, 11, ARRAY[
        '反對延長兵役',
        '廢除台獨課綱並恢復一綱一本',
        '提高詐騙犯罪刑度',
        '恢復特偵組',
        '立即執行死刑判決',
        '恢復勞工七天有薪國定假日',
        '所有外籍配偶及陸配三年取得身分證',
        '協助農漁產品銷往中國大陸',
        '恢復軍公教退休金',
        '重啟核能並凍漲電價',
        '開放中國大陸移工'
    ]),
    (2024, 12, ARRAY[
        '定期邀請總統進行國情報告，建立國會聽證調查並強化人事同意權審查',
        '完善財政收支劃分制度並修正預算法與公共債務法，限制浮濫舉債及特別預算',
        '制定學校午餐專法與兒童托育服務法，降低師生比並提高幼保人員待遇',
        '防制權貴司法及不法關說，嚴打黑金槍毒詐並增訂妨害司法公正罪',
        '通過吹哨者保護法',
        '協助產業淨零轉型、推動再生能源與綠色稅改',
        '改革勞保年金、保障勞工權益並降低警消組織工會門檻',
        '強化醫護制度保障及待遇，推動反族群歧視法與新住民基本法',
        '開徵中央囤房或空屋稅、社宅採輪候制並推動租屋透明化',
        '改革區段徵收與市地重劃，要求提供平價住宅',
        '制定反媒體壟斷法、禁止政治介入公共媒體並支持內容產業',
        '設置金融穩定委員會與金融消費者保護局，防制金融詐騙與炒房'
    ]),
    (2024, 13, ARRAY[
        '將營業稅與所得稅改為中央地方各分一半，改善地方財政',
        '推動台灣替代香港成為新的亞太營運金融中心',
        '反對廢除鄉鎮市自治，六都各區恢復地方自治選舉並以政黨比例代表改善地方選舉',
        '村里法人化並與社區協會整合，活動中心產權歸村里並承辦社福、長照、幼兒園與環境服務',
        '法官改採任期制，法官檢察官由多元獨立委員會提名並經民意機關三分之二同意任命',
        '成立網路警察局處理詐騙，並成立治安委員會督導掃黑與緝毒',
        '實施長照社會保險，將外籍看護、機構照顧與離職照顧親人納入給付',
        '優先以公有地及空屋作社宅、擴大囤房稅並制定都會區租金管制法',
        '領老農津貼者免繳農保保費，並推動老農離農退休及農地銀行',
        '制定鄉村計畫法並成立農村社區更新法人',
        '放寬癌症等重病藥品專案進口及醫療大麻，並加速疫苗受害者賠償',
        '以國家計畫全面疏浚、整治及復育淡水河流域'
    ]),
    (2024, 14, ARRAY[
        '增加政黨不分區席次，改善單一選區不利小黨參政的問題並推動內閣制',
        '推動以人為本的軍公教年金改革與軍警消生活安定基金，改善警消訓練、裝備及傷亡照顧',
        '改革稅制與財政收支劃分法，建立平台經濟管理並保障金融科技消費者',
        '制定兩岸和平促進法，維持中華民國憲法、自由民主、台灣自主及兩岸和平對話',
        '確保國防安全',
        '確保經濟安全',
        '確保民生安全',
        '確保環境安全',
        '確保人文倫理安全',
        '全面開放兩岸團客與自由行，振興觀光',
        '恢復農漁產品銷往中國大陸並協商檢驗及通關機制',
        '改善醫療環境、醫護工時及報酬，健全健保財務',
        '加強職場安全與職災照顧，檢討一例一休並制定最低工資法',
        '增加社會住宅、改善老舊社區，並將閒置校地轉作長照社福與幼教',
        '在綠電尚未穩定供電前保留核能，並更新維護輸配電系統'
    ]),
    (2024, 15, ARRAY[
        '推動全民健保免掛號費、藥費與手術費',
        '購屋免頭期款，貸款期限延長至50年並將利息減半',
        '外籍配偶來台兩年取得身分證',
        '放寬外籍配偶家屬申請來台期限至一至二年'
    ]),
    (2024, 16, ARRAY[
        '促進台灣主體意識、說明聯合國2758號決議史實並推動人民自決',
        '強化國防建設與國防自主',
        '提升高中職以上學費補助，放寬助學貸款利息及還款緩衝期',
        '提高護理人員薪資並改善合理工作條件',
        '將超徵稅收退還全民並提供疫情後產業紓困',
        '強化技職教育並改善學用落差'
    ]);

UPDATE public.party_list_race_results AS result
SET
    platform_items = pg_catalog.to_jsonb(source.items),
    platform_text = pg_catalog.array_to_string(source.items, E'\n'),
    platform_items_reviewed_at = pg_catalog.now(),
    updated_at = pg_catalog.now()
FROM public.races AS race
JOIN public.elections AS election ON election.id = race.election_id
JOIN _party_platform_source AS source ON source.election_year = election.year
WHERE result.race_id = race.id
  AND result.party_ballot_number = source.party_ballot_number
  AND race.race_type = 'party_list_legislator'
  AND result.is_public = TRUE;

UPDATE public.elections AS election
SET
    results_announced_on = DATE '2020-01-17',
    updated_at = pg_catalog.now()
WHERE election.year = 2020
  AND election.results_announced_on IS NULL
  AND EXISTS (
      SELECT 1
      FROM public.races AS race
      WHERE race.election_id = election.id
        AND race.race_type = 'party_list_legislator'
  );

DO $verify_platform_source$
DECLARE
    reviewed_result_count INTEGER;
    split_item_count INTEGER;
BEGIN
    SELECT
        COUNT(*),
        SUM(pg_catalog.jsonb_array_length(result.platform_items))
    INTO reviewed_result_count, split_item_count
    FROM public.party_list_race_results AS result
    JOIN public.races AS race ON race.id = result.race_id
    JOIN public.elections AS election ON election.id = race.election_id
    WHERE election.year IN (2020, 2024)
      AND race.race_type = 'party_list_legislator'
      AND result.is_public = TRUE
      AND result.platform_items_reviewed_at IS NOT NULL;

    IF reviewed_result_count <> 35 THEN
        RAISE EXCEPTION 'Expected 35 reviewed party platforms, got %', reviewed_result_count;
    END IF;
    IF split_item_count < 250 THEN
        RAISE EXCEPTION 'Expected at least 250 reviewed party platform items, got %', split_item_count;
    END IF;
END;
$verify_platform_source$;

CREATE OR REPLACE FUNCTION published.platform_fulfillment_results(
    p_claim_id UUID
)
RETURNS TABLE (
    item_key TEXT,
    display_order INTEGER,
    promise_text TEXT,
    fulfilled_count BIGINT,
    in_progress_count BIGINT,
    not_fulfilled_count BIGINT,
    insufficient_information_count BIGINT,
    total_count BIGINT,
    results_announced_on DATE,
    voting_opens_on DATE,
    voting_is_open BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    WITH raw_items AS (
        SELECT
            'person'::TEXT AS target_kind,
            public.platform_fulfillment_vote_claim_id(p_claim_id) AS vote_target_id,
            derived.item_key,
            derived.display_order,
            derived.promise_text,
            election.results_announced_on,
            (election.results_announced_on + INTERVAL '1 year')::DATE AS voting_opens_on,
            COALESCE(
                CURRENT_DATE >= (election.results_announced_on + INTERVAL '1 year')::DATE,
                FALSE
            ) AS voting_is_open
        FROM public.person_claims AS claim
        JOIN public.candidates AS candidate ON candidate.id = claim.candidate_id
        JOIN public.races AS race ON race.id = candidate.race_id
        JOIN public.elections AS election ON election.id = race.election_id
        CROSS JOIN LATERAL (
            SELECT
                pg_catalog.encode(
                    extensions.digest(pg_catalog.btrim(item.value), 'sha256'),
                    'hex'
                ) AS item_key,
                item.ordinality::INTEGER AS display_order,
                pg_catalog.btrim(item.value) AS promise_text
            FROM pg_catalog.jsonb_array_elements_text(claim.claim_json -> 'items')
                WITH ORDINALITY AS item(value, ordinality)
            WHERE pg_catalog.btrim(item.value) <> ''
        ) AS derived
        WHERE claim.id = p_claim_id
          AND claim.claim_type = 'platform'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
          AND claim.claim_json #>> '{contentSplit,reviewStatus}' IN ('auto_approved', 'reviewed')
          AND candidate.election_result = 'elected'
          AND (
              (election.year = 2024 AND race.race_type IN (
                  'president', 'legislative_district', 'legislator',
                  'party_list_legislator', 'indigenous'
              ))
              OR
              (election.year = 2022 AND race.race_type IN (
                  'councilor_district', 'city_councilor', 'county_councilor'
              ))
          )
          AND pg_catalog.jsonb_typeof(claim.claim_json -> 'items') = 'array'
        UNION ALL

        SELECT
            'party'::TEXT AS target_kind,
            result.result_id AS vote_target_id,
            derived.item_key,
            derived.display_order,
            derived.promise_text,
            election.results_announced_on,
            (election.results_announced_on + INTERVAL '1 year')::DATE AS voting_opens_on,
            COALESCE(
                CURRENT_DATE >= (election.results_announced_on + INTERVAL '1 year')::DATE,
                FALSE
            ) AS voting_is_open
        FROM public.party_list_race_results AS result
        JOIN public.races AS race ON race.id = result.race_id
        JOIN public.elections AS election ON election.id = race.election_id
        CROSS JOIN LATERAL (
            SELECT
                pg_catalog.encode(
                    extensions.digest(pg_catalog.btrim(item.value), 'sha256'),
                    'hex'
                ) AS item_key,
                item.ordinality::INTEGER AS display_order,
                pg_catalog.btrim(item.value) AS promise_text
            FROM pg_catalog.jsonb_array_elements_text(result.platform_items)
                WITH ORDINALITY AS item(value, ordinality)
            WHERE pg_catalog.btrim(item.value) <> ''
        ) AS derived
        WHERE result.result_id = p_claim_id
          AND result.is_public = TRUE
          AND result.platform_items_reviewed_at IS NOT NULL
          AND race.race_type = 'party_list_legislator'
          AND election.year IN (2020, 2024)
          AND pg_catalog.jsonb_typeof(result.platform_items) = 'array'
    ),
    current_items AS (
        SELECT DISTINCT ON (item.target_kind, item.item_key) item.*
        FROM raw_items AS item
        ORDER BY item.target_kind, item.item_key, item.display_order
    ),
    all_votes AS (
        SELECT
            'person'::TEXT AS target_kind,
            vote.claim_id AS vote_target_id,
            vote.item_key,
            vote.vote_status,
            vote.id
        FROM public.platform_fulfillment_votes AS vote
        UNION ALL
        SELECT
            'party'::TEXT,
            vote.party_result_id,
            vote.item_key,
            vote.vote_status,
            vote.id
        FROM public.party_platform_fulfillment_votes AS vote
    )
    SELECT
        item.item_key,
        item.display_order,
        item.promise_text,
        pg_catalog.count(*) FILTER (WHERE vote.vote_status = 'fulfilled') AS fulfilled_count,
        pg_catalog.count(*) FILTER (WHERE vote.vote_status = 'in_progress') AS in_progress_count,
        pg_catalog.count(*) FILTER (WHERE vote.vote_status = 'not_fulfilled') AS not_fulfilled_count,
        pg_catalog.count(*) FILTER (WHERE vote.vote_status = 'insufficient_information') AS insufficient_information_count,
        pg_catalog.count(vote.id) AS total_count,
        item.results_announced_on,
        item.voting_opens_on,
        item.voting_is_open
    FROM current_items AS item
    LEFT JOIN all_votes AS vote
      ON vote.target_kind = item.target_kind
     AND vote.vote_target_id = item.vote_target_id
     AND vote.item_key = item.item_key
    GROUP BY
        item.item_key,
        item.display_order,
        item.promise_text,
        item.results_announced_on,
        item.voting_opens_on,
        item.voting_is_open
    ORDER BY item.display_order;
$function$;

CREATE OR REPLACE FUNCTION published.get_platform_fulfillment_votes(
    p_claim_id UUID
)
RETURNS TABLE(item_key TEXT, vote_status TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    participant_id UUID;
    participant_digest TEXT;
    party_target BOOLEAN;
BEGIN
    participant_id := auth.uid();
    IF participant_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    participant_digest := pg_catalog.encode(
        extensions.digest(participant_id::TEXT, 'sha256'),
        'hex'
    );
    party_target := EXISTS (
        SELECT 1
        FROM public.party_list_race_results AS result
        WHERE result.result_id = p_claim_id
          AND result.is_public = TRUE
          AND result.platform_items_reviewed_at IS NOT NULL
    );

    IF party_target THEN
        RETURN QUERY
        SELECT vote.item_key, vote.vote_status
        FROM public.party_platform_fulfillment_votes AS vote
        WHERE vote.party_result_id = p_claim_id
          AND vote.participant_hash = participant_digest
          AND EXISTS (
              SELECT 1
              FROM published.platform_fulfillment_results(p_claim_id) AS item
              WHERE item.item_key = vote.item_key
          )
        ORDER BY vote.item_key;
    ELSE
        RETURN QUERY
        SELECT vote.item_key, vote.vote_status
        FROM public.platform_fulfillment_votes AS vote
        WHERE vote.claim_id = public.platform_fulfillment_vote_claim_id(p_claim_id)
          AND vote.participant_hash = participant_digest
          AND EXISTS (
              SELECT 1
              FROM published.platform_fulfillment_results(p_claim_id) AS item
              WHERE item.item_key = vote.item_key
          )
        ORDER BY vote.item_key;
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_platform_fulfillment_vote(
    p_claim_id UUID,
    p_item_key TEXT,
    p_vote_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    participant_id UUID;
    participant_digest TEXT;
    party_target BOOLEAN;
    saved_updated_at TIMESTAMPTZ;
BEGIN
    participant_id := public.assert_participation_proxy_request(
        'platform-fulfillment',
        public.participation_proxy_body_sha256(ARRAY[
            p_claim_id::TEXT,
            p_item_key,
            p_vote_status
        ])
    );

    IF p_item_key IS NULL OR p_item_key !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid platform item key';
    END IF;
    IF p_vote_status NOT IN (
        'fulfilled',
        'in_progress',
        'not_fulfilled',
        'insufficient_information'
    ) THEN
        RAISE EXCEPTION 'Invalid platform fulfilment status';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM published.platform_fulfillment_results(p_claim_id) AS item
        WHERE item.item_key = p_item_key
    ) THEN
        RAISE EXCEPTION 'Platform item is not available for voting';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM published.platform_fulfillment_results(p_claim_id) AS item
        WHERE item.item_key = p_item_key
          AND item.voting_is_open
    ) THEN
        RAISE EXCEPTION 'Platform fulfilment voting is not open';
    END IF;

    participant_digest := pg_catalog.encode(
        extensions.digest(participant_id::TEXT, 'sha256'),
        'hex'
    );
    party_target := EXISTS (
        SELECT 1
        FROM public.party_list_race_results AS result
        WHERE result.result_id = p_claim_id
          AND result.is_public = TRUE
          AND result.platform_items_reviewed_at IS NOT NULL
    );

    IF party_target THEN
        INSERT INTO public.party_platform_fulfillment_votes (
            party_result_id,
            item_key,
            participant_hash,
            vote_status
        )
        VALUES (p_claim_id, p_item_key, participant_digest, p_vote_status)
        ON CONFLICT (party_result_id, item_key, participant_hash) DO UPDATE
        SET
            vote_status = EXCLUDED.vote_status,
            submission_count = public.party_platform_fulfillment_votes.submission_count + 1,
            updated_at = pg_catalog.now()
        RETURNING updated_at INTO saved_updated_at;
    ELSE
        INSERT INTO public.platform_fulfillment_votes (
            claim_id,
            item_key,
            participant_hash,
            vote_status
        )
        VALUES (
            public.platform_fulfillment_vote_claim_id(p_claim_id),
            p_item_key,
            participant_digest,
            p_vote_status
        )
        ON CONFLICT (claim_id, item_key, participant_hash) DO UPDATE
        SET
            vote_status = EXCLUDED.vote_status,
            submission_count = public.platform_fulfillment_votes.submission_count + 1,
            updated_at = pg_catalog.now()
        RETURNING updated_at INTO saved_updated_at;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'claimId', p_claim_id,
        'itemKey', p_item_key,
        'voteStatus', p_vote_status,
        'updatedAt', saved_updated_at
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.withdraw_platform_fulfillment_vote(
    p_claim_id UUID,
    p_item_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    participant_id UUID;
    participant_digest TEXT;
    party_target BOOLEAN;
    deleted_count BIGINT;
BEGIN
    participant_id := public.assert_participation_proxy_request(
        'platform-fulfillment-withdrawal',
        public.participation_proxy_body_sha256(ARRAY[
            p_claim_id::TEXT,
            p_item_key
        ])
    );

    IF p_item_key IS NULL OR p_item_key !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid platform item key';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM published.platform_fulfillment_results(p_claim_id) AS item
        WHERE item.item_key = p_item_key
    ) THEN
        RAISE EXCEPTION 'Platform item is not available for voting';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM published.platform_fulfillment_results(p_claim_id) AS item
        WHERE item.item_key = p_item_key
          AND item.voting_is_open
    ) THEN
        RAISE EXCEPTION 'Platform fulfilment voting is not open';
    END IF;

    participant_digest := pg_catalog.encode(
        extensions.digest(participant_id::TEXT, 'sha256'),
        'hex'
    );
    party_target := EXISTS (
        SELECT 1
        FROM public.party_list_race_results AS result
        WHERE result.result_id = p_claim_id
          AND result.is_public = TRUE
          AND result.platform_items_reviewed_at IS NOT NULL
    );

    IF party_target THEN
        DELETE FROM public.party_platform_fulfillment_votes AS vote
        WHERE vote.party_result_id = p_claim_id
          AND vote.item_key = p_item_key
          AND vote.participant_hash = participant_digest;
    ELSE
        DELETE FROM public.platform_fulfillment_votes AS vote
        WHERE vote.claim_id = public.platform_fulfillment_vote_claim_id(p_claim_id)
          AND vote.item_key = p_item_key
          AND vote.participant_hash = participant_digest;
    END IF;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN pg_catalog.jsonb_build_object(
        'claimId', p_claim_id,
        'itemKey', p_item_key,
        'withdrawn', deleted_count > 0
    );
END;
$function$;

COMMENT ON TABLE public.party_platform_fulfillment_votes IS
    'Private community fulfilment votes for reviewed party-list platform items.';
COMMENT ON FUNCTION published.platform_fulfillment_results(UUID) IS
    'Returns reviewed candidate or party-list platform items with anonymous aggregate fulfilment votes.';
COMMENT ON FUNCTION published.get_platform_fulfillment_votes(UUID) IS
    'Returns the current participant own votes for a reviewed candidate or party-list platform target.';
COMMENT ON FUNCTION public.submit_platform_fulfillment_vote(UUID, TEXT, TEXT) IS
    'Stores a proxy-authorized candidate or party-list platform fulfilment vote.';
COMMENT ON FUNCTION public.withdraw_platform_fulfillment_vote(UUID, TEXT) IS
    'Withdraws a proxy-authorized candidate or party-list platform fulfilment vote.';

NOTIFY pgrst, 'reload schema';

COMMIT;
