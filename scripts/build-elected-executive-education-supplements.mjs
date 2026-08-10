import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetsPath = path.join(repoRoot, 'data-sources', 'elected-executive-education-reviewed-targets-2026-08-10.json');
const wikidataPath = path.join(repoRoot, 'data-sources', 'elected-executive-wikidata-education-2026-08-10.seed.json');
const outputPath = path.join(repoRoot, 'data-sources', 'elected-executive-education-supplements-2026-08-10.seed.json');

const educationByName = {
  王慶豐: '國立花蓮高級中學',
  余政憲: '逢甲大學國際貿易學系；義守大學管理科學研究所碩士',
  吳俊立: '國立高雄應用科技大學財經與商業法律碩士',
  呂秀蓮: '國立臺灣大學；伊利諾大學厄巴納－香檳分校；哈佛法學院',
  李炷烽: '國立臺灣師範大學',
  李登輝: '國立臺灣大學；京都大學；愛荷華州立大學；康乃爾大學',
  李雅景: '南華大學管理研究所碩士班',
  阮剛猛: '國立臺中教育大學',
  周錫瑋: '輔仁大學大眾傳播學系',
  林宗男: '明治大學',
  林政則: '東吳大學',
  徐慶元: '國立成功大學',
  翁金珠: '國立臺灣師範大學',
  張博雅: '高雄醫學大學；國立臺灣大學；約翰霍普金斯大學',
  張溫鷹: '高雄醫學大學；國立政治大學；牛津大學；南安普敦大學',
  張榮味: '嘉義市私立神州高級中學進修學校',
  張福興: '東吳大學法學士；近畿大學法學碩士；近畿大學法學博士',
  張燦鍙: '國立臺灣大學；萊斯大學；加州理工學院',
  許財利: '國立空中大學',
  許添財: '中國文化大學；哥倫比亞大學；羅格斯大學；新學院',
  連戰: '國立臺灣大學；芝加哥大學',
  陳水在: '國防大學政治作戰學院',
  陳水扁: '國立臺灣大學',
  陳唐山: '國立臺灣大學大氣科學學士；奧克拉荷馬大學碩士；普渡大學博士',
  陳麗貞: '中國醫藥大學',
  傅學鵬: '臺灣省立苗栗高級中學',
  彭百顯: '中國文化大學；倫敦大學',
  黃仲生: '國立中興大學園藝學系',
  楊秋興: '國立臺灣大學土木工程系；國立臺灣大學土木工程研究所碩士',
  廖永來: '臺灣省立臺中師範專科學校',
  劉立群: '國立屏東科技大學；國立政治大學；西雅圖社群大學',
  劉守成: '輔仁大學',
  蔡仁堅: '臺北醫學院藥學系；哈佛大學政府學院公共行政碩士',
  鄭永金: '中國文化大學；敏實科技大學',
  謝長廷: '國立臺灣大學；京都大學',
  謝深山: '臺灣省立花蓮工業職業學校',
  蘇嘉全: '國立臺灣海洋大學；國立中山大學',
};

const sourceOverrides = {
  王慶豐: {
    id: 'hualien-high-school-distinguished-alumni-wang-ching-feng',
    name: '國立花蓮高級中學：歷屆傑出校友',
    url: 'https://www.hlhs.hlc.edu.tw/content?a=T0RESU16UTVNamt4TURrPTBrRE0xZ2pOeGNsVGludGVseQ%3D%3D',
    confidenceLevel: 'A',
  },
  余政憲: {
    id: 'wikipedia-yu-cheng-hsien-education',
    name: '維基百科：余政憲',
    url: 'https://zh.wikipedia.org/wiki/%E4%BD%99%E6%94%BF%E6%86%B2',
    confidenceLevel: 'C',
  },
  吳俊立: {
    id: 'cec-2012-taitung-legislator-bulletin-wu-chun-li',
    name: '中央選舉委員會：第8屆立法委員選舉臺東縣選舉公報',
    url: 'https://web.cec.gov.tw/api/file/a4d9f4fa-f6ec-4c99-bd2c-0a4624b496b8.pdf',
    confidenceLevel: 'A',
  },
  李雅景: {
    id: 'legislative-yuan-lee-ya-ching-profile',
    name: '立法院：李雅景委員簡介',
    url: 'https://www.ly.gov.tw/EngPages/List.aspx?nodeid=1119',
    confidenceLevel: 'A',
  },
  周錫瑋: {
    id: 'fu-jen-alumni-chou-hsi-wei',
    name: '輔仁大學：校友資料',
    url: 'https://www.fju.edu.tw/file/news/Public971/2008121101929.pdf',
    confidenceLevel: 'A',
  },
  張福興: {
    id: 'wikipedia-chang-fu-hsing-education',
    name: '維基百科：張福興',
    url: 'https://zh.wikipedia.org/wiki/%E5%BC%B5%E7%A6%8F%E8%88%88_%28%E6%94%BF%E6%B2%BB%E4%BA%BA%E7%89%A9%29',
    confidenceLevel: 'C',
  },
  陳唐山: {
    id: 'legislative-yuan-chen-tang-shan-profile',
    name: '立法院：陳唐山委員簡介',
    url: 'https://www.ly.gov.tw/EngPages/List.aspx?nodeid=11473',
    confidenceLevel: 'A',
  },
  傅學鵬: {
    id: 'miaoli-former-magistrate-fu-hsueh-peng',
    name: '苗栗縣政府：第十三屆縣長傅學鵬',
    url: 'https://www.miaoli.gov.tw/News_Content2.aspx?n=270&s=9538',
    confidenceLevel: 'A',
  },
  黃仲生: {
    id: 'nchu-distinguished-alumnus-huang-chung-sheng',
    name: '國立中興大學：傑出校友黃仲生',
    url: 'https://archive.nchu.edu.tw/data/special/special6_3.pdf',
    confidenceLevel: 'A',
  },
  楊秋興: {
    id: 'legislative-yuan-yang-chiu-hsing-profile',
    name: '立法院：楊秋興委員簡介',
    url: 'https://www.ly.gov.tw/EngPages/List.aspx?nodeid=1027',
    confidenceLevel: 'A',
  },
  廖永來: {
    id: 'taichung-literature-liao-yung-lai-profile',
    name: '臺中文學館：廖莫白（廖永來）作家小傳',
    url: 'https://www.tlm.taichung.gov.tw/form/Details.aspx?Parser=2%2C8%2C46%2C95%2C%2C%2C104',
    confidenceLevel: 'A',
  },
  蔡仁堅: {
    id: 'cec-2014-hsinchu-mayor-bulletin-tsai-jen-chien',
    name: '中央選舉委員會：2014年新竹市市長選舉公報',
    url: 'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/04%E7%B8%A3%E5%B8%82%E9%95%B7/103%E5%B9%B4/08%E6%96%B0%E7%AB%B9%E5%B8%82%E5%B8%82%E9%95%B7.pdf',
    confidenceLevel: 'A',
  },
  謝深山: {
    id: 'votetw-legislative-yuan-hsieh-shen-shan',
    name: 'VoteTW：謝深山立法院資料',
    url: 'https://votetw.com/data/candidate/%E8%AC%9D%E6%B7%B1%E5%B1%B1',
    confidenceLevel: 'B',
  },
};

const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8')).targets;
const wikidataClaims = JSON.parse(fs.readFileSync(wikidataPath, 'utf8')).personClaims;
const wikidataByPersonId = new Map(wikidataClaims.map((claim) => [claim.personId, claim]));

const personClaims = targets.map((target) => {
  const education = educationByName[target.name];
  if (!education) throw new Error(`Missing curated education for ${target.name}`);

  const wikidataClaim = wikidataByPersonId.get(target.personId);
  const override = sourceOverrides[target.name];
  if (!override && !wikidataClaim) throw new Error(`Missing source for ${target.name}`);

  const source = override ?? {
    id: `wikidata-${wikidataClaim.claimJson.wikidataQid.toLowerCase()}`,
    name: `Wikidata：${target.name}`,
    url: wikidataClaim.sourceUrl,
    confidenceLevel: 'C',
  };

  return {
    claimKey: `elected-executive-education:${target.personId}`,
    personId: target.personId,
    personName: target.name,
    claimType: 'education',
    claimValue: education,
    claimJson: {
      value: education,
      identityMatch: override
        ? { status: 'matched', method: 'exact_name_and_elected_executive_office', score: 100 }
        : wikidataClaim.claimJson.identityMatch,
      manualReview: {
        status: 'approved',
        reviewedAt: '2026-08-10',
        reason: 'Exact elected executive identity; education normalized to the public profile display policy.',
      },
    },
    confidenceLevel: source.confidenceLevel,
    reviewStatus: 'verified',
    visibility: 'public',
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.url,
    observedAt: '2026-08-10',
  };
});

const sources = [...new Map(personClaims.map((claim) => [claim.sourceId, {
  id: claim.sourceId,
  name: claim.sourceName,
  url: claim.sourceUrl,
}])).values()];

const countConfidence = (level) => personClaims.filter((claim) => claim.confidenceLevel === level).length;
const payload = {
  schemaVersion: 1,
  name: 'elected-executive-education-supplements-2026-08-10',
  updatedAt: '2026-08-10',
  notes: 'Reviewed education supplements for elected presidents, vice presidents, and county/city chiefs. University-level entries omit lower schools; people without university records retain only the highest confirmed education.',
  sources,
  summary: {
    personCount: personClaims.length,
    claimCount: personClaims.length,
    confidenceA: countConfidence('A'),
    confidenceB: countConfidence('B'),
    confidenceC: countConfidence('C'),
  },
  personClaims,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, summary: payload.summary }, null, 2));
