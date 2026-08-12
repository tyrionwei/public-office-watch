BEGIN;

CREATE TEMP TABLE _cec_referendum_seed (
    event_key TEXT NOT NULL,
    election_name TEXT NOT NULL,
    election_year INTEGER NOT NULL,
    voting_date DATE NOT NULL,
    referendum_type TEXT NOT NULL,
    region_slug TEXT,
    jurisdiction_name TEXT NOT NULL,
    case_number INTEGER NOT NULL,
    proposal_text TEXT NOT NULL,
    result_status TEXT NOT NULL,
    eligible_voters BIGINT NOT NULL,
    yes_votes BIGINT NOT NULL,
    no_votes BIGINT NOT NULL,
    invalid_votes BIGINT,
    turnout_rate NUMERIC(7, 4),
    approval_rule TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_document_url TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _cec_referendum_seed VALUES
('national-2004-03-20', '2004 年全國性公民投票', 2004, '2004-03-20', 'national', NULL, '全國', 1,
 '台灣人民堅持台海問題應該和平解決。如果中共不撤除瞄準台灣的飛彈、不放棄對台灣使用武力，你是不是同意政府增加購置反飛彈裝備，強化台灣自我防衛能力？',
 'not_passed', 16497746, 6511216, 581413, 359711, 45.17,
 '投票人數達投票權人總數二分之一以上，且有效同意票超過有效票二分之一',
 'https://web.cec.gov.tw/central/article/26996', 'https://web.cec.gov.tw/api/file/3c512c0a-0794-47ed-81e6-7431a7a6d186.pdf'),
('national-2004-03-20', '2004 年全國性公民投票', 2004, '2004-03-20', 'national', NULL, '全國', 2,
 '你是不是同意政府與中共展開協商談判，推動建立兩岸和平穩定的互動架構，謀求兩岸的共識與人民的福祉？',
 'not_passed', 16497746, 6319663, 545911, 578574, 45.12,
 '投票人數達投票權人總數二分之一以上，且有效同意票超過有效票二分之一',
 'https://web.cec.gov.tw/central/article/26996', 'https://web.cec.gov.tw/api/file/3c512c0a-0794-47ed-81e6-7431a7a6d186.pdf'),
('national-2008-01-12', '2008 年 1 月全國性公民投票', 2008, '2008-01-12', 'national', NULL, '全國', 3,
 '你是否同意依下列原則制定「政黨不當取得財產處理條例」，將中國國民黨黨產還給全民：國民黨及其附隨組織的財產，除黨費、政治獻金及競選補助金外，均推定為不當取得的財產，應還給人民。已處分者，應償還價額。',
 'not_passed', 17277720, 3891170, 363494, 296217, 26.34,
 '投票人數達投票權人總數二分之一以上，且有效同意票超過有效票二分之一',
 'https://web.cec.gov.tw/central/article/26997', 'https://web.cec.gov.tw/api/file/f505d024-44a8-4373-84a5-c97a237e1c3b.pdf'),
('national-2008-01-12', '2008 年 1 月全國性公民投票', 2008, '2008-01-12', 'national', NULL, '全國', 4,
 '您是否同意制定法律追究國家領導人及其部屬，因故意或重大過失之措施，造成國家嚴重損害之責任，並由立法院設立調查委員會調查，政府各部門應全力配合，不得抗拒，以維全民利益，並懲處違法失職人員，追償不當所得？',
 'not_passed', 17277720, 2304136, 1656890, 544901, 26.08,
 '投票人數達投票權人總數二分之一以上，且有效同意票超過有效票二分之一',
 'https://web.cec.gov.tw/central/article/26997', 'https://web.cec.gov.tw/api/file/f505d024-44a8-4373-84a5-c97a237e1c3b.pdf'),
('national-2008-03-22', '2008 年 3 月全國性公民投票', 2008, '2008-03-22', 'national', NULL, '全國', 5,
 '1971年中華人民共和國進入聯合國，取代中華民國，台灣成為國際孤兒。為強烈表達台灣人民的意志，提升台灣的國際地位及參與，您是否同意政府以「台灣」名義加入聯合國？',
 'not_passed', 17313854, 5529230, 352359, 320088, 35.82,
 '投票人數達投票權人總數二分之一以上，且有效同意票超過有效票二分之一',
 'https://web.cec.gov.tw/central/article/27001', 'https://web.cec.gov.tw/api/file/494e8708-3ad1-46af-b004-bf7968bb843a.pdf'),
('national-2008-03-22', '2008 年 3 月全國性公民投票', 2008, '2008-03-22', 'national', NULL, '全國', 6,
 '您是否同意我國申請重返聯合國及加入其它組織，名稱採務實、有彈性的策略，亦即贊成以中華民國名義、或以台灣名義、或以其他有助於成功並兼顧尊嚴的名稱，申請重返聯合國及加入其他國際組織？',
 'not_passed', 17313854, 4962309, 724060, 500749, 35.74,
 '投票人數達投票權人總數二分之一以上，且有效同意票超過有效票二分之一',
 'https://web.cec.gov.tw/central/article/27001', 'https://web.cec.gov.tw/api/file/494e8708-3ad1-46af-b004-bf7968bb843a.pdf'),
('national-2018-11-24', '2018 年全國性公民投票', 2018, '2018-11-24', 'national', NULL, '全國', 7,
 '你是否同意以「平均每年至少降低1%」之方式逐年降低火力發電廠發電量？',
 'passed', 19757067, 7955753, 2109157, 715140, 54.56,
 '有效同意票多於不同意票，且達投票權人總額四分之一以上',
 'https://web.cec.gov.tw/referendum/article/27002', 'https://web.cec.gov.tw/api/file/0132581c-18b5-4951-bc24-3cc083924666.pdf'),
('national-2018-11-24', '2018 年全國性公民投票', 2018, '2018-11-24', 'national', NULL, '全國', 8,
 '您是否同意確立「停止新建、擴建任何燃煤發電廠或發電機組（包括深澳電廠擴建）」之能源政策？',
 'passed', 19757067, 7599267, 2346316, 823945, 54.51,
 '有效同意票多於不同意票，且達投票權人總額四分之一以上',
 'https://web.cec.gov.tw/referendum/article/27002', 'https://web.cec.gov.tw/api/file/0132581c-18b5-4951-bc24-3cc083924666.pdf'),
('national-2018-11-24', '2018 年全國性公民投票', 2018, '2018-11-24', 'national', NULL, '全國', 9,
 '你是否同意政府維持禁止開放日本福島311核災相關地區，包括福島與周遭4縣市（茨城、櫪木、群馬、千葉）等地區農產品及食品進口？',
 'passed', 19757067, 7791856, 2231425, 756041, 54.56,
 '有效同意票多於不同意票，且達投票權人總額四分之一以上',
 'https://web.cec.gov.tw/referendum/article/27002', 'https://web.cec.gov.tw/api/file/0132581c-18b5-4951-bc24-3cc083924666.pdf'),
('national-2018-11-24', '2018 年全國性公民投票', 2018, '2018-11-24', 'national', NULL, '全國', 10,
 '你是否同意民法婚姻規定應限定在一男一女的結合？',
 'passed', 19757067, 7658008, 2907429, 459508, 55.80,
 '有效同意票多於不同意票，且達投票權人總額四分之一以上',
 'https://web.cec.gov.tw/referendum/article/27002', 'https://web.cec.gov.tw/api/file/0132581c-18b5-4951-bc24-3cc083924666.pdf'),
('national-2018-11-24', '2018 年全國性公民投票', 2018, '2018-11-24', 'national', NULL, '全國', 11,
 '你是否同意在國民教育階段內（國中及國小），教育部及各級學校不應對學生實施性別平等教育法施行細則所定之同志教育？',
 'passed', 19757067, 7083379, 3419624, 507101, 55.73,
 '有效同意票多於不同意票，且達投票權人總額四分之一以上',
 'https://web.cec.gov.tw/referendum/article/27002', 'https://web.cec.gov.tw/api/file/0132581c-18b5-4951-bc24-3cc083924666.pdf'),
('national-2018-11-24', '2018 年全國性公民投票', 2018, '2018-11-24', 'national', NULL, '全國', 12,
 '你是否同意以民法婚姻規定以外之其他形式來保障同性別二人經營永久共同生活的權益？',
 'passed', 19757067, 6401748, 4072471, 540757, 55.75,
 '有效同意票多於不同意票，且達投票權人總額四分之一以上',
 'https://web.cec.gov.tw/referendum/article/27002', 'https://web.cec.gov.tw/api/file/0132581c-18b5-4951-bc24-3cc083924666.pdf'),
('national-2018-11-24', '2018 年全國性公民投票', 2018, '2018-11-24', 'national', NULL, '全國', 13,
 '你是否同意，以「台灣」（Taiwan）為全名申請參加所有國際運動賽事及2020年東京奧運？',
 'not_passed', 19757067, 4763086, 5774556, 505153, 55.89,
 '有效同意票多於不同意票，且達投票權人總額四分之一以上',
 'https://web.cec.gov.tw/referendum/article/27002', 'https://web.cec.gov.tw/api/file/0132581c-18b5-4951-bc24-3cc083924666.pdf'),
('national-2018-11-24', '2018 年全國性公民投票', 2018, '2018-11-24', 'national', NULL, '全國', 14,
 '您是否同意，以民法婚姻章保障同性別二人建立婚姻關係？',
 'not_passed', 19757067, 3382286, 6949697, 608484, 55.37,
 '有效同意票多於不同意票，且達投票權人總額四分之一以上',
 'https://web.cec.gov.tw/referendum/article/27002', 'https://web.cec.gov.tw/api/file/0132581c-18b5-4951-bc24-3cc083924666.pdf'),
('national-2018-11-24', '2018 年全國性公民投票', 2018, '2018-11-24', 'national', NULL, '全國', 15,
 '您是否同意，以「性別平等教育法」明定在國民教育各階段內實施性別平等教育，且內容應涵蓋情感教育、性教育、同志教育等課程？',
 'not_passed', 19757067, 3507665, 6805171, 619001, 55.33,
 '有效同意票多於不同意票，且達投票權人總額四分之一以上',
 'https://web.cec.gov.tw/referendum/article/27002', 'https://web.cec.gov.tw/api/file/0132581c-18b5-4951-bc24-3cc083924666.pdf'),
('national-2018-11-24', '2018 年全國性公民投票', 2018, '2018-11-24', 'national', NULL, '全國', 16,
 '您是否同意：廢除電業法第95條第1項，即廢除「核能發電設備應於中華民國一百十四年以前，全部停止運轉」之條文？',
 'passed', 19757067, 5895560, 4014215, 922960, 54.83,
 '有效同意票多於不同意票，且達投票權人總額四分之一以上',
 'https://web.cec.gov.tw/referendum/article/27002', 'https://web.cec.gov.tw/api/file/0132581c-18b5-4951-bc24-3cc083924666.pdf'),
('national-2021-12-18', '2021 年全國性公民投票', 2021, '2021-12-18', 'national', NULL, '全國', 17,
 '您是否同意核四啟封商轉發電？',
 'not_passed', 19825468, 3804689, 4262517, 78494, 41.09,
 '有效同意票多於不同意票，且達投票權人總額四分之一以上',
 'https://web.cec.gov.tw/central/article/34787', 'https://web.cec.gov.tw/api/file/8af8f22f-2e85-4aed-a5b3-795eb111e214.pdf'),
('national-2021-12-18', '2021 年全國性公民投票', 2021, '2021-12-18', 'national', NULL, '全國', 18,
 '你是否同意政府應全面禁止進口含有萊克多巴胺之乙型受體素豬隻之肉品、內臟及其相關產製品？',
 'not_passed', 19825468, 3936386, 4131371, 78108, 41.09,
 '有效同意票多於不同意票，且達投票權人總額四分之一以上',
 'https://web.cec.gov.tw/central/article/34787', 'https://web.cec.gov.tw/api/file/8af8f22f-2e85-4aed-a5b3-795eb111e214.pdf'),
('national-2021-12-18', '2021 年全國性公民投票', 2021, '2021-12-18', 'national', NULL, '全國', 19,
 '你是否同意公民投票案公告成立後半年內，若該期間內遇有全國性選舉時，在符合公民投票法規定之情形下，公民投票應與該選舉同日舉行？',
 'not_passed', 19825468, 3951677, 4120243, 73273, 41.08,
 '有效同意票多於不同意票，且達投票權人總額四分之一以上',
 'https://web.cec.gov.tw/central/article/34787', 'https://web.cec.gov.tw/api/file/8af8f22f-2e85-4aed-a5b3-795eb111e214.pdf'),
('national-2021-12-18', '2021 年全國性公民投票', 2021, '2021-12-18', 'national', NULL, '全國', 20,
 '您是否同意中油第三天然氣接收站遷離桃園大潭藻礁海岸及海域？（即北起觀音溪出海口，南至新屋溪出海口之海岸，及由上述海岸最低潮線往外平行延伸五公里之海域）',
 'not_passed', 19825468, 3901171, 4163464, 80819, 41.09,
 '有效同意票多於不同意票，且達投票權人總額四分之一以上',
 'https://web.cec.gov.tw/central/article/34787', 'https://web.cec.gov.tw/api/file/8af8f22f-2e85-4aed-a5b3-795eb111e214.pdf'),
('constitutional-2022-11-26', '2022 年憲法修正案公民複決', 2022, '2022-11-26', 'constitutional', NULL, '全國', 1,
 '中華民國憲法增修條文增訂第一條之一條文修正案：中華民國國民年滿十八歲者，有依法選舉、罷免、創制、複決及參加公民投票之權。除本憲法及法律別有規定者外，年滿十八歲者，有依法被選舉之權。憲法第一百三十條之規定，停止適用。',
 'not_passed', 19239392, 5647102, 5016427, NULL, NULL,
 '有效同意票超過選舉人總額二分之一',
 'https://web.cec.gov.tw/referendum/article/37719', 'https://web.cec.gov.tw/api/file/13286564-5a1e-45ec-aa18-7b19a88f8af2.pdf'),
('national-2025-08-23', '2025 年全國性公民投票', 2025, '2025-08-23', 'national', NULL, '全國', 21,
 '您是否同意第三核能發電廠經主管機關同意確認無安全疑慮後，繼續運轉？',
 'not_passed', 20002091, 4341432, 1511693, 53245, 29.53,
 '有效同意票多於不同意票，且達投票權人總額四分之一以上',
 'https://web.cec.gov.tw/referendum/article/61395', 'https://web.cec.gov.tw/api/file/ee7ce76f-068d-474e-af88-99c485d77511.pdf'),
('local-kaohsiung-2008-11-15', '2008 年高雄市地方性公民投票', 2008, '2008-11-15', 'local', 'historical-kaohsiung-city', '高雄市', 1,
 '學生班級人數適當的減少，可以增進學生的學習效果。本市公立國民小學一、三、五年級以及國民中學新生的編班，自96學年度起，每班不得超過31人，以後每學年減少2人，至99學年度起，每班不得超過25人。',
 'not_passed', 1159368, 56375, 5432, 261, 5.35,
 '投票人數達投票權人總數二分之一以上，且有效同意票超過有效票二分之一',
 'https://web.cec.gov.tw/referendum/article/32310', 'https://web.cec.gov.tw/api/file/622aafa8-2a15-4b40-9eb9-63b16f98d674.pdf'),
('local-penghu-2009-09-26', '2009 年澎湖縣地方性公民投票', 2009, '2009-09-26', 'local', 'penghu-county', '澎湖縣', 1,
 '澎湖要不要設置國際觀光度假區附設觀光賭場？',
 'not_passed', 73651, 13397, 17359, 298, 42.16,
 '有效同意票超過有效票二分之一；離島觀光賭場案不受投票率門檻限制',
 'https://web.cec.gov.tw/referendum/article/32310', 'https://web.cec.gov.tw/api/file/622aafa8-2a15-4b40-9eb9-63b16f98d674.pdf'),
('local-lienchiang-2012-07-07', '2012 年連江縣地方性公民投票', 2012, '2012-07-07', 'local', 'lienchiang-county', '連江縣', 1,
 '馬祖是否要設置國際觀光度假區附設觀光賭場？',
 'passed', 7762, 1795, 1341, NULL, 40.76,
 '有效同意票超過有效票二分之一；離島觀光賭場案不受投票率門檻限制',
 'https://web.cec.gov.tw/referendum/article/32310', 'https://web.cec.gov.tw/api/file/622aafa8-2a15-4b40-9eb9-63b16f98d674.pdf'),
('local-penghu-2016-10-15', '2016 年澎湖縣地方性公民投票', 2016, '2016-10-15', 'local', 'penghu-county', '澎湖縣', 2,
 '您是否同意澎湖設置國際觀光度假區附設觀光賭場？',
 'not_passed', 83469, 6210, 26598, 216, 39.56,
 '有效同意票超過有效票二分之一；離島觀光賭場案不受投票率門檻限制',
 'https://web.cec.gov.tw/referendum/article/32310', 'https://web.cec.gov.tw/api/file/622aafa8-2a15-4b40-9eb9-63b16f98d674.pdf'),
('local-kinmen-2017-10-28', '2017 年金門縣地方性公民投票', 2017, '2017-10-28', 'local', 'kinmen-county', '金門縣', 1,
 '為振興金門經濟，開創金門的前途，您是否贊成設立國際渡假區並於其中開放5%觀光博弈？',
 'not_passed', 114426, 2705, 24368, NULL, 24.17,
 '有效同意票超過有效票二分之一；離島觀光賭場案不受投票率門檻限制',
 'https://web.cec.gov.tw/referendum/article/32310', 'https://web.cec.gov.tw/api/file/622aafa8-2a15-4b40-9eb9-63b16f98d674.pdf'),
('local-hsinchu-2021-12-18', '2021 年新竹市地方性公民投票', 2021, '2021-12-18', 'local', 'hsinchu-city', '新竹市', 1,
 '您是否同意，新竹市應訂定廢污水管理自治條例，明定工業廢水、醫療廢水及其他事業廢水和污水，應以專管回收，不可排入飲用水取水口或灌溉水取水口上游？',
 'passed', 357083, 131816, 19581, NULL, 43.39,
 '有效同意票多於不同意票，且達投票權人總額四分之一以上',
 'https://web.cec.gov.tw/referendum/article/32310', 'https://web.cec.gov.tw/api/file/622aafa8-2a15-4b40-9eb9-63b16f98d674.pdf');

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _cec_referendum_seed seed
        LEFT JOIN public.regions region ON region.slug = seed.region_slug
        WHERE seed.region_slug IS NOT NULL
          AND region.id IS NULL
    ) THEN
        RAISE EXCEPTION 'CEC referendum seed references a missing canonical region';
    END IF;
END;
$$;

INSERT INTO public.elections (
    id,
    name,
    year,
    election_type,
    voting_date,
    status,
    source_name,
    source_url,
    is_public
)
SELECT DISTINCT ON (seed.event_key)
    MD5('cec-referendum:event:' || seed.event_key)::UUID,
    seed.election_name,
    seed.election_year,
    'referendum',
    seed.voting_date,
    'completed',
    '中央選舉委員會',
    seed.source_url,
    TRUE
FROM _cec_referendum_seed seed
ORDER BY seed.event_key, seed.case_number
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    year = EXCLUDED.year,
    election_type = EXCLUDED.election_type,
    voting_date = EXCLUDED.voting_date,
    status = EXCLUDED.status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

INSERT INTO public.races (
    id,
    election_id,
    region_id,
    race_type,
    title,
    voting_date,
    status,
    source_name,
    source_url,
    is_public
)
SELECT
    MD5('cec-referendum:race:' || seed.event_key || ':' || seed.case_number)::UUID,
    MD5('cec-referendum:event:' || seed.event_key)::UUID,
    region.id,
    'referendum',
    CASE seed.referendum_type
        WHEN 'national' THEN '全國性公民投票第' || seed.case_number || '案'
        WHEN 'constitutional' THEN '憲法修正案公民複決第' || seed.case_number || '案'
        ELSE seed.jurisdiction_name || '地方性公民投票第' || seed.case_number || '案'
    END,
    seed.voting_date,
    'completed',
    '中央選舉委員會',
    seed.source_url,
    TRUE
FROM _cec_referendum_seed seed
LEFT JOIN public.regions region ON region.slug = seed.region_slug
ON CONFLICT (id) DO UPDATE SET
    election_id = EXCLUDED.election_id,
    region_id = EXCLUDED.region_id,
    race_type = EXCLUDED.race_type,
    title = EXCLUDED.title,
    voting_date = EXCLUDED.voting_date,
    status = EXCLUDED.status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

INSERT INTO public.referendum_questions (
    id,
    race_id,
    referendum_type,
    case_number,
    jurisdiction_name,
    proposal_text,
    result_status,
    eligible_voters,
    total_votes,
    valid_votes,
    invalid_votes,
    turnout_rate,
    approval_rule,
    source_name,
    source_url,
    source_document_url,
    is_public
)
SELECT
    MD5('cec-referendum:question:' || seed.event_key || ':' || seed.case_number)::UUID,
    MD5('cec-referendum:race:' || seed.event_key || ':' || seed.case_number)::UUID,
    seed.referendum_type,
    seed.case_number,
    seed.jurisdiction_name,
    seed.proposal_text,
    seed.result_status,
    seed.eligible_voters,
    CASE
        WHEN seed.invalid_votes IS NULL THEN NULL
        ELSE seed.yes_votes + seed.no_votes + seed.invalid_votes
    END,
    seed.yes_votes + seed.no_votes,
    seed.invalid_votes,
    seed.turnout_rate,
    seed.approval_rule,
    '中央選舉委員會',
    seed.source_url,
    seed.source_document_url,
    TRUE
FROM _cec_referendum_seed seed
ON CONFLICT (id) DO UPDATE SET
    race_id = EXCLUDED.race_id,
    referendum_type = EXCLUDED.referendum_type,
    case_number = EXCLUDED.case_number,
    jurisdiction_name = EXCLUDED.jurisdiction_name,
    proposal_text = EXCLUDED.proposal_text,
    result_status = EXCLUDED.result_status,
    eligible_voters = EXCLUDED.eligible_voters,
    total_votes = EXCLUDED.total_votes,
    valid_votes = EXCLUDED.valid_votes,
    invalid_votes = EXCLUDED.invalid_votes,
    turnout_rate = EXCLUDED.turnout_rate,
    approval_rule = EXCLUDED.approval_rule,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    source_document_url = EXCLUDED.source_document_url,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

INSERT INTO public.referendum_options (
    id,
    question_id,
    option_code,
    label,
    vote_count,
    vote_rate,
    display_order,
    is_public
)
SELECT
    MD5('cec-referendum:option:' || seed.event_key || ':' || seed.case_number || ':' || option.option_code)::UUID,
    MD5('cec-referendum:question:' || seed.event_key || ':' || seed.case_number)::UUID,
    option.option_code,
    option.label,
    option.vote_count,
    ROUND(option.vote_count::NUMERIC * 100 / NULLIF(seed.yes_votes + seed.no_votes, 0), 4),
    option.display_order,
    TRUE
FROM _cec_referendum_seed seed
CROSS JOIN LATERAL (
    VALUES
        ('yes', '同意', seed.yes_votes, 1),
        ('no', '不同意', seed.no_votes, 2)
) AS option(option_code, label, vote_count, display_order)
ON CONFLICT (id) DO UPDATE SET
    question_id = EXCLUDED.question_id,
    option_code = EXCLUDED.option_code,
    label = EXCLUDED.label,
    vote_count = EXCLUDED.vote_count,
    vote_rate = EXCLUDED.vote_rate,
    display_order = EXCLUDED.display_order,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

DO $$
DECLARE
    seeded_election_count BIGINT;
    seeded_question_count BIGINT;
    seeded_option_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO seeded_election_count
    FROM public.elections election
    WHERE election.id IN (
        SELECT DISTINCT MD5('cec-referendum:event:' || seed.event_key)::UUID
        FROM _cec_referendum_seed seed
    );

    SELECT COUNT(*) INTO seeded_question_count
    FROM public.referendum_questions question
    WHERE question.id IN (
        SELECT MD5('cec-referendum:question:' || seed.event_key || ':' || seed.case_number)::UUID
        FROM _cec_referendum_seed seed
    );

    SELECT COUNT(*) INTO seeded_option_count
    FROM public.referendum_options option
    WHERE option.question_id IN (
        SELECT MD5('cec-referendum:question:' || seed.event_key || ':' || seed.case_number)::UUID
        FROM _cec_referendum_seed seed
    );

    IF seeded_election_count <> 13 OR seeded_question_count <> 28 OR seeded_option_count <> 56 THEN
        RAISE EXCEPTION
            'CEC referendum seed validation failed: elections %, questions %, options %',
            seeded_election_count,
            seeded_question_count,
            seeded_option_count;
    END IF;
END;
$$;

REFRESH MATERIALIZED VIEW published.election_race_summaries;
REFRESH MATERIALIZED VIEW published.election_race_facets;

DO $$
DECLARE
    published_summary_count BIGINT;
    published_facet_count BIGINT;
BEGIN
    SELECT COALESCE(SUM(summary.race_count), 0)
    INTO published_summary_count
    FROM published.election_race_summaries summary
    WHERE summary.election_id IN (
        SELECT DISTINCT MD5('cec-referendum:event:' || seed.event_key)::UUID
        FROM _cec_referendum_seed seed
    );

    SELECT COALESCE(SUM(facet.race_count), 0)
    INTO published_facet_count
    FROM published.election_race_facets facet
    WHERE facet.election_id IN (
        SELECT DISTINCT MD5('cec-referendum:event:' || seed.event_key)::UUID
        FROM _cec_referendum_seed seed
    );

    IF published_summary_count <> 28 OR published_facet_count <> 28 THEN
        RAISE EXCEPTION
            'CEC referendum published index validation failed: summaries %, facets %',
            published_summary_count,
            published_facet_count;
    END IF;
END;
$$;

COMMIT;
