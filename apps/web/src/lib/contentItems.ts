const numberedMarkerSource = String.raw`(?:\d{1,3}[.、．）)]|\(\d{1,3}\)|（\d{1,3}）|[一二三四五六七八九十百]+[.、．）)]|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])`;
const educationSchoolNameFragmentSource = String.raw`(?:(?!大學|大学|學院|学院|系|所|部|班|碩士|博士|學士|畢業|附設)[^\s,，、;；。()（）])`;
const conservativeEducationStartSource = String.raw`(?:(?:國立|私立|市立|縣立|省立|美國|英國|日本|澳洲|德國|法國|加拿大|中國|臺灣|台灣)?${educationSchoolNameFragmentSource}{2,32}(?:大學|大学|科大|專校|工專|商專|師專|高中|高職|高职|高級中學|國民中學|國中|国中|國民小學|國小|国小|小學|女中|中學|農工|高工|商職|工校|家商|高商|士商|商工|工商|附小|附中|附工|附農|一中)|[\p{Script=Han}]{1,4}(?:家商|高商|士商|商工|工商|女中|附小|附中|附工|附農|一中)|${educationSchoolNameFragmentSource}{2,24}(?:科技|技術|師範|藝術|醫護|商業)學院|${educationSchoolNameFragmentSource}{2,24}(?:國際|警察|預備)學校|[A-Za-z][^\s,，、;；。]{1,39}(?:University|College|School))`;

const roleEndingPattern = /(?:議員|委員|代表|主席|副主席|理事長|副理事長|常務理事|理事|監事|顧問|會長|副會長|秘書長|秘書|執行長|總幹事|幹事長|書記長|主任|副主任|主委|副主委|處長|局長|署長|課長|院長|校長|教授|講師|教師|研究員|研究助理|專員|助理|發言人|經理|總經理|董事長|董事|負責人|創辦人|記者|律師|醫師|藥師|護理師|社工師|警員|里長|鄉長|鎮長|市長|立法委員|候選人|黨代表|隊長|教練|領隊|顧問團團長)$/u;
const organizationStartPattern = /(?:議會|政府|公所|代表會|立法院|國會|辦公室|服務處|黨部|政黨|協會|公會|工會|基金會|委員會|促進會|同鄉會|宗親會|獅子會|青商會|同濟會|公司|企業社|醫院|診所|學校|大學|媒體|報社)/u;
const roleEndingSource = roleEndingPattern.source.replace(/\$$/u, '');

function stripControlCharacters(value: string) {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    const allowedWhitespace = code === 9 || code === 10 || code === 13;
    return (code < 32 && !allowedWhitespace) || code === 127 ? '' : character;
  }).join('');
}

function normalizeSourceText(value: string | null | undefined) {
  return stripControlCharacters(String(value ?? '')
    .normalize('NFC')
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/\r\n?/gu, '\n'))
    .trim();
}

function stripListPrefix(value: string) {
  return value
    .replace(/^[\s\-–—•●○▪◆◇★※◎‧“”‘’"'＋+.]+/u, '')
    .replace(new RegExp(`^(?:${numberedMarkerSource})\\s*`, 'u'), '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function uniqueItems(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu, '').toLocaleLowerCase('zh-TW');
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function splitMarkedItems(value: string) {
  const marked = value.replace(
    new RegExp(`(^|[\\n。；;])\\s*(?:${numberedMarkerSource})\\s*`, 'gmu'),
    '$1\u001e',
  ).replace(/(^|\n)\s*[•●○▪◆◇★※]+\s*/gmu, '$1\u001e');
  const markerCount = marked.split('\u001e').length - 1;
  if (markerCount < 2) return null;
  return uniqueItems(marked.split('\u001e').map(stripListPrefix).filter(Boolean));
}

export type PlatformSplitResult = {
  items: string[];
  splitMethod: 'numbered' | 'section' | 'paragraph' | 'line' | 'single';
  splitConfidence: number;
  reviewStatus: 'auto_approved' | 'needs_review';
};

function splitSectionedPlatform(paragraphs: string[]) {
  if (paragraphs.length < 5 || (paragraphs.length - 1) % 2 !== 0) return null;
  const intro = paragraphs[0];
  const sections = paragraphs.slice(1);
  const headings = sections.filter((_, index) => index % 2 === 0);
  const bodies = sections.filter((_, index) => index % 2 === 1);
  const pastAchievementIntro = /(?:任期|屆).*(?:獲評|提案|三讀|會勘|補助|完成|改善)/u.test(intro);
  const clearHeadings = headings.every((heading) => /^[\p{Script=Han}]{2,8}$/u.test(heading));
  const substantiveBodies = bodies.every((body) => body.length >= 20);
  if (!pastAchievementIntro || !clearHeadings || !substantiveBodies) return null;
  return headings.map((heading, index) => `${heading}：${bodies[index]}`);
}

function platformHeading(value: string) {
  const heading = stripListPrefix(value).replace(/[：:—–\-\s]+$/gu, '').trim();
  if (!heading || heading.length > 20) return null;
  if (/^(?:爭取|推動|監督|落實|改善|增設|加速|建立|支持|保障|關懷|重視|堅持|督促|促進|提升)/u.test(heading)) return null;
  if (/^【[^】]{2,18}】$/u.test(heading)) return heading.slice(1, -1);
  if (/^[^，,。！？!?；;：:]{1,12}篇$/u.test(heading)) return heading;
  if (/^(?:\d{4}\s*)?[^，,。！？!?；;：:]{0,12}(?:政見|政策|建設|福利|照護|交通|教育|觀光|農業|文化|環境|家園|青年|民生|經濟|食安|醫療|主權|社福|空間|長者|托育|發展|問政|監督|服務|願景|照顧|就業|生活|創生|遊憩|安全|青創|動保|優先)$/u.test(heading)) return heading;
  return null;
}

function purePastAchievement(value: string) {
  const withoutPastPhrases = value.replace(/成功爭取/gu, '');
  const hasPast = /(?:成功爭取|獲評|評鑑|獲獎|貢獻獎|已促成|已完成|三讀通過|任內完成|連續\d+會期|\d{3}年政見共推)/u.test(value);
  const hasCommitment = /(?:未來|將|持續|續促|督促|落實|改善|增加|建立|打造|保障|應予|任內將)/u.test(withoutPastPhrases);
  return hasPast && !hasCommitment;
}

function cleanPlatformItems(items: string[]) {
  const result: string[] = [];
function splitTrailingPlatformHeading(value: string) {
  const match = value.match(/^(.*?)(?:\s+)([^，,。！？!?；;：:]{2,16})$/u);
  if (!match) return [value];
  const heading = platformHeading(match[2]);
  if (!heading || !/[。！？!?；;]$/u.test(match[1])) return [value];
  return [match[1].trim(), heading];
}

  let heading: string | null = null;
  let skipSection = false;

  for (const rawItem of items.flatMap(splitTrailingPlatformHeading)) {
    const item = rawItem.trim();
    const nextHeading = platformHeading(item);
    if (nextHeading) {
      if (/^(?:政績|公益|服務實績|過往政績)$/u.test(nextHeading)) {
        skipSection = true;
        heading = null;
      } else if (/^(?:政見|\d{4}\s*[^，,。]{0,8}政見)$/u.test(nextHeading)) {
        skipSection = false;
        heading = null;
      } else {
        skipSection = false;
        heading = nextHeading;
      }
      continue;
    }
    if (skipSection || purePastAchievement(item)) continue;
    result.push(heading ? `${heading}：${item}` : item);
  }

  const cleaned = uniqueItems(result);
  return cleaned.length > 0 ? cleaned : uniqueItems(items);
}

export function splitPlatformContent(value: string | null | undefined): PlatformSplitResult {
  const source = normalizeSourceText(value);
  if (!source) return { items: [], splitMethod: 'single', splitConfidence: 100, reviewStatus: 'auto_approved' };

  const markedItems = splitMarkedItems(source);
  if (markedItems && markedItems.length > 1) {
    return { items: cleanPlatformItems(markedItems), splitMethod: 'numbered', splitConfidence: 98, reviewStatus: 'auto_approved' };
  }

  const paragraphs = uniqueItems(source
    .split(/\n\s*\n+/gu)
    .map(stripListPrefix)
    .filter(Boolean));
  const sectionItems = splitSectionedPlatform(paragraphs);
  if (sectionItems) {
    return { items: cleanPlatformItems(sectionItems), splitMethod: 'section', splitConfidence: 96, reviewStatus: 'auto_approved' };
  }
  if (paragraphs.length > 1) {
    return { items: cleanPlatformItems(paragraphs), splitMethod: 'paragraph', splitConfidence: 90, reviewStatus: 'auto_approved' };
  }

  const lines = uniqueItems(source.split(/\n+/gu).map(stripListPrefix).filter(Boolean));
  const completeLines = lines.filter((line) => /[。！？!?；;：:]$/u.test(line)).length;
  if (lines.length > 1) {
    const highConfidence = completeLines / lines.length >= 0.75;
    return {
      items: cleanPlatformItems(lines),
      splitMethod: 'line',
      splitConfidence: highConfidence ? 85 : 70,
      reviewStatus: highConfidence ? 'auto_approved' : 'needs_review',
    };
  }

  return {
    items: cleanPlatformItems([stripListPrefix(source.replace(/\n+/gu, ' '))]),
    splitMethod: 'single',
    splitConfidence: 55,
    reviewStatus: 'needs_review',
  };
}

function looksLikeEducationStart(value: string) {
  const candidate = stripListPrefix(value);
  return /^(?:(?:國立|私立|市立|縣立|省立|美國|英國|日本|澳洲|德國|法國|加拿大)?[^,，、;；\n]{1,32}(?:大學|大学|學院|学院|研究所|專科|专科|專校|工專|商專|師專|高中|高職|高职|高級中學|國民中學|國中|国中|國民小學|國小|国小|小學|女中|中學|農工|高工|商職|工校|家商|高商|士商|商工|工商|附小|附中|附工|附農|一中|學校)|[\p{Script=Han}]{1,6}大(?=[\p{Script=Han}]{1,20}(?:系|所|組|學程))|(?:國小|國中|高中|高職|大學|碩士|博士)[：:]?[\p{Script=Han}]{2,30}|[^,，、;；\n]{1,40}(?:University|College|Institute|School))/iu.test(candidate);
}

function looksLikeEducationEnd(value: string) {
  return /(?:博士|碩士|學士|副學士|學位|畢業|肄業|結業|畢|系|科|所|組|班|部|大學|學院|研究所|專科|二專|五專|二技|專校|工專|商專|師專|高中|高職|高級中學|國民中學|國中|國民小學|國小|小學|女中|中學|農工|高工|商職|工校|家商|高商|士商|商工|工商|附小|附中|附工|附農|一中|學校|[）)])(?:[、，,.。])?$/u.test(stripListPrefix(value));
}

function repairEducationLineBreaks(value: string) {
  const lines = value
    .replace(/([\p{Script=Han}]{2,30}大)\n(?=學)/gu, '$1')
    .replace(/([\p{Script=Han}]{2,30}學)\n(?=院)/gu, '$1')
    .split(/\n+/gu)
    .map((line) => line.trim())
    .filter(Boolean);
  const items: string[] = [];
  for (const line of lines) {
    const previous = items[items.length - 1] ?? '';
    const hasUnclosedParenthesis = (previous.match(/[（(]/gu)?.length ?? 0) > (previous.match(/[）)]/gu)?.length ?? 0);
    if (items.length === 0 || (!hasUnclosedParenthesis && looksLikeEducationEnd(previous) && looksLikeEducationStart(line))) items.push(line);
    else items[items.length - 1] += line;
  }
  return items.join('；')
    .replace(/([博碩學肄畢結修])\s*[；\n]\s*([士業了])/gu, '$1$2');
}

function maskParentheticalWhitespace(value: string) {
  let depth = 0;
  return Array.from(value, (character) => {
    if (/[（(]/u.test(character)) depth += 1;
    const result = depth > 0 && /\s/u.test(character) ? '\u001f' : character;
    if (/[）)]/u.test(character)) depth = Math.max(0, depth - 1);
    return result;
  }).join('');
}

function splitConcatenatedEducationItems(value: string) {
  const predecessorSource = String.raw`(?:博士|碩士|學士|副學士|學位|畢業|肄業|結業|畢|系|科|所|組|部|班|學院|專科|二專|五專|二技|專校|工專|商專|師專|高中|高職|高級中學|國民中學|國中|國民小學|國小|女中|中學|農工|高工|商職|工校|家商|高商|士商|商工|工商|附小|附中|附工|附農|一中|[）)])`;
  return maskParentheticalWhitespace(value)
    .replace(new RegExp(`(^|[。；;])\\s*(?:${numberedMarkerSource})\\s*`, 'gmu'), '$1；')
    .replace(new RegExp(`(${predecessorSource})\\s*(?:${numberedMarkerSource})\\s*`, 'gu'), '$1；')
    .replace(new RegExp(`。+\\s*(?=${conservativeEducationStartSource})`, 'giu'), '；')
    .replace(new RegExp(`(${predecessorSource})\\s*(?=${conservativeEducationStartSource})`, 'giu'), '$1；')
    .replace(new RegExp(`\\s+(?=${conservativeEducationStartSource})`, 'giu'), '；')
    .split('\u001f').join(' ');
}

export function splitEducationContent(value: string | null | undefined) {
  const source = normalizeSourceText(value);
  if (!source) return [];
  const repaired = splitConcatenatedEducationItems(repairEducationLineBreaks(source)
    .replace(/[•●○▪◆◇★※◎]+/gu, '；'))
    .replace(new RegExp(`(?:[,，、/／]|．+)\\s*(?=${conservativeEducationStartSource})`, 'giu'), '；');

  return uniqueItems(repaired
    .split(/[;；\n]+/gu)
    .map(stripListPrefix)
    .filter(Boolean));
}

function splitExperienceCommaGroups(value: string) {
  const tokens = value.split(/[，,、]+/gu).map((token) => token.trim()).filter(Boolean);
  if (tokens.length < 2) return [value];

  const items: string[] = [];
  let current = '';
  for (const token of tokens) {
    const currentComplete = roleEndingPattern.test(current);
    const startsNewRole = organizationStartPattern.test(token) || roleEndingPattern.test(token);
    if (current && currentComplete && startsNewRole && !/^[第民國\d一二三四五六七八九十百]+(?:屆|年|至|~|～|-)/u.test(token)) {
      items.push(current);
      current = token;
    } else {
      current = current ? `${current}、${token}` : token;
    }
  }
  if (current) items.push(current);
  return items;
}

export function splitExperienceContent(value: string | null | undefined) {
  const source = normalizeSourceText(value);
  if (!source) return [];
  const normalized = source
    .replace(/[•●○▪◆◇★※]+/gu, '；')
    .replace(new RegExp(`(${roleEndingSource})\\s*(?:${numberedMarkerSource})\\s*`, 'gu'), '$1；')
    .replace(new RegExp(`(${roleEndingSource})\\s+(?=[^\\s;；，,、。]{2,40}${roleEndingSource}(?:\\s|[;；]|$))`, 'gu'), '$1；')
    .replace(/。+\s*/gu, '；')
    .replace(/[\n]+/gu, '；');

  return uniqueItems(normalized
    .split(/[;；]+/gu)
    .flatMap(splitExperienceCommaGroups)
    .map(stripListPrefix)
    .filter(Boolean));
}
