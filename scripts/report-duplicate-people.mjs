import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'duplicate-people-report.json');

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
const localSupabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
const localServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY;
const identityPolicy = {
  mergeCandidateSignals: [
    'shared verified external ID',
    'same normalized name, gender, and birth date',
  ],
  contextOnlySignals: [
    'party',
    'district',
    'position',
    'candidate region',
  ],
  conflictSignals: [
    'different known gender',
    'different known birth date',
  ],
};

function parseArgs(argv) {
  const options = {
    outputPath: defaultOutputPath,
    limit: 10000,
    sampleLimit: 500,
    write: false,
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

    if (arg === '--sample-limit') {
      options.sampleLimit = Number.parseInt(argv[index + 1] ?? '', 10);
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

function supabaseUrl(pathname) {
  return new URL(`${localSupabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`);
}

async function fetchRows(viewName, select, options) {
  const pageSize = 1000;
  const rows = [];

  while (rows.length < options.limit) {
    const pageStart = rows.length;
    const pageEnd = Math.min(pageStart + pageSize - 1, options.limit - 1);
    const url = supabaseUrl(viewName);
    url.searchParams.set('select', select);

    const response = await fetch(url, {
      headers: {
        apikey: localServiceRoleKey,
        authorization: `Bearer ${localServiceRoleKey}`,
        range: `${pageStart}-${pageEnd}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to fetch ${viewName}: ${body?.message ?? response.statusText}`);
    }

    if (!Array.isArray(body) || body.length === 0) {
      break;
    }

    rows.push(...body);

    if (body.length < pageSize) {
      break;
    }
  }

  return rows;
}

function normalizeName(name) {
  const chinesePrefix = name.match(/^[\u3400-\u9fff]+/)?.[0] ?? name;
  return chinesePrefix.replace(/\s+/g, '').trim();
}

function normalizeExternalId(value) {
  const normalized = value.trim();
  const wikidataQid = normalized.match(/^wikidata:(Q\d+)$/i)?.[1];
  return wikidataQid ? `wikidata:${wikidataQid.toUpperCase()}` : normalized.toLowerCase();
}

function externalIdsFor(personId, claimsByPersonId) {
  const claims = claimsByPersonId.get(personId) ?? [];
  return Array.from(new Set(
    claims
      .filter((claim) => claim.claim_type === 'external_id')
      .flatMap((claim) => {
        const wikidataQid = typeof claim.claim_json?.wikidataQid === 'string' ? `wikidata:${claim.claim_json.wikidataQid}` : null;
        return [claim.claim_value, wikidataQid].filter(Boolean);
      })
      .map((value) => normalizeExternalId(value))
      .filter(Boolean),
  )).sort();
}

function birthDatesFor(personId, claimsByPersonId) {
  const claims = claimsByPersonId.get(personId) ?? [];
  return Array.from(new Set(
    claims
      .filter((claim) => claim.claim_type === 'birth_date')
      .map((claim) => String(claim.claim_value ?? claim.claim_json?.value ?? '').trim())
      .filter(Boolean),
  )).sort();
}

function candidateSummaryFor(personId, candidatesByPersonId) {
  return (candidatesByPersonId.get(personId) ?? []).map((candidate) => ({
    electionName: candidate.election_name,
    raceTitle: candidate.race_title,
    party: candidate.party ?? candidate.person_party,
    regionName: candidate.region_name,
    position: candidate.person_position,
    status: candidate.registration_status,
  }));
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function sameKnownValue(left, right) {
  return Boolean(left && right && left === right);
}

function scoreDuplicatePair(left, right) {
  const reasons = [];
  let score = 0;
  const sharedExternalIds = left.externalIds.filter((externalId) => right.externalIds.includes(externalId));
  const sharedBirthDates = left.birthDates.filter((birthDate) => right.birthDates.includes(birthDate));
  const hasBirthConflict = left.birthDates.length > 0 && right.birthDates.length > 0 && sharedBirthDates.length === 0;
  const hasGenderConflict =
    left.gender &&
    right.gender &&
    left.gender !== 'unknown' &&
    right.gender !== 'unknown' &&
    left.gender !== right.gender;

  if (sharedExternalIds.length > 0) {
    score += 90;
    reasons.push(`shared external id: ${sharedExternalIds.join(', ')}`);
  }

  if (left.normalizedName === right.normalizedName) {
    score += 10;
    reasons.push('same normalized name');
  }

  if (hasGenderConflict) {
    score -= 40;
    reasons.push(`different gender: ${left.gender} / ${right.gender}`);
  }

  if (sameKnownValue(left.gender, right.gender) && left.gender !== 'unknown') {
    score += 25;
    reasons.push(`same gender: ${left.gender}`);
  }

  if (hasBirthConflict) {
    score -= 50;
    reasons.push(`different birth date: ${left.birthDates.join(', ')} / ${right.birthDates.join(', ')}`);
  }

  if (sharedBirthDates.length > 0) {
    score += 45;
    reasons.push(`same birth date: ${sharedBirthDates.join(', ')}`);
  }

  const leftCandidateRegions = unique(left.candidates.map((candidate) => candidate.regionName));
  const rightCandidateRegions = unique(right.candidates.map((candidate) => candidate.regionName));
  const sharedCandidateRegions = leftCandidateRegions.filter((regionName) => rightCandidateRegions.includes(regionName));

  if (sameKnownValue(left.district, right.district)) {
    score += 5;
    reasons.push(`same district context: ${left.district}`);
  }

  if (sharedCandidateRegions.length > 0) {
    score += 5;
    reasons.push(`shared candidate region context: ${sharedCandidateRegions.join(', ')}`);
  }

  if (sameKnownValue(left.position, right.position)) {
    score += 5;
    reasons.push(`same position context: ${left.position}`);
  }

  if (sameKnownValue(left.party, right.party)) {
    score += 5;
    reasons.push(`same party context: ${left.party}`);
  } else if (left.party && right.party) {
    reasons.push(`different party context: ${left.party} / ${right.party}`);
  }

  const cappedScore = Math.max(0, Math.min(score, 100));
  const recommendation =
    hasGenderConflict || hasBirthConflict
      ? 'do_not_merge_likely'
      : sharedExternalIds.length > 0 || (sharedBirthDates.length > 0 && sameKnownValue(left.gender, right.gender) && left.gender !== 'unknown')
        ? 'merge_candidate'
        : cappedScore >= 50
          ? 'manual_review'
          : 'same_name_only';

  return {
    leftPersonId: left.personId,
    rightPersonId: right.personId,
    score: cappedScore,
    recommendation,
    reasons,
  };
}

function pairSuggestionsFor(records) {
  const suggestions = [];

  for (let leftIndex = 0; leftIndex < records.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < records.length; rightIndex += 1) {
      suggestions.push(scoreDuplicatePair(records[leftIndex], records[rightIndex]));
    }
  }

  return suggestions.sort((left, right) => right.score - left.score);
}

function buildDuplicateReport(people, candidates, claims, options) {
  const candidatesByPersonId = new Map();
  const claimsByPersonId = new Map();

  for (const candidate of candidates) {
    candidatesByPersonId.set(candidate.person_id, [...(candidatesByPersonId.get(candidate.person_id) ?? []), candidate]);
  }

  for (const claim of claims) {
    claimsByPersonId.set(claim.person_id, [...(claimsByPersonId.get(claim.person_id) ?? []), claim]);
  }

  const byName = new Map();

  for (const person of people) {
    const normalizedName = normalizeName(person.name);
    if (!normalizedName) continue;
    byName.set(normalizedName, [...(byName.get(normalizedName) ?? []), person]);
  }

  const groups = Array.from(byName.entries())
    .filter(([, group]) => group.length > 1)
    .map(([normalizedName, group]) => {
      const records = group.map((person) => {
        const personCandidates = candidateSummaryFor(person.person_id, candidatesByPersonId);
        return {
          personId: person.person_id,
          name: person.name,
          normalizedName,
          gender: person.gender,
          party: person.party,
          position: person.position,
          district: person.district,
          electionYear: person.election_year,
          externalIds: externalIdsFor(person.person_id, claimsByPersonId),
          birthDates: birthDatesFor(person.person_id, claimsByPersonId),
          candidateCount: personCandidates.length,
          candidates: personCandidates.slice(0, 8),
        };
      });
      const externalIdCounts = new Map();

      for (const record of records) {
        for (const externalId of record.externalIds) {
          externalIdCounts.set(externalId, (externalIdCounts.get(externalId) ?? 0) + 1);
        }
      }

      const sharedExternalIds = Array.from(externalIdCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([externalId]) => externalId);
      const pairSuggestions = pairSuggestionsFor(records);

      return {
        normalizedName,
        recordCount: records.length,
        parties: unique(records.map((record) => record.party)),
        genders: unique(records.map((record) => record.gender)),
        districts: unique(records.map((record) => record.district)),
        positions: unique(records.map((record) => record.position)),
        sharedExternalIds,
        topRecommendation: pairSuggestions[0]?.recommendation ?? 'same_name_only',
        pairSuggestions,
        records,
      };
    })
    .sort((left, right) => right.recordCount - left.recordCount || left.normalizedName.localeCompare(right.normalizedName, 'zh-Hant-TW'));

  return {
    generatedAt: new Date().toISOString(),
    policy: identityPolicy,
    scannedPeople: people.length,
    duplicateNameGroups: groups.length,
    groups: groups.slice(0, options.sampleLimit),
  };
}

async function main() {
  if (!localServiceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for duplicate people report.');
  }

  const options = parseArgs(process.argv.slice(2));
  const [people, candidates, claims] = await Promise.all([
    fetchRows('public_people', 'person_id,name,gender,party,position,district,election_year', options),
    fetchRows('public_candidates', 'person_id,person_name,person_party,person_position,race_title,election_name,region_name,party,registration_status', options),
    fetchRows('public_person_claims', 'person_id,claim_type,claim_value,claim_json', options),
  ]);
  const report = buildDuplicateReport(people, candidates, claims, options);
  const content = `${JSON.stringify(report, null, 2)}\n`;

  if (options.write) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, content);
    console.log(`Wrote duplicate people report: ${path.relative(repoRoot, options.outputPath)}`);
    return;
  }

  console.log(content);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`duplicate people report failed: ${message}`);
  process.exit(1);
});
