import { splitEducationContent, splitExperienceContent } from './contentItems.ts';

const comparisonCollator = new Intl.Collator('zh-Hant-TW', {
  usage: 'search',
  sensitivity: 'base',
});

const knownEnglishSchoolAliases: Record<string, string> = {
  nationaltaiwanuniversity: '臺灣大學',
  nationalchengchiuniversity: '政治大學',
  nationaltaiwannormaluniversity: '臺灣師範大學',
  nationaltsinghuauniversity: '清華大學',
  nationalchiaotunguniversity: '交通大學',
  nationalyangmingchiaotunguniversity: '陽明交通大學',
  nationalchengkunguniversity: '成功大學',
  nationalcentraluniversity: '中央大學',
  nationalchungsinguniversity: '中興大學',
  nationalsunyatsenuniversity: '中山大學',
};

function normalizeComparisonText(value: string) {
  return value
    .normalize('NFKC')
    .replace(/台/g, '臺')
    .replace(/国/g, '國')
    .replace(/学/g, '學')
    .replace(/师/g, '師')
    .replace(/专/g, '專')
    .replace(/业/g, '業')
    .replace(/华/g, '華')
    .replace(/湾/g, '灣')
    .replace(/术/g, '術')
    .replace(/医/g, '醫')
    .replace(/护/g, '護')
    .replace(/电/g, '電')
    .replace(/机/g, '機')
    .replace(/经/g, '經')
    .replace(/济/g, '濟')
    .replace(/资/g, '資')
    .replace(/讯/g, '訊')
    .replace(/传/g, '傳')
    .replace(/东/g, '東')
    .replace(/吴/g, '吳')
    .replace(/辅/g, '輔')
    .replace(/义/g, '義')
    .replace(/铭/g, '銘')
    .replace(/实/g, '實')
    .replace(/兴/g, '興')
    .replace(/协/g, '協')
    .replace(/会/g, '會')
    .replace(/议/g, '議')
    .replace(/员/g, '員')
    .replace(/县/g, '縣')
    .replace(/长/g, '長')
    .replace(/处/g, '處')
    .replace(/务/g, '務')
    .replace(/发/g, '發')
    .replace(/总/g, '總')
    .replace(/组/g, '組')
    .replace(/团/g, '團')
    .replace(/党/g, '黨')
    .replace(/举/g, '舉')
    .replace(/办/g, '辦')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .toLocaleLowerCase('zh-TW');
}

function equivalentText(left: string, right: string) {
  const normalizedLeft = normalizeComparisonText(left);
  const normalizedRight = normalizeComparisonText(right);
  return normalizedLeft === normalizedRight || comparisonCollator.compare(normalizedLeft, normalizedRight) === 0;
}

function splitEducationText(value: string | null | undefined) {
  return splitEducationContent(value);
}

function educationLevel(item: string) {
  const normalized = normalizeComparisonText(item);
  if (/博士後|postdoc|postdoctoral/u.test(normalized)) return 8;
  if (/博士|phd|doctorate/u.test(normalized)) return 7;
  if (/碩士|研究所|master|emba|mba/u.test(normalized)) return 6;
  if (/副學士|專科|專校|工專|商專|師專|醫專|護專|警專|五專|二專/u.test(normalized)) return 4;
  if (/國民中學|初中|國中(?:部|畢業|肄業|結業|在學)?$/u.test(normalized)) return 2;
  if (/國小|國民小學|小學|附小/u.test(normalized)) return 1;
  if (/幼稚園|幼兒園/u.test(normalized)) return 0;
  if (/高中|女中|高職|高級中學|職校|中學|預備學校|高級.{0,12}(?:學校|部)|農工|高工|商職|工校|家商|高商|士商|商工|工商|附中|附工|附農|一中/u.test(normalized)) return 3;
  if (/大學|學院|學士|學系|臺大|政大|師大|清大|交大|成大|college|university|bachelor/u.test(normalized)) return 5;
  return -1;
}

function genericEducationLevel(item: string) {
  return /^(?:國小|國民小學|小學|國中|國民中學|初中|高中|高級中學|高職|職校|專科|五專|二專|大學|學院|學士|研究所|碩士|博士|博士後)(?:學歷)?(?:畢業|肄業|結業|在學)?$/u.test(
    normalizeComparisonText(item),
  );
}

function latinSchoolKey(value: string) {
  const latin = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (!latin) return null;
  return knownEnglishSchoolAliases[latin] ?? (/(?:university|college|institute|school)/u.test(latin) ? latin : null);
}

function chineseSchoolKey(value: string) {
  const normalized = normalizeComparisonText(value);
  const abbreviation = normalized.match(/(?:^|[^\p{Script=Han}])(臺大|政大|師大|清大|交大|成大)(?=[^\p{Script=Han}]|$|\p{Script=Han}{0,8}(?:系|所|學士|碩士|博士))/u)?.[1];
  const abbreviationAliases: Record<string, string> = {
    臺大: '臺灣大學',
    政大: '政治大學',
    師大: '臺灣師範大學',
    清大: '清華大學',
    交大: '交通大學',
    成大: '成功大學',
  };
  if (abbreviation) return abbreviationAliases[abbreviation];

  const school = normalized.match(/((?:國立|私立|市立|縣立|省立)?[\p{Script=Han}]{1,20}?(?:大學|學院|專科學校|專校|工專|商專|師專|高中|女中|高級中學|高職|中學|農工|高工|商職|工校|家商|高商|士商|商工|工商|附中|附工|附農|一中|國中|國民中學|國小|國民小學|小學|附小|學校))/u)?.[1];
  return school?.replace(/^(?:國立|私立|市立|縣立|省立)/u, '') ?? null;
}

function bilingualSchoolAliases(items: string[]) {
  const aliases = new Map<string, string>();
  for (const item of items) {
    const chineseKey = chineseSchoolKey(item);
    if (!chineseKey) continue;
    for (const match of item.matchAll(/[（(]([^）)]*[A-Za-z][^）)]*)[）)]/gu)) {
      const englishKey = latinSchoolKey(match[1]);
      if (englishKey) aliases.set(englishKey, chineseKey);
    }
  }
  return aliases;
}

function schoolKey(value: string, bilingualAliases: Map<string, string>) {
  const chineseKey = chineseSchoolKey(value);
  if (chineseKey) return chineseKey;
  const englishKey = latinSchoolKey(value);
  return englishKey ? bilingualAliases.get(englishKey) ?? englishKey : null;
}

function educationAliases(value: string) {
  return [
    value,
    value.replace(/[（(][^）)]*[A-Za-z][^）)]*[）)]/gu, ''),
    ...Array.from(value.matchAll(/[（(]([^）)]*[A-Za-z][^）)]*)[）)]/gu), (match) => match[1]),
  ].filter(Boolean);
}

function equivalentEducation(
  left: string,
  right: string,
  bilingualAliases: Map<string, string>,
) {
  if (educationAliases(left).some((leftAlias) => educationAliases(right).some((rightAlias) => equivalentText(leftAlias, rightAlias)))) {
    return true;
  }

  const leftSchool = schoolKey(left, bilingualAliases);
  const rightSchool = schoolKey(right, bilingualAliases);
  if (!leftSchool || !rightSchool || !equivalentText(leftSchool, rightSchool)) return false;

  const leftLevel = educationLevel(left);
  const rightLevel = educationLevel(right);
  if (leftLevel !== rightLevel && leftLevel >= 0 && rightLevel >= 0) return false;

  const leftNormalized = normalizeComparisonText(left);
  const rightNormalized = normalizeComparisonText(right);
  const oneContainsTheOther = leftNormalized.includes(rightNormalized) || rightNormalized.includes(leftNormalized);
  const oneIsBareSchool = equivalentText(left, leftSchool) || equivalentText(right, rightSchool);
  const crossLanguagePair = /[A-Za-z]/u.test(left) !== /[A-Za-z]/u.test(right);
  return oneContainsTheOther || oneIsBareSchool || crossLanguagePair;
}

function preferEducationItem(left: string, right: string) {
  const leftHasChinese = /[\u3400-\u9fff]/u.test(left);
  const rightHasChinese = /[\u3400-\u9fff]/u.test(right);
  if (leftHasChinese !== rightHasChinese) return rightHasChinese ? right : left;
  return right.length > left.length ? right : left;
}

function dedupeEducationItems(items: string[]) {
  const bilingualAliases = bilingualSchoolAliases(items);
  const result: string[] = [];

  for (const item of items) {
    const existingIndex = result.findIndex((existing) => equivalentEducation(existing, item, bilingualAliases));
    if (existingIndex < 0) {
      result.push(item);
    } else {
      result[existingIndex] = preferEducationItem(result[existingIndex], item);
    }
  }

  const hasSpecificEducation = result.some((item) => !genericEducationLevel(item));
  return hasSpecificEducation ? result.filter((item) => !genericEducationLevel(item)) : result;
}

export function educationProfileItems(value: string | null | undefined) {
  const items = dedupeEducationItems(splitEducationText(value))
    .sort((left, right) => educationLevel(right) - educationLevel(left));
  const explicitSchools = items.filter((item) => Boolean(chineseSchoolKey(item) || latinSchoolKey(item)));
  if (explicitSchools.length > 0) return explicitSchools;

  const highestLevel = Math.max(...items.map(educationLevel));
  if (highestLevel >= 0) {
    return items.filter((item) => educationLevel(item) === highestLevel).slice(0, 1);
  }
  return items.slice(0, 1);
}

function normalizeRole(value: string) {
  return normalizeComparisonText(value.replace(/^(?:中華民國|共和國)/u, ''));
}

const experienceNoiseLabels = new Set([
  '上一頁', 'TOP', '展開收合', '其他', '市政服務', '市政服務一覽', '民意代表通訊指南',
  '數位申辦平台', '服務中心', '消費者服務', 'app專區', '臉書專區', '樂活地圖',
  '常見問題集', '市府公開資料', '市政紀錄', '雙語詞彙', '統計資料', '法規查詢',
  '性別主流化專區', '最新債務訊息', '主動公開資料', '資料開放平臺', '施政公開資料',
  '社福與公益', '認識新竹', '新竹沿革', '地理位置', '自然氣候', '市徽花樹鳥',
  '姊妹市', '友好城市暨合作備忘錄', '市府團隊', '市長簡介', '林副市長簡介',
  '秘書長簡介', '副秘書長簡介', '組織架構', '市府平面圖', '市府各單位聯絡電話',
  '機關局處列表', '機關網站', '公告資訊', '市政新聞', '電子公告欄', '徵才訊息公告',
  '招標公告', '澄清專區', '市政電子報', '主題宣導', '促參公告', 'RSS訂閱',
  '非洲豬瘟防疫專區', '陳情相關表件',
].map(normalizeRole));

function isExperienceNoise(value: string) {
  if (experienceNoiseLabels.has(value)) return true;
  if (/^瀏覽人次\d*$/u.test(value)) return true;
  if (/^(?:地址|服務時間|24小時服務專線)/u.test(value)) return true;
  if (/隱私權及安全政策.*政府網站資料開放宣告/u.test(value)) return true;
  return false;
}

export function experienceProfileItems(value: string | null | undefined, currentPosition: string) {
  const normalizedCurrentPosition = normalizeRole(currentPosition);
  const result: string[] = [];

  for (const item of splitExperienceContent(value)) {
    const normalizedItem = normalizeRole(item);
    if (!normalizedItem) continue;
    if (isExperienceNoise(normalizedItem)) continue;
    if (normalizedItem === '政治人物' || normalizedItem === 'politician' || normalizedItem === '政府首腦') continue;
    if (normalizedItem === normalizedCurrentPosition) continue;
    if (/^(?:19|20)\d{2}年.*選舉/u.test(normalizedItem)) continue;
    if (result.some((existing) => equivalentText(existing, item))) continue;
    result.push(item);
  }

  const specificItems = result.filter((item, index, items) => {
    const normalizedItem = normalizeRole(item);
    return normalizedItem !== '大學校長' || !items.some((other, otherIndex) => otherIndex !== index
      && normalizeRole(other).endsWith(normalizedItem));
  });

  const chineseItems = specificItems.filter((item) => /[\u3400-\u9fff]/u.test(item));
  return chineseItems.length > 0 ? chineseItems : specificItems;
}
