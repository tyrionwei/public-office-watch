import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'official-person-profile-claims.seed.json');
const lySourceId = 'ly-current-legislators';
const lySourceName = '立法院開放資料：歷屆委員資料';
const lySourceUrl = 'https://data.ly.gov.tw/getds.action?id=16';
const lyDownloadBaseUrl = 'https://data.ly.gov.tw/odw/ID16Action.action?name=&sex=&party=&partyGroup=&areaName=&fileType=json';

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
    terms: Array.from({ length: 11 }, (_, index) => index + 1),
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--output') {
      options.outputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--terms') {
      options.terms = String(argv[index + 1] ?? '')
        .split(',')
        .map((term) => Number.parseInt(term.trim(), 10))
        .filter((term) => Number.isInteger(term) && term > 0);
      index += 1;
      continue;
    }

    if (arg === '--write') {
      options.write = true;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  if (options.terms.length === 0) {
    throw new Error('--terms must include at least one positive integer');
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

function normalizeGender(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === '1' || text === '男' || text === 'male') return 'male';
  if (text === '2' || text === '女' || text === 'female') return 'female';
  return 'unknown';
}

function cleanProfileText(value) {
  return String(value ?? '')
    .split(/[;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join('；');
}

function pickField(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') {
      return String(row[name]).trim();
    }
  }

  return '';
}

function parseJsonPayload(content) {
  const startIndex = content.indexOf('{');
  const endIndex = content.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('No JSON object was found in response payload.');
  }

  return JSON.parse(content.slice(startIndex, endIndex + 1));
}

function getLegislatorCodeFromPhotoUrl(picUrl) {
  const match = String(picUrl ?? '').match(/\/(\d+)\.[a-z]+$/i);
  return match?.[1] ?? '';
}

function lyExternalId(row) {
  const term = pickField(row, ['term']) || '11';
  const name = pickField(row, ['name']);
  const party = pickField(row, ['partyGroup', 'party']);
  const areaName = pickField(row, ['areaName']);
  const onboardDate = pickField(row, ['onboardDate']);
  const legislatorCode = getLegislatorCodeFromPhotoUrl(pickField(row, ['picUrl']));
  return `ly-legislator-${term}-${legislatorCode || hashId([name, party, areaName, onboardDate].join('|'))}`;
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

async function fetchAllRows(viewName, select, pageSize = 1000) {
  const rows = [];

  for (let offset = 0; ; offset += pageSize) {
    const url = restUrl(viewName);
    url.searchParams.set('select', select);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));

    const page = await supabaseJson(url);
    rows.push(...page);

    if (page.length < pageSize) {
      return rows;
    }
  }
}

async function fetchLyTerm(term) {
  const url = `${lyDownloadBaseUrl}&term=${term}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`LY term ${term} failed: ${response.status} ${response.statusText}`);
  }

  const payload = parseJsonPayload(text);
  return Array.isArray(payload.dataList) ? payload.dataList : [];
}

function personIndexes(publicPeople, publicExternalIdClaims) {
  const peopleById = new Map(publicPeople.map((person) => [person.person_id, person]));
  const externalIdToPerson = new Map();
  const peopleByName = new Map();

  for (const claim of publicExternalIdClaims) {
    if (claim.claim_type !== 'external_id' || typeof claim.claim_value !== 'string') {
      continue;
    }

    const person = peopleById.get(claim.person_id);
    if (person) {
      externalIdToPerson.set(claim.claim_value, person);
    }
  }

  for (const person of publicPeople) {
    const key = normalizeIdentityText(person.name);
    const group = peopleByName.get(key) ?? [];
    group.push(person);
    peopleByName.set(key, group);
  }

  return { externalIdToPerson, peopleByName };
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

function scoreNameMatch(row, person) {
  let score = 50;
  const reasons = ['normalized name matched'];
  const rowGender = normalizeGender(pickField(row, ['sex']));
  const rowParty = pickField(row, ['partyGroup', 'party']);
  const rowArea = pickField(row, ['areaName']);

  if (rowGender !== 'unknown' && person.gender === rowGender) {
    score += 20;
    reasons.push('gender matched');
  } else if (rowGender !== 'unknown' && person.gender && person.gender !== 'unknown') {
    score -= 30;
    reasons.push('gender mismatched');
  }

  if (overlap(rowParty, person.party)) {
    score += 15;
    reasons.push('party matched');
  }

  if (overlap(rowArea, person.district)) {
    score += 15;
    reasons.push('district matched');
  }

  if (String(person.position ?? '').includes('立法委員')) {
    score += 10;
    reasons.push('legislator position hint matched');
  }

  return { score, reasons };
}

function matchPerson(row, indexes) {
  const externalId = lyExternalId(row);
  const externalIdPerson = indexes.externalIdToPerson.get(externalId);

  if (externalIdPerson) {
    return {
      person: externalIdPerson,
      method: 'official_external_id',
      score: 100,
      reasons: ['LY external_id matched public claim'],
    };
  }

  const candidates = indexes.peopleByName.get(normalizeIdentityText(pickField(row, ['name']))) ?? [];
  const scored = candidates
    .map((person) => ({ person, ...scoreNameMatch(row, person) }))
    .sort((left, right) => right.score - left.score);
  const best = scored[0] ?? null;
  const second = scored[1] ?? null;

  if (!best || best.score < 75 || (second && best.score - second.score < 15)) {
    return null;
  }

  return {
    ...best,
    method: 'unique_name_profile_match',
  };
}

function claimRecord({ row, person, match, claimType, claimValue }) {
  const term = pickField(row, ['term']) || '11';
  const externalId = lyExternalId(row);
  const claimKey = `official-profile:${lySourceId}:${externalId}:${person.person_id}:${claimType}`;

  return {
    claimKey,
    personId: person.person_id,
    personName: person.name,
    claimType,
    claimValue,
    claimJson: {
      value: claimValue,
      officialExternalId: externalId,
      term,
      sourcePersonKey: `${lySourceId}:${externalId}`,
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
    sourceId: lySourceId,
    sourceName: lySourceName,
    sourceUrl: lySourceUrl,
  };
}

async function main() {
  if (!anonKey) {
    throw new Error('Set SUPABASE_ANON_KEY for official person profile enrichment.');
  }

  const options = parseArgs(process.argv.slice(2));
  const [publicPeople, publicExternalIdClaims] = await Promise.all([
    fetchAllRows('public_people', 'person_id,name,gender,party,position,district,education,experience'),
    fetchAllRows('public_person_claims', 'person_id,claim_type,claim_value,source_name'),
  ]);
  const indexes = personIndexes(publicPeople, publicExternalIdClaims);
  const personClaims = [];
  const summary = {
    terms: options.terms,
    lyRows: 0,
    matchedRows: 0,
    unmatchedRows: 0,
    claims: 0,
    educationClaims: 0,
    experienceClaims: 0,
  };

  for (const term of options.terms) {
    const rows = await fetchLyTerm(term);
    summary.lyRows += rows.length;

    for (const row of rows) {
      const match = matchPerson(row, indexes);

      if (!match) {
        summary.unmatchedRows += 1;
        continue;
      }

      summary.matchedRows += 1;

      const education = cleanProfileText(pickField(row, ['degree']));
      const experience = cleanProfileText(pickField(row, ['experience']));

      if (education) {
        personClaims.push(claimRecord({ row, person: match.person, match, claimType: 'education', claimValue: education }));
        summary.educationClaims += 1;
      }

      if (experience) {
        personClaims.push(claimRecord({ row, person: match.person, match, claimType: 'experience', claimValue: experience }));
        summary.experienceClaims += 1;
      }
    }
  }

  summary.claims = personClaims.length;

  const output = {
    schemaVersion: 1,
    name: 'official-person-profile-claims',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: 'Official structured education and experience claims. Official sources are preferred over Wiki/Wikidata fallback claims.',
    source: {
      id: lySourceId,
      name: lySourceName,
      url: lySourceUrl,
    },
    summary,
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

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`official person profile enrichment failed: ${message}`);
  process.exit(1);
});
