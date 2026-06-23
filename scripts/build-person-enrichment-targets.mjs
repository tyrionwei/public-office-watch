import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'person-profile-gap-targets.json');

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

function isBlank(value) {
  return value == null || String(value).trim() === '';
}

function rolePriority(position) {
  const text = String(position ?? '');
  if (text.includes('總統') || text.includes('副總統')) return 0;
  if (text.includes('立法委員')) return 1;
  if (text.includes('縣長') || text.includes('市長')) return 2;
  if (text.includes('議員')) return 3;
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

function targetFromPerson(person, missing) {
  return {
    personId: person.person_id,
    name: person.name,
    gender: person.gender ?? 'unknown',
    party: person.party ?? '',
    position: person.position ?? '',
    district: person.district ?? '',
    education: person.education ?? '',
    experience: person.experience ?? '',
    missingSignals: missing,
  };
}

async function main() {
  if (!anonKey) {
    throw new Error('Set SUPABASE_ANON_KEY for target generation.');
  }

  const options = parseArgs(process.argv.slice(2));
  const [people, publicClaims] = await Promise.all([
    fetchAllRows('public_people', 'person_id,name,gender,party,position,district,education,experience'),
    fetchAllRows('public_person_claims', 'person_id,claim_type'),
  ]);
  const publicClaimTypes = claimTypesByPerson(publicClaims);
  const targets = people
    .map((person) => ({ person, missing: missingSignals(person, publicClaimTypes) }))
    .filter(({ missing }) => missing.includes('birth_date') || missing.includes('education') || missing.includes('experience'))
    .sort((left, right) =>
      rolePriority(left.person.position) - rolePriority(right.person.position) ||
      right.missing.length - left.missing.length ||
      left.person.name.localeCompare(right.person.name, 'zh-Hant-TW'),
    )
    .slice(0, options.limit)
    .map(({ person, missing }) => targetFromPerson(person, missing));

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
      missingSignals: target.missingSignals,
    })),
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`person enrichment target generation failed: ${message}`);
  process.exit(1);
});
