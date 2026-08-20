import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const regionalSeedPath = path.join(repoRoot, 'data-sources', 'cec-2024-bulletin-profile-claims.seed.json');
const partyListSeedPath = path.join(repoRoot, 'data-sources', 'cec-2024-party-list-bulletin-profile-claims.seed.json');
const regionalReviewPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2024-legislator', 'review.json');
const qaPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2024-profile-column-overflow-qa.json');

const regionalCorrections = {
  鄭正鈐: {
    experience: '新竹市第十屆立法委員\n新竹市議會第六、七、八、九、十屆議員\n中華大學、玄奘大學助理教授\n新竹市消防局鳳凰志工隊大隊長／工商時報記者\n新竹市中區扶輪社社長／救國團之友聯誼會會長\n鄭氏宗親會副理事長／新竹市各姓宗親會理事',
  },
  蔡易餘: {
    education: '台灣大學財經法律學系畢業。',
    experience: '萬國法律事務所律師、民主進步黨中央執行委員、台灣陪審團協會理事、凱達格蘭基金會理事、小英教育基金會顧問、民主進步黨嘉義縣黨部主委、第九、十屆立法委員。',
  },
  陳冠廷: {
    education: '日本國立東京大學公共政策碩士\n美國威斯康辛大學麥迪遜分校國際研究學士\n嘉義縣私立協同高級中學',
  },
  楊瓊瓔: {
    experience: '立法院第四、五、六、七、八、十屆立法委員；臺中市副市長；立法院國民黨團書記長；立法院經濟、財政、教育及文化委員會召集委員；立法院中美洲議會觀察員；臺灣省議會第九、十屆省議員；中英獅子會會長；臺中港女國濟同濟會會長；臺中市大臺中婦女會理事長。',
  },
  林思銘: {
    experience: '新竹縣議會第15、16、17、18、19屆議員\n文化大學法律研究所\n台灣大學PMLBA碩士班\n明典法律事務所主持律師\n中華民國立法院第十屆立法委員',
  },
  黃建賓: {
    experience: '大武鄉公所約聘村幹事\n大武鄉民代表會第十九、二十屆代表主席\n大武鄉第十八、十九屆鄉長',
  },
  涂權吉: {
    experience: '第二、三屆桃園市議員\n立法委員廖正井主任\n立法委員吳志揚秘書\n●桃園市\n楊梅獅子會副會長\n菁英慢壘協會創會長\n客家藝文協會理事長\n楊梅國際青年商會會長\n余徐涂佘四美同宗會副理事長\n●楊梅區\n桌球、柔道委員會主委\n後備軍人輔導中心督導\n退伍軍人協會、儲蓄互助社理事長\n楊梅高中家長會會長\n大同國小、治平中學副會長',
  },
};

const partyListCorrections = {
  林倩綺: {
    education: '華盛頓大學博士、波士頓音樂學院碩士。',
    experience: '新北市政府文化局、原民局局長。高雄縣政府文化局局長。考試院典試委員。南華大學助理教授。',
  },
  韓國瑜: {
    education: '東吳大學英國語文學系文學士學位、政治大學東亞研究所法學碩士',
    experience: '典亮慈善基金會董事長、高雄市市長、台北農產公司總經理、立法委員（第二、三、四屆）、台北縣議員',
  },
  葛如鈞: {
    education: '國立臺灣大學資訊網路與多媒體研究所資訊工程學博士',
    experience: '國立臺灣大學資訊網路與多媒體研究所兼任助理教授。國立臺北科技大學互動設計系專任助理教授',
  },
  陳菁徽: {
    education: '臺北醫學大學醫學系、國立臺灣大學碩士',
    experience: '美國約翰霍普金斯大學公衛碩士、宜蘊醫療創辦人、臺北醫學大學專任助理教授、北醫附醫婦科主任。',
  },
  許宇甄: {
    education: '國立雲林科技大學企業管理所碩士\n私立輔仁大學統計系學士',
    experience: '中國國民黨中央組發會主委、雲林縣黨部主委、雲林縣工策會總幹事、雲林縣婦聯會主委、大學講師。',
  },
  許忠信: {
    education: '台灣大學政治系國際關係組\n政大法學碩士\n英國劍橋大學法學博士',
    experience: '第8屆立法委員、成大法律系教授、巴黎國際商會主任仲裁人\n國際名仕會臺灣總秘書長',
  },
  沈伯洋: {
    education: '加州大學爾灣分校犯罪與法律社會學博士、賓州大學法學碩士、台大法律法學碩士',
    experience: '臺北大學犯罪學研究所所長、台灣民主實驗室理事長、黑熊學院院長、台灣人權促進會執行委員、律師',
  },
  范雲: {
    education: '耶魯大學社會學博士',
    experience: '第十屆立法委員、中華民國無任所大使、社會民主黨召集人、臺大社會系副教授、中央研究院助研究員、婦女新知基金會董事長、野百合學運總指揮',
  },
  郭昱晴: {
    education: '私立淡江大學法文系畢業',
    experience: '袖珍藝術工作者、影視文化工作者（演員、主持人）、作家、生命教育講師',
  },
  王義川: {
    education: '國立臺灣大學土木工程研究所交通組碩士、博士、國立臺灣大學土木工程學系',
    experience: '台中市政府交通局長、財團法人台灣智庫董事、策略長、桃園航空城公司董事長、台灣觀光協會秘書長',
  },
};

const contaminationPattern = /投票所|行動電話|圈選|選舉人|公辦電視|直播時間|重播時間|推薦之政黨|基本資料|(^|\n)(學歷|經歷|政見)(\n|$)/u;

function applyCorrections(seed, corrections) {
  for (const [personName, fields] of Object.entries(corrections)) {
    for (const [claimType, claimValue] of Object.entries(fields)) {
      let claim = seed.personClaims.find((item) => item.personName === personName && item.claimType === claimType);
      if (!claim) {
        const template = seed.personClaims.find((item) => item.personName === personName);
        if (!template) throw new Error(`Missing ${personName} profile claim`);
        const claimKey = template.claimKey.replace(/:(education|experience)$/u, `:${claimType}`);
        if (claimKey === template.claimKey) throw new Error(`Cannot derive ${personName} ${claimType} claim key`);
        claim = structuredClone(template);
        claim.claimKey = claimKey;
        claim.claimType = claimType;
        seed.personClaims.push(claim);
      }
      claim.claimValue = claimValue;
      claim.claimJson.value = claimValue;
      claim.claimJson.items = [claimValue];
      claim.claimJson.extractionMethod = 'manual_official_bulletin_transcription';
      claim.claimJson.extractionNote = 'Corrected after visual comparison found column or adjacent-section overflow in the automatic extraction.';
    }
  }
}

function main() {
  const regional = JSON.parse(fs.readFileSync(regionalSeedPath, 'utf8'));
  const partyList = JSON.parse(fs.readFileSync(partyListSeedPath, 'utf8'));
  const review = JSON.parse(fs.readFileSync(regionalReviewPath, 'utf8'));
  applyCorrections(regional, regionalCorrections);
  applyCorrections(partyList, partyListCorrections);
  const candidateNames = new Set(review.entries.flatMap((entry) => entry.raceCandidates.map((candidate) => candidate.personName)));
  const problems = [];
  for (const claim of regional.personClaims) {
    if (contaminationPattern.test(claim.claimValue)) problems.push(`${claim.personName}: contaminated ${claim.claimType}`);
    for (const candidateName of candidateNames) {
      if (candidateName !== claim.personName && candidateName.length >= 2 && claim.claimValue.includes(candidateName)) {
        problems.push(`${claim.personName}: ${claim.claimType} contains adjacent candidate ${candidateName}`);
      }
    }
  }
  for (const claim of partyList.personClaims) {
    if (contaminationPattern.test(claim.claimValue)) problems.push(`${claim.personName}: contaminated ${claim.claimType}`);
  }
  if (problems.length > 0) throw new Error(`Profile column-overflow QA failed:\n${problems.join('\n')}`);
  const qa = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    regionalCorrectedPeople: Object.keys(regionalCorrections),
    partyListCorrectedPeople: Object.keys(partyListCorrections),
    problems,
  };
  fs.writeFileSync(regionalSeedPath, `${JSON.stringify(regional, null, 2)}\n`);
  fs.writeFileSync(partyListSeedPath, `${JSON.stringify(partyList, null, 2)}\n`);
  fs.writeFileSync(qaPath, `${JSON.stringify(qa, null, 2)}\n`);
  console.log(JSON.stringify(qa, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}


export { applyCorrections };
