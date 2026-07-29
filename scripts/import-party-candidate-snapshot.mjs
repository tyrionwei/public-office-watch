import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  applyReviewedPartyCandidates,
  stagePartyCandidateReview,
  validateReviewFile,
} from './party-candidate-review.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetElectionExternalId = 'planned-2026-local-public-officials';
const externalIdPattern = /^[A-Za-z0-9._:-]+$/;
const allowedRaceTypes = new Set([
  'municipality_mayor',
  'county_mayor',
  'city_councilor',
  'county_councilor',
]);
const mayorRaceTypes = new Set(['municipality_mayor', 'county_mayor']);
const partySourceDomains = new Map([
  ['民主進步黨', ['dpp.org.tw']],
  ['中國國民黨', ['kmt.org.tw']],
  ['台灣民眾黨', ['tpp.org.tw']],
  ['時代力量', ['newpowerparty.tw', 'taiwangogo.tw']],
  ['台灣綠黨', ['greenparty.org.tw', 'taiwangogo.tw']],
  ['台灣基進', ['statebuilding.tw', 'taiwangogo.tw']],
  ['小民參政歐巴桑聯盟', ['obs.ppedu.org', 'taiwangogo.tw']],
]);

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

function parseArgs(argv) {
  let inputPath = null;
  let mode = 'dry-run';
  let reviewPath = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') {
      inputPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--stage') {
      mode = 'stage';
      continue;
    }
    if (arg === '--apply-reviewed') {
      mode = 'apply-reviewed';
      reviewPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }
  if (!inputPath) throw new Error('--input is required');
  if (mode === 'apply-reviewed' && !reviewPath) throw new Error('--apply-reviewed requires a review file');
  return { inputPath, mode, reviewPath };
}

function requireText(value, field, errors) {
  const normalized = String(value ?? '').trim();
  if (!normalized) errors.push(`${field} is required`);
  return normalized;
}

function optionalDate(value, field, errors) {
  if (value == null || value === '') return null;
  const normalized = String(value).trim();
  if (Number.isNaN(Date.parse(normalized))) errors.push(`${field} must be a valid date`);
  return normalized;
}

function requireDate(value, field, errors) {
  const normalized = requireText(value, field, errors);
  if (normalized && Number.isNaN(Date.parse(normalized))) errors.push(`${field} must be a valid date`);
  return normalized;
}

function optionalUrl(value, field, errors) {
  if (value == null || value === '') return null;
  const normalized = String(value).trim();
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'https:') errors.push(`${field} must use https`);
  } catch {
    errors.push(`${field} must be a valid URL`);
  }
  return normalized;
}

function optionalTextArray(value, field, errors) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return [];
  }
  if (value.length > 200) errors.push(`${field} must contain at most 200 items`);
  return value.map((item, index) => {
    const normalized = String(item ?? '').replace(/\s+/g, ' ').trim();
    if (!normalized) errors.push(`${field}[${index}] must not be empty`);
    if (normalized.length > 4000) errors.push(`${field}[${index}] is too long`);
    return normalized;
  }).filter(Boolean);
}

function optionalUrlArray(value, field, errors) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return [];
  }
  return value.map((item, index) => optionalUrl(item, `${field}[${index}]`, errors)).filter(Boolean);
}

function hostnameMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function validatePartySource(party, source, errors) {
  const name = requireText(source?.name, 'source.name', errors);
  const url = requireText(source?.url, 'source.url', errors);
  const publishedAt = optionalDate(source?.publishedAt, 'source.publishedAt', errors);
  const retrievedAt = requireDate(source?.retrievedAt, 'source.retrievedAt', errors);
  const allowedDomains = partySourceDomains.get(party);

  if (!allowedDomains) {
    errors.push(`party is not configured for official-source validation: ${party}`);
  }

  if (url) {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'https:') errors.push('source.url must use https');
      if (allowedDomains && !allowedDomains.some((domain) => hostnameMatches(parsedUrl.hostname.toLowerCase(), domain))) {
        errors.push(`source.url is not an official ${party} domain`);
      }
    } catch {
      errors.push('source.url must be a valid URL');
    }
  }

  return { name, url, publishedAt, retrievedAt };
}

function validateSnapshot(snapshot) {
  const errors = [];
  if (snapshot?.schemaVersion !== 1) errors.push('schemaVersion must be 1');

  const electionYear = Number(snapshot?.electionYear);
  if (electionYear !== 2026) errors.push('electionYear must be 2026');

  const sourceType = requireText(snapshot?.sourceType, 'sourceType', errors);
  if (sourceType && sourceType !== 'official_party_nomination') {
    errors.push('sourceType must be official_party_nomination');
  }

  const party = requireText(snapshot?.party, 'party', errors);
  const source = validatePartySource(party, snapshot?.source, errors);
  const rawRecords = Array.isArray(snapshot?.records) ? snapshot.records : [];
  if (rawRecords.length === 0) errors.push('records must contain at least one candidate');

  const seenKeys = new Set();
  const records = rawRecords.map((record, index) => {
    const prefix = `records[${index}]`;
    const sourceCandidateKey = requireText(record?.sourceCandidateKey, `${prefix}.sourceCandidateKey`, errors);
    if (sourceCandidateKey && !externalIdPattern.test(sourceCandidateKey)) {
      errors.push(`${prefix}.sourceCandidateKey contains unsupported characters`);
    }
    if (seenKeys.has(sourceCandidateKey)) errors.push(`${prefix}.sourceCandidateKey is duplicated`);
    seenKeys.add(sourceCandidateKey);

    const personName = requireText(record?.personName, `${prefix}.personName`, errors);
    const candidacyStatus = requireText(record?.candidacyStatus, `${prefix}.candidacyStatus`, errors);
    if (candidacyStatus && candidacyStatus !== 'party_nominee') {
      errors.push(`${prefix}.candidacyStatus must be party_nominee`);
    }

    const raceType = requireText(record?.raceType, `${prefix}.raceType`, errors);
    if (raceType && !allowedRaceTypes.has(raceType)) {
      errors.push(`${prefix}.raceType is not supported in phase 1`);
    }

    const regionName = requireText(record?.regionName, `${prefix}.regionName`, errors);
    const districtName = record?.districtName == null ? null : String(record.districtName).trim() || null;
    if (raceType && !mayorRaceTypes.has(raceType) && !districtName) {
      errors.push(`${prefix}.districtName is required for councilor races`);
    }
    if (mayorRaceTypes.has(raceType) && districtName) {
      errors.push(`${prefix}.districtName must be null for mayor races`);
    }
    if (Object.hasOwn(record ?? {}, 'candidateNo')) {
      errors.push(`${prefix}.candidateNo must not come from a party source`);
    }

    return {
      sourceCandidateKey,
      personName,
      candidacyStatus,
      raceType,
      regionName,
      districtName,
      nominationAnnouncedAt: optionalDate(record?.nominationAnnouncedAt, `${prefix}.nominationAnnouncedAt`, errors),
      profileUrl: optionalUrl(record?.profileUrl, `${prefix}.profileUrl`, errors),
      photoUrl: optionalUrl(record?.photoUrl, `${prefix}.photoUrl`, errors),
      education: optionalTextArray(record?.education, `${prefix}.education`, errors),
      experience: optionalTextArray(record?.experience, `${prefix}.experience`, errors),
      platform: optionalTextArray(record?.platform, `${prefix}.platform`, errors),
      socialLinks: optionalUrlArray(record?.socialLinks, `${prefix}.socialLinks`, errors),
    };
  });

  if (errors.length > 0) throw new Error(`Invalid party candidate snapshot:\n- ${errors.join('\n- ')}`);
  return { schemaVersion: 1, electionYear, sourceType, party, source, records };
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replaceAll('臺', '台')
    .replace(/[\s()（）．。·、,，-]/g, '')
    .toLowerCase();
}

function chineseNumberToInteger(value) {
  const digits = new Map([['零', 0], ['一', 1], ['二', 2], ['三', 3], ['四', 4], ['五', 5], ['六', 6], ['七', 7], ['八', 8], ['九', 9]]);
  if (!value) return null;
  if (!value.includes('十')) {
    let result = 0;
    for (const character of value) {
      if (!digits.has(character)) return null;
      result = (result * 10) + digits.get(character);
    }
    return result;
  }
  const [tensText, onesText] = value.split('十');
  const tens = tensText ? digits.get(tensText) : 1;
  const ones = onesText ? digits.get(onesText) : 0;
  return tens == null || ones == null ? null : (tens * 10) + ones;
}

function districtDescriptor(value) {
  const normalized = normalizeText(value);
  const districtMatch = normalized.match(/第([^區]+)區/);
  const districtToken = districtMatch?.[1]?.replace(/(?:選舉|選)$/, '') ?? '';
  const number = /^\d+$/.test(districtToken)
    ? Number(districtToken)
    : chineseNumberToInteger(districtToken);
  const subtype = normalized.includes('山地原住民')
    ? 'mountain_indigenous'
    : normalized.includes('平地原住民')
      ? 'plain_indigenous'
      : normalized.includes('原住民')
        ? 'indigenous'
        : 'general';
  return { number, subtype };
}

function sameDistrict(left, right) {
  const leftDescriptor = districtDescriptor(left);
  const rightDescriptor = districtDescriptor(right);
  return leftDescriptor.number != null
    && leftDescriptor.number === rightDescriptor.number
    && leftDescriptor.subtype === rightDescriptor.subtype;
}

function canonicalIdentityGroups(snapshot, record, people, state, regionsById) {
  const canonicalByPersonId = new Map(
    (state.canonicalMap ?? []).map((row) => [row.person_id, row.canonical_person_id]),
  );
  const candidatesByPersonId = new Map();
  for (const candidate of state.candidates ?? []) {
    candidatesByPersonId.set(
      candidate.person_id,
      [...(candidatesByPersonId.get(candidate.person_id) ?? []), candidate],
    );
  }
  const historyRacesById = new Map(
    (state.historyRaces ?? []).map((race) => [race.id, race]),
  );
  const groups = new Map();

  for (const person of people) {
    const canonicalPersonId = canonicalByPersonId.get(person.id) ?? person.id;
    const group = groups.get(canonicalPersonId) ?? {
      canonicalPersonId,
      people: [],
      partyMatch: false,
      geographyMatch: false,
      evidence: [],
    };
    group.people.push(person);

    const personCandidates = candidatesByPersonId.get(person.id) ?? [];
    const partyValues = [person.party, ...personCandidates.map((candidate) => candidate.party)];
    if (partyValues.some((party) => normalizeText(party) === normalizeText(snapshot.party))) {
      group.partyMatch = true;
    }

    const personDistrict = normalizeText(person.district);
    const sameRegionFromProfile = personDistrict.includes(normalizeText(record.regionName));
    if (mayorRaceTypes.has(record.raceType) && sameRegionFromProfile) {
      group.geographyMatch = true;
    }
    if (
      !mayorRaceTypes.has(record.raceType)
      && String(person.position ?? '').includes('議員')
      && sameRegionFromProfile
      && sameDistrict(record.districtName, person.district)
    ) {
      group.geographyMatch = true;
    }

    for (const candidate of personCandidates) {
      const historyRace = historyRacesById.get(candidate.race_id);
      const historyRegion = historyRace ? regionsById.get(historyRace.region_id) : null;
      if (!historyRace || normalizeText(historyRegion?.name) !== normalizeText(record.regionName)) continue;
      if (mayorRaceTypes.has(record.raceType)) {
        group.geographyMatch = true;
      } else if (
        ['city_councilor', 'county_councilor'].includes(historyRace.race_type)
        && sameDistrict(record.districtName, historyRace.title)
      ) {
        group.geographyMatch = true;
      }
    }

    groups.set(canonicalPersonId, group);
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    evidence: [
      ...(group.partyMatch ? ['party'] : []),
      ...(group.geographyMatch ? ['geography'] : []),
    ],
  }));
}

function planPartyCandidateImport(snapshot, state) {
  const targetElections = state.elections.filter((row) => row.external_id === targetElectionExternalId);
  const globalBlocking = [];
  if (targetElections.length !== 1) {
    globalBlocking.push({ reason: targetElections.length === 0 ? 'target_election_not_found' : 'target_election_ambiguous' });
  }
  const targetElection = targetElections[0] ?? null;
  const regionsById = new Map(state.regions.map((row) => [row.id, row]));
  const peopleByName = new Map();
  for (const person of state.people) {
    const key = normalizeText(person.name);
    peopleByName.set(key, [...(peopleByName.get(key) ?? []), person]);
  }

  const matched = [];
  const highConfidenceMatch = [];
  const probableMatch = [];
  const identityReview = [];
  const newPersonReview = [];
  const blocking = [...globalBlocking];

  for (const record of snapshot.records) {
    if (!targetElection) continue;
    const raceMatches = state.races.filter((race) => {
      if (race.election_id !== targetElection.id || race.race_type !== record.raceType || race.is_public !== true) return false;
      const region = regionsById.get(race.region_id);
      if (!region || normalizeText(region.name) !== normalizeText(record.regionName)) return false;
      return mayorRaceTypes.has(record.raceType) || sameDistrict(record.districtName, race.title);
    });

    if (raceMatches.length !== 1) {
      blocking.push({
        sourceCandidateKey: record.sourceCandidateKey,
        reason: raceMatches.length === 0 ? 'race_not_found' : 'race_ambiguous',
        raceType: record.raceType,
        regionName: record.regionName,
        districtName: record.districtName,
        matchCount: raceMatches.length,
      });
      continue;
    }

    const race = raceMatches[0];
    const people = peopleByName.get(normalizeText(record.personName)) ?? [];
    const existingCandidates = state.candidates.filter((candidate) => (
      candidate.race_id === race.id && people.some((person) => person.id === candidate.person_id)
    ));
    const canonicalGroups = canonicalIdentityGroups(snapshot, record, people, state, regionsById);
    const strongMatches = canonicalGroups.filter((group) => group.partyMatch && group.geographyMatch);
    const partialMatches = canonicalGroups.filter((group) => group.partyMatch || group.geographyMatch);
    const selectedGroup = strongMatches.length === 1
      ? strongMatches[0]
      : partialMatches.length === 1
        ? partialMatches[0]
        : canonicalGroups.length === 1
          ? canonicalGroups[0]
          : null;
    const identityResolution = people.length === 0
      ? 'new_person'
      : strongMatches.length === 1
        ? 'high_confidence_match'
        : selectedGroup
          ? 'probable_match'
          : 'needs_identity_review';
    const planned = {
      record, race, people, existingCandidates, canonicalGroups, selectedGroup, identityResolution,
    };
    matched.push(planned);
    if (people.length === 0) newPersonReview.push(planned);
    else if (identityResolution === 'high_confidence_match') highConfidenceMatch.push(planned);
    else if (identityResolution === 'probable_match') probableMatch.push(planned);
    else identityReview.push(planned);
  }

  return { matched, highConfidenceMatch, probableMatch, identityReview, newPersonReview, blocking };
}

function restUrl(supabaseUrl, pathname) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`);
}

async function fetchRows(config, tableName, select, filters = {}) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const url = restUrl(config.supabaseUrl, tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    const response = await fetch(url, {
      headers: { apikey: config.serviceRoleKey, authorization: `Bearer ${config.serviceRoleKey}` },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`Failed to fetch ${tableName}: ${body?.message ?? response.statusText}`);
    rows.push(...body);
    if (body.length < pageSize) return rows;
  }
}

function quotePostgrestValue(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

async function fetchRowsByValues(config, tableName, select, column, values) {
  const rows = [];
  const uniqueValues = Array.from(new Set(values.filter(Boolean)));
  for (let index = 0; index < uniqueValues.length; index += 100) {
    const chunk = uniqueValues.slice(index, index + 100);
    rows.push(...await fetchRows(config, tableName, select, {
      [column]: `in.(${chunk.map(quotePostgrestValue).join(',')})`,
    }));
  }
  return rows;
}

function readSnapshot(inputPath) {
  const resolvedPath = path.resolve(inputPath);
  if (!fs.existsSync(resolvedPath)) throw new Error(`Input file not found: ${resolvedPath}`);
  return { resolvedPath, raw: JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { resolvedPath, raw } = readSnapshot(options.inputPath);
  const snapshot = validateSnapshot(raw);
  const localEnv = readLocalEnv();
  const config = {
    supabaseUrl: process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

  const elections = await fetchRows(config, 'elections', 'id,external_id', { external_id: `eq.${targetElectionExternalId}` });
  const races = elections.length === 1
    ? await fetchRows(config, 'races', 'id,election_id,region_id,race_type,title,is_public', { election_id: `eq.${elections[0].id}` })
    : [];
  const [targetRegions, people] = await Promise.all([
    fetchRowsByValues(config, 'regions', 'id,name', 'id', races.map((row) => row.region_id)),
    fetchRowsByValues(config, 'people', 'id,external_id,name,party,position,district,is_public', 'name', snapshot.records.map((row) => row.personName)),
  ]);
  const [canonicalMap, candidates] = await Promise.all([
    fetchRowsByValues(config, 'person_canonical_map', 'person_id,canonical_person_id', 'person_id', people.map((row) => row.id)),
    fetchRowsByValues(config, 'candidates', 'id,person_id,race_id,candidacy_status,party,source_url', 'person_id', people.map((row) => row.id)),
  ]);
  const historyRaces = await fetchRowsByValues(
    config, 'races', 'id,region_id,race_type,title', 'id', candidates.map((row) => row.race_id),
  );
  const historyRegions = await fetchRowsByValues(
    config, 'regions', 'id,name', 'id', historyRaces.map((row) => row.region_id),
  );
  const regions = Array.from(
    new Map([...targetRegions, ...historyRegions].map((region) => [region.id, region])).values(),
  );
  const plan = planPartyCandidateImport(snapshot, {
    elections, races, regions, people, candidates, canonicalMap, historyRaces,
  });
  let writeResult = null;
  if (plan.blocking.length === 0 && options.mode === 'stage') {
    writeResult = await stagePartyCandidateReview(config, snapshot, plan);
  }
  if (plan.blocking.length === 0 && options.mode === 'apply-reviewed') {
    const reviewFile = path.resolve(options.reviewPath);
    if (!fs.existsSync(reviewFile)) throw new Error(`Review file not found: ${reviewFile}`);
    const review = validateReviewFile(
      JSON.parse(fs.readFileSync(reviewFile, 'utf8')),
      snapshot,
      plan,
    );
    const staged = await stagePartyCandidateReview(config, snapshot, plan);
    const applied = await applyReviewedPartyCandidates(config, snapshot, plan, review);
    writeResult = { ...staged, ...applied, reviewFile };
  }
  const result = {
    status: plan.blocking.length > 0 ? 'blocked' : 'ok',
    mode: options.mode,
    dryRun: options.mode === 'dry-run',
    inputPath: resolvedPath,
    party: snapshot.party,
    recordCount: snapshot.records.length,
    matchedRaceCount: plan.matched.length,
    highConfidenceMatchCount: plan.highConfidenceMatch.length,
    probableMatchCount: plan.probableMatch.length,
    identityReviewCount: plan.identityReview.length,
    newPersonReviewCount: plan.newPersonReview.length,
    existingCandidateReviewCount: plan.matched.filter((item) => item.existingCandidates.length > 0).length,
    blockingCount: plan.blocking.length,
    blocking: plan.blocking,
    sample: plan.matched.slice(0, 20).map((item) => ({
      sourceCandidateKey: item.record.sourceCandidateKey,
      personName: item.record.personName,
      raceTitle: item.race.title,
      personMatchCount: item.people.length,
      canonicalMatchCount: item.canonicalGroups.length,
      existingCandidateMatchCount: item.existingCandidates.length,
      identityResolution: item.identityResolution,
      selectedCanonicalPersonId: item.selectedGroup?.canonicalPersonId ?? null,
    })),
    writeResult,
  };
  console.log(JSON.stringify(result, null, 2));
  if (plan.blocking.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  chineseNumberToInteger,
  districtDescriptor,
  planPartyCandidateImport,
  validateSnapshot,
};
