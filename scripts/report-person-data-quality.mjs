import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'person-data-quality-report.json');
const defaultMissingExternalIdsReportPath = path.join(repoRoot, 'data-sources', 'missing-person-external-ids-report.json');

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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY;

function parseArgs(argv) {
  const options = {
    outputPath: defaultOutputPath,
    limit: 100000,
    sampleLimit: 100,
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

function restUrl(pathname) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`);
}

async function fetchRows(viewName, select, options) {
  const pageSize = 1000;
  const rows = [];

  while (rows.length < options.limit) {
    const pageStart = rows.length;
    const pageEnd = Math.min(pageStart + pageSize - 1, options.limit - 1);
    const url = restUrl(viewName);
    url.searchParams.set('select', select);

    const response = await fetch(url, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
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

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function normalizeName(name) {
  return String(name ?? '')
    .replace(/^[^\u3400-\u9fffA-Za-z]+/, '')
    .match(/^[\u3400-\u9fffA-Za-z·．・\s]+/)?.[0]
    ?.replace(/[臺]/g, '台')
    .replace(/[‧·．・･•\s\u00A0\u3000]+/g, '')
    .trim()
    .toLowerCase() ?? '';
}

function normalizeExternalId(value) {
  const normalized = String(value ?? '').trim();
  const wikidataQid = normalized.match(/^wikidata:(Q\d+)$/i)?.[1];
  return wikidataQid ? `wikidata:${wikidataQid.toUpperCase()}` : normalized.toLowerCase();
}

function externalIdValuesFor(claim) {
  if (claim.claim_type !== 'external_id') {
    return [];
  }

  const wikidataQid = typeof claim.claim_json?.wikidataQid === 'string' ? `wikidata:${claim.claim_json.wikidataQid}` : null;
  return [claim.claim_value, wikidataQid].filter(Boolean).map(normalizeExternalId);
}

function countMissing(people, field, predicate = (person) => isBlank(person[field])) {
  return people.filter(predicate).length;
}

function sample(items, limit) {
  return items.slice(0, limit);
}

function groupBy(items, keyFor) {
  const groups = new Map();

  for (const item of items) {
    const key = keyFor(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return groups;
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => !isBlank(value)))).sort();
}

function publicClaimCoverageByPerson(claims, claimType) {
  const covered = new Set();

  for (const claim of claims) {
    if (claim.claim_type === claimType && !isBlank(claim.claim_value)) {
      covered.add(claim.person_id);
    }
  }

  return covered;
}

function summarizeMissingFields(people, claims, options) {
  const publicEducationClaimPersonIds = publicClaimCoverageByPerson(claims, 'education');
  const publicExperienceClaimPersonIds = publicClaimCoverageByPerson(claims, 'experience');
  const missing = {
    gender: countMissing(people, 'gender', (person) => isBlank(person.gender) || person.gender === 'unknown'),
    party: countMissing(people, 'party'),
    position: countMissing(people, 'position'),
    district: countMissing(people, 'district'),
    election_year: countMissing(people, 'election_year'),
    education: countMissing(people, 'education', (person) => isBlank(person.education) && !publicEducationClaimPersonIds.has(person.person_id)),
    experience: countMissing(people, 'experience', (person) => isBlank(person.experience) && !publicExperienceClaimPersonIds.has(person.person_id)),
    primary_photo_url: countMissing(people, 'primary_photo_url'),
  };
  const primaryFieldMissing = {
    education: countMissing(people, 'education'),
    experience: countMissing(people, 'experience'),
  };

  const samples = {};
  for (const field of Object.keys(missing)) {
    samples[field] = sample(
      people
        .filter((person) => {
          if (field === 'gender') {
            return isBlank(person.gender) || person.gender === 'unknown';
          }

          if (field === 'education') {
            return isBlank(person.education) && !publicEducationClaimPersonIds.has(person.person_id);
          }

          if (field === 'experience') {
            return isBlank(person.experience) && !publicExperienceClaimPersonIds.has(person.person_id);
          }

          return isBlank(person[field]);
        })
        .map((person) => ({
          personId: person.person_id,
          name: person.name,
          party: person.party,
          position: person.position,
          district: person.district,
        })),
      options.sampleLimit,
    );
  }

  return {
    counts: missing,
    primaryFieldMissing,
    publicClaimCoverage: {
      education: publicEducationClaimPersonIds.size,
      experience: publicExperienceClaimPersonIds.size,
    },
    samples,
  };
}

function summarizeExternalIds(people, claims, options) {
  const externalIdsByPerson = new Map();
  const peopleById = new Map(people.map((person) => [person.person_id, person]));
  const peopleByExternalId = new Map();

  for (const claim of claims) {
    for (const externalId of externalIdValuesFor(claim)) {
      externalIdsByPerson.set(claim.person_id, [...(externalIdsByPerson.get(claim.person_id) ?? []), externalId]);
      peopleByExternalId.set(externalId, [...(peopleByExternalId.get(externalId) ?? []), claim.person_id]);
    }
  }

  const missingExternalId = people
    .filter((person) => (externalIdsByPerson.get(person.person_id) ?? []).length === 0)
    .map((person) => ({
      personId: person.person_id,
      name: person.name,
      party: person.party,
      position: person.position,
      district: person.district,
    }));

  const sharedExternalIds = Array.from(peopleByExternalId.entries())
    .map(([externalId, personIds]) => ({
      externalId,
      people: unique(personIds).map((personId) => {
        const person = peopleById.get(personId);
        return {
          personId,
          name: person?.name ?? null,
          party: person?.party ?? null,
          position: person?.position ?? null,
          district: person?.district ?? null,
        };
      }),
    }))
    .filter((item) => item.people.length > 1)
    .sort((left, right) => right.people.length - left.people.length || left.externalId.localeCompare(right.externalId));

  return {
    peopleWithExternalId: people.length - missingExternalId.length,
    peopleMissingExternalId: missingExternalId.length,
    sharedExternalIdCount: sharedExternalIds.length,
    missingExternalIdSamples: sample(missingExternalId, options.sampleLimit),
    sharedExternalIdSamples: sample(sharedExternalIds, options.sampleLimit),
  };
}

function publicExternalIdClaimsFromRawClaims(rawClaims) {
  return rawClaims
    .filter((claim) =>
      claim.claim_type === 'external_id' &&
      claim.review_status === 'verified' &&
      claim.visibility === 'public' &&
      claim.is_public === true,
    )
    .map((claim) => ({
      claim_id: claim.id,
      person_id: claim.person_id,
      claim_type: claim.claim_type,
      claim_value: claim.claim_value,
      claim_json: claim.claim_json,
      confidence_level: claim.confidence_level,
      source_name: claim.source_name,
      source_url: claim.source_url,
    }));
}

function externalIdSummaryFromMissingReport(people, options) {
  if (!fs.existsSync(defaultMissingExternalIdsReportPath)) {
    return null;
  }

  const report = JSON.parse(fs.readFileSync(defaultMissingExternalIdsReportPath, 'utf8'));
  if (report.totalPublicPeople !== people.length || !Array.isArray(report.records)) {
    return null;
  }

  return {
    peopleWithExternalId: people.length - report.missingPublicExternalId,
    peopleMissingExternalId: report.missingPublicExternalId,
    sharedExternalIdCount: null,
    missingExternalIdSamples: sample(report.records.map((record) => record.person), options.sampleLimit),
    sharedExternalIdSamples: [],
    sourceReport: path.relative(repoRoot, defaultMissingExternalIdsReportPath),
  };
}

function summarizeDuplicateNames(people, options) {
  const groups = Array.from(groupBy(people, (person) => normalizeName(person.name)).entries())
    .filter(([normalizedName, records]) => normalizedName && records.length > 1)
    .map(([normalizedName, records]) => ({
      normalizedName,
      recordCount: records.length,
      parties: unique(records.map((person) => person.party)),
      districts: unique(records.map((person) => person.district)),
      positions: unique(records.map((person) => person.position)),
      people: records.map((person) => ({
        personId: person.person_id,
        name: person.name,
        gender: person.gender,
        party: person.party,
        position: person.position,
        district: person.district,
      })),
    }))
    .sort((left, right) => right.recordCount - left.recordCount || left.normalizedName.localeCompare(right.normalizedName, 'zh-Hant-TW'));

  return {
    duplicateNameGroups: groups.length,
    samples: sample(groups, options.sampleLimit),
  };
}

function summarizeCandidateInconsistencies(people, candidates, options) {
  const peopleById = new Map(people.map((person) => [person.person_id, person]));
  const candidateOnly = candidates
    .filter((candidate) => !peopleById.has(candidate.person_id))
    .map((candidate) => ({
      candidateId: candidate.candidate_id,
      personId: candidate.person_id,
      personName: candidate.person_name,
      electionName: candidate.election_name,
      raceTitle: candidate.race_title,
    }));
  const partyMismatches = candidates
    .map((candidate) => ({ candidate, person: peopleById.get(candidate.person_id) }))
    .filter(({ candidate, person }) =>
      person &&
      !isBlank(candidate.party) &&
      !isBlank(person.party) &&
      candidate.party !== person.party &&
      candidate.party !== '無黨籍及未經政黨推薦',
    )
    .map(({ candidate, person }) => ({
      candidateId: candidate.candidate_id,
      personId: candidate.person_id,
      name: person.name,
      personParty: person.party,
      candidateParty: candidate.party,
      electionName: candidate.election_name,
      raceTitle: candidate.race_title,
    }));

  return {
    candidateWithoutPublicPerson: candidateOnly.length,
    partyMismatchCount: partyMismatches.length,
    candidateWithoutPublicPersonSamples: sample(candidateOnly, options.sampleLimit),
    partyMismatchSamples: sample(partyMismatches, options.sampleLimit),
  };
}

async function main() {
  if (!serviceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for person data quality report.');
  }

  const options = parseArgs(process.argv.slice(2));
  const [
    people,
    candidates,
    claims,
    rawClaims,
    duplicateQueue,
    mergeDecisions,
    reviewQueue,
  ] = await Promise.all([
    fetchRows('public_people', 'person_id,name,alias,gender,party,position,election_year,district,education,experience,updated_at,primary_photo_url', options),
    fetchRows('public_candidates', 'candidate_id,person_id,person_name,person_party,person_position,race_title,election_name,region_name,party,registration_status', options),
    fetchRows('public_person_claims', 'claim_id,person_id,claim_type,claim_value,claim_json,confidence_level,source_name,source_url', options),
    fetchRows('person_claims', 'id,person_id,claim_type,claim_value,claim_json,confidence_level,review_status,visibility,is_public,source_name,source_url', options),
    fetchRows('person_duplicate_review_queue', 'duplicate_person_id,duplicate_person_name,canonical_person_id,canonical_person_name,reason,confidence_level,score,evidence_json', options),
    fetchRows('person_merge_decisions', 'id,duplicate_person_id,canonical_person_id,status,confidence_level,reason,reviewed_at,updated_at', options),
    fetchRows('person_claim_review_queue', 'claim_id,claim_type,source_name,review_status,visibility', options),
  ]);
  const mergeDecisionCounts = Object.fromEntries(
    Array.from(groupBy(mergeDecisions, (decision) => decision.status).entries()).map(([status, records]) => [status, records.length]),
  );
  const duplicateQueueCounts = Object.fromEntries(
    Array.from(groupBy(duplicateQueue, (item) => item.confidence_level).entries()).map(([level, records]) => [level, records.length]),
  );
  const reviewQueueCounts = Object.fromEntries(
    Array.from(groupBy(reviewQueue, (item) => item.claim_type).entries()).map(([claimType, records]) => [claimType, records.length]),
  );
  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      people: people.length,
      candidates: candidates.length,
      publicClaims: claims.length,
      duplicateQueue: duplicateQueue.length,
      mergeDecisions: mergeDecisions.length,
      reviewQueue: reviewQueue.length,
    },
    missingFields: summarizeMissingFields(people, claims, options),
    externalIds: externalIdSummaryFromMissingReport(people, options) ?? summarizeExternalIds(people, [...claims, ...publicExternalIdClaimsFromRawClaims(rawClaims)], options),
    duplicateNames: summarizeDuplicateNames(people, options),
    duplicateQueue: {
      byConfidenceLevel: duplicateQueueCounts,
      samples: sample(duplicateQueue, options.sampleLimit),
    },
    mergeDecisions: {
      byStatus: mergeDecisionCounts,
      samples: sample(mergeDecisions, options.sampleLimit),
    },
    candidateInconsistencies: summarizeCandidateInconsistencies(people, candidates, options),
    reviewQueue: {
      byClaimType: reviewQueueCounts,
      samples: sample(reviewQueue, options.sampleLimit),
    },
  };
  const content = `${JSON.stringify(report, null, 2)}\n`;

  if (options.write) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, content);
    console.log(`Wrote person data quality report: ${path.relative(repoRoot, options.outputPath)}`);
    return;
  }

  console.log(content);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`person data quality report failed: ${message}`);
  process.exit(1);
});
