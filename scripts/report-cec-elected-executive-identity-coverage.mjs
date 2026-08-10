import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(repoRoot, 'data-sources', 'cec-elected-executives-1994-2014.json');
const outputPath = path.join(repoRoot, 'data-sources', 'cec-elected-executive-identity-coverage.json');

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
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')];
      }),
  );
}

const localEnv = readLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY?.trim() || localEnv.SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY || '';

function normalize(value) {
  return String(value ?? '').normalize('NFKC').replaceAll('台', '臺').replace(/\s+/g, '').trim();
}

async function fetchAllRows(view, select, pageSize = 1000, requestKey = anonKey) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${view}`);
    url.searchParams.set('select', select);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));
    const response = await fetch(url, {
      headers: { apikey: requestKey, authorization: `Bearer ${requestKey}` },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`GET ${view} failed: ${body?.message ?? response.statusText}`);
    rows.push(...body);
    if (body.length < pageSize) return rows;
  }
}

async function main() {
  if (!anonKey || !serviceRoleKey) throw new Error('Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.');
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const [people, candidates, canonicalMaps] = await Promise.all([
    fetchAllRows(
      'people',
      'id,external_id,name,alias,gender,party,position,election_year,district,education,experience,source_url,is_public',
      1000,
      serviceRoleKey,
    ),
    fetchAllRows('public_candidates', 'person_id,person_name,party,person_party,election_year,race_title,region_name,is_elected'),
    fetchAllRows('person_canonical_map', 'person_id,canonical_person_id', 1000, serviceRoleKey),
  ]);
  const rawPeopleById = new Map(people.map((person) => [person.id, person]));
  const canonicalByPersonId = new Map(canonicalMaps.map((row) => [row.person_id, row.canonical_person_id]));
  const peopleByName = new Map();
  const seenCanonicalIds = new Set();
  for (const sourcePerson of people) {
    const canonicalId = canonicalByPersonId.get(sourcePerson.id) ?? sourcePerson.id;
    if (seenCanonicalIds.has(canonicalId)) continue;
    seenCanonicalIds.add(canonicalId);
    const rawPerson = rawPeopleById.get(canonicalId) ?? sourcePerson;
    const person = {
      person_id: rawPerson.id,
      external_id: rawPerson.external_id,
      name: rawPerson.name,
      alias: rawPerson.alias,
      gender: rawPerson.gender,
      party: rawPerson.party,
      position: rawPerson.position,
      election_year: rawPerson.election_year,
      district: rawPerson.district,
      education: rawPerson.education,
      experience: rawPerson.experience,
      source_url: rawPerson.source_url,
      is_public: rawPerson.is_public,
    };
    const key = normalize(person.name);
    const group = peopleByName.get(key) ?? [];
    group.push(person);
    peopleByName.set(key, group);
  }
  const candidatesByPerson = new Map();
  for (const candidate of candidates) {
    const group = candidatesByPerson.get(candidate.person_id) ?? [];
    group.push(candidate);
    candidatesByPerson.set(candidate.person_id, group);
  }

  const recordsByName = new Map();
  for (const record of source.records) {
    const key = normalize(record.name);
    const group = recordsByName.get(key) ?? [];
    group.push(record);
    recordsByName.set(key, group);
  }

  const entries = [...recordsByName.entries()].map(([normalizedName, records]) => {
    const sourceGender = records.find((record) => record.gender !== 'unknown')?.gender ?? 'unknown';
    const nameMatches = peopleByName.get(normalizedName) ?? [];
    const compatible = nameMatches.filter((person) =>
      sourceGender === 'unknown' || person.gender === 'unknown' || person.gender === sourceGender);
    const matches = compatible.map((person) => ({
      ...person,
      electionHistory: candidatesByPerson.get(person.person_id) ?? [],
    }));
    return {
      name: records[0].name,
      normalizedName,
      sourceGender,
      sourceRecords: records,
      resolution: matches.length === 1 ? 'unique_match' : matches.length === 0 ? 'missing_person' : 'ambiguous_match',
      matches,
    };
  }).sort((left, right) => left.resolution.localeCompare(right.resolution) || left.name.localeCompare(right.name, 'zh-Hant-TW'));

  const output = {
    schemaVersion: 1,
    name: 'cec-elected-executive-identity-coverage',
    generatedAt: new Date().toISOString(),
    summary: {
      sourcePersonCount: entries.length,
      uniqueMatchCount: entries.filter((entry) => entry.resolution === 'unique_match').length,
      missingPersonCount: entries.filter((entry) => entry.resolution === 'missing_person').length,
      ambiguousMatchCount: entries.filter((entry) => entry.resolution === 'ambiguous_match').length,
    },
    entries,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, ...output.summary }, null, 2));
}

main().catch((error) => {
  console.error(`CEC elected executive identity coverage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exit(1);
});
