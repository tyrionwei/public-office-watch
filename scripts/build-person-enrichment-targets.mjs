import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const anonKey =
  process.env.SUPABASE_ANON_KEY?.trim() ||
  localEnv.SUPABASE_ANON_KEY ||
  (supabaseUrl.startsWith('http://127.0.0.1:54321') ? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' : '');

function parseArgs(argv) {
  const options = {
    outputPath: defaultOutputPath,
    limit: 500,
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
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
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
  const electedOffice = /(總統|副總統|立法委員|議員|縣長|市長|鄉長|鎮長|代表|村長|里長)/;
  return text !== '' && !electedOffice.test(text);
}

function priorityGroup(person, priorElectionYears) {
  if (person.list_status === 'current' && !isAdministrativeCurrentOfficial(person)) {
    return 'current_elected_official';
  }

  if (person.list_status === 'candidate' && Number(person.election_year) === 2026 && priorElectionYears.length > 0) {
    return 'returning_candidate';
  }

  if (isAdministrativeCurrentOfficial(person)) {
    return 'administrative_current_official';
  }

  if (person.list_status === 'candidate' && Number(person.election_year) === 2026) {
    return 'first_time_2026_candidate';
  }

  if (person.list_status === 'candidate') {
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
  return 5;
}

function rolePriority(person) {
  const text = String(person.current_office_label ?? person.position ?? '');
  if (countyCityChiefOffices.has(text)) return 0;
  if (text.includes('議員') && !text.includes('立法委員')) return 1;
  if (text.includes('總統') || text.includes('副總統')) return 2;
  if (text.includes('立法委員')) return 3;
  if (/(縣長|市長)$/.test(text)) return 4;
  return 5;
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

function missingSignals(person, publicClaimTypes) {
  const claimTypes = publicClaimTypes.get(person.person_id) ?? new Set();
  const missing = [];

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

  return missing;
}

function targetFromPerson(person, missing, group, priorElectionYears) {
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
    priorElectionYears,
    missingSignals: missing,
  };
}

function postgrestIn(values) {
  return `in.(${values.map((value) => `"${String(value)}"`).join(',')})`;
}

async function fetchClaimsForPeople(people) {
  const claims = [];
  const personIds = people.map((person) => person.person_id);

  for (let index = 0; index < personIds.length; index += 20) {
    claims.push(...await fetchAllRows('public_person_claims', 'claim_id,person_id,claim_type', 1000, {
      person_id: postgrestIn(personIds.slice(index, index + 20)),
      claim_type: 'in.(birth_date,external_id,education,experience)',
    }));
  }

  return claims;
}

async function fetchCandidateHistoryForPeople(people) {
  const candidates = [];
  const personIds = people.map((person) => person.person_id);

  for (let index = 0; index < personIds.length; index += 20) {
    candidates.push(...await fetchAllRows('public_candidates', 'person_id,election_year', 1000, {
      person_id: postgrestIn(personIds.slice(index, index + 20)),
    }));
  }

  const yearsByPerson = new Map();
  for (const candidate of candidates) {
    const year = Number(candidate.election_year);
    if (!Number.isFinite(year) || year >= 2026) continue;

    const years = yearsByPerson.get(candidate.person_id) ?? new Set();
    years.add(year);
    yearsByPerson.set(candidate.person_id, years);
  }

  return new Map(
    [...yearsByPerson].map(([personId, years]) => [personId, [...years].sort((left, right) => right - left)]),
  );
}

async function main() {
  if (!anonKey) {
    throw new Error('Set SUPABASE_ANON_KEY for target generation.');
  }

  const options = parseArgs(process.argv.slice(2));
  const people = await fetchAllRows(
    'public_people_directory',
    'person_id,name,gender,party,position,current_office_label,district,education,experience,list_status,election_year',
    1000,
    {
      list_status: 'in.(current,candidate)',
      list_is_grassroots: 'eq.false',
    },
    'person_id.asc',
  );
  const [publicClaims, candidateHistoryYears] = await Promise.all([
    fetchClaimsForPeople(people),
    fetchCandidateHistoryForPeople(people),
  ]);
  const publicClaimTypes = claimTypesByPerson(publicClaims);
  const targets = people
    .map((person) => {
      const missing = missingSignals(person, publicClaimTypes);
      const priorElectionYears = candidateHistoryYears.get(person.person_id) ?? [];
      return {
        person,
        missing,
        priorElectionYears,
        group: priorityGroup(person, priorElectionYears),
      };
    })
    .filter(({ missing }) => missing.includes('birth_date') || missing.includes('education') || missing.includes('experience'))
    .sort((left, right) =>
      priorityRank(left.group) - priorityRank(right.group) ||
      profileGapPriority(left.missing) - profileGapPriority(right.missing) ||
      rolePriority(left.person) - rolePriority(right.person) ||
      right.missing.length - left.missing.length ||
      left.person.name.localeCompare(right.person.name, 'zh-Hant-TW'),
    )
    .slice(0, options.limit)
    .map(({ person, missing, group, priorElectionYears }) => targetFromPerson(person, missing, group, priorElectionYears));

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
    })),
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`person enrichment target generation failed: ${message}`);
  process.exit(1);
});
