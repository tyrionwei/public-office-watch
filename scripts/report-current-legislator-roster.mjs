import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const legislativeYuanRosterUrl = 'https://www.ly.gov.tw/Pages/List.aspx?nodeid=109';
const expectedLegislatorCount = 113;

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};

  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        const key = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : line;
        const value = separatorIndex >= 0
          ? line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '')
          : '';
        return [key, value];
      }),
  );
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
    .replace(/&#([0-9]+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

export function normalizePersonName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[・．•·]/g, '‧')
    .replace(/\s+/g, '')
    .trim();
}

export function extractCurrentLegislatorNames(html) {
  const sectionStart = html.search(/id=["']six-legislatorListBox["']/i);
  if (sectionStart < 0) throw new Error('Legislative Yuan roster section was not found');

  const rosterSection = html.slice(sectionStart);
  const departedTextIndex = rosterSection.search(/離職\s*立法委員名單/i);
  const departedHeadingIndex = departedTextIndex >= 0
    ? rosterSection.lastIndexOf('<h2', departedTextIndex)
    : -1;
  const currentRosterHtml = rosterSection.slice(0, departedHeadingIndex >= 0 ? departedHeadingIndex : undefined);
  const names = [];
  const namePattern = /<div\b[^>]*class=["'][^"']*\blegislatorname\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;

  for (const match of currentRosterHtml.matchAll(namePattern)) {
    const name = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, ' ')).trim();
    if (name) names.push(name);
  }

  if (names.length === 0) throw new Error('No current legislators were parsed');
  return names;
}

function rosterIndex(names) {
  const index = new Map();
  for (const name of names) {
    const normalizedName = normalizePersonName(name);
    const existing = index.get(normalizedName) ?? [];
    existing.push(name);
    index.set(normalizedName, existing);
  }
  return index;
}

export function compareRosters(officialNames, localNames) {
  const official = rosterIndex(officialNames);
  const local = rosterIndex(localNames);
  const duplicateOfficialNames = [...official.values()].filter((names) => names.length > 1);
  const duplicateLocalNames = [...local.values()].filter((names) => names.length > 1);
  const missingLocally = [...official.entries()]
    .filter(([name]) => !local.has(name))
    .map(([, names]) => names[0])
    .sort();
  const unexpectedLocally = [...local.entries()]
    .filter(([name]) => !official.has(name))
    .map(([, names]) => names[0])
    .sort();

  return {
    officialCount: official.size,
    localCount: local.size,
    missingLocally,
    unexpectedLocally,
    duplicateOfficialNames,
    duplicateLocalNames,
    passed: official.size === expectedLegislatorCount
      && local.size === expectedLegislatorCount
      && missingLocally.length === 0
      && unexpectedLocally.length === 0
      && duplicateOfficialNames.length === 0
      && duplicateLocalNames.length === 0,
  };
}

async function fetchOfficialRoster() {
  const response = await fetch(legislativeYuanRosterUrl, {
    headers: { 'user-agent': 'Public Office Watch data audit' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Legislative Yuan roster: ${response.status}`);
  }
  return extractCurrentLegislatorNames(await response.text());
}

async function fetchLocalRoster(supabaseUrl, serviceRoleKey) {
  const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/public_people`);
  url.searchParams.set('select', 'person_id,name,current_office_label');
  url.searchParams.set('current_office_label', 'like.*立法委員*');
  url.searchParams.set('order', 'name.asc');

  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to fetch local public_people: ${body?.message ?? response.statusText}`);
  }
  return body.map((person) => person.name);
}

async function main() {
  const localEnv = readLocalEnv();
  const supabaseUrl = process.env.SUPABASE_URL?.trim()
    || localEnv.SUPABASE_URL
    || 'http://127.0.0.1:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || localEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

  const [officialNames, localNames] = await Promise.all([
    fetchOfficialRoster(),
    fetchLocalRoster(supabaseUrl, serviceRoleKey),
  ]);
  const comparison = compareRosters(officialNames, localNames);
  console.log(JSON.stringify({
    observedAt: new Date().toISOString(),
    sourceUrl: legislativeYuanRosterUrl,
    expectedLegislatorCount,
    ...comparison,
  }, null, 2));
  if (!comparison.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
