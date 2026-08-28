import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { splitPlatformContent } from '../apps/web/src/lib/contentItems.ts';
import { educationProfileItems, experienceProfileItems } from '../apps/web/src/lib/profileResume.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.join(repoRoot, 'tmp', 'election-content-items-report.json');
const reviewedPlatformItemsPath = path.join(repoRoot, 'scripts', 'data', 'platform-fulfillment-reviewed-items.json');
const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
const version = 'election-content-items-v1';

function readEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/gu, '')];
      }),
  );
}

function chunks(values, size = 40) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function headers(key, extra = {}) {
  return {
    apikey: key,
    authorization: 'Bearer ' + key,
    accept: 'application/json',
    'content-type': 'application/json',
    'accept-profile': 'public',
    'content-profile': 'public',
    ...extra,
  };
}

async function responseJson(response, label) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(label + ': ' + (body?.message ?? response.statusText));
  return body;
}

async function fetchAll(config, table, select, filters = {}) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = new URL(config.url + '/rest/v1/' + table);
    url.searchParams.set('select', select);
    url.searchParams.set('limit', '1000');
    url.searchParams.set('offset', String(offset));
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    const page = await responseJson(await fetch(url, {
      headers: headers(config.key),
      signal: AbortSignal.timeout(30000),
    }), 'Fetch ' + table);
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function fetchByValues(config, table, select, column, values, filters = {}) {
  const rows = [];
  for (const batch of chunks(Array.from(new Set(values)).filter(Boolean))) {
    rows.push(...await fetchAll(config, table, select, {
      ...filters,
      [column]: 'in.(' + batch.join(',') + ')',
    }));
  }
  return rows;
}

function isPublicVerified(claim) {
  return claim.review_status === 'verified'
    && (claim.is_public === true || claim.visibility === 'public');
}

function isElected(candidate) {
  return candidate.is_elected === true || candidate.election_result === 'elected';
}

function canonicalId(personId, canonicalById) {
  return canonicalById.get(personId) ?? personId;
}

function sameJson(left, right) {
  return isDeepStrictEqual(left, right);
}

function auditSplitItems(claimType, items, metadata) {
  const flags = [];
  const normalized = items.map((item) => item.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu, '').toLocaleLowerCase('zh-TW'));
  if (new Set(normalized).size !== normalized.length) flags.push('duplicate_items');
  if (items.some((item) => /(?:https?:\/\/|瀏覽人次|隱私權|政府網站資料開放宣告|回首頁|網站導覽)/iu.test(item))) {
    flags.push('navigation_or_web_noise');
  }

  if (claimType === 'platform') {
    if (metadata.reviewStatus === 'needs_review') flags.push('platform_needs_review');
    if (items.some((item) => /^[\p{Script=Han}]{2,8}$/u.test(item))) flags.push('standalone_heading');
    if (items.some((item) => /(?:任期|兩屆|獲評|三讀|會勘).*(?:完成|改善|補助|建設|提案)/u.test(item))) {
      flags.push('possible_past_achievement');
    }
  }

  if (claimType === 'education') {
    const schoolPattern = /(?:大學|大学|學院|学院|專校|工專|商專|師專|高中|高職|高职|高級中學|國中|国中|國小|国小|女中|中學|農工|高工|商職|工校|附小|一中|University|College|School)/giu;
    if (items.some((item) => Array.from(item.matchAll(schoolPattern)).length > 1)) flags.push('possible_joined_schools');
    if (items.some((item) => item.length > 80)) flags.push('overlong_education_item');
  }

  if (claimType === 'experience' && items.some((item) => item.length > 120)) flags.push('overlong_experience_item');
  return flags;
}

async function patchClaim(config, claimId, claimJson) {
  const url = new URL(config.url + '/rest/v1/person_claims');
  url.searchParams.set('id', 'eq.' + claimId);
  await responseJson(await fetch(url, {
    method: 'PATCH',
    headers: headers(config.key, { prefer: 'return=minimal' }),
    body: JSON.stringify({ claim_json: claimJson }),
    signal: AbortSignal.timeout(30000),
  }), 'Patch person claim ' + claimId);
}

export function scopedRace(race, electionById) {
  const year = Number(electionById.get(race.election_id)?.year);
  return (year === 2022 && race.race_type === 'councilor_district')
    || (year === 2024 && ['legislative_district', 'indigenous'].includes(race.race_type));
}

export function splitClaimItems(claim, position = '') {
  const source = claim.claim_type === 'platform'
    ? claim.claim_json?.platformText ?? claim.claim_value
    : claim.claim_value ?? (Array.isArray(claim.claim_json?.items) ? claim.claim_json.items.join('\n') : '');

  const reviewedSnapshot = reviewedPlatformSnapshots.get(claim.id);
  if (claim.claim_type === 'platform' && reviewedSnapshot) {
    if (source !== reviewedSnapshot.original) {
      throw new Error('Reviewed platform source changed for claim ' + claim.id);
    }
    return {
      items: reviewedSnapshot.items,
      metadata: {
        version,
        method: 'manually_reviewed_platform_snapshot',
        confidence: 100,
        reviewStatus: 'reviewed',
      },
    };
  }
  if (claim.claim_type === 'platform' && reviewedPlatformItems.has(claim.id)) {
    return {
      items: reviewedPlatformItems.get(claim.id),
      metadata: {
        version,
        method: 'manually_reviewed_platform_items',
        confidence: 100,
        reviewStatus: 'auto_approved',
      },
    };
  }
  if (claim.claim_type === 'platform') {
    const result = splitPlatformContent(source);
    const droppedItems = reviewedPlatformDropItems.get(claim.id);
    const items = droppedItems ? result.items.filter((item) => !droppedItems.has(item)) : result.items;
    return {
      items,
      metadata: {
        version,
        method: result.splitMethod,
        confidence: result.splitConfidence,
        reviewStatus: result.reviewStatus,
      },
    };
  }
  if (claim.claim_type === 'education') {
    return {
      items: educationProfileItems(source),
      metadata: { version, method: 'education_profile_rules', reviewStatus: 'auto_approved' },
    };
  }
  const reviewedItems = reviewedExperienceItems.get(claim.id);
  if (reviewedItems) {
    return {
      items: reviewedItems,
      metadata: { version, method: 'manually_reviewed_experience_items', reviewStatus: 'auto_approved' },
    };
  }

  return {
    items: experienceProfileItems(source, position),
    metadata: { version, method: 'experience_profile_rules', reviewStatus: 'auto_approved' },
  };
}

function parseArgs(argv) {
  const options = { write: false, claimIds: new Set() };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--write') options.write = true;
    else if (argument === '--claim-id') {
      const claimId = argv[++index];
      if (!claimId) throw new Error('--claim-id requires a value');
      options.claimIds.add(claimId);
    } else throw new Error('Unsupported argument: ' + argument);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = readEnv();
  const config = {
    url: String(process.env.SUPABASE_URL ?? env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '').replace(/\/$/u, ''),
    key: String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? ''),
  };
  if (!config.url || !config.key) throw new Error('Local Supabase URL and service-role key are required');
  const hostname = new URL(config.url).hostname;
  if (!localHosts.has(hostname)) throw new Error('Refused non-local Supabase host: ' + hostname);

  const elections = await fetchAll(config, 'elections', 'id,year', { year: 'in.(2022,2024)' });
  const electionById = new Map(elections.map((election) => [election.id, election]));
  const races = (await fetchByValues(config, 'races', 'id,election_id,race_type', 'election_id', elections.map((row) => row.id)))
    .filter((race) => scopedRace(race, electionById));
  const candidates = await fetchByValues(
    config,
    'candidates',
    'id,person_id,race_id,is_elected,election_result',
    'race_id',
    races.map((race) => race.id),
  );
  const electedCandidates = candidates.filter(isElected);
  if (candidates.length !== 2005 || electedCandidates.length !== 989) {
    throw new Error('Scope integrity check failed: expected 2005 candidates and 989 elected candidates, found '
      + candidates.length + ' and ' + electedCandidates.length);
  }

  const directPersonIds = candidates.map((candidate) => candidate.person_id);
  const directCanonicalRows = await fetchByValues(
    config,
    'person_canonical_map',
    'person_id,canonical_person_id',
    'person_id',
    directPersonIds,
  );
  const canonicalById = new Map(directCanonicalRows.map((row) => [row.person_id, row.canonical_person_id]));
  const canonicalPersonIds = Array.from(new Set(directPersonIds.map((id) => canonicalId(id, canonicalById))));
  const mergedRows = await fetchByValues(
    config,
    'person_canonical_map',
    'person_id,canonical_person_id',
    'canonical_person_id',
    canonicalPersonIds,
  );
  for (const row of mergedRows) canonicalById.set(row.person_id, row.canonical_person_id);

  const claimPersonIds = Array.from(new Set([...directPersonIds, ...canonicalPersonIds, ...mergedRows.map((row) => row.person_id)]));
  const [people, profileClaims, platformClaims] = await Promise.all([
    fetchByValues(config, 'people', 'id,name,position,education,experience', 'id', canonicalPersonIds),
    fetchByValues(
      config,
      'person_claims',
      'id,person_id,candidate_id,claim_type,claim_value,claim_json,review_status,visibility,is_public',
      'person_id',
      claimPersonIds,
      { claim_type: 'in.(education,experience)' },
    ),
    fetchByValues(
      config,
      'person_claims',
      'id,person_id,candidate_id,claim_type,claim_value,claim_json,review_status,visibility,is_public',
      'candidate_id',
      candidates.map((candidate) => candidate.id),
      { claim_type: 'eq.platform' },
    ),
  ]);

  const peopleById = new Map(people.map((person) => [person.id, person]));
  const electedCandidateIds = new Set(electedCandidates.map((candidate) => candidate.id));
  const scopedClaims = [
    ...profileClaims.filter(isPublicVerified),
    ...platformClaims.filter((claim) => isPublicVerified(claim) && electedCandidateIds.has(claim.candidate_id)),
  ];
  const allUniqueClaims = Array.from(new Map(scopedClaims.map((claim) => [claim.id, claim])).values());
  const uniqueClaims = options.claimIds.size > 0
    ? allUniqueClaims.filter((claim) => options.claimIds.has(claim.id))
    : allUniqueClaims;
  if (options.claimIds.size > 0 && uniqueClaims.length !== options.claimIds.size) {
    throw new Error('One or more requested claim IDs are outside the guarded scope');
  }
  const changes = [];
  const auditRecords = [];
  const platformReviewRecords = [];
  const counts = {
    candidates2022CouncilorAnd2024Legislator: candidates.length,
    electedCandidatesForPlatforms: electedCandidateIds.size,
    profilePeople: canonicalPersonIds.length,
    claimsConsidered: uniqueClaims.length,
    claimsChanged: 0,
    claimsUnchanged: 0,
    emptyItems: 0,
    platformNeedsReview: 0,
    byType: {},
    emptyByType: {},
    platformMethods: {},
  };

  for (const claim of uniqueClaims) {
    const person = peopleById.get(canonicalId(claim.person_id, canonicalById));
    const split = splitClaimItems(claim, person?.position ?? '');
    const nextJson = { ...(claim.claim_json ?? {}), items: split.items, contentSplit: split.metadata };
    const original = claim.claim_type === 'platform'
      ? claim.claim_json?.platformText ?? claim.claim_value
      : claim.claim_value;
    const auditFlags = auditSplitItems(claim.claim_type, split.items, split.metadata);
    const reportRecord = {
      claimId: claim.id,
      personId: person?.id ?? canonicalId(claim.person_id, canonicalById),
      personName: person?.name ?? '',
      candidateId: claim.candidate_id,
      claimType: claim.claim_type,
      original,
      currentItems: Array.isArray(claim.claim_json?.items) ? claim.claim_json.items : [],
      items: split.items,
      contentSplit: split.metadata,
      auditFlags,
    };
    if (auditFlags.length > 0) auditRecords.push(reportRecord);
    if (claim.claim_type === 'platform' && split.metadata.reviewStatus === 'needs_review') {
      platformReviewRecords.push(reportRecord);
    }
    counts.byType[claim.claim_type] = (counts.byType[claim.claim_type] ?? 0) + 1;
    if (split.items.length === 0) {
      counts.emptyItems += 1;
      counts.emptyByType[claim.claim_type] = (counts.emptyByType[claim.claim_type] ?? 0) + 1;
    }
    if (claim.claim_type === 'platform') {
      counts.platformMethods[split.metadata.method] = (counts.platformMethods[split.metadata.method] ?? 0) + 1;
    }
    if (claim.claim_type === 'platform' && split.metadata.reviewStatus === 'needs_review') {
      counts.platformNeedsReview += 1;
    }
    if (sameJson(nextJson, claim.claim_json ?? {})) {
      counts.claimsUnchanged += 1;
      continue;
    }
    changes.push({ claim, nextJson, split, reportRecord });
  }
  counts.claimsChanged = changes.length;

  if (options.write) {
    for (const batch of chunks(changes, 25)) {
      await Promise.all(batch.map((change) => patchClaim(config, change.claim.id, change.nextJson)));
    }
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    mode: options.write ? 'write-local' : 'dry-run',
    scope: {
      profiles: ['2022 councilor candidates', '2024 district and indigenous legislator candidates'],
      platforms: 'elected candidates in those races only',
      excludes: ['2024 party-list legislators', 'fulfilment rate', 'voting'],
    },
    counts,
    changes: changes.map((change) => change.reportRecord),
    auditRecords,
    platformReviewRecords,
  }, null, 2) + '\n');

  console.log(JSON.stringify({ mode: options.write ? 'write-local' : 'dry-run', reportPath, counts }, null, 2));
}

const reviewedExperienceItems = new Map([
  ['f42a38a0-7a07-4501-b83d-e2054788bd4b', ['桃園市第1、2屆市議員', '健行科技大學講師', '南亞技術學院講師', '桃園市體育會輕艇委員會理事長', '中華象棋促進協會理事長', '桃園太極氣功十八式協會理事長', '桃園市議會民進黨黨團幹事長', '民進黨桃園市黨部執、評委', '中壢壢民獅子會創會長', '英國南安普敦大學台灣學生會副會長', '桃園縣儀隊發展協會常務理事']],
  ['f3f17ff0-224b-4c7b-aeae-9884a1d79068', ['第1、2屆桃園市議員', '民進黨中央黨部發言人', '兩岸政經研究學會秘書長', '鄭文燦競選桃園縣長辦公室主任', '行政院長蘇貞昌政務委員室機要秘書', '桃園市啦啦隊協會理事長', '桃園市體育會籃球委員會主委', '桃園市體育會棒球委員會主委', '台灣客家聯盟桃園縣會總幹事', '壢青獅子會會長', '中壢國際青年商會理事']],
  ['18d21a9a-a0f5-4520-b1de-67ae03154f72', ['桃園市議會第1、2屆議員', '桃園縣議會第17屆議員', '中壢市第10、11屆市民代表', '桃園市劉姓宗親會／青年會顧問', '曾氏宗親會中壢分會名譽會長', '桃園市太極拳武術協會理事長', '桃園市龍岡森林氣功協會名譽理事長', '桃園市民防中隊首席顧問', '桃園市脊髓損傷者協會顧問', '海雁國際同濟會社福主委', '財團法人中壢三教紫雲宮顧問', '中壢青昇宮管委會顧問']],
  ['e4082121-7875-4722-912f-7b2570e45b3a', ['第1、2屆桃園市議員', '第16、17屆桃園縣議員', '第10屆中壢市民代表', '桃園市勞資關係發展協進會副理事長', '桃園市黃墘溪水環境保護協進會理事長', '桃園市中壢青溪婦女協會理事長', '桃園市中壢區婦女會理事長', '台灣葉姓宗親會理事長', '桃園市文化警友協進會理事長', '桃園市長春藤健康促進協會理事長']],
  ['5241579d-99a0-4231-a5bd-92aee7cd52a4', ['新北市第3屆議員', '台大研究生協會會長', '民進黨發言人', '民進黨青年代表', '立法院議會資深政策助理', '民視、三立、年代政論來賓', '太陽花學運成員', '陳文成基金會董事', '新北足球委員會委員', '新北屏東同鄉會顧問', '新北牙醫公會顧問', '新北驗光公會顧問', '新北樂山會顧問', '耕著熊運動健康社團代言人']],
]);

const reviewedPlatformSnapshots = new Map(
  JSON.parse(fs.readFileSync(reviewedPlatformItemsPath, 'utf8')).map((record) => {
    if (
      !record?.claimId
      || !record?.original
      || !Array.isArray(record?.items)
      || record.items.length === 0
      || record.items.some((item) => typeof item !== 'string' || item.trim() !== item || !item)
    ) {
      throw new Error('Invalid reviewed platform snapshot: ' + (record?.claimId ?? 'missing claim ID'));
    }
    return [record.claimId, record];
  }),
);

const reviewedPlatformItems = new Map([
  ['bd708886-98b1-4601-a49c-21bbe865c4c4', ['建請縣府成立外來投資聯合局處小組，可加速審核速度，提高投資意願。', '針對秀姑巒溪流域研議強化泛舟活動及任何可行的水上遊憩行為，並增設親水公園等空間。', '重視南區觀光及農業産業，研議多時節經年常態性之中大型活動來為南區帶入更多的人潮及就業機會，增進活絡在地產業。', '加速瑞穗溫泉區開發計劃，檢討特定農業區地目之存廢，讓瑞穗溫泉區能夠有實質之發展。', '優化或建置南區公共運輸系統，推行銀髮就醫固定班次接駁往返，讓長輩就醫無憂。', '以南區四鄉鎮為主軸結合各區農特產品，邀請各大銷售通路做規劃配合，讓農民不再為銷售煩惱，共創雙赢。']],
  ['7d167ab5-64ba-4ef1-a115-8241df0a7ab4', []],
  ['6edf8418-16a6-4b6f-ab17-cb9386ccf3dd', ['提高公糧收購價格，保障稻農基本收入。', '降低青年養育壓力，廣設托育托嬰據點。', '避免意識形態因素，務實開拓國際市場。', '增列嬰幼公費疫苗，減輕家長經濟負擔。', '提升專技人員薪資，建構智慧科技農業。', '提高山區教師待遇，強化偏鄉學校設備。', '打造永續發展農村，推動綠色環境給付。', '監督落實居住正義，杜絕炒作健全稅制。', '重啟還我土地運動，放寬原墾文件認定。', '放寬取消巴氏量表，降低看護申請門檻。', '暫緩訴訟司法追殺，改訂輔導落日條款。', '檢討現行長照缺失，優化長者照護品質。', '檢討國土功能分區，捍衛居住生存權益。', '完善長者社群連結，拚壯世代第三人生。', '國土保育落實配套，擬定安遷補助方案。', '推動長照保險政策，建立穩定永續財務。', '輔導工廠數位轉型，營造產業聚落效應。', '打造觀光友善環境，國際遊客倍增來嘉。', '開發深度套裝遊程，補助旅宿優化環境。', '爭取合理水電配置，吸引高科廠商進駐。']],
  ['c4366e8d-2c58-4a23-9276-829a13a55322', []],
]);

const reviewedPlatformDropItems = new Map([
  ['d6ca3abe-1a48-4452-a00d-25cbb9c62e2c', new Set(['See 圖', '7 7S 1', '閃避', '211', 'REIS SIN eee'])],
  ['8e0c3871-19d1-473e-9dca-c55dcab62cbc', new Set(['屆議員'])],
  ['0e6c1ad4-9955-4873-b312-165ba1fb0092', new Set(['產業'])],
  ['de6ffe7a-1c15-4e58-9845-bfe5135ec8c9', new Set(['裝上路'])],
  ['6ba952ed-f55f-48e5-9c5e-e0ffbfbb933c', new Set(['七選舉區', '2'])],
  ['067bde29-67f5-4dc4-9c12-4ec45ce18a7e', new Set(['服務有婕'])],
  ['2519c601-5c7f-4ca5-96c7-4e5fddab8c17', new Set(['於選舉公報篇幅規定，政見詳細內容請掃 QR-CODE'])],
]);


if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
