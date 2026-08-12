import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchWithTrustedTwcaChain } from './trusted-official-fetch.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'cec-2024-person-profile-claims.seed.json');
const cecBaseUrl = 'https://2024.cec.gov.tw/data/json';
const cecSourceId = 'cec-2024-candidate-json';
const cecSourceName = '中央選舉委員會 2024 選舉專區：候選人 JSON';
const cecSourceUrl = 'https://2024.cec.gov.tw/';

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');

  if (!fs.existsSync(envPath)) {
    return {};
  }

  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        const key = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : line;
        const value = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '') : '';
        return [key, value];
      }),
  );
}

const localEnv = readLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey =
  process.env.SUPABASE_ANON_KEY?.trim() ||
  localEnv.SUPABASE_ANON_KEY ||
  (supabaseUrl.startsWith('http://127.0.0.1:54321') ? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' : '');

function parseArgs(argv) {
  const options = {
    outputPath: defaultOutputPath,
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--output') {
      options.outputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--write') {
      options.write = true;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  return options;
}

function hashId(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 12);
}

function normalizeIdentityText(value) {
  return String(value ?? '')
    .trim()
    .replace(/[臺]/g, '台')
    .replace(/[‧·．・･•]/g, '')
    .replace(/[\s\u00A0\u3000]+/g, '')
    .toLowerCase();
}

function normalizePartyName(value) {
  const text = String(value ?? '').trim().replace(/[臺]/g, '台');
  if (!text || text === '無') return '無黨籍';
  return text;
}

function normalizeGender(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === '1' || text === '男' || text === 'male') return 'male';
  if (text === '2' || text === '女' || text === 'female') return 'female';
  return 'unknown';
}

function parseRocDate(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{2,3})(\d{2})(\d{2})$/);

  if (!match) {
    return '';
  }

  const year = Number.parseInt(match[1], 10) + 1911;
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return '';
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function httpsGetText(url) {
  const response = await fetchWithTrustedTwcaChain(url, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'public-office-watch data fetcher',
    },
  });

  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status}`);
  }

  return response.text();
}

async function fetchOfficialJson(pathname, rawSources) {
  const url = `${cecBaseUrl}${pathname}`;
  const text = await httpsGetText(url);
  rawSources.push({
    url,
    sha256: crypto.createHash('sha256').update(text).digest('hex'),
    bytes: Buffer.byteLength(text),
  });
  return JSON.parse(text);
}

function restUrl(pathname) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`);
}

async function supabaseJson(url) {
  const response = await fetch(url, {
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      'accept-profile': 'published',
    },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`GET ${url.pathname} failed: ${body?.message ?? response.statusText}`);
  }

  return body;
}

async function fetchAllRows(viewName, select, pageSize = 1000, params = {}) {
  const rows = [];

  for (let offset = 0; ; offset += pageSize) {
    const url = restUrl(viewName);
    url.searchParams.set('select', select);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const page = await supabaseJson(url);
    rows.push(...page);

    if (page.length < pageSize) {
      return rows;
    }
  }
}

function officialKey(row) {
  return [
    cecSourceId,
    row.typeCode,
    row.areaName,
    row.party,
    row.candNo,
    row.candType,
    row.name,
    row.birthRaw,
  ].join(':');
}

function officialSourceUrl(row) {
  return `${cecBaseUrl}${row.sourcePath}`;
}

function flattenPresidentCandidates(payload) {
  return (payload.P1 ?? []).flatMap((group) =>
    (group.cands ?? []).map((candidate) => ({
      typeCode: 'P1',
      electionName: '第16任總統副總統選舉',
      raceTitle: '總統副總統全國選舉',
      areaName: '全國',
      candNo: String(candidate.candNo ?? group.candNo ?? ''),
      candType: candidate.candType ?? '',
      name: candidate.name ?? '',
      party: normalizePartyName(candidate.party),
      gender: normalizeGender(candidate.gender),
      birthDate: parseRocDate(candidate.birth),
      birthRaw: candidate.birth ?? '',
      home: candidate.home ?? '',
      sourcePath: '/cand/P1/00000.json',
    })),
  );
}

function flattenLegislatorDistrictCandidates(payload, prvCityCode) {
  return (payload.L1 ?? []).flatMap((area) =>
    (area.cands ?? []).map((candidate) => ({
      typeCode: 'L1',
      electionName: '第11屆立法委員選舉',
      raceTitle: `${area.areaName}立法委員選舉`,
      areaName: area.areaName ?? '',
      candNo: String(candidate.candNo ?? ''),
      candType: candidate.type ?? 'L1',
      name: candidate.name ?? '',
      party: normalizePartyName(candidate.party),
      gender: normalizeGender(candidate.gender),
      birthDate: parseRocDate(candidate.birth),
      birthRaw: candidate.birth ?? '',
      home: candidate.home ?? '',
      sourcePath: `/cand/L1/${prvCityCode}.json`,
    })),
  );
}

function flattenIndigenousCandidates(payload, typeCode, raceTitle, sourcePath) {
  return (payload[typeCode] ?? []).map((candidate) => ({
    typeCode,
    electionName: '第11屆立法委員選舉',
    raceTitle,
    areaName: candidate.area ?? '全國',
    candNo: String(candidate.candNo ?? ''),
    candType: candidate.type ?? typeCode,
    name: candidate.name ?? '',
    party: normalizePartyName(candidate.party),
    gender: normalizeGender(candidate.gender),
    birthDate: parseRocDate(candidate.birth),
    birthRaw: candidate.birth ?? '',
    home: candidate.home ?? '',
    sourcePath,
  }));
}

function flattenPartyListCandidates(payload) {
  return (payload.L4 ?? []).flatMap((party) =>
    (party.cands ?? []).map((candidate) => ({
      typeCode: 'L4',
      electionName: '第11屆立法委員選舉',
      raceTitle: '全國不分區及僑居國外國民立法委員選舉',
      areaName: '全國不分區',
      candNo: String(candidate.candNo ?? ''),
      candType: 'L4',
      name: candidate.name ?? '',
      party: normalizePartyName(party.partyName),
      gender: normalizeGender(candidate.gender),
      birthDate: parseRocDate(candidate.birth),
      birthRaw: candidate.birth ?? '',
      home: candidate.home ?? '',
      sourcePath: '/cand/L4/00000.json',
    })),
  );
}

function overlap(left, right) {
  const normalizedLeft = normalizeIdentityText(left);
  const normalizedRight = normalizeIdentityText(right);

  return Boolean(
    normalizedLeft &&
    normalizedRight &&
    (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)),
  );
}

function scoreMatch(row, candidate) {
  let score = 0;
  const reasons = [];

  if (normalizeIdentityText(row.name) === normalizeIdentityText(candidate.person_name)) {
    score += 50;
    reasons.push('name matched');
  }

  if (String(row.candNo) && String(row.candNo) === String(candidate.candidate_no ?? '')) {
    score += 20;
    reasons.push('candidate number matched');
  }

  if (overlap(row.party, candidate.party ?? candidate.person_party)) {
    score += 15;
    reasons.push('party matched');
  }

  if (overlap(row.raceTitle, candidate.race_title)) {
    score += 20;
    reasons.push('race title matched');
  }

  if (overlap(row.electionName, candidate.election_name)) {
    score += 10;
    reasons.push('election matched');
  } else if (candidate.election_name) {
    score -= 40;
    reasons.push('election mismatched');
  }

  if (
    row.typeCode.startsWith('L') &&
    String(candidate.election_name ?? '').includes('第11屆立法委員選舉')
  ) {
    score += 15;
    reasons.push('legislative election type matched');
  }

  if (
    row.typeCode === 'P1' &&
    String(candidate.election_name ?? '').includes('第16任總統副總統選舉')
  ) {
    score += 15;
    reasons.push('presidential election type matched');
  }

  return { score, reasons };
}

export function matchCandidate(row, candidatesByName) {
  const candidates = candidatesByName.get(normalizeIdentityText(row.name)) ?? [];
  const scored = candidates
    .map((candidate) => ({ candidate, ...scoreMatch(row, candidate) }))
    .sort((left, right) => right.score - left.score);
  const best = scored[0] ?? null;
  const second = scored[1] ?? null;

  if (!best || best.score < 75 || (second && best.score - second.score < 15)) {
    return null;
  }

  const hasSpecificDiscriminator = best.reasons.some((reason) =>
    ['candidate number matched', 'party matched', 'race title matched'].includes(reason));
  if (!hasSpecificDiscriminator) {
    return null;
  }

  return {
    person: best.candidate,
    method: 'official_candidate_json_match',
    score: best.score,
    reasons: best.reasons,
  };
}

function claimRecord({ row, match, claimType, claimValue }) {
  const sourcePersonKey = officialKey(row);
  const claimKey = `official-profile:${cecSourceId}:${hashId(sourcePersonKey)}:${match.person.person_id}:${claimType}`;

  return {
    claimKey,
    personId: match.person.person_id,
    personName: match.person.person_name,
    claimType,
    claimValue,
    claimJson: {
      value: claimValue,
      officialExternalId: sourcePersonKey,
      sourcePersonKey,
      electionName: row.electionName,
      raceTitle: row.raceTitle,
      candidateNo: row.candNo,
      party: row.party,
      home: row.home,
      rawBirth: row.birthRaw,
      identityMatch: {
        status: 'matched',
        method: match.method,
        score: match.score,
        reasons: match.reasons,
      },
    },
    confidenceLevel: 'A',
    reviewStatus: 'verified',
    visibility: 'public',
    sourceId: cecSourceId,
    sourceName: cecSourceName,
    sourceUrl: officialSourceUrl(row),
  };
}

async function fetchOfficialCandidateRows(rawSources) {
  const dist = await fetchOfficialJson('/dist/prvCityDept.json', rawSources);
  const rows = [];

  rows.push(...flattenPresidentCandidates(await fetchOfficialJson('/cand/P1/00000.json', rawSources)));

  for (const prv of dist.prvs ?? []) {
    rows.push(
      ...flattenLegislatorDistrictCandidates(
        await fetchOfficialJson(`/cand/L1/${prv.prvCityCode}.json`, rawSources),
        prv.prvCityCode,
      ),
    );
  }

  rows.push(
    ...flattenIndigenousCandidates(
      await fetchOfficialJson('/cand/L2/00000.json', rawSources),
      'L2',
      '平地原住民立法委員選舉',
      '/cand/L2/00000.json',
    ),
  );
  rows.push(
    ...flattenIndigenousCandidates(
      await fetchOfficialJson('/cand/L3/00000.json', rawSources),
      'L3',
      '山地原住民立法委員選舉',
      '/cand/L3/00000.json',
    ),
  );
  rows.push(...flattenPartyListCandidates(await fetchOfficialJson('/cand/L4/00000.json', rawSources)));

  return rows.filter((row) => row.name && row.party);
}

function candidatesByName(candidates) {
  const byName = new Map();

  for (const candidate of candidates) {
    const key = normalizeIdentityText(candidate.person_name);
    const group = byName.get(key) ?? [];
    group.push(candidate);
    byName.set(key, group);
  }

  return byName;
}

function addCurrentLegislatorFallbacks(candidates, currentLegislators) {
  const candidatePersonIds = new Set(
    candidates
      .filter((candidate) => String(candidate.election_name ?? '').includes('第11屆立法委員選舉'))
      .map((candidate) => candidate.person_id),
  );
  const fallbacks = currentLegislators
    .filter((person) => !candidatePersonIds.has(person.person_id))
    .map((person) => ({
      person_id: person.person_id,
      person_name: person.name,
      person_party: person.party,
      person_position: person.position,
      race_title: person.district,
      election_name: '第11屆立法委員選舉',
      region_name: '',
      party: person.party,
      candidate_no: '',
    }));

  return [...candidates, ...fallbacks];
}

async function main() {
  if (!anonKey) {
    throw new Error('Set SUPABASE_ANON_KEY for CEC 2024 person profile enrichment.');
  }

  const options = parseArgs(process.argv.slice(2));
  const rawSources = [];
  const [officialRows, publicCandidates, currentLegislators] = await Promise.all([
    fetchOfficialCandidateRows(rawSources),
    fetchAllRows(
      'candidates',
      'person_id,person_name,person_party,person_position,race_title,election_name,region_name,party,candidate_no',
    ),
    fetchAllRows(
      'people_directory',
      'person_id,name,party,position,current_office_label,district,list_status,election_year',
      1000,
      {
        list_status: 'eq.current',
        current_office_label: 'eq.第11屆立法委員',
      },
    ),
  ]);
  const index = candidatesByName(addCurrentLegislatorFallbacks(publicCandidates, currentLegislators));
  const personClaims = [];
  const unmatchedRows = [];
  const summary = {
    officialRows: officialRows.length,
    matchedRows: 0,
    unmatchedRows: 0,
    claims: 0,
    externalIdClaims: 0,
    birthDateClaims: 0,
    genderClaims: 0,
    rawSourceCount: rawSources.length,
  };

  for (const row of officialRows) {
    const match = matchCandidate(row, index);

    if (!match) {
      summary.unmatchedRows += 1;
      unmatchedRows.push({
        name: row.name,
        party: row.party,
        raceTitle: row.raceTitle,
        candidateNo: row.candNo,
      });
      continue;
    }

    summary.matchedRows += 1;

    personClaims.push(claimRecord({ row, match, claimType: 'external_id', claimValue: officialKey(row) }));
    summary.externalIdClaims += 1;

    if (row.birthDate) {
      personClaims.push(claimRecord({ row, match, claimType: 'birth_date', claimValue: row.birthDate }));
      summary.birthDateClaims += 1;
    }

    if (row.gender !== 'unknown') {
      personClaims.push(claimRecord({ row, match, claimType: 'gender', claimValue: row.gender }));
      summary.genderClaims += 1;
    }
  }

  summary.claims = personClaims.length;

  const output = {
    schemaVersion: 1,
    name: 'cec-2024-person-profile-claims',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: 'Official CEC 2024 candidate JSON claims. This source currently provides birth date and gender, not education or experience.',
    source: {
      id: cecSourceId,
      name: cecSourceName,
      url: cecSourceUrl,
      baseUrl: cecBaseUrl,
    },
    summary,
    rawSources,
    unmatchedRows: unmatchedRows.slice(0, 50),
    personClaims,
  };

  if (options.write) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, `${JSON.stringify(output, null, 2)}\n`);
  }

  console.log(JSON.stringify({
    status: options.write ? 'written' : 'dry-run',
    outputPath: options.outputPath,
    summary,
  }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`CEC 2024 person profile enrichment failed: ${message}`);
    process.exit(1);
  });
}
