import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(repoRoot, 'data-sources', 'tnl-dark-guide');
const outputPath = path.join(dataDir, 'family-people-report.json');
const csvOutputPath = path.join(dataDir, 'family-people-review.csv');

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = separator >= 0 ? line.slice(0, separator).trim() : line;
        const value = separator >= 0
          ? line.slice(separator + 1).trim().replace(/^["']|["']$/g, '')
          : '';
        return [key, value];
      }),
  );
}

const localEnv = readLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL?.trim()
  || localEnv.SUPABASE_URL
  || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  || localEnv.SUPABASE_SERVICE_ROLE_KEY;

function restUrl(tableName) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`);
}

async function fetchRows(tableName, select) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const url = restUrl(tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));
    const response = await fetch(url, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to fetch ${tableName}: ${body?.message ?? response.statusText}`);
    }
    rows.push(...body);
    if (body.length < pageSize) return rows;
  }
}

function normalizeHan(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/臺/g, '台')
    .replace(/羣/g, '群')
    .replace(/黄/g, '黃')
    .match(/\p{Script=Han}+/gu)
    ?.join('') ?? '';
}

function uniqueBy(rows, keyFor) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = keyFor(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

const relationWords = [
  '遠房表姊', '遠房表妹', '表姐夫', '外曾祖父', '外祖父', '外祖母', '曾祖父', '曾祖母',
  '祖父', '祖母', '爺爺', '奶奶', '外公', '外婆', '爸爸', '父親', '媽媽', '母親',
  '岳父', '岳母', '公公', '婆婆', '丈夫', '妻子', '老婆', '配偶',
  '兄長', '哥哥', '弟弟', '姊姊', '姐姐', '妹妹', '姐夫', '小叔', '小姑', '大伯', '伯伯',
  '伯父', '叔叔', '姑姑', '舅舅', '姨丈', '阿姨', '嬸嬸', '二嫂', '堂兄', '堂弟',
  '堂哥', '堂妹', '表親', '表哥', '表姊', '表姐', '表弟', '乾媽', '親家', '養父',
  '二叔', '三叔', '四叔', '二哥', '三哥', '四哥',
  '兒子', '女兒', '長子', '姪女', '侄女', '姪子', '外甥', '孫子', '孫女',
];
const roleWords = [
  '國民大會代表', '國大代表', '鎮民代表會主席', '市民代表會主席', '鄉民代表會主席',
  '代表會主席', '農會總幹事', '黨部執行長', '黨部主委', '黨主席', '中評會主委',
  '立法委員', '監察委員', '市政顧問', '國策顧問', '副董事長', '董事長',
  '副議長', '議長', '縣議員', '市議員', '省議員', '議員', '立委', '國代',
  '縣市長', '縣長', '市長', '區長', '鄉長', '鎮長', '里長', '村長',
  '市民代表', '鄉民代表', '鎮民代表', '民意代表', '代表', '參選人',
  '副秘書長', '秘書長', '辦公室主任', '服務處主任', '主任', '主委', '主席',
  '總召集人', '總幹事', '發言人', '創辦人', '會長', '顧問', '特助', '助理', '長子',
];
const singleSurnames = '趙錢孫李周吳鄭王馮陳蔣沈韓楊朱秦尤許何呂施張孔曹嚴華金魏陶姜謝鄒柏章蘇潘葛范彭郎魯韋昌馬苗方俞任袁柳史唐費岑薛雷賀倪湯羅畢郝鄔安常樂于傅卞齊康伍余顧孟平黃穆蕭尹姚邵汪毛米戴宋龐熊紀舒屈項董梁杜阮藍閔席季麻賈路危江童顏郭梅盛林鍾徐邱駱高夏蔡田樊胡霍虞萬柯管盧莫房陸榮翁羊家芮段富巫焦巴牧山谷車侯全秋伊宮寧甘祖武符劉景詹龍葉黎白蒲台鄂賴卓屠池喬能蒼聞黨翟譚姬申冉雍桑桂牛通邊燕尚溫莊晏柴瞿閻慕連茹艾容向古易慎廖庾居衡耿滿弘匡國文寇廣闕東歐利越師聶敖冷辛簡饒曾游權關紅查洪丁厲';
const compoundSurnames = ['歐陽', '司馬', '上官', '諸葛', '夏侯', '皇甫', '尉遲', '公孫', '慕容', '司徒', '司空', '南宮'];
const surnamePattern = `(?:${compoundSurnames.join('|')}|[${singleSurnames}])`;
const hanNamePattern = `(?:\\p{Script=Han}{2,4}[．・‧·]\\p{Script=Han}{2,5}|${surnamePattern}\\p{Script=Han}{1,3}(?:[．・‧·]\\p{Script=Han}{2,4})?)`;
const nameBoundary = '(?=為|是|因|曾|現|今|本|同|之|，|、|；|。|（|\\(|$)';

function relationSegments(text) {
  const expression = new RegExp(relationWords.join('|'), 'gu');
  const matches = [...text.matchAll(expression)];
  return matches.map((match, index) => ({
    relationship: match[0],
    text: text.slice(match.index, matches[index + 1]?.index ?? text.length),
  }));
}

function extractExplicitNames(text) {
  const names = [];
  const addMatches = (expression) => {
    for (const match of text.matchAll(expression)) names.push(match[1]);
  };
  const rolePattern = roleWords.sort((left, right) => right.length - left.length).join('|');
  addMatches(new RegExp(`(?:${rolePattern})(?:的)?\\s*(${hanNamePattern})${nameBoundary}`, 'gu'));
  addMatches(new RegExp(`(?:是|為|叫|名叫)\\s*(${hanNamePattern})(?=為|是|因|曾|現|今|本|同|之|，|、|；|。|（|\\(|$)`, 'gu'));
  addMatches(new RegExp(`^(?:${relationWords.join('|')})(?:是|為)?\\s*(${hanNamePattern})(?=為|是|因|曾|現|今|本|同|之|，|、|；|。|（|\\(|$)`, 'gu'));
  addMatches(new RegExp(`(${hanNamePattern})(?:（[^）]*）|\\([^)]*\\))?$`, 'gu'));
  const cleaned = names
    .map((name) => name.trim().replace(/[的為]$/u, ''))
    .filter((name) => name && !/(曾任|立委|議員|組長|隨扈|主席|主委|市長|縣長|里長|代表)$/u.test(name));
  const normalized = uniqueBy(cleaned, (name) => normalizeHan(name));
  return normalized.filter((name) => !normalized.some((other) => (
    other !== name
    && normalizeHan(name).length > normalizeHan(other).length
    && normalizeHan(name).endsWith(normalizeHan(other))
  )));
}

function databaseNamesAtSegmentEnd(text, aliasGroups) {
  const normalizedText = normalizeHan(text);
  return [...aliasGroups.keys()].filter((alias) => normalizedText.endsWith(alias));
}

function claimRows(datasets) {
  return datasets.flatMap((dataset) => dataset.candidates.flatMap((candidate) => (
    (candidate.sections?.['政治家族'] ?? []).map((entry, index) => ({
      id: `${candidate.id}-family-${index + 1}`,
      year: candidate.year,
      candidateId: candidate.id,
      candidateName: candidate.name,
      city: candidate.city,
      cityCode: candidate.cityCode,
      area: candidate.area,
      text: entry.text,
      sourceUrl: entry.url,
      pageUrl: candidate.pageUrl,
    }))
  )));
}

async function main() {
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

  const guide2018 = JSON.parse(fs.readFileSync(path.join(dataDir, 'tnl-dark-guide-2018.json'), 'utf8'));
  const guide2022 = JSON.parse(fs.readFileSync(path.join(dataDir, 'tnl-dark-guide-2022.json'), 'utf8'));
  const claims = claimRows([guide2018, guide2022]);
  const [people, canonicalMap] = await Promise.all([
    fetchRows('people', 'id,name,external_id,is_public'),
    fetchRows('person_canonical_map', 'person_id,canonical_person_id'),
  ]);

  const canonicalByPersonId = new Map(canonicalMap.map((row) => [row.person_id, row.canonical_person_id]));
  const peopleById = new Map(people.map((row) => [row.id, row]));
  const aliasGroups = new Map();
  for (const person of people) {
    const alias = normalizeHan(person.name);
    if (alias.length < 2 || alias.length > 5) continue;
    const canonicalPersonId = canonicalByPersonId.get(person.id) ?? person.id;
    const rows = aliasGroups.get(alias) ?? [];
    rows.push({
      personId: person.id,
      canonicalPersonId,
      name: person.name,
      canonicalName: peopleById.get(canonicalPersonId)?.name ?? person.name,
      externalId: person.external_id,
      isPublic: person.is_public,
    });
    aliasGroups.set(alias, rows);
  }

  const occurrences = [];
  const claimsWithoutExplicitName = [];
  for (const claim of claims) {
    const targets = relationSegments(claim.text).flatMap((segment) => (
      uniqueBy([
        ...extractExplicitNames(segment.text),
        ...databaseNamesAtSegmentEnd(segment.text, aliasGroups),
      ], normalizeHan).map((name) => ({ ...segment, name }))
    ));
    if (targets.length === 0) {
      claimsWithoutExplicitName.push(claim);
    }
    for (const target of targets) {
      const mentionedName = normalizeHan(target.name);
      if (!mentionedName || mentionedName === normalizeHan(claim.candidateName)) continue;
      const peopleMatches = uniqueBy(aliasGroups.get(mentionedName) ?? [], (row) => row.canonicalPersonId);
      occurrences.push({
        mentionedName,
        relationship: target.relationship,
        claim,
        matches: peopleMatches,
      });
    }
  }

  const byMentionedName = new Map();
  for (const occurrence of occurrences) {
    const rows = byMentionedName.get(occurrence.mentionedName) ?? [];
    rows.push(occurrence);
    byMentionedName.set(occurrence.mentionedName, rows);
  }

  const namedPeople = [...byMentionedName.entries()].map(([mentionedName, rows]) => {
    const matches = uniqueBy(rows.flatMap((row) => row.matches), (row) => row.canonicalPersonId);
    return {
      mentionedName,
      status: matches.length === 0
        ? 'not_found'
        : matches.length === 1
          ? 'found'
          : 'ambiguous_same_name',
      matches,
      occurrences: rows.map((row) => ({ relationship: row.relationship, ...row.claim })),
    };
  }).sort((left, right) => left.mentionedName.localeCompare(right.mentionedName, 'zh-Hant'));

  const report = {
    generatedAt: new Date().toISOString(),
    databaseUrl: supabaseUrl,
    method: {
      description: 'Extract names explicitly associated with a family relationship, then match them against all local people aliases and collapse matches by canonical person id.',
      limitations: [
        'Claims with no explicit relation target remain in a manual-review list because free-text name extraction is intentionally conservative.',
        'A name shared by multiple canonical people is never resolved automatically.',
        'No relationship rows are written by this report.',
      ],
    },
    summary: {
      familyClaimEntries: claims.length,
      claimsWithExplicitName: new Set(occurrences.map((row) => row.claim.id)).size,
      claimsWithoutExplicitName: claimsWithoutExplicitName.length,
      uniqueNamesFound: namedPeople.filter((row) => row.status === 'found').length,
      uniqueNamesAmbiguous: namedPeople.filter((row) => row.status === 'ambiguous_same_name').length,
      uniqueNamesNotFound: namedPeople.filter((row) => row.status === 'not_found').length,
      uniqueCanonicalPeopleFound: new Set(namedPeople.flatMap((row) => row.matches.map((match) => match.canonicalPersonId))).size,
    },
    found: namedPeople.filter((row) => row.status === 'found'),
    ambiguousSameName: namedPeople.filter((row) => row.status === 'ambiguous_same_name'),
    notFound: namedPeople.filter((row) => row.status === 'not_found'),
    claimsWithoutExplicitName,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const csvRows = [
    ['status', 'mentioned_name', 'match_count', 'matched_people', 'years', 'candidate_names', 'relationships', 'claim_texts'],
    ...namedPeople.map((row) => [
      row.status,
      row.mentionedName,
      row.matches.length,
      row.matches.map((match) => `${match.canonicalName} [${match.canonicalPersonId}]`).join(' | '),
      [...new Set(row.occurrences.map((item) => item.year))].sort().join(' | '),
      [...new Set(row.occurrences.map((item) => item.candidateName))].join(' | '),
      [...new Set(row.occurrences.map((item) => item.relationship))].join(' | '),
      [...new Set(row.occurrences.map((item) => item.text))].join(' | '),
    ]),
  ];
  fs.writeFileSync(csvOutputPath, `${csvRows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`, 'utf8');
  console.log(JSON.stringify(report.summary, null, 2));
}

await main();
