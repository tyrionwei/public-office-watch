BEGIN;

DO $$
DECLARE
    matched_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO matched_count
    FROM public.candidates candidate
    JOIN public.people person ON person.id = candidate.person_id
    JOIN public.races race ON race.id = candidate.race_id
    JOIN public.elections election ON election.id = race.election_id
    JOIN (
        VALUES
            ('votetw-candidate-961ad18334e1caa5', '蔡文益', '宜蘭縣頭城鎮鎮長選舉'),
            ('votetw-candidate-6ce9e16ade917721', '李明哲', '宜蘭縣蘇澳鎮鎮長選舉'),
            ('votetw-candidate-ab007df3869e48cf', '蕭淑芬', '彰化縣田中鎮鎮長選舉'),
            ('votetw-candidate-21ba06e26ac56776', '林慧如', '雲林縣古坑鄉鄉長選舉'),
            ('votetw-candidate-ec5a88f751fb8902', '陳建名', '雲林縣褒忠鄉鄉長選舉')
    ) AS expected(candidate_external_id, person_name, race_title)
      ON expected.candidate_external_id = candidate.external_id
     AND expected.person_name = person.name
     AND expected.race_title = race.title
    WHERE election.year = 2022
      AND candidate.is_elected IS TRUE
      AND candidate.election_result = 'elected';

    IF matched_count <> 5 THEN
        RAISE EXCEPTION 'Expected 5 uniquely identified elected 2022 candidates, found %', matched_count;
    END IF;
END
$$;

WITH platform_data (
    claim_key,
    candidate_external_id,
    person_name,
    race_title,
    claim_value,
    platform_text,
    source_name,
    source_url,
    source_file,
    source_sha256,
    extraction_method
) AS (
    VALUES
        (
            'cec-platform:2022:votetw-candidate-961ad18334e1caa5',
            'votetw-candidate-961ad18334e1caa5',
            '蔡文益',
            '宜蘭縣頭城鎮鎮長選舉',
            '2022年宜蘭縣頭城鎮鎮長選舉公報政見',
            $platform$一、交通便捷：假日塞車嚴重，增設東西向道路，於金面溪、得子口溪堤防道拓寬為6米道，讓竹安直接福成金面山腳，另為一號道路南端連接高速公路交流道，積極規劃鎮內道路拓寬連結。
二、農業政策：保障農民地主權益，實施全面農地重劃，推廣農業產品，增加農民收益。
三、弱勢關懷：提升老人照顧品質，加強長照及長青食堂設置。
四、孩童照護：提高生育津貼，托嬰中心設立及幼兒教育環境改善。
五、休閒運動：建立桌球館、室內溫水游泳池，並辦理各項體育活動。
六、工商發展：拔雅工業區15米規劃道，並引進輕工業，增加就業機會。
七、文化傳承：頭城文風鼎盛，設立文化館，老街再造，推廣各項文化活動。
八、建設起飛：頭城為開蘭第一城，加速打造優質城市，讓城市風貌更新。
九、漁業提升：配合爭取各項漁業補助，推動漁業精緻化，改善漁民生計。
十、開發觀光：引進觀光資源，結合在地商家，推展優質觀光。$platform$,
            '中央選舉委員會：2022年頭城鎮鎮長選舉公報',
            'https://eebulletin.cec.gov.tw/111/15%E5%AE%9C%E8%98%AD%E7%B8%A3/03%E9%84%89%E9%8E%AE%E5%B8%82%E9%95%B7/%E9%A0%AD%E5%9F%8E%E9%8E%AE%E9%8E%AE%E9%95%B7%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/%E9%A0%AD%E5%9F%8E%E9%8E%AE%E9%8E%AE%E9%95%B7%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1.pdf',
            'tmp/pdfs/cec-2022-toucheng-mayor.pdf',
            'a0e0f59d7b6b75ff230ce4b8b7dcb5090010322f41ea6439b58dd25e19ff75b4',
            'manual_transcription_verified_against_pdf_render'
        ),
        (
            'cec-platform:2022:votetw-candidate-6ce9e16ade917721',
            'votetw-candidate-6ce9e16ade917721',
            '李明哲',
            '宜蘭縣蘇澳鎮鎮長選舉',
            '2022年宜蘭縣蘇澳鎮鎮長選舉公報政見',
            $platform$幸福安居・務實建設・政見延續
一、基礎建設　社會福利：
1. 建構安全通學步道。
2. 持續推動「花園城市」綠美化計畫。
3. 打造蘇澳戶外探索親子公園。
4. 持續推動長青食堂。
二、幼童培育　青年願景：
1. 爭取增設0-2歲公共托育中心設施及服務。
2. 持續推動英語學習力計畫。
3. 完善青年創生基地、推動地方創生事業結合社區共好。
三、城鎮聯盟　國際交流：
1. 「蘇澳－冬山」雙城鎮自行車道整合串聯。
2. 推動跨鄉鎮「鐵道觀光」。
3. 持續深化「日本石垣姊妹市」貨貿文化觀光交流。
四、永續觀光　創意行銷：
1. 推動武荖坑風景區為野外探索基地。
2. 籌劃南方澳環港特色觀光街車。
3. 推動活化蘇澳火車站扇型車庫。
五、交通增能　安全城鎮：
1. 加速國道五號交流道末端銜接蘇花改。
2. 促進「蘇花安」東澳至南澳路段改善。
3. 爭取「蘇澳溪分洪道」計畫並持續推動社區自主防災。$platform$,
            '中央選舉委員會：2022年蘇澳鎮鎮長選舉公報',
            'https://eebulletin.cec.gov.tw/111/15%E5%AE%9C%E8%98%AD%E7%B8%A3/03%E9%84%89%E9%8E%AE%E5%B8%82%E9%95%B7/%E8%98%87%E6%BE%B3%E9%8E%AE%E9%8E%AE%E9%95%B7%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/%E8%98%87%E6%BE%B3%E9%8E%AE%E9%8E%AE%E9%95%B7%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1.pdf',
            'tmp/pdfs/cec-2022-suao-mayor.pdf',
            '2bf5527a4a6a69c54d04d6fd4c919af1792a48bb49cea7ed5d06f5714c766459',
            'pdf_text_layer_verified_against_pdf_render'
        ),
        (
            'cec-platform:2022:votetw-candidate-ab007df3869e48cf',
            'votetw-candidate-ab007df3869e48cf',
            '蕭淑芬',
            '彰化縣田中鎮鎮長選舉',
            '2022年彰化縣田中鎮鎮長選舉公報政見',
            $platform$擘劃永續發展新田中、精進鄉親樂活幸福感
1. 爭取在彰化高鐵特區興建「彰化優質農業展售中心」和「大型多功能展覽館」，帶動產業發展與就業機會。
2. 儘速完成第一公有市場現代化興建，精進市場生活機能及帶動周邊商圈的商機。
3. 儘速規劃興建第二公墓納骨塔、殯儀館及明亮、寬敞、綠美化的生命園區。
4. 鎮內各排水系統定期清淤作業，爭取水土保持局經費整治野溪，以維護鎮民生命財產安全。
5. 爭取開闢高鐵聯外道路新闢工程與台鐵田中支線，提供便捷安全的交通，帶動地方觀光發展。
6. 爭取田中鎮設置公共自行車站點，提供一般和電動輔助自行車，提供遊客來田中旅行便利的交通工具。
7. 打造「臺灣田中米倉文創園區」，成立「文創共學基地和青農培訓基地」推廣在地產業、文化藝術和農業發展，成為南彰化文創藝文基地。
8. 再造田中老街觀光發展，開啟古宅建築的新生命和珍貴歷史軌跡，重拾田中老街繁華風貌。
9. 辦理田中馬拉松、藝術踩街嘉年華，冬季花海節活動並爭取稻農冬季稻田休耕補助，結合地方百工百業聯合行銷、在地觀光遊程和交通接駁，提高活動魅力與成效，成為南彰化觀光亮點。
10. 充實鎮內運動場館設施提倡運動休閒活動，並舉辦運動賽事。
11. 改善全鎮公園設施和展演空間，增加照明和遊樂設施，提供親子們休憩場所，及舉辦兒童藝術表演活動。
12. 配合田中鎮農會推廣精緻農業，培育優秀農村青年管理技術與產品行銷，增加農民收益。
13. 規劃田中的休閒農業，推動「田中農遊」體驗農村田園風光為注入農業帶來新活力，並帶來觀光熱潮。
14. 敬老致贈長者禮金和禮品，建立長照、關懷、日照「樂齡綜合社福中心」，設置共享食堂以中央廚房方式統一發送餐食至各關懷站，照顧弱勢、獨居老人、新住民，使老有所依，子女可專心事業。
15. 致贈生育津貼，建立「樂兒多元智能親子中心」，設置托嬰中心及育兒親子館，提供孩子們快樂共學及健康成長處所，讓年輕父母減輕育兒負擔安心拚經濟。$platform$,
            '中央選舉委員會：2022年田中鎮鎮長選舉公報',
            'https://eebulletin.cec.gov.tw/111/10%E5%BD%B0%E5%8C%96%E7%B8%A3/03%E9%84%89%E9%8E%AE%E5%B8%82%E9%95%B7/%E7%94%B0%E4%B8%AD%E9%8E%AE%E9%8E%AE%E9%95%B7.pdf',
            'tmp/pdfs/cec-2022-tianzhong-mayor.pdf',
            '5eadbe530ae8a620502b97a8b005eac8bd0bdadf166eb1693b4d5c0e8941b57c',
            'pdf_text_layer_verified_against_pdf_render'
        ),
        (
            'cec-platform:2022:votetw-candidate-21ba06e26ac56776',
            'votetw-candidate-21ba06e26ac56776',
            '林慧如',
            '雲林縣古坑鄉鄉長選舉',
            '2022年雲林縣古坑鄉鄉長選舉公報政見',
            $platform$改變古坑，清廉勤政！慧如有7目標、11好政見、六大標竿

7目標：
設立服務中心，建置資訊平台。
捍衛農業正義，爭取公地放領。
發揚在地文化，推廣觀光產業。
主動關懷弱勢，專責專人服務。
強化村鄰組織，深化社區功能。
迎接產業園區，創造古坑榮景。
打造美麗家園，營造宜居古坑。

11好政見：
1. 服務好，力行簡政便民。
2. 環境好，草要除、溝要清，打造優質生活環境。
3. 文化好，編纂村史、故事繪本；規劃藝文團體展演。
4. 教育好，尋求企業資源協助鄉內國中小發展特色教育；辦理各項藝文活動。
5. 社區好，深化社區功能，發展一社區一特色。
6. 農產好，建立古坑農產品牌，爭取農地重劃；協助解決農業缺工問題。
7. 居住好，全面通盤檢討古坑都市計畫，爭取辦理農村社區重劃。
8. 社福好，設立社會福利諮詢中心，強化老福所功能；幼兒園增設幼幼班。
9. 運動好，推動古坑馬拉松、鐵馬遊、萬步健行，補助辦理各項運動比賽。
10. 建設好，改善154乙縣道（福祿壽酒廠前）交通，延伸特九號道路至崁頭厝及台3線；爭取活動中心的興（修）建與農水路改善及河川的整治。
11. 觀光好，以古坑豐富樣貌，推動尋根、溯溪、訪樹、採果、聞香、探幽、慢遊之旅。

六大標竿：
（一）協力古坑產業加值園區的設置。
（二）爭取縣道149、149甲及149乙提升為台3丁省道，完善交通網絡。
（三）協助149甲縣道清水溪跨橋興建。
（四）爭取國3號側車道往南延伸至雲199線鄉道往北延伸至棋盤橋林溪，做為古坑鄉南北的交通要道，並爭取78快速道路在154乙縣道增設簡易交流道。
（五）完善古坑Bike-go自行車道系統網絡。
（六）籌編村村有村史，展現古坑鄉的軟實力。$platform$,
            '中央選舉委員會：2022年古坑鄉鄉長選舉公報',
            'https://eebulletin.cec.gov.tw/111/12%E9%9B%B2%E6%9E%97%E7%B8%A3/03%E9%84%89%E9%8E%AE%E5%B8%82%E9%95%B7/%E5%8F%A4%E5%9D%91%E9%84%89%E9%95%B7.pdf',
            'tmp/pdfs/cec-2022-gukeng-mayor.pdf',
            'c9208295c06022b4e5f5a97a7421154162ef3d07c94baa34b635eff6838578c1',
            'manual_transcription_verified_against_pdf_render'
        ),
        (
            'cec-platform:2022:votetw-candidate-ec5a88f751fb8902',
            'votetw-candidate-ec5a88f751fb8902',
            '陳建名',
            '雲林縣褒忠鄉鄉長選舉',
            '2022年雲林縣褒忠鄉鄉長選舉公報政見',
            $platform$一、褒忠鄉生育獎勵金。
二、爭取興建社會住宅，實現居住正義。
三、爭取褒忠農業機械科技產業園區270公頃，分期開發。
四、持續爭取補助改善鄉內道路及排水溝通暢，並改善淹水狀況。
五、持續辦理地方特色活動，健走、藝文活動……等，進行文化、宗教、農產品推廣，提升鄉民的健康及培養鄉民藝術文化涵養，將文化藝術帶進鄉內，平衡城鄉藝文資源。
六、爭取開辦全鄉老人食堂，以實際的行動支持照顧長者。
七、持續落實各項社會福利措施及健康巴士活動。
八、堅決反對污染源，捍衛鄉民住的品質及健康。
九、持續辦理走讀雲林導覽英語研習活動，落實2030國家雙語政策，培養在地特色英語導覽。$platform$,
            '中央選舉委員會：2022年褒忠鄉鄉長選舉公報',
            'https://eebulletin.cec.gov.tw/111/12%E9%9B%B2%E6%9E%97%E7%B8%A3/03%E9%84%89%E9%8E%AE%E5%B8%82%E9%95%B7/%E8%A4%92%E5%BF%A0%E9%84%89%E9%95%B7%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1.pdf',
            'tmp/pdfs/cec-2022-baozhong-mayor.pdf',
            '4c76481d413255c5e241a07bce1db09f734f09f13b112bf02c19b2f2e9dcf56e',
            'manual_transcription_verified_against_pdf_render'
        )
), matched AS (
    SELECT
        data.*,
        candidate.id AS candidate_id,
        candidate.person_id,
        race.id AS race_id,
        election.id AS election_id
    FROM platform_data data
    JOIN public.candidates candidate
      ON candidate.external_id = data.candidate_external_id
     AND candidate.is_elected IS TRUE
     AND candidate.election_result = 'elected'
    JOIN public.people person
      ON person.id = candidate.person_id
     AND person.name = data.person_name
    JOIN public.races race
      ON race.id = candidate.race_id
     AND race.title = data.race_title
    JOIN public.elections election
      ON election.id = race.election_id
     AND election.year = 2022
)
INSERT INTO public.person_claims (
    claim_key,
    person_id,
    candidate_id,
    claim_type,
    claim_value,
    claim_json,
    confidence_level,
    review_status,
    visibility,
    source_name,
    source_url,
    observed_at,
    is_public,
    review_score,
    scoring_version,
    scoring_reasons
)
SELECT
    matched.claim_key,
    matched.person_id,
    matched.candidate_id,
    'platform',
    matched.claim_value,
    JSONB_BUILD_OBJECT(
        'platformText', matched.platform_text,
        'electionContext', JSONB_BUILD_OBJECT(
            'candidateId', matched.candidate_id,
            'raceId', matched.race_id,
            'electionId', matched.election_id
        ),
        'sourceDocument', JSONB_BUILD_OBJECT(
            'file', matched.source_file,
            'sha256', matched.source_sha256,
            'page', 1,
            'extractionMethod', matched.extraction_method
        ),
        'publicationGate', JSONB_BUILD_OBJECT(
            'status', 'passed',
            'reason', 'Exact elected candidacy matched by stable candidate external id, person name, race title and 2022 result'
        ),
        'phase', 1
    ),
    'A',
    'verified',
    'public',
    matched.source_name,
    matched.source_url,
    TIMESTAMPTZ '2022-11-26 00:00:00+08',
    TRUE,
    100,
    'cec-elected-platform-v1',
    JSONB_BUILD_ARRAY(
        'Central Election Commission election bulletin',
        'Exact elected candidate match',
        'Full platform text verified against preserved PDF snapshot'
    )
FROM matched
ON CONFLICT (claim_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;
