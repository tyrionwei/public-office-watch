import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultInputPath = path.join(repoRoot, 'tmp', 'party-annual-finance', 'moi-party-annual-finance.json');
const defaultOutputPath = path.join(repoRoot, 'tmp', 'party-annual-finance', 'moi-party-annual-finance-staging.json');
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);
const sourceHost = 'party.moi.gov.tw';
const pdfHost = 'ws.moi.gov.tw';

function readLocalEnv() {
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

function parseArgs(argv) {
  const options = { inputPath: defaultInputPath, outputPath: defaultOutputPath, applyLocal: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.inputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--apply-local') options.applyLocal = true;
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (!fs.existsSync(options.inputPath)) throw new Error(`MOI annual finance report not found: ${options.inputPath}`);
  return options;
}

function assertLocalSupabase(supabaseUrl) {
  const hostname = new URL(supabaseUrl).hostname;
  if (!localHostnames.has(hostname)) {
    throw new Error(`MOI annual finance writes are local-only; received Supabase host ${hostname}`);
  }
}

function normalizePartyName(value) {
  return String(value ?? '')
    .replace(/（\d{3}年.*）$/u, '')
    .replaceAll('臺', '台')
    .replace(/\s+/gu, '').trim();
}

function assertOfficialUrl(value, hostname, label, nullable = false) {
  if (nullable && !value) return null;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== hostname) {
    throw new Error(`${label} must use the official ${hostname} HTTPS origin`);
  }
  return url.toString();
}

function normalizeFilingStatus(value) {
  if (value === '已申報') return 'filed';
  if (value === '待補正') return 'correction_required';
  if (value === '未申報') return 'not_filed';
  return 'unknown';
}

function normalizeRatificationStatus(value) {
  if (value === '已追認') return 'ratified';
  if (value === '未追認') return 'not_ratified';
  return 'unknown';
}

function normalizeAssemblyApprovalStatus(value) {
  if (value === '有') return 'approved';
  if (String(value ?? '').includes('尚未')) return 'not_approved';
  return 'unknown';
}

function validateReport(report) {
  assertOfficialUrl(report?.sourceUrl, sourceHost, 'Source URL');
  if (!Number.isInteger(report?.reportYear) || !Array.isArray(report?.records) || report.records.length === 0) {
    throw new Error('Expected a non-empty MOI annual finance report with a Gregorian report year');
  }
  if (report.recordCount !== report.records.length) {
    throw new Error('MOI annual finance record count does not match its records');
  }
  const partyNumbers = new Set();
  for (const record of report.records) {
    if (!Number.isInteger(record.partyNumber) || partyNumbers.has(record.partyNumber) || !record.partyName) {
      throw new Error(`Invalid or duplicate MOI party record: ${record.partyName ?? 'unknown'}`);
    }
    partyNumbers.add(record.partyNumber);
    assertOfficialUrl(record.detailUrl, sourceHost, 'Detail URL');
    assertOfficialUrl(record.reportPdfUrl, pdfHost, 'Report PDF URL', true);
  }
  return report;
}

function buildStagingRows(report, parties) {
  const partyByName = new Map();
  const ambiguousNames = new Set();
  for (const party of parties) {
    const normalizedName = normalizePartyName(party.name);
    if (partyByName.has(normalizedName)) ambiguousNames.add(normalizedName);
    else partyByName.set(normalizedName, party);
  }

  const rows = [];
  const unmatched = [];
  const ambiguous = [];
  for (const record of report.records) {
    const normalizedName = normalizePartyName(record.partyName);
    if (ambiguousNames.has(normalizedName)) {
      ambiguous.push({ partyNumber: record.partyNumber, partyName: record.partyName });
      continue;
    }
    const party = partyByName.get(normalizedName);
    if (!party) {
      unmatched.push({ partyNumber: record.partyNumber, partyName: record.partyName });
      continue;
    }
    rows.push({
      party_id: party.id,
      report_year: report.reportYear,
      filing_status: normalizeFilingStatus(record.filingStatus),
      ratification_status: normalizeRatificationStatus(record.ratificationStatus),
      assembly_approval_status: normalizeAssemblyApprovalStatus(record.assemblyApprovalStatus),
      detail_url: assertOfficialUrl(record.detailUrl, sourceHost, 'Detail URL'),
      report_pdf_url: assertOfficialUrl(record.reportPdfUrl, pdfHost, 'Report PDF URL', true),
      source_name: report.sourceName,
      source_url: assertOfficialUrl(report.sourceUrl, sourceHost, 'Source URL'),
      is_public: true,
      updated_at: report.generatedAt,
    });
  }
  return { rows, unmatched, ambiguous };
}

function restHeaders(serviceRoleKey, prefer = null) {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    'content-type': 'application/json',
    ...(prefer ? { prefer } : {}),
  };
}

async function responseJson(response, label) {
  const body = await response.text();
  if (!response.ok) throw new Error(`${label}: ${response.status} ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : [];
}

async function fetchParties(config) {
  const url = new URL('/rest/v1/parties', config.supabaseUrl);
  url.searchParams.set('select', 'id,name');
  url.searchParams.set('is_public', 'eq.true');
  url.searchParams.set('limit', '500');
  return responseJson(await fetch(url, {
    headers: restHeaders(config.serviceRoleKey),
    signal: AbortSignal.timeout(30000),
  }), 'Failed to load local parties');
}

async function upsertRows(config, rows) {
  if (rows.length === 0) return [];
  const url = new URL('/rest/v1/party_annual_finance_filings', config.supabaseUrl);
  url.searchParams.set('on_conflict', 'party_id,report_year');
  return responseJson(await fetch(url, {
    method: 'POST',
    headers: restHeaders(config.serviceRoleKey, 'resolution=merge-duplicates,return=representation'),
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(30000),
  }), 'Failed to write local annual finance filings');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = { ...readLocalEnv(), ...process.env };
  const config = {
    supabaseUrl: String(env.SUPABASE_URL ?? 'http://127.0.0.1:54321').replace(/\/$/u, ''),
    serviceRoleKey: String(env.SUPABASE_SERVICE_ROLE_KEY ?? ''),
  };
  assertLocalSupabase(config.supabaseUrl);
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for local annual finance import');

  const report = validateReport(JSON.parse(fs.readFileSync(options.inputPath, 'utf8')));
  const staging = buildStagingRows(report, await fetchParties(config));
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceReport: path.relative(repoRoot, options.inputPath),
    reportYear: report.reportYear,
    matchedCount: staging.rows.length,
    unmatched: staging.unmatched,
    ambiguous: staging.ambiguous,
    rows: staging.rows,
  };
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(output, null, 2)}\n`);

  if (!options.applyLocal) {
    console.log(JSON.stringify({ reportYear: output.reportYear, matchedCount: output.matchedCount, unmatchedCount: output.unmatched.length, ambiguousCount: output.ambiguous.length, applied: false }, null, 2));
    return;
  }
  const written = await upsertRows(config, staging.rows);
  if (written.length !== staging.rows.length) throw new Error(`Expected ${staging.rows.length} local rows, wrote ${written.length}`);
  console.log(JSON.stringify({ reportYear: output.reportYear, matchedCount: output.matchedCount, unmatchedCount: output.unmatched.length, ambiguousCount: output.ambiguous.length, applied: true }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { assertLocalSupabase, buildStagingRows, normalizeAssemblyApprovalStatus, normalizeFilingStatus, normalizePartyName, normalizeRatificationStatus, parseArgs, validateReport };
