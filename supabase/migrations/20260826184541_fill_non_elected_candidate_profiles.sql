begin;

create temp table profile_gap_inputs (
  person_id uuid primary key,
  person_name text not null,
  election_year integer not null,
  education text,
  experience text
) on commit drop;

insert into profile_gap_inputs (
  person_id,
  person_name,
  election_year,
  education,
  experience
)
values
  ('6dad34bb-07e4-4669-9e82-90b9763187d1', '吳宗憲', 2022, null, '桃園市議會第一屆市議員、桃園縣議會第十五、十六、十七屆議員、觀音鄉民代表會第十五屆副主席、第十六屆鄉民代表、草漯國小教育事務基金會董事長、觀音鄉吳姓宗親會會長、台灣兒童暨家庭扶助基金會委員、桃園市社區志工推展協會理事長、觀音獅子會會長、觀音同濟會會長、救國團觀音團委會會長'),
  ('1d43d439-839b-4213-82ab-aa4c2d5ca3bf', '李振榮', 2022, '台灣省立體育專科學校、台灣警察學校', '內政部航空警察局警員、獅子鄉民代表會第21屆鄉民代表'),
  ('5ad17b6b-345a-4b81-b8bc-3478a037702d', '林芳如', 2022, '臺北醫學大學護理系', '中山醫學大學附設醫院、臺東基督教醫院、臺東馬偕醫院、大武鄉衛生所'),
  ('df52ba3a-2e40-43cb-95c9-b501597d3bca', '林清發', 2022, '三間國小', '基督教習藝所、大發吊車行負責人、大聯發吊車行負責人、台中大俱來同鄉會會長、台中長濱旅中同鄉會會長'),
  ('d87a57f2-becb-4be7-8272-3a1337ef3845', '洪志明', 2022, '逢甲大學IMBA國際經營管理碩士、國立雲林科技大學工業工程與管理系、國立虎尾科技大學電機工程科（五專部）', null),
  ('e9e00194-c11a-4741-94b7-e10536ff217a', '張凱翔', 2022, '桃園國小、振聲中學、臺北醫學大學藥學士', '桃園市政府市政顧問、台南同鄉會常務理事、桃園區張氏宗親會副理事長、西藥商公會理事長、張老師基金會主任委員、景福派出所警友站站長、商業總會理事、中藥商業同業公會顧問、桃園區家長會長協會執行長、桃園國小與振聲高中家長會長、桃園區體育會常務監事、守望相助大隊指導員、臺北醫學大學桃園校友會常務理事'),
  ('40458e06-e918-462f-9b0f-db4f06107750', '林建志', 2022, '屏東縣歸來國民小學、屏東縣立中正國民中學、屏東縣私立屏榮高級商工職業學校', '公報經歷欄空白'),
  ('d0557ab6-1345-4469-806e-892b46806095', '陳冠宇', 2022, '玄奘大學資管系、台東大學附設體育高中、六家國小、六家國中', '新竹縣竹北市市民代表、NVIDIA社群行銷暨通路訓練專員、中央大學防災士結業、凱達格蘭學校第26期國策班結業、凱達格蘭學校青年領袖營結業、新竹縣議會第18、19屆議員、竹北市民代表會第6、7屆市民代表、中國國民黨第18、19、20、21屆黨代表'),
  ('172341ff-3b02-48d7-8541-65c1338602f0', '張振亮', 2022, '屏東縣九如鄉國小、屏東縣九如國中、屏東市屏榮高中、屏東縣大仁科技大學附設專科進修學校肄業', '屏東縣九如鄉民代表會第18、19屆主席、屏東縣九如鄉第17、18屆鄉長'),
  ('a2cd8011-8184-41e9-94c8-0fdca62c6b30', '彭新銘', 2022, '國立虎尾科技大學電機工程學系、西螺農工、斗南國中、斗南國小', '2020年立法委員候選人、斗南鎮民代表、斗南鎮小東社區發展協會總幹事、西螺農工棒球隊教練、零號企業社負責人、斗南鎮公所職員、全運會雲林縣棒球代表隊、斗南鎮棒球代表隊領隊'),
  ('3a9780ca-74ce-44f2-ae12-b1bb551a8fac', '林明義', 2022, '龜山國小、國防大學政治作戰學院專科學生班79年班第13期', '銘傳大學公行系在職學分班、美國GIA寶石學院鑑定師、龜山區大同里第一、二屆里長、大同社區發展協會理事長、桃園市林姓宗親會龜山分會理事長、壽山巖觀音寺董事、比得利珠寶銀樓負責人、桃園市金銀珠寶同業公會常務理事、龜山國小家長會長、桃園博愛獅子會前會長、龜山後憲荷松協會顧問'),
  ('8958b535-a35a-411d-80a9-f74ca75b60d8', '葉國雄', 2022, null, '鹿港分局民防副中隊長、秀水鄉第19屆代表、大彰國際青年商會會長、秀水鄉調解委員會委員、彰化地方檢察署觀護監事、秀水獅子會創會長、立委魏明谷與蔡煌瑯服務處主任、鎮長黃振彥競選團隊執行長、彰化縣第18、19屆議員'),
  ('769d921c-72cb-46bb-9eea-f36511e82618', '陳志明', 2022, null, '時代力量秘書長、時代力量發言人、時代力量台北黨部主委、臺北市南隆獅子會會長'),
  ('f7d97ddd-1dea-48d4-9d3a-1f770962a5f4', '張志宏', 2022, null, '頭前獅子會會長、金獅服務會長聯誼會首屆主席、新莊區張廖簡宗親會理事長、隨意愛心關懷協會理事長、新莊分局中平義警分隊顧問團團長、新北市福營義消分隊顧問團團長、新莊鎮泰宮主委、新莊玄武堂榮譽主委、新莊同心會副理事長、新莊區青山健行協會副理事長'),
  ('f04b5aa3-837e-4158-bd89-508884b05884', '李清林', 2022, null, '礁溪鄉民代表、副主席、宜蘭縣議會第十四、十五屆議員、第十六、十七屆副議長、第十九屆議員'),
  ('dbc0f9b2-0cd0-4ced-b327-4d6b3feb91d7', '林志成', 2022, '高職畢業', '新埤鄉第17、18屆鄉長'),
  ('cb2d97d6-27cd-4e3c-98c1-f4cd2a923b7d', '陳志明', 2022, null, '台北都市更新協會理事、台北市信義國中家長委員'),
  ('c5372444-36c6-49fe-9bf5-9a6d065d2b53', '吳佩蓉', 2022, '前金國小、七賢國中、鳳山高中、國立成功大學歷史學系、國立清華大學歷史研究所', '中央研究院史語所研究助理、高雄市政府研考會企劃員、行政院新聞局行政專員、行政院大陸委員會副研究員、林佳龍國會辦公室法案助理、陳其邁國會辦公室法案助理、鄭麗君國會辦公室法案助理、促轉會副研究員'),
  ('7cf25b19-7816-410b-a63d-c63e2e773976', '柳淑芳', 2022, null, '國小全班第一名、國中英文不及格、中山大學公務人員進修班英文會話一百分、曾任英文家庭教師、現任台灣中油公司圖書管理員、散文〈紀念感恩我的父親〉及〈我的母親〉被刊載獲佳評、參選里長、市議員、立委奮鬥不懈、楠梓第一人：西青埔垃圾場抗爭、高雄第一人：倒馬遊行、全國第一人：罷免空心蔡大陸妹遊行'),
  ('505f6c1e-6e82-40e0-ac7e-952755bd0dc5', '洪志明', 2022, '正修科技大學企業管理系管理學士', '前立法委員蘇清泉服務處主任、前琉球鄉親會總幹事（現任理事）、國民黨東港鎮黨部主委、東港鎮鎮民代表、南部地區後備指揮部組訓顧問'),
  ('d05ee015-57d6-457a-90f8-252d8f0b01a6', '翁美春', 2022, null, '大臺中市第一、二屆市議員、臺中縣第十六屆縣議員、臺中市議會警消環衛召集人、臺中市議會民進黨團幹事長、臺中市議會民進黨團書記長、民進黨臺中縣黨部婦女組組長、六合慈善會理事、翁子義警分隊顧問、美豐獅子會顧問、臺中縣記帳士公會顧問'),
  ('db9df2fa-aee6-42bd-bd40-9f2eb50dec99', '郭麗華', 2022, null, '桃園市第一、二屆市議員、桃園市體育總會桌球委員會主任委員、蘆竹區體育會十八式氣功委員會主任委員、桃園市警察局蘆竹分局志工中隊長、桃園市議員'),
  ('de10ebed-c9fe-4369-954e-b0f247467243', '陳志明', 2022, '花蓮縣立玉東國中', '花蓮縣南區巡守大隊顧問、東台灣記者協會顧問、富里防宣大隊顧問、玉里民眾服務社顧問'),
  ('3fe3d56e-e466-48ee-b9bb-db2275cd92c1', '陳清全', 2022, null, '新竹市職業總工會理事長、新竹市民富國小校友會常務理事、冠義社民藝協會理事長、新竹市木工業職業工會榮譽顧問、吳青山市議員辦公室主任'),
  ('669a68a8-5c1f-487d-a397-e70c463b7a3c', '陳福慶', 2022, null, '台南縣南化鄉民代表會主席、丁丁有限公司負責人'),
  ('dda83220-0398-4132-9994-640a2357c349', '張睿倉', 2022, '大華國中、國立臺中二中、世新大學', null),
  ('7d37dbe1-b595-4ddb-b5ad-d738c8b1101a', '曾宛菁', 2022, '斗煥國小、興華國中、大成高中', '中華統一促進黨臥龍黨部秘書、兩岸時報苗栗處秘書、傳奇報導苗栗處秘書'),
  ('6ee090f6-a90f-4fce-92cc-103af1d1f894', '李偉華', 2022, null, '長庚醫院主治醫師、中華民國全國醫師聯合會副秘書長、基隆市診所協會理事長、李偉華耳鼻喉科診所院長、新光醫院主治醫師、基隆市議員、市議員鄭林清良服務處特助、基隆市婦女會總幹事'),
  ('becd698c-5a88-412e-b7b6-a0447801502d', '王齡嬌', 2022, '國立中山大學公共政策碩士、文藻語專、光華國中、愛群國小', '高雄市第六、七屆議員、國民黨高雄市黨部副主委、國民黨提名參選高雄市立法委員、全國青商會總會長、高雄市救國團團友會會長、高雄市傷殘服務協會榮譽理事長、高雄市中華工商文化經貿促進協會理事長、世界青商副主席、高雄市體育會運動舞蹈委員會主任委員、美和科技大學社工系在學'),
  ('97d478b5-5780-42de-91eb-1b0f3f9a5942', '陳玉鳳', 2022, '淡江大學英國語文學系、台灣省立板橋高級中學、台北縣立江翠國民中學、台北縣立江翠國民小學', '第10屆立法委員候選人'),
  ('b9593008-a718-45bf-a4e1-13bffe7a8430', '張怡', 2022, '美國柏克萊大學法學碩士、英國諾丁漢大學英語研究碩士、國立臺灣大學進修法律學士、國立臺灣大學外國語文學士、高雄女中、恆春國小', '紐約派美語創辦人、國際專利商標事務所國外部主任、中華民國律師執照、美國紐約州律師考試通過'),
  ('897f6406-43c2-48ca-a0d9-232f87ff084c', '李正皓', 2022, '國立臺灣海洋大學電機系學士、國立臺灣師範大學工業教育研究所碩士', '國立交通大學電機與自動化控制博士候選人、國民黨2016年總統競選辦公室發言人、各大政論節目固定來賓'),
  ('d8ded8d7-ff0d-4f69-a3db-9e1751857349', '童小芸', 2022, '長榮大學高階管理碩士', '臺南市政府顧問、國民黨徵召參選臺南市第十屆第三選區立委、臺南市北區振興里第三屆里長、臺南市里長促進協會副會長、臺南市北區第三屆里長聯誼會會長'),
  ('a6531936-ee53-4598-8c1a-ccf6bd7e1f14', '華珮君', 2022, '國立臺灣大學社會工作學系、北一女中、實踐國中、興德國小', '台灣動物保護黨創辦人、台灣動物保護黨主席、前台灣動物保護黨秘書長、社工師'),
  ('7d5f5c70-0144-4bf5-ad58-bf99a4a4979c', '李佳玲', 2022, '光武國小（高雄市三民區）、陽明國中（高雄市三民區）、鳳新高中（高雄市鳳山區）、靜宜大學國際貿易系', '兒童美語KK音標專任講師（90～92年）、百博文理補習班班主任（92～99年）、三商美邦壽險規劃師（99～109年）、陽明國小家長會常務理事（108～110年）、民眾黨三民服務處主任（109年迄今）、柯粉版版主'),
  ('23d4a9fc-9f09-49c9-b63d-3b291de20931', '林佳瑋', 2022, '國立政治大學社會學系學士、國立臺灣大學建築與城鄉研究所碩士、國立清華大學學士後法律學程學士', '桃園市產業總工會秘書長、桃園市空服員職業工會秘書長、中華民國全國航空業總工會顧問、中華民國消防員工作權益促進會顧問'),
  ('1cef9cde-28ab-4c5f-8a97-ee0a128c56d8', '吳益政', 2022, null, '高雄市合併前第六、七屆及合併後第一、二、三屆市議員、正修科技大學講師、文藻外語大學講師、道明中學董事'),
  ('72204671-f01f-4ad3-bf0b-9704daf8bee1', '朱哲成', 2022, '天主教輔仁大學廣告傳播學系', '時代力量平鎮區主任、2020年立法委員候選人、行政院中辦副執行長祕書、黃偉哲臺南市長競總新聞聯絡人'),
  ('81cad995-8a8c-4542-a4ec-71f4259ae2e4', '段體佩', 2022, '明道中學初中部畢業、樹德工專機械工程科73年畢業', '聯合報台中廣告社負責人、愛迪爾廣告公司負責人、惠双房屋旅順店店東、台中瑞寶獅子會秘書、台中救難協會顧問、台中青創協會首席顧問、林洋港與宋楚瑜選舉義工大隊長、民國93年起至地方法院抗議檢察官問案態度惡劣獲得改善、民國90年為民眾抗議中山醫院醫療糾紛並達成和解'),
  ('50f4ac22-d952-4743-86e1-954a0f8c3039', '徐定禎', 2022, '東吳大學企業管理系學士、省立新竹高級中學', '行政院顧問、第1屆頭份市市長、第16、17屆頭份鎮長、苗栗縣地政士公會理事長、中華資產鑑定股份有限公司估價師、苗栗縣竹南地政事務所課員'),
  ('1eca5b65-bffe-4c5f-81d7-527986e5ca62', '黃秀龍', 2022, '竹東高中、竹東國中、竹東國小', '神誠有限公司董事、國家甲等考試及格於民國81年'),
  ('698e8edd-ea97-4ea1-91f2-3765e9d15317', '張家豪', 2022, '國立臺灣大學心理學系學士', '台灣動物保護黨副主席、東默農編劇有限公司創辦人'),
  ('28c5dfaf-6490-4641-8a2f-f49e65fa1c61', '蔡明堂', 2024, null, '台北縣議會議員、新北市議會議員、中華民國棒球協會理事、新北市棒球委員會主任委員、蔡火石紀念文教基金會董事長、三重義消救護志工中隊中隊長、新北市中山獅子會會長、三重市後備軍人輔導中心主任、二重國小家長會長、二重國中家長會長、穀保家商校友會長'),
  ('add27636-af06-4cd9-851d-68b477facbf9', '陳源發', 2024, '輔仁大學西班牙語文學系、師大附中、成功高中、嘉義高中、嘉義縣溪口國小', '陳特事業機構董事長，首先開拓共產國家市場。人民之聲出版社社長，世界唯一以中文、英文、日文、西班牙文、法文五種語文著作28本書。'),
  ('a7a292df-bc96-40cb-a6b5-6f31411ee962', '林志成', 2024, '雲林縣褒忠國小、褒忠國中、彰化縣培元高職、美國北維吉尼亞大學研究所碩士', '中華民國健美協會秘書長兼總教練、76年至86年全國健力10年連霸冠軍、76年至91年全國健美16年連霸冠軍、74年第1486梯次新兵授槍代表、87年大學運動會第26屆宣誓代表'),
  ('3e77774c-74f6-4ec4-b5af-7bb0843599ae', '陳永和', 2024, '玉井高中、關廟國中、五甲國小、龍船國小', '聖泰工業股份有限公司總經理、2018年參選台南市長第三名、2014～2018年龍崎牛埔里里長');

create temp table profile_gap_targets on commit drop as
select distinct on (input.person_id)
  input.*,
  candidate.id as candidate_id,
  case
    when input.election_year = 2024 then '中央選舉委員會：2024年立法委員選舉公報'
    else '中央選舉委員會：2022年地方公職人員選舉公報'
  end as source_name,
  case
    when input.election_year = 2024 then 'https://2024.cec.gov.tw/'
    else 'https://eebulletin.cec.gov.tw/?dir=111'
  end as source_url
from profile_gap_inputs as input
join public.people as person
  on person.id = input.person_id
  and person.name = input.person_name
join public.person_canonical_map as person_map
  on person_map.canonical_person_id = input.person_id
join public.candidates as candidate
  on candidate.person_id = person_map.person_id
join public.races as race
  on race.id = candidate.race_id
join public.elections as election
  on election.id = race.election_id
where election.year = input.election_year
  and candidate.is_elected = false
  and (
    (
      input.election_year = 2022
      and race.race_type in ('councilor_district', 'local_chief')
    )
    or (
      input.election_year = 2024
      and race.race_type in ('legislative_district', 'indigenous')
    )
  )
order by input.person_id, candidate.is_public desc, candidate.id;

do $validation$
declare
  target_count integer;
  education_count integer;
  experience_count integer;
begin
  select count(*), count(education), count(experience)
  into target_count, education_count, experience_count
  from profile_gap_targets;

  if target_count <> 46 then
    raise exception 'Expected 46 non-elected profile targets, found %', target_count;
  end if;

  if education_count <> 32 then
    raise exception 'Expected 32 education values, found %', education_count;
  end if;

  if experience_count <> 44 then
    raise exception 'Expected 44 experience values, found %', experience_count;
  end if;
end
$validation$;

update public.people as person
set
  education = case
    when nullif(btrim(person.education), '') is null then target.education
    else person.education
  end,
  experience = case
    when nullif(btrim(person.experience), '') is null then target.experience
    else person.experience
  end,
  updated_at = now()
from profile_gap_targets as target
where person.id = target.person_id
  and (
    (target.education is not null and nullif(btrim(person.education), '') is null)
    or
    (target.experience is not null and nullif(btrim(person.experience), '') is null)
  );

with claim_inputs as (
  select
    target.*,
    claim.claim_type,
    claim.claim_value
  from profile_gap_targets as target
  cross join lateral (
    values
      ('education'::text, target.education),
      ('experience'::text, target.experience)
  ) as claim(claim_type, claim_value)
  where claim.claim_value is not null
)
insert into public.person_claims (
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
  scoring_reasons,
  auto_reviewed_at
)
select
  format(
    'cec-reviewed-profile-gap-20260827:%s:%s',
    claim_inputs.person_id,
    claim_inputs.claim_type
  ),
  claim_inputs.person_id,
  claim_inputs.candidate_id,
  claim_inputs.claim_type,
  claim_inputs.claim_value,
  jsonb_build_object(
    'value', claim_inputs.claim_value,
    'personName', claim_inputs.person_name,
    'candidateId', claim_inputs.candidate_id,
    'electionYear', claim_inputs.election_year,
    'profileSource', 'cec_election_bulletin',
    'reviewAudit', jsonb_build_object(
      'version', 'manual-semantic-review-20260827-v1',
      'lineBreaksNormalized', true,
      'officialFieldBlank',
        claim_inputs.person_name = '林建志'
        and claim_inputs.claim_type = 'experience'
    )
  ),
  'A',
  'verified',
  'public',
  claim_inputs.source_name,
  claim_inputs.source_url,
  now(),
  true,
  95,
  'cec-manual-semantic-review-20260827-v1',
  jsonb_build_array(
    'A-level official election bulletin source',
    'candidate identity matched to election race',
    'OCR text semantically reviewed and punctuation normalized'
  ),
  now()
from claim_inputs
on conflict (claim_key) do update
set
  candidate_id = excluded.candidate_id,
  claim_value = excluded.claim_value,
  claim_json = excluded.claim_json,
  confidence_level = excluded.confidence_level,
  review_status = excluded.review_status,
  visibility = excluded.visibility,
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  observed_at = excluded.observed_at,
  is_public = excluded.is_public,
  review_score = excluded.review_score,
  scoring_version = excluded.scoring_version,
  scoring_reasons = excluded.scoring_reasons,
  auto_reviewed_at = excluded.auto_reviewed_at,
  updated_at = now();

do $validation$
declare
  published_claim_count integer;
begin
  select count(*)
  into published_claim_count
  from public.person_claims
  where claim_key like 'cec-reviewed-profile-gap-20260827:%'
    and review_status = 'verified'
    and visibility = 'public'
    and is_public = true;

  if published_claim_count <> 76 then
    raise exception 'Expected 76 published profile claims, found %', published_claim_count;
  end if;

  if exists (
    select 1
    from profile_gap_targets as target
    join public.people as person
      on person.id = target.person_id
    where
      (target.education is not null and nullif(btrim(person.education), '') is null)
      or
      (target.experience is not null and nullif(btrim(person.experience), '') is null)
  ) then
    raise exception 'Expected all targeted canonical profile fields to be populated';
  end if;
end
$validation$;

select published.promote();

commit;
