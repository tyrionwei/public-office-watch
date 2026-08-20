import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'person-profile-gap-targets.json');
const countyCityChiefOffices = new Set([
  '臺北市市長', '新北市市長', '桃園市市長', '臺中市市長', '臺南市市長', '高雄市市長',
  '基隆市市長', '新竹市市長', '嘉義市市長', '新竹縣縣長', '苗栗縣縣長', '彰化縣縣長',
  '南投縣縣長', '雲林縣縣長', '嘉義縣縣長', '屏東縣縣長', '宜蘭縣縣長', '花蓮縣縣長',
  '臺東縣縣長', '澎湖縣縣長', '金門縣縣長', '連江縣縣長',
]);

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
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY;

function parseArgs(argv) {
  const options = {
    outputPath: defaultOutputPath,
    limit: 500,
    includeResearchSignals: false,
    ongoingResearchOnly: false,
    excludeFirstTime2026: false,
    excludeAdministrativeCurrent: false,
    includeGrassrootsLast: false,
    includeFormer: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--output') {
      options.outputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--limit') {
      options.limit = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--include-research-signals') {
      options.includeResearchSignals = true;
      continue;
    }

    if (arg === '--ongoing-research-only') {
      options.ongoingResearchOnly = true;
      continue;
    }

    if (arg === '--exclude-first-time-2026') {
      options.excludeFirstTime2026 = true;
      continue;
    }

    if (arg === '--exclude-administrative-current') {
      options.excludeAdministrativeCurrent = true;
      continue;
    }

    if (arg === '--include-grassroots-last') {
      options.includeGrassrootsLast = true;
      continue;
    }

    if (arg === '--include-former') {
      options.includeFormer = true;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  if (!Number.isInteger(options.limit) || options.limit <= 0) {
    throw new Error('--limit must be a positive integer');
  }

  return options;
}

function restUrl(pathname) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`);
}

async function supabaseJson(url) {
  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`GET ${url.pathname} failed: ${body?.message ?? response.statusText}`);
  }

  return body;
}

async function fetchAllRows(viewName, select, pageSize = 1000, params = {}, order = null) {
  const rows = [];

  for (let offset = 0; ; offset += pageSize) {
    const url = restUrl(viewName);
    url.searchParams.set('select', select);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));
    if (order) url.searchParams.set('order', order);
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

function isBlank(value) {
  return value == null || String(value).trim() === '';
}

function profileGapPriority(missing) {
  return missing.includes('education') || missing.includes('experience') ? 0 : 1;
}

function isAdministrativeCurrentOfficial(person) {
  if (person.list_status !== 'current') return false;

  const text = String(person.current_office_label ?? person.position ?? '');
  if (text.includes('副市長') || text.includes('副縣長')) return true;
  if (countyCityChiefOffices.has(text)) return false;
  const electedOffice = /(總統|副總統|立法委員|議員|縣長|市長|鄉長|鎮長|代表|村長|里長)/;
  return text !== '' && !electedOffice.test(text);
}

function personRoleText(person) {
  return [person.current_office_label, person.position, person.district]
    .filter(Boolean)
    .join(' ');
}

function isCountyCityChief(text) {
  return [...countyCityChiefOffices].some((office) => String(text).includes(office));
}

function isGrassrootsPerson(person) {
  const text = personRoleText(person);
  if (/(總統|副總統|立法委員|議員|縣長|市長|鄉長|鎮長)/.test(text)) return false;
  if (/(區長|鄉民代表|鎮民代表|市民代表|鄉鎮市民代表|區民代表|村長|里長)/.test(text)) return true;
  return person.list_is_grassroots === true;
}

function priorityGroup(person, history) {
  if (isGrassrootsPerson(person)) {
    if (person.list_status === 'current') return 'grassroots_current';
    if (history.hasElectedHistory) return 'grassroots_former_elected';
    return 'grassroots_never_elected';
  }

  if (person.list_status === 'current' && !isAdministrativeCurrentOfficial(person)) {
    return 'current_elected_official';
  }

  if (person.list_status === 'candidate' && Number(person.election_year) === 2026 && history.years.length > 0) {
    return 'returning_candidate';
  }

  if (isAdministrativeCurrentOfficial(person)) {
    return 'administrative_current_official';
  }

  if (person.list_status === 'candidate' && Number(person.election_year) === 2026) {
    return 'first_time_2026_candidate';
  }

  if (person.list_status === 'candidate' || history.electionCount > 0) {
    return 'historical_candidate';
  }

  return 'other';
}

function priorityRank(group) {
  if (group === 'current_elected_official') return 0;
  if (group === 'returning_candidate') return 1;
  if (group === 'administrative_current_official') return 2;
  if (group === 'first_time_2026_candidate') return 3;
  if (group === 'historical_candidate') return 4;
  if (group === 'other') return 5;
  if (group === 'grassroots_current') return 6;
  if (group === 'grassroots_former_elected') return 7;
  return 8;
}

function processingPriority(person, history) {
  const text = personRoleText(person);
  const exactOffice = String(person.current_office_label ?? person.position ?? '');

  if (isGrassrootsPerson(person)) {
    if (person.list_status === 'current') return 5;
    if (history.hasElectedHistory) return 6;
    if (history.electionCount > 1) return 7;
    return 8;
  }

  if (/(總統|副總統)/.test(text)) return 0;
  if (/立法委員/.test(text) || countyCityChiefOffices.has(exactOffice) || isCountyCityChief(text)) return 1;
  if (/議員/.test(text)) return 2;
  if (/(鄉長|鎮長|市長)/.test(text)) return 3;
  return 4;
}

function claimTypesByPerson(claims) {
  const byPerson = new Map();

  for (const claim of claims) {
    const types = byPerson.get(claim.person_id) ?? new Set();
    types.add(claim.claim_type);
    byPerson.set(claim.person_id, types);
  }

  return byPerson;
}

function missingSignals(person, publicClaimTypes, includeResearchSignals = false) {
  const claimTypes = publicClaimTypes.get(person.person_id) ?? new Set();
  const missing = [];

  if (isBlank(person.gender) || person.gender === 'unknown') {
    if (!claimTypes.has('gender')) missing.push('gender');
  }

  if (!claimTypes.has('birth_date')) {
    missing.push('birth_date');
  }

  if (!claimTypes.has('external_id')) {
    missing.push('external_id');
  }

  if (isBlank(person.education) && !claimTypes.has('education')) {
    missing.push('education');
  }

  if (isBlank(person.experience) && !claimTypes.has('experience')) {
    missing.push('experience');
  }
  if (includeResearchSignals && !claimTypes.has('family_relation')) {
    missing.push('family_relation');
  }
  return missing;
}

function recurringResearchSignals(includeResearchSignals) {
  return includeResearchSignals ? ['experience', 'party_affiliation', 'legal_case'] : [];
}

function ongoingResearchSignals(ongoingResearchOnly) {
  return ongoingResearchOnly ? ['family_relation', 'party_affiliation', 'legal_case'] : [];
}

function targetFromPerson(person, missing, researchSignals, group, history) {
  return {
    personId: person.person_id,
    name: person.name,
    gender: person.gender ?? 'unknown',
    party: person.party ?? '',
    position: person.position ?? '',
    currentOfficeLabel: person.current_office_label ?? '',
    listStatus: person.list_status,
    electionYear: person.election_year,
    district: person.district ?? '',
    education: person.education ?? '',
    experience: person.experience ?? '',
    priorityGroup: group,
    processingPriority: processingPriority(person, history),
    priorElectionYears: history.years,
    hasElectedHistory: history.hasElectedHistory,
    electionCount: history.electionCount,
    missingSignals: missing,
    researchSignals,
  };
}

function postgrestIn(values) {
  return `in.(${values.map((value) => `"${String(value)}"`).join(',')})`;
}

async function fetchClaimsForPeople(people) {
  const claims = [];
  const personIds = people.map((person) => person.person_id);
  const personIdSet = new Set(personIds);

  if (personIds.length > 5000) {
    const allClaims = await fetchAllRows('public_person_claims', 'claim_id,person_id,claim_type', 1000, {
      claim_type: 'in.(gender,birth_date,external_id,education,experience,family_relation,legal_case)',
    });
    return allClaims.filter((claim) => personIdSet.has(claim.person_id));
  }

  for (let index = 0; index < personIds.length; index += 50) {
    claims.push(...await fetchAllRows('public_person_claims', 'claim_id,person_id,claim_type', 1000, {
      person_id: postgrestIn(personIds.slice(index, index + 50)),
      claim_type: 'in.(gender,birth_date,external_id,education,experience,family_relation,legal_case)',
    }));
  }

  return claims;
}

async function fetchCandidateHistoryForPeople(people) {
  const personIds = people.map((person) => person.person_id);
  const personIdSet = new Set(personIds);
  const candidates = personIds.length > 5000
    ? (await fetchAllRows('public_candidates', 'person_id,election_year,election_result'))
      .filter((candidate) => personIdSet.has(candidate.person_id))
    : [];

  if (personIds.length <= 5000) {
    for (let index = 0; index < personIds.length; index += 50) {
      candidates.push(...await fetchAllRows('public_candidates', 'person_id,election_year,election_result', 1000, {
        person_id: postgrestIn(personIds.slice(index, index + 50)),
      }));
    }
  }

  const historyByPerson = new Map();
  for (const candidate of candidates) {
    const year = Number(candidate.election_year);
    const history = historyByPerson.get(candidate.person_id) ?? {
      years: new Set(),
      hasElectedHistory: false,
      electionCount: 0,
      latestElectionYear: null,
    };
    history.electionCount += 1;
    if (candidate.election_result === 'elected') history.hasElectedHistory = true;
    if (Number.isFinite(year)) {
      if (year < 2026) history.years.add(year);
      history.latestElectionYear = Math.max(history.latestElectionYear ?? year, year);
    }
    historyByPerson.set(candidate.person_id, history);
  }

  return new Map(
    [...historyByPerson].map(([personId, history]) => [personId, {
      ...history,
      years: [...history.years].sort((left, right) => right - left),
    }]),
  );
}

function emptyCandidateHistory() {
  return { years: [], hasElectedHistory: false, electionCount: 0, latestElectionYear: null };
}

function effectiveElectionYear(person, history) {
  const personYear = Number(person.election_year);
  return history.latestElectionYear ?? (Number.isFinite(personYear) ? personYear : 0);
}

async function main() {
  if (!serviceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for target generation.');
  }

  const options = parseArgs(process.argv.slice(2));
  const peopleFilters = {
    list_status: options.includeFormer ? 'in.(current,candidate,former)' : 'in.(current,candidate)',
  };
  if (!options.includeGrassrootsLast) peopleFilters.list_is_grassroots = 'eq.false';
  const people = await fetchAllRows(
    'public_people_directory',
    'person_id,name,gender,party,position,current_office_label,district,education,experience,list_status,list_is_grassroots,election_year',
    1000,
    peopleFilters,
    'person_id.asc',
  );
  const [publicClaims, candidateHistories] = await Promise.all([
    fetchClaimsForPeople(people),
    fetchCandidateHistoryForPeople(people),
  ]);
  const publicClaimTypes = claimTypesByPerson(publicClaims);
  const targets = people
    .map((person) => {
      const missing = options.ongoingResearchOnly
        ? []
        : missingSignals(person, publicClaimTypes, options.includeResearchSignals);
      const researchSignals = options.ongoingResearchOnly
        ? ongoingResearchSignals(true)
        : recurringResearchSignals(options.includeResearchSignals);
      const history = candidateHistories.get(person.person_id) ?? emptyCandidateHistory();
      return {
        person,
        missing,
        researchSignals,
        history,
        group: priorityGroup(person, history),
      };
    })
    .filter(({ missing, researchSignals }) => missing.length > 0 || researchSignals.length > 0)
    .filter(({ group }) => !options.excludeFirstTime2026 || group !== 'first_time_2026_candidate')
    .filter(({ group }) => !options.excludeAdministrativeCurrent || group !== 'administrative_current_official')
    .sort((left, right) =>
      processingPriority(left.person, left.history) - processingPriority(right.person, right.history) ||
      effectiveElectionYear(right.person, right.history) - effectiveElectionYear(left.person, left.history) ||
      priorityRank(left.group) - priorityRank(right.group) ||
      profileGapPriority(left.missing) - profileGapPriority(right.missing) ||
      right.missing.length - left.missing.length ||
      left.person.name.localeCompare(right.person.name, 'zh-Hant-TW'),
    )
    .slice(0, options.limit)
    .map(({ person, missing, researchSignals, group, history }) => targetFromPerson(person, missing, researchSignals, group, history));

  const output = {
    schemaVersion: 1,
    name: 'person-profile-gap-targets',
    generatedAt: new Date().toISOString(),
    targetCount: targets.length,
    targets,
  };

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(output, null, 2)}\n`);

  console.log(JSON.stringify({
    status: 'written',
    outputPath: options.outputPath,
    targetCount: targets.length,
    firstTargets: targets.slice(0, 10).map((target) => ({
      name: target.name,
      position: target.position,
      currentOfficeLabel: target.currentOfficeLabel,
      priorityGroup: target.priorityGroup,
      priorElectionYears: target.priorElectionYears,
      missingSignals: target.missingSignals,
      researchSignals: target.researchSignals,
    })),
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`person enrichment target generation failed: ${message}`);
    process.exit(1);
  });
}

export {
  isAdministrativeCurrentOfficial,
  isGrassrootsPerson,
  missingSignals,
  parseArgs,
  processingPriority,
  priorityGroup,
  priorityRank,
  recurringResearchSignals,
  ongoingResearchSignals,
};
