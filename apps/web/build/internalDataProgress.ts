import fs from 'node:fs';
import path from 'node:path';
import { currentCountyNames, normalizeTaiwanText } from '../src/lib/taiwanText.ts';
import type { DataProgressSummary, ProgressDetail, ProgressMetric } from '../src/lib/dataProgressContract';

// Heterogeneous existing local artifact formats are checked at each boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
type Result = { rows: Row[]; error: string | null };
type Artifact = { data: Row | null; error: string | null };
export type ProgressSources = {
  people: Result; candidates: Result; claims: Result; identities: Result;
  regions?: Result; profileClaims: Result;
  pool: Artifact; state: Artifact; followups: Artifact; daily: Artifact; weekly: Artifact; review: Artifact;
};
const categories = ['family_relation', 'party_affiliation', 'legal_case'];
const groups = ['總統／副總統', '立法委員', '縣市首長', '縣市議員', '鄉鎮市長與其他人物', '鄉鎮市民代表／區長／村里長'];
const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const unique = (rows: Row[], key: string) => [...new Map(rows.filter(r => text(r[key])).map(r => [r[key], r])).values()];
const safeUrl = (value: unknown) => { try { const u = new URL(text(value)); return ['https:', 'http:'].includes(u.protocol) ? u.href : undefined; } catch { return undefined; } };

const progressCountyNames = [...currentCountyNames, '臺北縣', '桃園縣', '臺中縣', '臺南縣', '高雄縣'];
// Election titles preserve historical boundaries even where region IDs were modernized.
export function candidateCounty(candidate: Row, regions: Map<string, Row>) {
  const matchCounty = (value: unknown) => {
    const name = normalizeTaiwanText(text(value));
    return progressCountyNames.find(county => name.startsWith(county));
  };
  const byYear = (county: string) => {
    if (county === '新北市' && candidate.election_year < 2010) return '臺北縣';
    if (county === '桃園市' && candidate.election_year < 2014) return '桃園縣';
    return county;
  };
  const titleCounty = matchCounty(candidate.race_title);
  if (titleCounty) return byYear(titleCounty);
  let region = regions.get(candidate.region_id);
  const seen = new Set<string>();
  while (region && !seen.has(region.region_id)) {
    seen.add(region.region_id);
    const county = matchCounty(region.name);
    if (county && ['county', 'city', 'municipality'].includes(region.region_type)) return byYear(county);
    region = regions.get(region.parent_region_id);
  }
  const county = matchCounty(candidate.region_name);
  return county ? byYear(county) : null;
}

export function researchGroup(person: Row) {
  const office = text(person.current_office_label) || text(person.position);
  if (/總統/.test(office)) return groups[0];
  if (person.list_role === 'legislator' || /立法委員/.test(office)) return groups[1];
  if (/代表|區長|村長|里長/.test(office)) return groups[5];
  if (person.list_role === 'councilor' || /議員/.test(office)) return groups[3];
  if (/縣長|(?:臺北|台北|新北|桃園|臺中|台中|臺南|台南|高雄|基隆|新竹|嘉義)市長/.test(office)) return groups[2];
  return groups[4];
}
export function backfillComplete(record: Row | undefined, now: Date) {
  return Boolean(record && validDate(record.completedAt) && Date.parse(record.completedAt) <= now.getTime()
    && Array.isArray(record.results) && record.results.length === categories.length
    && categories.every(category => record.results.filter((r: Row) => r?.category === category && ['leads_found', 'no_leads'].includes(r.status)).length === 1));
}
export function hasDegradedEvidence(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasDegradedEvidence);
  const row = value as Row;
  if (row.needsAttention === true || ['failed', 'error', 'source_error', 'fallback', 'partial', 'degraded', 'needs_attention'].includes(row.status)
    || (typeof row.exitCode === 'number' && row.exitCode !== 0) || (typeof row.sourceErrorCount === 'number' && row.sourceErrorCount > 0)) return true;
  return Object.values(row).some(hasDegradedEvidence);
}

// Fixed paths only. Never follow a filename or artifact path supplied by the browser.
function readArtifact(root: string, relative: string, requiredKey: string): Artifact {
  try {
    const full = path.join(root, relative);
    const real = fs.realpathSync(full);
    if (!real.startsWith(`${fs.realpathSync(path.join(root, 'tmp'))}${path.sep}`) || fs.statSync(real).size > 64 * 1024 * 1024) throw Error('Invalid artifact');
    const data = JSON.parse(fs.readFileSync(real, 'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data) || !(requiredKey in data)) throw Error('Invalid format');
    if (['targets', 'items', 'steps'].includes(requiredKey) && !Array.isArray(data[requiredKey])) throw Error('Invalid rows');
    if (requiredKey === 'historicalBackfill' && (!data[requiredKey] || typeof data[requiredKey] !== 'object' || Array.isArray(data[requiredKey]))) throw Error('Invalid state');
    return { data, error: null };
  } catch (error) {
    return { data: null, error: `${relative}：${(error as { code?: string }).code === 'ENOENT' ? '未接入' : '讀取失敗或格式不符'}` };
  }
}
export async function readProgressRows(rest: (query: string) => Promise<unknown>, table: string, select: string, key: string, filters: Record<string, string> = {}): Promise<Result> {
  const rows: Row[] = [];
  try {
    for (let offset = 0; offset < 500000; offset += 1000) {
      const query = new URLSearchParams({ ...filters, select, order: `${key}.asc`, limit: '1000', offset: String(offset) });
      const page = await rest(`${table}?${query}`);
      if (!Array.isArray(page)) throw Error('Invalid response');
      rows.push(...page);
      if (page.length < 1000) return { rows: unique(rows, key), error: null };
    }
    throw Error('Read limit exceeded');
  } catch { return { rows: [], error: `${table}：讀取失敗，未以部分資料計算` }; }
}
export async function loadProgressSources(root: string, rest: (query: string, profile?: string) => Promise<unknown>): Promise<ProgressSources> {
  const published = (query: string) => rest(query, 'published');
  const [people, candidates, claims, identities, regions, profileClaims] = await Promise.all([
    readProgressRows(published, 'people', 'person_id,name,position,current_office_label,list_role,list_status,district,education,experience', 'person_id'),
    readProgressRows(published, 'candidates', 'candidate_id,person_id,person_name,election_year,election_result,region_id,region_name,race_title,source_name,source_url', 'candidate_id'),
    readProgressRows(rest, 'person_claim_review_queue', 'claim_id,person_id,raw_name,claim_type,review_status,source_name,source_url,updated_at,claim_json', 'claim_id'),
    readProgressRows(rest, 'person_identity_review_queue', 'source_person_id,raw_name,review_status,source_name,source_url,updated_at,election_year,district', 'source_person_id'),
    readProgressRows(published, 'regions', 'region_id,name,region_type,parent_region_id', 'region_id'),
    readProgressRows(published, 'person_claims', 'claim_id,person_id,claim_type,claim_value,claim_json', 'claim_id', { claim_type: 'in.(education,experience)' }),
  ]);
  return { people, candidates, claims, identities, regions, profileClaims,
    pool: readArtifact(root, 'tmp/daily-person-enrichment-pool.json', 'targets'),
    state: readArtifact(root, 'tmp/daily-person-enrichment-state.json', 'historicalBackfill'),
    followups: readArtifact(root, 'tmp/monitor-followups.json', 'items'),
    daily: readArtifact(root, 'tmp/daily-monitor/summary.json', 'steps'),
    weekly: readArtifact(root, 'tmp/weekly-monitor/summary.json', 'steps'),
    review: readArtifact(root, 'tmp/codex-scheduled-review-state.json', 'lastCheckedAt'),
  };
}

// One in-flight snapshot per server; filters reuse it. Explicit refresh invalidates a completed snapshot.
export function createDataProgressReader(root: string, rest: (query: string, profile?: string) => Promise<unknown>) {
  let pending: Promise<{ sources: ProgressSources; at: Date }> | null = null;
  let expiresAt = 0;
  let loading = false;
  return async (params: URLSearchParams) => {
    if (!pending || (!loading && (params.get('refresh') === '1' || Date.now() >= expiresAt))) {
      loading = true;
      pending = loadProgressSources(root, rest).then(sources => {
        const at = new Date(); expiresAt = at.getTime() + 5 * 60 * 1000;
        return { sources, at };
      }).catch(error => { pending = null; throw error; }).finally(() => { loading = false; });
    }
    const { sources, at } = await pending;
    return buildDataProgress(sources, params, at);
  };
}

export function buildDataProgress(input: ProgressSources, params: URLSearchParams, now = new Date()): DataProgressSummary {
  const errors = Object.values(input).flatMap(s => s.error ? [s.error] : []);
  const allPeople = unique(input.people.rows, 'person_id');
  const allCandidates = unique(input.candidates.rows, 'candidate_id');
  const peopleById = new Map(allPeople.map(p => [p.person_id, p]));
  const year = params.get('year') || '';
  const region = params.get('region') || '';
  const office = params.get('office') || '';
  const scope = params.get('scope') || 'all';
  const result = params.get('result') || '';
  const tenure = params.get('tenure') || '';
  const inclusion = params.get('inclusion') || '';
  const currentYear = now.getFullYear();
  const regionById = new Map((input.regions?.rows || []).map(r => [r.region_id, r]));
  const countyByCandidate = new Map(allCandidates.map(c => [c.candidate_id, candidateCounty(c, regionById)]));
  const yearCandidates = allCandidates.filter(c => (!year || String(c.election_year) === year)
    && (scope !== 'election' || c.election_year === currentYear)
    && (scope !== 'history' || c.election_year < currentYear));
  const poolRows = Array.isArray(input.pool.data?.targets) ? input.pool.data.targets : null;
  const poolIds = poolRows ? new Set(poolRows.map((p: Row) => p.personId)) : null;
  const electionFilter = Boolean(year || result || region || scope === 'election' || scope === 'history');
  const scopedCandidates = yearCandidates.filter(c => (!region || countyByCandidate.get(c.candidate_id) === region)
    && (!result || (result === 'unknown' ? !c.election_result || c.election_result === 'unknown' : c.election_result === result)));
  const electionIds = new Set(scopedCandidates.map(c => c.person_id));
  const people = allPeople.filter(p => (!electionFilter || electionIds.has(p.person_id))
    && (scope !== 'current' || p.list_status === 'current')
    && (!tenure || (tenure === 'unknown' ? !['current', 'former'].includes(p.list_status) : p.list_status === tenure))
    && (!office || researchGroup(p) === office)
    && (!inclusion || (poolIds && (inclusion === 'included' ? poolIds.has(p.person_id) : !poolIds.has(p.person_id)))));
  const ids = new Set(people.map(p => p.person_id));
  const personFilter = scope === 'current' || Boolean(tenure || office || inclusion);
  const candidates = scopedCandidates.filter(c => !personFilter || ids.has(c.person_id));
  const filtered = scope !== 'all' || Boolean(year || region || result || tenure || office || inclusion);
  const scopeFailed = Boolean(input.people.error || (electionFilter && input.candidates.error) || (region && input.regions?.error) || (inclusion && !poolIds) || tenure === 'former');
  if (tenure === 'former') errors.push('曾任篩選：歷史任期證據尚未接入，不能從過去參選或當選推定曾任。');
  const details: ProgressDetail[] = [];
  const metrics: ProgressMetric[] = [];
  const addGap = (id: string, label: string, personId: string, reason: string, source: string) => details.push({ id, label, personId, reason, source, group: id.startsWith('name:') ? '人物基本資料' : '選舉與參選紀錄', section: 'gaps', state: 'missing', next: '回到對應官方來源補齊並核對' });
  const namesMissing = people.filter(p => !text(p.name));
  namesMissing.forEach(p => addGap(`name:${p.person_id}`, p.person_id, p.person_id, '缺少人物姓名', '本機公開人物資料'));
  const candidatePersonIds = new Set(allCandidates.map(c => c.person_id));
  const profilePeople = people.filter(p => candidatePersonIds.has(p.person_id));
  const profileFields = new Set(input.profileClaims.rows.filter(c => ['education', 'experience'].includes(c.claim_type) && (text(c.claim_value) || text(c.claim_json?.value))).map(c => `${c.person_id}:${c.claim_type}`));
  const profileFailed = Boolean(input.profileClaims.error);
  let profileMissing = namesMissing.length;
  for (const p of profilePeople) for (const [key, label] of [['education', '學歷'], ['experience', '經歷']]) {
    if (!profileFailed && !text(p[key]) && !profileFields.has(`${p.person_id}:${key}`)) {
      profileMissing++;
      addGap(`name:${p.person_id}:${key}`, p.name, p.person_id, `缺少${label}；需以已確認人物的官方公報或人物資料補齊`, '本機人物欄位與已公開資料主張');
    }
  }
  const profileTotal = people.length + profilePeople.length * 2;
  metrics.push({ key: 'people', label: '人物基本資料', missing: scopeFailed || input.candidates.error || profileFailed ? null : profileMissing, total: scopeFailed || input.candidates.error || profileFailed ? null : profileTotal, unit: '必要項目', note: 'v1：每人姓名；有參選紀錄者另檢查學歷、經歷。生日、外部 ID 為補充項目，不列入。以人物欄位及已核准公開主張共同檢查是否有內容，尚未稽核內容品質。' });
  let candidateMissing = 0; let candidateTotal = 0; let waiting = 0;
  for (const c of candidates) {
    const checks = [[Boolean(c.person_id && peopleById.has(c.person_id)), '人物對應'], [Boolean(text(c.source_name) && safeUrl(c.source_url)), '可追溯來源']] as [boolean, string][];
    if (c.election_year < currentYear) checks.push([['elected', 'not_elected'].includes(c.election_result), '歷屆選舉結果']);
    else waiting++;
    for (const [ready, label] of checks) {
      candidateTotal++;
      if (!ready) { candidateMissing++; addGap(`${c.candidate_id}:${label}`, `${c.person_name || '待確認人物'} · ${c.election_year} ${c.race_title || ''}`, c.person_id, `缺少${label}`, text(c.source_name)); }
    }
  }
  const candidateFailed = scopeFailed || Boolean(input.candidates.error);
  metrics.push({ key: 'elections', label: '選舉與參選紀錄', missing: candidateFailed ? null : candidateMissing, total: candidateFailed ? null : candidateTotal, unit: '必要項目', note: '逐筆檢查人物對應、來源；往年另檢查選舉結果。本年及未來結果不納入，待選舉日期契約接入。' });
  for (const label of ['現任公職與任期', '政見與公報', '政黨與政治獻金', '投票地區與投票所', '司法紀錄與家族關係']) metrics.push({ key: label, label, missing: null, total: null, unit: '必要項目', note: label === '司法紀錄與家族關係' ? '只看已知線索查核，不以人物是否有紀錄計算缺口。' : '預期收錄範圍與必要項目分母尚未接入。' });
  const eligiblePeople = people.filter(p => poolIds?.has(p.person_id));
  const state = input.state.data;
  const researchKnown = Boolean(state && typeof state.historicalBackfill === 'object' && state.historicalBackfill);
  const researchRows = eligiblePeople.map(p => {
    const complete = backfillComplete(state?.historicalBackfill?.[p.person_id], now);
    const attemptedAt = state?.attempts?.[p.person_id]?.attemptedAt;
    const attempted = Boolean(state?.attempts?.[p.person_id]);
    const due = complete && (!validDate(attemptedAt) || now.getTime() - Date.parse(attemptedAt) >= 30 * 86400000);
    const incomplete = state?.researchMonitoring?.[p.person_id]?.status === 'incomplete' || state?.historicalBackfill?.[p.person_id]?.status === 'incomplete' || (!complete && attempted);
    const rowState = !researchKnown ? 'unknown' : due ? 'due' : incomplete ? 'incomplete' : complete ? 'complete' : 'unsearched';
    details.push({ id: `research:${p.person_id}`, label: p.name, personId: p.person_id, section: 'research', state: rowState, firstComplete: complete, due, incomplete, group: researchGroup(p), reason: !researchKnown ? '搜尋狀態未接入' : complete ? '首次三類搜尋已成功；不代表資料查盡' : attempted ? '曾執行但尚無三類皆成功的完成證據' : '尚無首次補查完成紀錄', date: attemptedAt, source: '人物搜尋候選池與狀態檔', next: due ? '已符合 30 天冷卻期，等待既有排程重查' : '依既有優先順序與冷卻期處理' });
    return { group: researchGroup(p), complete, due, incomplete, unsearched: rowState === 'unsearched' };
  });
  const researchGroups = !poolIds || scopeFailed ? [] : groups.map(label => {
    const rows = researchRows.filter(r => r.group === label);
    return { label, total: rows.length, complete: researchKnown ? rows.filter(r => r.complete).length : null, due: researchKnown ? rows.filter(r => r.due).length : null, incomplete: researchKnown ? rows.filter(r => r.incomplete).length : null, unsearched: researchKnown ? rows.filter(r => r.unsearched).length : null };
  });
  if (poolIds && !scopeFailed) people.filter(p => !poolIds.has(p.person_id)).forEach(p => details.push({ id: `excluded:${p.person_id}`, label: p.name, personId: p.person_id, section: 'research', state: 'excluded', group: researchGroup(p), reason: '未在已保存的搜尋候選池；排除／暫緩原因尚待逐人確認', source: '人物搜尋候選池', next: '核對候選池時間與原有納入規則' }));
  const claims = unique(input.claims.rows, 'claim_id').filter(c => (!filtered || ids.has(c.person_id)) && ['pending', 'needs_more_evidence'].includes(c.review_status));
  for (const c of claims) details.push({ id: `claim:${c.claim_id}`, label: text(c.raw_name) || peopleById.get(c.person_id)?.name || '待確認人物', personId: c.person_id, section: 'backlog', state: c.review_status, reason: `${c.claim_type}：${c.review_status === 'needs_more_evidence' ? '需補證' : '等待人工審核'}`, source: text(c.source_name), sourceUrl: safeUrl(c.source_url), date: c.updated_at, next: '開啟既有審核佇列，核對來源與身分', reviewStatus: c.review_status, claimType: c.claim_type });
  const claimIds = new Set(input.claims.rows.map(c => c.claim_id));
  const followups = Array.isArray(input.followups.data?.items) ? unique(input.followups.data.items, 'key') : null;
  const activeLeads = followups?.filter(f => ['open', 'blocked'].includes(f.status) && (!filtered || ids.has(f.personId))) ?? [];
  const linkedLeads = activeLeads.filter(f => claimIds.has(f.pendingClaim?.id));
  const unlinkedLeads = activeLeads.filter(f => !claimIds.has(f.pendingClaim?.id));
  for (const f of unlinkedLeads) details.push({ id: `lead:${f.key}`, label: text(f.personName) || '待確認人物', personId: f.personId, section: 'backlog', state: 'leads', reason: text(f.reviewNote) || text(f.summary) || '未完成線索查核', source: text(f.artifactRef) || '本機線索佇列', sourceUrl: safeUrl(f.sourceUrl), date: f.firstSeenAt, next: Array.isArray(f.missingEvidence) && f.missingEvidence.length ? f.missingEvidence.map(String).join('、') : '核對官方證據與人物身分；不自動發布' });
  const identities = unique(input.identities.rows, 'source_person_id');
  if (!filtered) for (const item of identities) details.push({ id: `identity:${item.source_person_id}`, label: text(item.raw_name) || '待確認人物', section: 'backlog', state: 'identity', reason: '來源人物尚待身分核對', source: text(item.source_name), sourceUrl: safeUrl(item.source_url), date: item.updated_at, next: '前往審核佇列的身分核對區' });
  const backlogKnown = !scopeFailed && !input.claims.error;
  const backlog = [
    { key: 'leads', label: '未結案線索', count: followups && backlogKnown ? unlinkedLeads.length : null, note: `按線索 key 去重；${backlogKnown ? linkedLeads.length : '未知'} 件已關聯待審資料，不重複列入。未完成跨來源事件去重。` },
    { key: 'identity', label: '身分待確認', count: input.identities.error || filtered ? null : identities.length, note: filtered ? '未配對人物無法套用人物篩選，請切回全站查看。' : '來源人物紀錄，與主張／線索分開統計。' },
    { key: 'needs_more_evidence', label: '待補證資料', count: backlogKnown ? claims.filter(c => c.review_status === 'needs_more_evidence').length : null, note: '主張筆數；等待時間以最近更新計算，非首次入列時間。' },
    { key: 'pending', label: '待審核資料', count: backlogKnown ? claims.filter(c => c.review_status === 'pending').length : null, note: '主張筆數；建議可發布仍須人工核准，不等於已核准。' },
    { key: 'publication', label: '已核准待發布', count: null, note: '核准與公開層對帳尚未接入，不從建議發布狀態推算。' },
    { key: 'raw', label: '原始來源／去重事件', count: null, note: '跨來源事件識別未接入，不與主張筆數混加。' },
  ];
  const schedules: DataProgressSummary['schedules'] = (['daily', 'weekly'] as const).map(kind => {
    const data = input[kind].data;
    const steps = Array.isArray(data?.steps) ? data.steps : null;
    const degraded = hasDegradedEvidence(data);
    const fullyKnown = Boolean(steps?.length && data?.scheduledStepCount === steps.length && steps.every((s: Row) => s.status === 'ok' && s.exitCode === 0 && validDate(s.finishedAt)));
    const complete = data?.status === 'ok' && !degraded && fullyKnown;
    return { label: kind === 'daily' ? '每日蒐集' : '每週蒐集', source: `tmp/${kind}-monitor/summary.json`, configured: kind === 'daily' ? '文件規則：每日 25 人、30 天最低冷卻；實際排程啟用狀態未接入' : '文件規則：每週來源刷新；實際排程啟用狀態未接入', observedAt: validDate(data?.generatedAt) ? data.generatedAt : null, status: !data ? '未接入' : degraded ? '需注意／部分失敗' : complete ? '該次完整成功' : '完整成功證據不足', completeAt: complete ? data.generatedAt : null, passed: steps ? steps.filter((s: Row) => s.status === 'ok' && s.exitCode === 0 && !hasDegradedEvidence(s)).length : null, total: steps?.length ?? null, steps: steps?.map((s: Row) => ({ label: text(s.scriptName) || text(s.name), status: hasDegradedEvidence(s) ? '需注意' : s.status === 'ok' && s.exitCode === 0 ? '步驟成功' : '狀態未知' })) ?? [], review: '這是已保存摘要；未與各產物雜湊逐項對帳，不能推定全部已審或本次取得新資料。' };
  });
  schedules.push({ label: '定期審核', source: 'tmp/codex-scheduled-review-state.json', configured: '文件規則：每日審核既有產物；實際排程啟用狀態未接入', observedAt: validDate(input.review.data?.lastCheckedAt) ? input.review.data.lastCheckedAt : null, status: text(input.review.data?.lastReviewSummary?.status) || '狀態未知', completeAt: null, passed: null, total: null, steps: [], review: `最近審核紀錄：${text(input.review.data?.lastReviewedAt) || '未知'}。審核狀態不代表已發布。` });
  const section = params.get('section') || 'gaps'; const stateFilter = params.get('state'); const group = params.get('group'); const query = text(params.get('q')).toLocaleLowerCase();
  const stateMatches = (d: ProgressDetail) => !stateFilter || (section === 'research' && stateFilter === 'complete' ? d.firstComplete : section === 'research' && stateFilter === 'due' ? d.due : section === 'research' && stateFilter === 'incomplete' ? d.incomplete : section === 'research' && stateFilter === 'included' ? d.state !== 'excluded' : d.state === stateFilter);
  const selected = scopeFailed ? [] : details.filter(d => d.section === section && stateMatches(d) && (!group || d.group === group) && (!query || `${d.label} ${d.reason} ${d.source}`.toLocaleLowerCase().includes(query)));
  selected.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(selected.length / 25)); const page = Math.min(pages, Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1));
  return { version: 'necessary-items-v1', generatedAt: now.toISOString(), errors,
    options: { years: [...new Set(allCandidates.map(c => String(c.election_year)).filter(y => /^\d{4}$/.test(y)))].sort().reverse(), regions: progressCountyNames.filter(name => yearCandidates.some(c => countyByCandidate.get(c.candidate_id) === name)), offices: groups },
    people: scopeFailed ? null : people.length, candidates: candidateFailed ? null : candidates.length,
    gap: { missing: candidateFailed || profileFailed ? null : profileMissing + candidateMissing, total: candidateFailed || profileFailed ? null : profileTotal + candidateTotal, waiting: candidateFailed ? null : waiting }, metrics,
    research: { poolAt: text(input.pool.data?.generatedAt) || null, stateAt: text(state?.updatedAt) || null, excluded: !poolIds || scopeFailed ? null : people.length - eligiblePeople.length, groups: researchGroups },
    backlog, schedules, details: { rows: selected.slice((page - 1) * 25, page * 25), total: selected.length, page, pages } };
}
