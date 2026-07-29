import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '202607290012_company_registry_officer_data.sql',
);

const GCIS_BASE_URL = 'https://data.gcis.nat.gov.tw/od/data/api';
const COMPANY_BASIC_DATASET = '5F64D864-61CB-4D0D-8AD9-492047CC1EA6';
const COMPANY_DIRECTOR_DATASET = '4E5F7653-1B91-4DDC-99D5-468530FAE396';
const BUSINESS_LOOKUP_DATASET = '426D5542-5F05-43EB-83F9-F1300F14E1F1';
const BUSINESS_DETAIL_DATASET = '7E6AFA72-AD6A-46D3-8681-ED77951D912D';
const REGISTRY_SOURCE_NAME = '經濟部商業發展署商工行政資料開放平臺';
const REGISTRY_SOURCE_URL = 'https://data.gcis.nat.gov.tw/od/rule';

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
          ? line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
          : '';
        return [key, value];
      }),
  );
}

function parseArgs(argv) {
  const args = {
    outputPath: defaultOutputPath,
    limit: null,
    concurrency: 2,
  };

  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--output') {
      args.outputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (argv[index] === '--limit') {
      args.limit = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (argv[index] === '--concurrency') {
      args.concurrency = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    }
  }

  if (!Number.isInteger(args.concurrency) || args.concurrency < 1 || args.concurrency > 8) {
    throw new Error('--concurrency must be an integer between 1 and 8');
  }
  if (args.limit !== null && (!Number.isInteger(args.limit) || args.limit < 1)) {
    throw new Error('--limit must be a positive integer');
  }

  return args;
}

function getSupabaseEnv() {
  const localEnv = readLocalEnv();
  const url = process.env.SUPABASE_URL ?? localEnv.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  return { url: url.replace(/\/$/, ''), serviceRoleKey };
}

export function buildGcisUrl(dataset, filter) {
  const url = new URL(`${GCIS_BASE_URL}/${dataset}`);
  url.searchParams.set('$format', 'json');
  url.searchParams.set('$filter', filter);
  url.searchParams.set('$skip', '0');
  url.searchParams.set('$top', '50');
  return url;
}

async function fetchJsonRows(dataset, filter, fetchImpl = fetch) {
  const url = buildGcisUrl(dataset, filter);
  let lastError = null;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'PublicOfficeWatch/1.1',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      if (!body.trim()) return [];
      const payload = JSON.parse(body);
      if (!Array.isArray(payload)) throw new Error('Expected an array response');
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  throw new Error(`GCIS request failed for ${dataset}: ${lastError?.message ?? 'unknown error'}`);
}

function cleanName(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function uniqueNames(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function parseCompanyRegistryProfile(basicRows, directorRows) {
  const basic = basicRows[0];
  if (!basic) return null;

  const directors = uniqueNames(
    directorRows
      .filter((row) => cleanName(row?.Person_Position_Name)?.includes('董事'))
      .map((row) => cleanName(row?.Person_Name) ?? cleanName(row?.Juristic_Person_Name)),
  );

  return {
    registrationType: 'company',
    representativeName: cleanName(basic.Responsible_Name),
    directorNames: directors,
  };
}

export function parseBusinessRegistryProfile(detailRows) {
  const detail = detailRows[0];
  if (!detail) return null;

  return {
    registrationType: 'business',
    representativeName: cleanName(detail.Responsible_Name),
    directorNames: [],
  };
}

export async function fetchRegistryProfile(unifiedBusinessNo, fetchImpl = fetch) {
  const companyFilter = `Business_Accounting_NO eq ${unifiedBusinessNo}`;
  const basicRows = await fetchJsonRows(COMPANY_BASIC_DATASET, companyFilter, fetchImpl);

  if (basicRows.length > 0) {
    const directorRows = await fetchJsonRows(COMPANY_DIRECTOR_DATASET, companyFilter, fetchImpl);
    return parseCompanyRegistryProfile(basicRows, directorRows);
  }

  const businessRows = await fetchJsonRows(
    BUSINESS_LOOKUP_DATASET,
    `President_No eq ${unifiedBusinessNo}`,
    fetchImpl,
  );
  const agency = cleanName(businessRows[0]?.Agency);
  if (!agency) return null;

  const detailRows = await fetchJsonRows(
    BUSINESS_DETAIL_DATASET,
    `President_No eq ${unifiedBusinessNo} and Agency eq ${agency}`,
    fetchImpl,
  );
  return parseBusinessRegistryProfile(detailRows);
}

export function toMigrationRow(company, profile) {
  if (!profile) return null;

  return {
    unifiedBusinessNo: company.unified_business_no,
    companyName: company.name,
    ...profile,
  };
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlTextArray(values) {
  if (values.length === 0) return 'ARRAY[]::TEXT[]';
  return `ARRAY[${values.map(sqlLiteral).join(', ')}]::TEXT[]`;
}

export function buildMigrationSql(rows, checkedAt) {
  const valueRows = rows.map((row) => (
    `    (${sqlLiteral(row.unifiedBusinessNo)}, ${sqlLiteral(row.representativeName)}, ${sqlTextArray(row.directorNames)})`
  ));

  return `BEGIN;\n\nWITH registry_data (unified_business_no, representative_name, director_names) AS (\n  VALUES\n${valueRows.join(',\n')}\n)\nUPDATE public.companies AS company\nSET\n    representative_name = registry.representative_name,\n    director_names = registry.director_names,\n    registry_source_name = ${sqlLiteral(REGISTRY_SOURCE_NAME)},\n    registry_source_url = ${sqlLiteral(REGISTRY_SOURCE_URL)},\n    registry_checked_at = ${sqlLiteral(checkedAt)}::TIMESTAMPTZ,\n    updated_at = NOW()\nFROM registry_data AS registry\nWHERE company.unified_business_no = registry.unified_business_no;\n\nCOMMIT;\n`;
}

async function fetchSupabaseRows(env, url, label) {
  const response = await fetch(url, {
    headers: {
      apikey: env.serviceRoleKey,
      authorization: `Bearer ${env.serviceRoleKey}`,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${label}: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function loadTargetCompanies(env) {
  const companiesUrl = new URL(`${env.url}/rest/v1/companies`);
  companiesUrl.searchParams.set('select', 'id,unified_business_no,name');
  companiesUrl.searchParams.set('is_public', 'eq.true');
  companiesUrl.searchParams.set('unified_business_no', 'not.is.null');
  companiesUrl.searchParams.set('order', 'name.asc');
  companiesUrl.searchParams.set('limit', '1000');

  const contributionsUrl = new URL(`${env.url}/rest/v1/public_party_company_contribution_summaries`);
  contributionsUrl.searchParams.set('select', 'company_id');
  contributionsUrl.searchParams.set('limit', '1000');

  const [companies, contributions] = await Promise.all([
    fetchSupabaseRows(env, companiesUrl, 'companies'),
    fetchSupabaseRows(env, contributionsUrl, 'company contributions'),
  ]);
  const contributionCompanyIds = new Set(contributions.map((row) => row.company_id));

  return companies.filter((row) => (
    contributionCompanyIds.has(row.id)
    && /^\d{8}$/.test(row.unified_business_no ?? '')
  ));
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function main() {
  const args = parseArgs(process.argv);
  const env = getSupabaseEnv();
  const allCompanies = await loadTargetCompanies(env);
  const companies = args.limit === null ? allCompanies : allCompanies.slice(0, args.limit);

  const profiles = await mapWithConcurrency(companies, args.concurrency, async (company, index) => {
    const profile = await fetchRegistryProfile(company.unified_business_no);
    if ((index + 1) % 25 === 0 || index + 1 === companies.length) {
      console.log(`Checked ${index + 1}/${companies.length} companies`);
    }
    return toMigrationRow(company, profile);
  });

  const matched = profiles.filter(Boolean);
  if (matched.length === 0) throw new Error('No official registry profiles matched');

  const checkedAt = new Date().toISOString();
  const migration = buildMigrationSql(matched, checkedAt);
  fs.writeFileSync(args.outputPath, migration, 'utf8');

  console.log(JSON.stringify({
    outputPath: path.relative(repoRoot, args.outputPath),
    targetCount: companies.length,
    matchedCount: matched.length,
    companyCount: matched.filter((row) => row.registrationType === 'company').length,
    businessCount: matched.filter((row) => row.registrationType === 'business').length,
    representativeCount: matched.filter((row) => row.representativeName).length,
    directorCompanyCount: matched.filter((row) => row.directorNames.length > 0).length,
    unmatchedCount: companies.length - matched.length,
  }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
