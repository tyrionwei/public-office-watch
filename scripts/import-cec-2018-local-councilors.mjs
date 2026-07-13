import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cecBaseUrl = 'https://db.cec.gov.tw/static/elections';
const sourceName = '中央選舉委員會選舉資料庫';
const sourceUrl = 'https://db.cec.gov.tw/ElecTable/Election';
const electionExternalId = 'cec-2018-local-public-officials';
const electionDate = '2018-11-24';
const councilorKinds = [
  { legislatorTypeId: 'T1', kind: 'regional', label: '區域' },
  { legislatorTypeId: 'T2', kind: 'plain-indigenous', label: '平地原住民' },
  { legislatorTypeId: 'T3', kind: 'mountain-indigenous', label: '山地原住民' },
];

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
  const options = { write: false };
  for (const arg of argv) {
    if (arg === '--write') {
      options.write = true;
      continue;
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }
  return options;
}

const localEnv = readLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY;

function requireSupabaseConfig() {
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment or .env.local');
  }
}

function restUrl(pathname) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`);
}

async function fetchRows(tableName, select, params = {}) {
  const rows = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const url = restUrl(tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to fetch ${tableName}: ${body?.message ?? response.statusText}`);
    }

    rows.push(...body);
    if (body.length < pageSize) return rows;
  }
}

async function upsertRows(tableName, rows, conflictKey) {
  if (rows.length === 0) return [];

  const url = restUrl(tableName);
  url.searchParams.set('on_conflict', conflictKey);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to upsert ${tableName}: ${body?.message ?? response.statusText}`);
  }
  return body;
}

async function insertRows(tableName, rows) {
  if (rows.length === 0) return [];

  const response = await fetch(restUrl(tableName), {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to insert ${tableName}: ${body?.message ?? response.statusText}`);
  }
  return body;
}

function chunk(rows, size) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function hashId(value, length = 12) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, length);
}

function normalizeText(value) {
  return String(value ?? '').trim().replaceAll('台', '臺').replace(/\s+/g, '');
}

function normalizePartyName(value) {
  const party = String(value ?? '').trim();
  if (!party || party === ' ') return '未知政黨';
  if (party === '無黨籍及未經政黨推薦') return '無黨籍';
  if (party === '臺灣民眾黨') return '台灣民眾黨';
  return party;
}

function normalizeGender(value) {
  if (String(value) === '1') return 'male';
  if (String(value) === '2') return 'female';
  return 'unknown';
}

function uniqueBy(rows, keyName) {
  const seen = new Set();
  const uniqueRows = [];
  for (const row of rows) {
    const key = row[keyName];
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRows.push(row);
  }
  return uniqueRows;
}

function cecCountyParts(countyKey) {
  const key = String(countyKey ?? '');
  return {
    prvCode: key.slice(0, 2),
    cityCode: key.slice(2, 5),
  };
}

function cecAreaFileName(region) {
  const countyKey = String(region.external_id ?? '').replace(/^tw-county-/, '');
  const { prvCode, cityCode } = cecCountyParts(countyKey);
  return `${prvCode}_${cityCode}_00_000_0000`;
}

function councilorSubjectId(region) {
  return region.region_type === 'municipality' ? 'T1' : 'T2';
}

function councilorRaceType(region) {
  return region.region_type === 'county' ? 'county_councilor' : 'city_councilor';
}

function districtNumber(value) {
  const match = normalizeText(value).match(/第0*(\d+)選舉區/);
  return match ? Number(match[1]) : null;
}

function unwrapCecRows(json) {
  if (Array.isArray(json)) return json;
  for (const value of Object.values(json)) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

async function fetchCecJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    throw new Error(`Failed to fetch CEC JSON ${url}: ${response.status}`);
  }
  return response.json();
}

async function fetchCecThemes(subjectId) {
  const listJson = await fetchCecJson(`${cecBaseUrl}/list/ELC_${subjectId}.json`);
  return new Map(
    listJson
      .flatMap((group) => group.theme_items ?? [])
      .filter((item) => item.session === 107 && item.subject_id === subjectId)
      .map((item) => [item.legislator_type_id, item]),
  );
}

async function fetchCecCouncilorRows(regions) {
  const themesBySubject = new Map([
    ['T1', await fetchCecThemes('T1')],
    ['T2', await fetchCecThemes('T2')],
  ]);
  const rows = [];

  for (const region of regions) {
    const subjectId = councilorSubjectId(region);
    const areaFileName = cecAreaFileName(region);
    for (const kind of councilorKinds) {
      const theme = themesBySubject.get(subjectId)?.get(kind.legislatorTypeId);
      if (!theme) {
        throw new Error(`Missing 2018 CEC councilor theme for ${subjectId}/${kind.legislatorTypeId}`);
      }

      const ticketsUrl = `${cecBaseUrl}/data/tickets/ELC/${subjectId}/${kind.legislatorTypeId}/${theme.theme_id}/A/${areaFileName}.json`;
      const response = await fetch(ticketsUrl, { signal: AbortSignal.timeout(30000) });
      if (response.status === 404) continue;
      if (!response.ok) {
        throw new Error(`Failed to fetch CEC JSON ${ticketsUrl}: ${response.status}`);
      }

      const ticketRows = unwrapCecRows(await response.json());
      for (const row of ticketRows) {
        rows.push({ ...row, region, subjectId, kind, theme, ticketsUrl });
      }
    }
  }

  return rows;
}

function buildImportRows(cecRows) {
  const raceRowsByExternalId = new Map();
  const personRows = [];
  const candidateSpecs = [];

  for (const row of cecRows) {
    const region = row.region;
    const countyKey = String(region.external_id).replace(/^tw-county-/, '');
    const areaCode = String(row.area_code ?? '').padStart(2, '0');
    const districtLabel = `第${areaCode}選舉區`;
    const raceExternalId = `cec-2018-local-councilor-${row.kind.kind}-${countyKey}-${areaCode}`;
    const raceTitle = `${region.name}${districtLabel}${row.kind.label}議員選舉`;

    raceRowsByExternalId.set(raceExternalId, {
      external_id: raceExternalId,
      election_id: null,
      region_id: region.id,
      race_type: councilorRaceType(region),
      title: raceTitle,
      voting_date: electionDate,
      status: 'completed',
      source_name: sourceName,
      source_url: row.ticketsUrl,
      is_public: true,
    });

    const candidateNo = String(row.cand_no ?? '').trim();
    const candidateName = String(row.cand_name ?? '').trim();
    const party = normalizePartyName(row.party_name);
    const elected = String(row.is_victor ?? '').trim() === '*';
    const rowKey = `${row.kind.kind}-${countyKey}-${areaCode}-${row.cand_id ?? hashId(`${raceExternalId}|${candidateNo}|${candidateName}`)}`;
    const personExternalId = `cec-2018-local-councilor-person-${rowKey}`;
    const candidateExternalId = `cec-2018-local-councilor-candidate-${rowKey}`;

    personRows.push({
      external_id: personExternalId,
      name: candidateName,
      party,
      position: elected ? `${region.name}${row.kind.label}議員` : `${region.name}${row.kind.label}議員候選人`,
      election_year: 2018,
      district: `${region.name}${districtLabel}`,
      source_url: row.ticketsUrl,
      is_public: true,
      gender: normalizeGender(row.cand_sex),
      education: row.cand_edu ? String(row.cand_edu).trim() : null,
    });

    candidateSpecs.push({
      external_id: candidateExternalId,
      person_external_id: personExternalId,
      race_external_id: raceExternalId,
      region_name: region.name,
      district_number: Number(areaCode),
      candidate_name: candidateName,
      candidate_no: candidateNo,
      party,
      source_url: row.ticketsUrl,
      vote_count: Number.isFinite(Number(row.ticket_num)) ? Number(row.ticket_num) : null,
      vote_rate: Number.isFinite(Number(row.ticket_percent)) ? Number(row.ticket_percent) : null,
      is_elected: elected,
      is_incumbent: String(row.is_current ?? '').trim() === 'Y',
    });
  }

  return {
    electionRow: {
      external_id: electionExternalId,
      name: '2018年地方公職人員選舉',
      year: 2018,
      election_type: 'local',
      voting_date: electionDate,
      status: 'completed',
      source_name: sourceName,
      source_url: sourceUrl,
      is_public: true,
    },
    raceRows: Array.from(raceRowsByExternalId.values()),
    personRows,
    candidateSpecs,
  };
}

function isLegacyVoteTwCouncilorRace(race, election) {
  if (!race.external_id?.startsWith('votetw-race-') || !election?.external_id?.startsWith('votetw-election-')) {
    return false;
  }
  return normalizeText(`${election.name} ${race.title} ${race.race_type}`).includes('議員');
}

function buildMergeRows({ cecRaceRows, cecCandidateRows, oldData, existingDecisions }) {
  const electionById = new Map(oldData.elections.map((election) => [election.id, election]));
  const candidatesByRaceId = Map.groupBy(oldData.candidates, (candidate) => candidate.race_id);
  const personById = new Map(oldData.people.map((person) => [person.id, person]));
  const canonicalPersonById = new Map(oldData.personCanonicalMap.map((row) => [row.person_id, row.canonical_person_id]));
  const activeElectionDuplicateIds = new Set(existingDecisions.election.map((row) => row.duplicate_election_id));
  const activeRaceDuplicateIds = new Set(existingDecisions.race.map((row) => row.duplicate_race_id));
  const activePersonDuplicateIds = new Set(existingDecisions.person.map((row) => row.duplicate_person_id));
  const cecRaceByDistrictKey = new Map();
  const oldRaceByCecRaceId = new Map();

  for (const race of cecRaceRows) {
    const district = districtNumber(race.title);
    const countyName = normalizeText(race.title).split('第')[0];
    if (district) cecRaceByDistrictKey.set(`${countyName}|${district}`, race);
  }

  const electionMergeRows = [];
  const raceMergeRows = [];
  for (const race of oldData.races) {
    const election = electionById.get(race.election_id);
    if (!isLegacyVoteTwCouncilorRace(race, election)) continue;

    const district = districtNumber(race.title);
    const countyName = normalizeText(race.title).split('第')[0];
    const cecRace = district ? cecRaceByDistrictKey.get(`${countyName}|${district}`) : null;
    if (!cecRace || cecRace.id === race.id) continue;

    oldRaceByCecRaceId.set(cecRace.id, race);
    if (!activeRaceDuplicateIds.has(race.id)) {
      raceMergeRows.push({
        duplicate_race_id: race.id,
        canonical_race_id: cecRace.id,
        relation_type: 'same_race',
        status: 'verified',
        confidence_level: 'A',
        reason: '2018 CEC councilor race replaces legacy VoteTW split race with the same county/city and election district.',
        evidence_json: {
          source: 'cec-2018-local-councilor-import',
          legacyRaceExternalId: race.external_id,
          cecRaceExternalId: cecRace.external_id,
        },
        reviewed_by: 'data-script',
        reviewed_at: new Date().toISOString(),
      });
    }

    if (!activeElectionDuplicateIds.has(election.id)) {
      electionMergeRows.push({
        duplicate_election_id: election.id,
        canonical_election_id: cecRace.election_id,
        relation_type: 'same_election',
        status: 'verified',
        confidence_level: 'B',
        reason: 'Legacy VoteTW split councilor election is represented by the official 2018 local public officials election aggregate.',
        evidence_json: {
          source: 'cec-2018-local-councilor-import',
          legacyElectionExternalId: election.external_id,
          canonicalElectionExternalId: electionExternalId,
          legacyRaceExternalId: race.external_id,
          cecRaceExternalId: cecRace.external_id,
        },
        reviewed_by: 'data-script',
        reviewed_at: new Date().toISOString(),
      });
    }
  }

  const personMergeRows = [];
  for (const cecCandidate of cecCandidateRows) {
    const oldRace = oldRaceByCecRaceId.get(cecCandidate.race_id);
    if (!oldRace) continue;

    const cecPerson = personById.get(cecCandidate.person_id);
    const oldCandidate = (candidatesByRaceId.get(oldRace.id) ?? []).find((candidate) => {
      const oldPerson = personById.get(candidate.person_id);
      const sameCandidateNo = String(candidate.candidate_no ?? '') === String(cecCandidate.candidate_no ?? '');
      const sameName = normalizeText(oldPerson?.name) === normalizeText(cecPerson?.name);
      const sameOfficialResult = normalizeText(candidate.party) === normalizeText(cecCandidate.party)
        && candidate.vote_count !== null
        && candidate.vote_count === cecCandidate.vote_count;
      return sameCandidateNo && (sameName || sameOfficialResult);
    });
    if (!oldCandidate) continue;

    const canonicalPersonId = canonicalPersonById.get(oldCandidate.person_id) ?? oldCandidate.person_id;
    if (canonicalPersonId === cecCandidate.person_id || activePersonDuplicateIds.has(cecCandidate.person_id)) continue;

    personMergeRows.push({
      duplicate_person_id: cecCandidate.person_id,
      canonical_person_id: canonicalPersonId,
      status: 'verified',
      confidence_level: 'A',
      reason: 'CEC 2018 councilor candidate matches legacy VoteTW candidate by race, candidate number, and name.',
      evidence_json: {
        source: 'cec-2018-local-councilor-import',
        cecCandidateExternalId: cecCandidate.external_id,
        legacyRaceExternalId: oldRace.external_id,
      },
      reviewed_by: 'data-script',
      reviewed_at: new Date().toISOString(),
    });
  }

  return {
    electionMergeRows: uniqueBy(electionMergeRows, 'duplicate_election_id'),
    raceMergeRows: uniqueBy(raceMergeRows, 'duplicate_race_id'),
    personMergeRows: uniqueBy(personMergeRows, 'duplicate_person_id'),
  };
}

async function fetchMergeSourceData() {
  const [
    elections,
    races,
    candidates,
    people,
    personCanonicalMap,
    electionDecisions,
    raceDecisions,
    personDecisions,
  ] = await Promise.all([
    fetchRows('elections', 'id,external_id,name,year,election_type,source_name', { year: 'eq.2018' }),
    fetchRows('races', 'id,external_id,election_id,region_id,race_type,title,source_name'),
    fetchRows('candidates', 'id,external_id,race_id,person_id,party,candidate_no,vote_count,is_elected'),
    fetchRows('people', 'id,name,external_id,is_public'),
    fetchRows('person_canonical_map', 'person_id,canonical_person_id'),
    fetchRows('election_merge_decisions', 'duplicate_election_id,canonical_election_id,status', { status: 'in.(suggested,verified)' }),
    fetchRows('race_merge_decisions', 'duplicate_race_id,canonical_race_id,status', { status: 'in.(suggested,verified)' }),
    fetchRows('person_merge_decisions', 'duplicate_person_id,canonical_person_id,status', { status: 'in.(suggested,verified)' }),
  ]);

  return {
    oldData: { elections, races, candidates, people, personCanonicalMap },
    existingDecisions: {
      election: electionDecisions,
      race: raceDecisions,
      person: personDecisions,
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  requireSupabaseConfig();

  const allRegions = await fetchRows('regions', 'id,name,region_type,external_id,is_public');
  const countyRegions = allRegions
    .filter((region) => ['municipality', 'county', 'city'].includes(region.region_type))
    .filter((region) => String(region.external_id ?? '').startsWith('tw-county-'))
    .sort((left, right) => String(left.external_id).localeCompare(String(right.external_id)));
  const cecRows = await fetchCecCouncilorRows(countyRegions);
  const importRows = buildImportRows(cecRows);

  const summary = {
    mode: options.write ? 'write' : 'dry-run',
    cecRows: cecRows.length,
    elections: 1,
    races: importRows.raceRows.length,
    people: importRows.personRows.length,
    candidates: importRows.candidateSpecs.length,
    scope: '2018 CEC local councilors only: T1 municipality councilors, T2 county/city councilors; regional/plain/mountain indigenous',
  };

  if (!options.write) {
    console.log(JSON.stringify({
      ...summary,
      sampleRaces: importRows.raceRows.slice(0, 8).map((race) => ({ externalId: race.external_id, title: race.title })),
      sampleCandidates: importRows.candidateSpecs.slice(0, 10).map((candidate) => ({
        region: candidate.region_name,
        district: candidate.district_number,
        no: candidate.candidate_no,
        name: candidate.candidate_name,
        party: candidate.party,
        votes: candidate.vote_count,
        elected: candidate.is_elected,
      })),
    }, null, 2));
    return;
  }

  const [election] = await upsertRows('elections', [importRows.electionRow], 'external_id');
  const racesToWrite = importRows.raceRows.map((race) => ({ ...race, election_id: election.id }));
  const cecRaceRows = [];
  for (const batch of chunk(racesToWrite, 100)) {
    cecRaceRows.push(...await upsertRows('races', batch, 'external_id'));
  }

  const cecPersonRows = [];
  for (const batch of chunk(importRows.personRows, 100)) {
    cecPersonRows.push(...await upsertRows('people', batch, 'external_id'));
  }

  const personByExternalId = new Map(cecPersonRows.map((person) => [person.external_id, person]));
  const raceByExternalId = new Map(cecRaceRows.map((race) => [race.external_id, race]));
  const candidateRows = importRows.candidateSpecs.map((candidate) => ({
    external_id: candidate.external_id,
    person_id: personByExternalId.get(candidate.person_external_id)?.id,
    race_id: raceByExternalId.get(candidate.race_external_id)?.id,
    party: candidate.party,
    candidate_no: candidate.candidate_no,
    registration_status: candidate.is_elected ? 'elected' : 'not_elected',
    source_name: sourceName,
    source_url: candidate.source_url,
    is_public: true,
    vote_count: candidate.vote_count,
    vote_rate: candidate.vote_rate,
    is_elected: candidate.is_elected,
    is_incumbent: candidate.is_incumbent,
  }));

  if (candidateRows.some((candidate) => !candidate.person_id || !candidate.race_id)) {
    throw new Error('Candidate row missing person_id or race_id after upsert');
  }

  const cecCandidateRows = [];
  for (const batch of chunk(candidateRows, 100)) {
    cecCandidateRows.push(...await upsertRows('candidates', batch, 'external_id'));
  }

  const mergeSourceData = await fetchMergeSourceData();
  const mergeRows = buildMergeRows({ cecRaceRows, cecCandidateRows, ...mergeSourceData });
  for (const batch of chunk(mergeRows.raceMergeRows, 100)) {
    await insertRows('race_merge_decisions', batch);
  }
  for (const batch of chunk(mergeRows.electionMergeRows, 100)) {
    await insertRows('election_merge_decisions', batch);
  }
  for (const batch of chunk(mergeRows.personMergeRows, 100)) {
    await insertRows('person_merge_decisions', batch);
  }

  console.log(JSON.stringify({
    ...summary,
    upsertedElectionId: election.id,
    upsertedRaces: cecRaceRows.length,
    upsertedPeople: cecPersonRows.length,
    upsertedCandidates: cecCandidateRows.length,
    insertedRaceMergeDecisions: mergeRows.raceMergeRows.length,
    insertedElectionMergeDecisions: mergeRows.electionMergeRows.length,
    insertedPersonMergeDecisions: mergeRows.personMergeRows.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
