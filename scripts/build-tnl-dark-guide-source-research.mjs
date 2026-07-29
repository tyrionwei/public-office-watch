import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(repoRoot, 'data-sources', 'tnl-dark-guide');
const outputPath = path.join(dataDir, 'source-research-report.json');
const csvOutputPath = path.join(dataDir, 'source-research-review.csv');
const summaryOutputPath = path.join(dataDir, 'source-research-summary.md');
const findingsPath = path.join(dataDir, 'source-research-findings.json');
const categories = ['政治工作', '政治家族', '涉案紀錄', '其他'];

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

function stableOrderForTable(tableName) {
  return {
    elections: 'id.asc',
    races: 'id.asc',
    candidates: 'id.asc',
    people: 'id.asc',
    regions: 'id.asc',
    person_canonical_map: 'person_id.asc',
    person_identity_matches: 'source_person_id.asc,person_id.asc',
    person_claims: 'id.asc',
    source_people: 'id.asc',
  }[tableName] ?? null;
}

function restUrl(tableName) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`);
}

async function fetchRows(tableName, select, filters = {}) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const url = restUrl(tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));
    const stableOrder = stableOrderForTable(tableName);
    if (stableOrder) url.searchParams.set('order', stableOrder);
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
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

async function fetchRowsByIds(tableName, select, column, ids, chunkSize = 80) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const rows = [];
  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    const chunk = uniqueIds.slice(index, index + chunkSize);
    rows.push(...await fetchRows(tableName, select, { [column]: `in.(${chunk.join(',')})` }));
  }
  return rows;
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/臺/g, '台')
    .replace(/羣/g, '群')
    .replace(/黄/g, '黃')
    .replace(/[\s　·．・‧,，.。:：;；!！?？()（）\[\]【】「」『』\/]/g, '')
    .toLowerCase();
}

function normalizeName(value) {
  return normalizeText(value).replace(/[^㐀-鿿a-z0-9]/g, '');
}

function normalizeHanName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/臺/g, '台')
    .replace(/羣/g, '群')
    .replace(/黄/g, '黃')
    .match(/\p{Script=Han}+/gu)
    ?.join('') ?? '';
}

function normalizeParty(value) {
  return normalizeText(value)
    .replace(/中國國民黨/g, '國民黨')
    .replace(/民主進步黨/g, '民進黨')
    .replace(/台灣民眾黨/g, '民眾黨')
    .replace(/台灣基進/g, '基進黨')
    .replace(/無黨籍及未經政黨推薦/g, '無黨籍');
}

function candidateIdentityKey(name, party, cityCode) {
  const normalizedName = normalizeName(name);
  const normalizedParty = normalizeParty(party);
  const normalizedCityCode = String(cityCode ?? '').trim().toLowerCase();
  if (!normalizedName || !normalizedParty || !normalizedCityCode) return null;
  return [normalizedName, normalizedParty, normalizedCityCode].join('|');
}

function combinedCandidateHistory(directRows, identityRows) {
  return uniqueBy([
    ...directRows,
    ...identityRows.map((row) => ({ ...row, identityInferred: true })),
  ], (row) => [
    row.election_year,
    row.raceType,
    row.is_elected,
    normalizeParty(row.party),
    row.cityCode,
    row.area,
  ].join('|'));
}

function historicalSourceHistoryRow(sourcePerson, identityMatch) {
  if (sourcePerson?.source_type !== 'official_election') return null;
  const position = String(sourcePerson.position ?? '');
  const electionYear = Number(sourcePerson.election_year);
  if (!position.includes('議員') || !Number.isInteger(electionYear)) return null;
  const cityCode = cityCodeForText(`${sourcePerson.district ?? ''} ${position}`);
  if (!cityCode) return null;
  return {
    person_id: identityMatch.person_id,
    person_name: sourcePerson.raw_name ?? '',
    party: sourcePerson.party ?? '',
    candidate_no: null,
    race_title: sourcePerson.district ?? null,
    election_name: null,
    election_year: electionYear,
    cityCode,
    area: districtNumber(sourcePerson.district),
    raceType: 'councilor',
    source_name: sourcePerson.source_name,
    source_url: sourcePerson.source_url,
    is_elected: !position.includes('候選人'),
    identityInferred: true,
    identityMatchStatus: identityMatch.match_status,
    identityMatchScore: identityMatch.score,
  };
}

function cityCodeForText(value) {
  const text = normalizeText(value);
  if (text.includes('台北')) return 'tpe';
  if (text.includes('新北')) return 'nwt';
  if (text.includes('桃園')) return 'tao';
  if (text.includes('台中')) return 'txg';
  if (text.includes('台南')) return 'tnn';
  if (text.includes('高雄')) return 'khh';
  return null;
}

function chineseNumber(value) {
  if (/^\d+$/.test(value)) return Number.parseInt(value, 10);
  const digits = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (value === '十') return 10;
  if (value.includes('十')) {
    const [left, right] = value.split('十');
    return (left ? digits[left] : 1) * 10 + (right ? digits[right] : 0);
  }
  return digits[value] ?? null;
}

function districtNumber(value) {
  const match = String(value ?? '').normalize('NFKC').match(/第\s*([一二三四五六七八九十\d]+)\s*(?:選舉)?區/);
  return match ? chineseNumber(match[1]) : null;
}
function semanticRaceType(value) {
  if (['city_councilor', 'county_councilor', 'councilor_district'].includes(value)) return 'councilor';
  return value ?? 'unknown';
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

function claimTypesFor(category) {
  if (category === '政治工作') return new Set(['experience', 'position', 'office', 'party_affiliation']);
  if (category === '政治家族') return new Set(['family_relation']);
  if (category === '涉案紀錄') return new Set(['legal_case']);
  return new Set(['education', 'experience', 'platform', 'position', 'office', 'party_affiliation']);
}

function evidenceTier(claim, sourcePerson) {
  const sourceType = sourcePerson?.source_type ?? '';
  const sourceName = claim.source_name ?? sourcePerson?.source_name ?? '';
  const sourceUrl = claim.source_url ?? sourcePerson?.source_url ?? '';
  if (['official_election', 'official_officeholder', 'official_site'].includes(sourceType)) return 'official';
  if (/\.gov\.tw(?:\/|$)/i.test(sourceUrl) || /(中央選舉委員會|立法院|內政部|市議會|縣議會|市政府|縣政府)/.test(sourceName)) {
    return 'official';
  }
  if (sourceType === 'public_reference' || /(VoteTW|Wikidata|維基)/i.test(sourceName)) return 'secondary';
  return 'unknown';
}

function originalSourceEvidence(researchClaim) {
  if (!researchClaim.originalSourceUrl) return [];
  let hostname = '';
  try {
    hostname = new URL(researchClaim.originalSourceUrl).hostname.toLowerCase();
  } catch {
    hostname = 'invalid-url';
  }
  const tier = hostname.endsWith('.gov.tw') || hostname === 'judicial.gov.tw'
    ? 'official'
    : hostname === 'www.cna.com.tw'
      ? 'trusted_media'
      : 'secondary';
  return [{
    claimId: null,
    claimType: 'dark_guide_linked_source',
    claimValue: researchClaim.text,
    matchScore: 1,
    tier,
    reviewStatus: 'linked_unverified',
    visibility: 'review_only',
    sourceType: 'dark_guide_embedded_link',
    sourceName: hostname,
    sourceUrl: researchClaim.originalSourceUrl,
  }];
}

function derivedElectionEvidence(researchClaim, historyRows) {
  if (researchClaim.category !== '政治工作') return [];
  const electedCouncilorRows = historyRows.filter((row) => row.raceType === 'councilor' && row.is_elected === true);
  const yearMatch = researchClaim.text.match(/(\d{4})年當選(?:議員)?/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    const matches = electedCouncilorRows.filter((row) => row.election_year === year);
    if (matches.length === 0) return [];
    const directMatches = matches.filter((row) => row.identityInferred !== true);
    const evidenceMatches = directMatches.length > 0 ? directMatches : matches;
    const official = evidenceMatches.find((row) => /中央選舉委員會/.test(row.source_name ?? ''));
    const source = official ?? evidenceMatches[0];
    const identityInferred = evidenceMatches.some((row) => row.identityInferred === true);
    return [{
      claimId: null,
      claimType: 'derived_election_result',
      claimValue: `${year}年議員選舉當選${identityInferred ? '（同名、同黨、同縣市身分推定）' : ''}`,
      matchScore: 1,
      tier: official ? 'official' : 'secondary',
      reviewStatus: identityInferred ? 'identity_inferred' : official ? 'verified' : 'derived_secondary',
      visibility: 'review_only',
      sourceType: 'election_result',
      sourceName: identityInferred ? `${source.source_name}（身分待確認）` : source.source_name,
      sourceUrl: source.source_url,
    }];
  }

  const termMatch = researchClaim.text.match(/(1998年後)?曾任(\d+)屆(?:縣|市)?議員/);
  if (!termMatch) return [];
  const expectedTerms = Number(termMatch[2]);
  const referenceYears = (researchClaim.occurrences ?? [])
    .map((occurrence) => occurrence.year)
    .filter(Number.isFinite);
  const referenceYear = referenceYears.length > 0 ? Math.min(...referenceYears) : null;
  const relevantRows = electedCouncilorRows.filter((row) => (
    (!termMatch[1] || row.election_year >= 1998)
    && (referenceYear === null || row.election_year < referenceYear)
  ));
  const electedYears = [...new Set(relevantRows.map((row) => row.election_year))].sort();
  const allYearsOfficial = electedYears.every((year) => relevantRows.some((row) => (
    row.election_year === year && /中央選舉委員會/.test(row.source_name ?? '')
  )));
  const identityInferred = electedYears.some((year) => !relevantRows.some((row) => (
    row.election_year === year && row.identityInferred !== true
  )));
  const sourceName = allYearsOfficial ? '中央選舉委員會選舉資料庫：公開資料包' : '本機歷史選舉資料彙整';
  if (electedYears.length > expectedTerms) {
    return [{
      claimId: null,
      claimType: 'derived_election_history_conflict',
      claimValue: `暗公報敘述${expectedTerms}屆，但官方歷史來源對應到${electedYears.length}個當選年份（${electedYears.join('、')}）`,
      matchScore: 1,
      tier: allYearsOfficial ? 'official' : 'secondary',
      reviewStatus: identityInferred ? 'identity_conflict' : 'source_conflict',
      visibility: 'review_only',
      sourceType: 'election_history',
      sourceName: `${sourceName}（任期數衝突）`,
      sourceUrl: null,
    }];
  }
  if (electedYears.length > 0 && electedYears.length < expectedTerms) {
    return [{
      claimId: null,
      claimType: 'derived_election_history_partial',
      claimValue: `暗公報聲稱${expectedTerms}屆，目前找到${electedYears.length}個當選年份（${electedYears.join('、')}）`,
      matchScore: 1,
      tier: allYearsOfficial ? 'official' : 'secondary',
      reviewStatus: identityInferred ? 'identity_partial' : 'source_partial',
      visibility: 'review_only',
      sourceType: 'election_history',
      sourceName: `${sourceName}（任期資料未完整）`,
      sourceUrl: null,
    }];
  }
  if (electedYears.length !== expectedTerms) return [];
  return [{
    claimId: null,
    claimType: 'derived_election_history',
    claimValue: `${termMatch[1] ?? ''}當選議員共${expectedTerms}屆（${electedYears.join('、')}）${identityInferred ? '（同名、同黨、同縣市身分推定）' : ''}`,
    matchScore: 1,
    tier: allYearsOfficial ? 'official' : 'secondary',
    reviewStatus: identityInferred ? 'identity_inferred' : allYearsOfficial ? 'verified' : 'derived_secondary',
    visibility: 'review_only',
    sourceType: 'election_history',
    sourceName: identityInferred ? `${sourceName}（身分待確認）` : sourceName,
    sourceUrl: null,
  }];
}

function comparableParts(value) {
  const stripped = String(value ?? '')
    .replace(/^(曾任|現任|曾擔任|擔任|曾為|現為|為)/, '')
    .trim();
  return uniqueBy(
    [stripped, ...stripped.split(/[；;、，,\n]/)]
      .map(normalizeText)
      .filter((part) => part.length >= 4),
    (part) => part,
  );
}

function bigrams(value) {
  const parts = new Set();
  for (let index = 0; index < value.length - 1; index += 1) parts.add(value.slice(index, index + 2));
  return parts;
}

function similarity(left, right) {
  if (!left || !right) return 0;
  if (left.includes(right) || right.includes(left)) return 1;
  const leftParts = bigrams(left);
  const rightParts = bigrams(right);
  const overlap = [...leftParts].filter((part) => rightParts.has(part)).length;
  return (2 * overlap) / (leftParts.size + rightParts.size || 1);
}

function compareClaimToEvidence(researchText, evidenceValue) {
  let best = 0;
  for (const left of comparableParts(researchText)) {
    for (const right of comparableParts(evidenceValue)) best = Math.max(best, similarity(left, right));
  }
  return best;
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function matchGuideCandidate(guide, candidateRows) {
  const sameContext = candidateRows.filter((candidate) => (
    candidate.election_year === guide.year
    && candidate.cityCode === guide.cityCode
    && candidate.area === guide.area
  ));
  let matches = guide.number
    ? sameContext.filter((candidate) => Number(candidate.candidate_no) === Number(guide.number))
    : sameContext.filter((candidate) => normalizeName(candidate.person_name) === normalizeName(guide.name) || normalizeHanName(candidate.person_name) === normalizeHanName(guide.name));
  if (matches.length === 0) {
    matches = candidateRows.filter((candidate) => (
      candidate.election_year === guide.year
      && candidate.cityCode === guide.cityCode
      && (normalizeName(candidate.person_name) === normalizeName(guide.name) || normalizeHanName(candidate.person_name) === normalizeHanName(guide.name))
    ));
  }
  if (matches.length > 1) {
    const sameParty = matches.filter((candidate) => normalizeParty(candidate.party) === normalizeParty(guide.party));
    if (sameParty.length > 0) matches = sameParty;
  }
  return uniqueBy(matches, (candidate) => candidate.person_id);
}

function externalFindingEvidence(finding, researchClaim) {
  if (!finding?.sources?.length) return [];
  return finding.sources.map((source) => ({
    claimId: null,
    claimType: 'external_research_source',
    claimValue: source.supports ?? researchClaim.text,
    matchScore: 1,
    tier: source.tier ?? 'unknown',
    reviewStatus: 'external_manual_review',
    visibility: 'review_only',
    sourceType: 'external_research',
    sourceName: source.name ?? null,
    sourceUrl: source.url ?? null,
  }));
}

function researchStatus(category, evidence, externalFinding = null) {
  if (['政治家族', '涉案紀錄'].includes(category) && evidence.length > 0) return 'manual_review';
  const exactOfficial = evidence.find((item) => (
    item.matchScore === 1
    && item.tier === 'official'
    && item.reviewStatus === 'verified'
  ));
  if (exactOfficial) return 'auto_reviewable';
  if (evidence.length > 0) return 'manual_review';
  if (externalFinding?.outcome === 'not_found_after_stop_loss') return 'not_found_after_stop_loss';
  return 'external_search_needed';
}

async function main() {
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment or .env.local');

  const datasets = [2018, 2022].map((year) => JSON.parse(
    fs.readFileSync(path.join(dataDir, `tnl-dark-guide-${year}.json`), 'utf8'),
  ));
  const guideRows = datasets.flatMap((dataset) => dataset.candidates);
  const externalFindings = fs.existsSync(findingsPath)
    ? JSON.parse(fs.readFileSync(findingsPath, 'utf8')).findings ?? []
    : [];
  const externalFindingByResearchId = new Map(externalFindings.map((finding) => [finding.researchId, finding]));
  const [elections, races, candidates, people, regions, canonicalMap, identityMatches, officialElectionSourcePeople] = await Promise.all([
    fetchRows('elections', 'id,external_id,name,year,election_type,source_name'),
    fetchRows('races', 'id,external_id,election_id,region_id,race_type,title,source_name'),
    fetchRows('candidates', 'id,external_id,person_id,race_id,party,candidate_no,source_name,source_url,is_public,is_elected'),
    fetchRows('people', 'id,external_id,name,party,is_public'),
    fetchRows('regions', 'id,external_id,name,region_type,parent_region_id'),
    fetchRows('person_canonical_map', 'person_id,canonical_person_id'),
    fetchRows(
      'person_identity_matches',
      'source_person_id,person_id,match_status,score',
      { match_status: 'in.(auto_matched,probable_match)' },
    ),
    fetchRows(
      'source_people',
      'id,source_type,source_name,source_url,raw_name,party,position,district,election_year',
      { source_type: 'eq.official_election' },
    ),
  ]);
  const electionById = new Map(elections.map((row) => [row.id, row]));
  const raceById = new Map(races.map((row) => [row.id, row]));
  const personById = new Map(people.map((row) => [row.id, row]));
  const regionById = new Map(regions.map((row) => [row.id, row]));
  const canonicalByPersonId = new Map(canonicalMap.map((row) => [row.person_id, row.canonical_person_id]));
  const regionLineage = (regionId) => {
    const rows = [];
    const visited = new Set();
    let current = regionById.get(regionId);
    while (current && !visited.has(current.id)) {
      rows.push(current);
      visited.add(current.id);
      current = regionById.get(current.parent_region_id);
    }
    return rows;
  };
  const allCandidateRows = candidates.map((candidate) => {
    const race = raceById.get(candidate.race_id);
    const election = electionById.get(race?.election_id);
    const person = personById.get(candidate.person_id);
    const canonicalPersonId = canonicalByPersonId.get(candidate.person_id) ?? candidate.person_id;
    const canonicalPerson = personById.get(canonicalPersonId) ?? person;
    const lineage = regionLineage(race?.region_id);
    const cityCode = [
      ...lineage.flatMap((row) => [row.name, row.external_id]),
      race?.title,
      race?.external_id,
      election?.name,
      election?.external_id,
    ].map(cityCodeForText).find(Boolean) ?? null;
    const area = [race?.title, ...lineage.flatMap((row) => [row.name, row.external_id])]
      .map(districtNumber)
      .find((value) => value !== null) ?? null;
    return {
      person_id: canonicalPersonId,
      person_name: canonicalPerson?.name ?? person?.name ?? '',
      party: candidate.party ?? canonicalPerson?.party ?? person?.party ?? '',
      candidate_no: candidate.candidate_no,
      race_title: race?.title ?? null,
      election_name: election?.name ?? null,
      election_year: election?.year ?? null,
      cityCode,
      area,
      raceType: semanticRaceType(race?.race_type),
      source_name: candidate.source_name,
      source_url: candidate.source_url,
      is_elected: candidate.is_elected,
    };
  });
  const candidateRows = allCandidateRows.filter((candidate) => (
    [2018, 2022].includes(candidate.election_year)
    && candidate.raceType === 'councilor'
    && candidate.cityCode
    && candidate.person_name
  ));


  const guideMatches = new Map();
  const mappingIssues = [];
  for (const guide of guideRows) {
    const matches = matchGuideCandidate(guide, candidateRows);
    if (matches.length !== 1) {
      mappingIssues.push({
        guideId: guide.id,
        year: guide.year,
        name: guide.name,
        city: guide.city,
        area: guide.area,
        matchCount: matches.length,
        matches,
      });
      continue;
    }
    guideMatches.set(guide.id, matches[0]);
  }

  const rawResearchClaims = guideRows.flatMap((guide) => {
    const match = guideMatches.get(guide.id);
    if (!match) return [];
    return categories.flatMap((category) => (guide.sections?.[category] ?? []).map((entry, index) => ({
      researchId: `${guide.id}-${category}-${index + 1}`,
      canonicalPersonId: match.person_id,
      personName: match.person_name,
      category,
      text: entry.text.trim(),
      originalSourceUrl: entry.url,
      guidePageUrl: guide.pageUrl,
      occurrence: {
        guideId: guide.id,
        year: guide.year,
        city: guide.city,
        area: guide.area,
        party: guide.party,
        candidateNumber: guide.number ?? null,
      },
    })));
  });
  const groupedClaims = new Map();
  for (const claim of rawResearchClaims) {
    const key = [claim.canonicalPersonId, claim.category, normalizeText(claim.text)].join('|');
    const existing = groupedClaims.get(key);
    if (existing) {
      existing.occurrences.push(claim.occurrence);
      if (!existing.originalSourceUrl && claim.originalSourceUrl) existing.originalSourceUrl = claim.originalSourceUrl;
    } else {
      groupedClaims.set(key, { ...claim, occurrences: [claim.occurrence] });
    }
  }
  const researchClaims = [...groupedClaims.values()];
  const candidateHistoryByCanonical = new Map();
  const candidateHistoryByIdentity = new Map();
  for (const candidate of allCandidateRows) {
    const rows = candidateHistoryByCanonical.get(candidate.person_id) ?? [];
    rows.push(candidate);
    candidateHistoryByCanonical.set(candidate.person_id, rows);

    const identityKey = candidateIdentityKey(candidate.person_name, candidate.party, candidate.cityCode);
    if (!identityKey) continue;
    const identityRows = candidateHistoryByIdentity.get(identityKey) ?? [];
    identityRows.push(candidate);
    candidateHistoryByIdentity.set(identityKey, identityRows);
  }

  for (const sourcePerson of officialElectionSourcePeople) {
    const historyRow = historicalSourceHistoryRow(sourcePerson, {
      person_id: null,
      match_status: 'identity_fallback',
      score: null,
    });
    if (!historyRow) continue;
    const identityKey = candidateIdentityKey(sourcePerson.raw_name, sourcePerson.party, historyRow.cityCode);
    if (!identityKey) continue;
    const identityRows = candidateHistoryByIdentity.get(identityKey) ?? [];
    identityRows.push(historyRow);
    candidateHistoryByIdentity.set(identityKey, identityRows);
  }

  const canonicalIds = [...new Set(researchClaims.map((claim) => claim.canonicalPersonId))];

  const memberIds = canonicalMap
    .filter((row) => canonicalIds.includes(row.canonical_person_id))
    .map((row) => row.person_id);
  const relevantIdentityMatches = identityMatches
    .map((match) => ({
      ...match,
      canonicalPersonId: canonicalByPersonId.get(match.person_id) ?? match.person_id,
    }))
    .filter((match) => canonicalIds.includes(match.canonicalPersonId));
  const localClaims = await fetchRowsByIds(
    'person_claims',
    'id,person_id,source_person_id,claim_type,claim_value,claim_json,confidence_level,review_status,visibility,source_name,source_url,observed_at,is_public',
    'person_id',
    memberIds,
  );
  const additionalSourcePeople = await fetchRowsByIds(
    'source_people',
    'id,source_type,source_name,source_url,raw_name,party,position,district,election_year',
    'id',
    [
      ...localClaims.map((claim) => claim.source_person_id),
      ...relevantIdentityMatches.map((match) => match.source_person_id),
    ],
  );
  const sourcePeople = uniqueBy(
    [...officialElectionSourcePeople, ...additionalSourcePeople],
    (row) => row.id,
  );
  const sourcePersonById = new Map(sourcePeople.map((row) => [row.id, row]));
  for (const match of relevantIdentityMatches) {
    const historyRow = historicalSourceHistoryRow(sourcePersonById.get(match.source_person_id), match);
    if (!historyRow) continue;
    const historyRows = candidateHistoryByCanonical.get(match.canonicalPersonId) ?? [];
    historyRows.push({ ...historyRow, person_id: match.canonicalPersonId });
    candidateHistoryByCanonical.set(match.canonicalPersonId, historyRows);
  }
  const localClaimsByCanonical = new Map();
  for (const claim of localClaims) {
    const canonicalPersonId = canonicalByPersonId.get(claim.person_id) ?? claim.person_id;
    const rows = localClaimsByCanonical.get(canonicalPersonId) ?? [];
    rows.push(claim);
    localClaimsByCanonical.set(canonicalPersonId, rows);
  }

  const rows = researchClaims.map((researchClaim) => {
    const acceptedTypes = claimTypesFor(researchClaim.category);
    const externalFinding = externalFindingByResearchId.get(researchClaim.researchId) ?? null;
    const localEvidence = (localClaimsByCanonical.get(researchClaim.canonicalPersonId) ?? [])
      .filter((claim) => acceptedTypes.has(claim.claim_type))
      .map((claim) => {
        const sourcePerson = sourcePersonById.get(claim.source_person_id);
        return {
          claimId: claim.id,
          claimType: claim.claim_type,
          claimValue: claim.claim_value,
          matchScore: Number(compareClaimToEvidence(researchClaim.text, claim.claim_value).toFixed(3)),
          tier: evidenceTier(claim, sourcePerson),
          reviewStatus: claim.review_status,
          visibility: claim.visibility,
          sourceType: sourcePerson?.source_type ?? null,
          sourceName: claim.source_name ?? sourcePerson?.source_name ?? null,
          sourceUrl: claim.source_url ?? sourcePerson?.source_url ?? null,
        };
      })
      .filter((item) => item.matchScore >= 0.45);
    const directHistoryRows = candidateHistoryByCanonical.get(researchClaim.canonicalPersonId) ?? [];
    const directElectionEvidence = derivedElectionEvidence(researchClaim, directHistoryRows);
    const occurrence = researchClaim.occurrences[0] ?? researchClaim.occurrence;
    const identityKey = candidateIdentityKey(
      researchClaim.personName,
      occurrence?.party,
      cityCodeForText(occurrence?.city),
    );
    const directEvidenceIsVerified = directElectionEvidence.some((item) => item.reviewStatus === 'verified');
    const inferredElectionEvidence = !directEvidenceIsVerified && identityKey
      ? derivedElectionEvidence(
        researchClaim,
        combinedCandidateHistory(
          directHistoryRows,
          candidateHistoryByIdentity.get(identityKey) ?? [],
        ),
      )
      : [];
    const evidence = uniqueBy([
      ...localEvidence,
      ...originalSourceEvidence(researchClaim),
      ...externalFindingEvidence(externalFinding, researchClaim),
      ...directElectionEvidence,
      ...inferredElectionEvidence,
    ], (item) => [item.claimType, item.claimValue, item.sourceUrl].join('|'))
      .sort((left, right) => (
        right.matchScore - left.matchScore
        || ['official', 'trusted_media', 'secondary', 'unknown'].indexOf(left.tier)
        - ['official', 'trusted_media', 'secondary', 'unknown'].indexOf(right.tier)
      ))
      .slice(0, 5);
    const status = researchStatus(researchClaim.category, evidence, externalFinding);
    const city = researchClaim.occurrences[0]?.city ?? '';
    return {
      ...researchClaim,
      status,
      searchQuery: `"${researchClaim.personName}" "${researchClaim.text}" ${city}`.trim(),
      localEvidence: evidence,
      externalResearch: externalFinding,
    };
  }).sort((left, right) => (
    ['涉案紀錄', '政治家族', '政治工作', '其他'].indexOf(left.category)
    - ['涉案紀錄', '政治家族', '政治工作', '其他'].indexOf(right.category)
    || left.personName.localeCompare(right.personName, 'zh-Hant')
    || left.text.localeCompare(right.text, 'zh-Hant')
  ));

  const statusCounts = Object.fromEntries(
    ['auto_reviewable', 'manual_review', 'external_search_needed', 'not_found_after_stop_loss'].map((status) => [
      status,
      rows.filter((row) => row.status === status).length,
    ]),
  );
  const categoryCounts = Object.fromEntries(categories.map((category) => [category, {
    people: new Set(rows.filter((row) => row.category === category).map((row) => row.canonicalPersonId)).size,
    claims: rows.filter((row) => row.category === category).length,
    autoReviewable: rows.filter((row) => row.category === category && row.status === 'auto_reviewable').length,
    manualReview: rows.filter((row) => row.category === category && row.status === 'manual_review').length,
    externalSearchNeeded: rows.filter((row) => row.category === category && row.status === 'external_search_needed').length,
    notFoundAfterStopLoss: rows.filter((row) => row.category === category && row.status === 'not_found_after_stop_loss').length,
  }]));
  const report = {
    generatedAt: new Date().toISOString(),
    databaseUrl: supabaseUrl,
    publicationStatus: 'internal_research_only',
    method: {
      description: 'Map every Dark Guide candidate to the local canonical person by election context, deduplicate repeated claims across years, and compare each claim with existing local evidence.',
      sourceTiers: {
        official: 'Government, election authority, legislature, council, or official party/person source.',
        trusted_media: 'Established news organization; always requires manual review for sensitive claims.',
        secondary: 'Public reference source such as VoteTW or Wikidata; requires review for sensitive claims.',
        unknown: 'Source type could not be established automatically.',
      },
      stopLoss: 'For unresolved claims, use one exact search query and inspect at most the two strongest relevant results. Do not retry protected sites, bypass access controls, or auto-approve same-name evidence without matching context.',
      autoReviewRule: 'Exact normalized containment match against a verified official local claim. Cross-ID election evidence inferred from exact name, party, and city remains manual review only. External findings and sensitive family/legal claims remain separately auditable.',
    },
    summary: {
      guideCandidateRows: guideRows.length,
      mappedGuideCandidateRows: guideMatches.size,
      mappingIssues: mappingIssues.length,
      candidateYearRowsWithData: guideRows.filter((guide) => categories.some((category) => (guide.sections?.[category] ?? []).length > 0)).length,
      uniqueCanonicalPeopleWithData: new Set(rows.map((row) => row.canonicalPersonId)).size,
      rawClaims: rawResearchClaims.length,
      deduplicatedClaims: rows.length,
      statusCounts,
      categoryCounts,
    },
    mappingIssues,
    claims: rows,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

  const csvHeaders = [
    'research_id', 'status', 'category', 'person_name', 'canonical_person_id', 'years', 'city',
    'claim_text', 'search_query', 'best_source_tier', 'best_source_name', 'best_source_url',
    'best_evidence_value', 'best_match_score', 'original_source_url', 'external_research_outcome', 'external_research_notes',
  ];
  const csvRows = rows.map((row) => {
    const best = row.localEvidence[0] ?? {};
    return [
      row.researchId,
      row.status,
      row.category,
      row.personName,
      row.canonicalPersonId,
      [...new Set(row.occurrences.map((item) => item.year))].sort().join('|'),
      row.occurrences[0]?.city,
      row.text,
      row.searchQuery,
      best.tier,
      best.sourceName,
      best.sourceUrl,
      best.claimValue,
      best.matchScore,
      row.originalSourceUrl,
      row.externalResearch?.outcome,
      row.externalResearch?.notes,
    ].map(csvCell).join(',');
  });
  fs.writeFileSync(csvOutputPath, `${[csvHeaders.map(csvCell).join(','), ...csvRows].join('\n')}\n`);

  const summary = `# 暗公報獨立來源查核進度（${new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })}）

## 範圍

- 2018、2022 暗公報候選人：${guideRows.length} 筆。
- 有任何暗公報敘述的候選人年度紀錄：${report.summary.candidateYearRowsWithData} 筆。
- 對應 canonical person：${report.summary.uniqueCanonicalPeopleWithData} 人。
- 原始敘述：${report.summary.rawClaims} 條；跨年份去重後：${report.summary.deduplicatedClaims} 條。
- 身分對應疑義：${report.summary.mappingIssues} 筆。

## 本機既有來源初篩

- 可自動審核候選：${statusCounts.auto_reviewable} 條。
- 已有相關證據、仍需人工審核：${statusCounts.manual_review} 條。
- 尚需外部搜尋：${statusCounts.external_search_needed} 條。
- 已依停損規則搜尋但未找到可靠來源：${statusCounts.not_found_after_stop_loss} 條。

| 類別 | 人數 | 敘述 | 可自動審核 | 需人工審核 | 需外部搜尋 | 停損未找到 |
|---|---:|---:|---:|---:|---:|---:|
${categories.map((category) => {
    const row = categoryCounts[category];
    return `| ${category} | ${row.people} | ${row.claims} | ${row.autoReviewable} | ${row.manualReview} | ${row.externalSearchNeeded} | ${row.notFoundAfterStopLoss} |`;
  }).join('\n')}

## 查核與停損規則

1. 官方選舉公報、政府、立法院、地方議會與政黨官方人物頁列為第一級來源。
2. 政治家族與涉案紀錄即使找到媒體報導，也必須保留人物身分與案件階段，不把「涉案」寫成「有罪」。
3. 外部搜尋每條使用一組精確查詢，最多檢查最相關的兩個結果；仍無可靠佐證即列為未找到，不反覆改寫查詢。
4. 同名、選區或年份對不上時不得自動審核；姓名、政黨與縣市完全一致的跨 ID 選舉紀錄僅列為身分推定，仍需人工審核。
5. 暗公報目前只作研究線索，不直接公開或寫入已驗證 claims。
`;
  fs.writeFileSync(summaryOutputPath, summary);
  console.log(JSON.stringify(report.summary, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  candidateIdentityKey,
  combinedCandidateHistory,
  compareClaimToEvidence,
  derivedElectionEvidence,
  evidenceTier,
  externalFindingEvidence,
  historicalSourceHistoryRow,
  normalizeText,
  originalSourceEvidence,
  researchStatus,
  stableOrderForTable,
};
