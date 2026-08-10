import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(repoRoot, 'data-sources', 'historical-local-chief-winners-1950-1993.raw.json');
const outputPath = path.join(repoRoot, 'data-sources', 'historical-local-chief-identity-coverage.json');

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
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^[\"']|[\"']$/g, '')];
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

function regionCompatible(sourceRegion, candidate) {
  const source = normalize(sourceRegion).replace(/[縣市]$/, '');
  const values = [candidate.district, candidate.position, ...candidate.electionHistory.flatMap((record) => [record.region_name, record.race_title])]
    .map(normalize)
    .filter(Boolean);
  return values.some((value) => value.includes(source));
}

function hasLocalChiefEvidence(candidate) {
  if (/(?:\u7e23\u9577|\u5e02\u9577)/.test(normalize(candidate.position))) return true;
  return candidate.electionHistory.some((record) =>
    record.is_elected === true && /(?:\u7e23\u9577|\u5e02\u9577)\u9078\u8209/.test(normalize(record.race_title)));
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
    fetchAllRows('people', 'id,external_id,name,alias,gender,party,position,election_year,district,source_url,is_public', 1000, serviceRoleKey),
    fetchAllRows('public_candidates', 'person_id,person_name,party,person_party,election_year,race_title,region_name,is_elected'),
    fetchAllRows('person_canonical_map', 'person_id,canonical_person_id', 1000, serviceRoleKey),
  ]);

  const rawPeopleById = new Map(people.map((person) => [person.id, person]));
  const canonicalByPersonId = new Map(canonicalMaps.map((row) => [row.person_id, row.canonical_person_id]));
  const candidatesByPerson = new Map();
  for (const candidate of candidates) {
    const canonicalId = canonicalByPersonId.get(candidate.person_id) ?? candidate.person_id;
    const group = candidatesByPerson.get(canonicalId) ?? [];
    group.push(candidate);
    candidatesByPerson.set(canonicalId, group);
  }

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
      source_url: rawPerson.source_url,
      is_public: rawPerson.is_public,
      electionHistory: candidatesByPerson.get(canonicalId) ?? [],
    };
    const key = normalize(person.name);
    const group = peopleByName.get(key) ?? [];
    group.push(person);
    peopleByName.set(key, group);
  }

  const recordsByName = new Map();
  for (const record of source.records) {
    const key = normalize(record.name);
    const group = recordsByName.get(key) ?? [];
    group.push(record);
    recordsByName.set(key, group);
  }

  const entries = [...recordsByName.entries()].map(([normalizedName, records]) => {
    const nameMatches = peopleByName.get(normalizedName) ?? [];
    const sourceRegions = [...new Set(records.map((record) => record.historicalRegionName))];
    const compatibleMatches = nameMatches.filter((person) =>
      hasLocalChiefEvidence(person) && sourceRegions.some((region) => regionCompatible(region, person)));
    let resolution = 'missing_person';
    let recommendedMatch = null;
    if (nameMatches.length === 1 && compatibleMatches.length === 1) {
      resolution = 'unique_local_chief_match';
      recommendedMatch = compatibleMatches[0].person_id;
    } else if (nameMatches.length === 1) {
      resolution = 'unique_name_needs_review';
    } else if (nameMatches.length > 1 && compatibleMatches.length === 1) {
      resolution = 'ambiguous_name_unique_local_chief_match';
      recommendedMatch = compatibleMatches[0].person_id;
    } else if (nameMatches.length > 1) {
      resolution = 'ambiguous_match';
    }
    return {
      name: records[0].name,
      normalizedName,
      sourceRegions,
      sourceRecords: records,
      resolution,
      recommendedMatch,
      matches: nameMatches,
    };
  }).sort((left, right) => left.resolution.localeCompare(right.resolution) || left.name.localeCompare(right.name, 'zh-Hant-TW'));

  const count = (resolution) => entries.filter((entry) => entry.resolution === resolution).length;
  const output = {
    schemaVersion: 1,
    name: 'historical-local-chief-identity-coverage',
    generatedAt: new Date().toISOString(),
    archiveStatus: 'archived',
    notes: [
      'This report is archived from active review, retained locally, and must not be promoted directly.',
      'A recommendation requires exact normalized name, compatible historical region, and explicit local-chief evidence.',
      'Unique-name matches without both region and office evidence remain manual review items.',
    ],
    summary: {
      sourcePersonCount: entries.length,
      uniqueLocalChiefMatchCount: count('unique_local_chief_match'),
      ambiguousNameUniqueLocalChiefMatchCount: count('ambiguous_name_unique_local_chief_match'),
      uniqueNameNeedsReviewCount: count('unique_name_needs_review'),
      ambiguousMatchCount: count('ambiguous_match'),
      missingPersonCount: count('missing_person'),
    },
    entries,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, ...output.summary }, null, 2));
}

main().catch((error) => {
  console.error(`Historical local chief identity coverage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exit(1);
});
