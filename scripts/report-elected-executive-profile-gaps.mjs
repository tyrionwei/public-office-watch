import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(repoRoot, 'data-sources', 'elected-executive-profile-gaps.json');
const localElectionYear = 2022;
const nationalElectionYear = 2024;
const countyCityNames = [
  '臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市',
  '基隆市', '新竹市', '嘉義市', '新竹縣', '苗栗縣', '彰化縣',
  '南投縣', '雲林縣', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '臺東縣', '澎湖縣', '金門縣', '連江縣',
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
        const value = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '') : '';
        return [key, value];
      }),
  );
}

const localEnv = readLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY?.trim() || localEnv.SUPABASE_ANON_KEY || '';

function presidentialTicketRoles() {
  const roles = new Map();
  const sourceDirectory = path.join(repoRoot, 'data-sources');
  const seedFiles = fs.readdirSync(sourceDirectory)
    .filter((fileName) => fileName.includes('election-history') && fileName.endsWith('.seed.json'));

  for (const fileName of seedFiles) {
    const seed = JSON.parse(fs.readFileSync(path.join(sourceDirectory, fileName), 'utf8'));
    for (const sourcePerson of seed.sourcePeople ?? []) {
      const ticketRole = sourcePerson.sourcePayload?.ticketRole;
      if (!['president', 'vice_president'].includes(ticketRole)) continue;
      roles.set(
        `${Number(sourcePerson.electionYear)}:${normalizeTaiwanText(sourcePerson.rawName)}`,
        ticketRole,
      );
    }
  }

  return roles;
}

function restUrl(viewName) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${viewName}`);
}

async function fetchAllRows(viewName, select, params = {}, pageSize = 1000) {
  const rows = [];

  for (let offset = 0; ; offset += pageSize) {
    const url = restUrl(viewName);
    url.searchParams.set('select', select);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    const response = await fetch(url, {
      headers: { apikey: anonKey, authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`GET ${viewName} failed: ${body?.message ?? response.statusText}`);
    rows.push(...body);
    if (body.length < pageSize) return rows;
  }
}

function normalizeTaiwanText(value) {
  return String(value ?? '').replaceAll('台', '臺').replace(/\s+/g, '');
}

function electedOffice(candidate, ticketRoles) {
  const electionText = normalizeTaiwanText(`${candidate.election_name ?? ''}${candidate.race_title ?? ''}`);
  const raceType = String(candidate.race_type ?? '').toLowerCase();
  const regionName = normalizeTaiwanText(candidate.region_name);

  if (['municipality_mayor', 'county_mayor', 'county_chief'].includes(raceType)) {
    const matchedRegion = countyCityNames.find((name) => normalizeTaiwanText(name) === regionName);
    if (matchedRegion) {
      return {
        officeType: 'local_chief',
        officeName: `${matchedRegion}${matchedRegion.endsWith('市') ? '市長' : '縣長'}`,
      };
    }
  }

  for (const regionName of countyCityNames) {
    const officeName = `${regionName}${regionName.endsWith('市') ? '市長' : '縣長'}`;
    if (electionText.includes(officeName)) return { officeType: 'local_chief', officeName };
  }

  if (electionText.includes('總統')) {
    const ticketRole = ticketRoles.get(
      `${Number(candidate.election_year)}:${normalizeTaiwanText(candidate.person_name)}`,
    );
    if (ticketRole === 'president') return { officeType: 'president', officeName: '總統' };
    if (ticketRole === 'vice_president') return { officeType: 'vice_president', officeName: '副總統' };
  }

  return null;
}

function postgrestIn(values) {
  return `in.(${values.map((value) => `"${String(value)}"`).join(',')})`;
}

async function fetchPeople(personIds) {
  const people = [];
  for (let index = 0; index < personIds.length; index += 20) {
    people.push(...await fetchAllRows(
      'public_people_directory',
      'person_id,name,alias,party,position,election_year,district,gender,education,experience,primary_photo_url,current_office_label,upcoming_candidate_label,list_role,list_status',
      { person_id: postgrestIn(personIds.slice(index, index + 20)) },
    ));
  }
  return people;
}

async function fetchClaims(personIds) {
  const claims = [];
  for (let index = 0; index < personIds.length; index += 20) {
    claims.push(...await fetchAllRows(
      'public_person_claims',
      'person_id,claim_type,claim_value,source_name,source_url,confidence_level',
      { person_id: postgrestIn(personIds.slice(index, index + 20)) },
    ));
  }
  return claims;
}

function isBlank(value) {
  return value == null || String(value).trim() === '';
}

function profileMissing(person, claimTypes) {
  const missing = [];
  if (!claimTypes.has('birth_date')) missing.push('birth_date');
  if ((isBlank(person.gender) || person.gender === 'unknown') && !claimTypes.has('gender')) missing.push('gender');
  if (isBlank(person.education) && !claimTypes.has('education')) missing.push('education');
  if (isBlank(person.experience) && !claimTypes.has('experience')) missing.push('experience');
  if (isBlank(person.primary_photo_url)) missing.push('licensed_photo');
  return missing;
}

async function main() {
  if (!anonKey) throw new Error('Set SUPABASE_ANON_KEY for elected executive reporting.');

  const [candidates, races] = await Promise.all([
    fetchAllRows(
      'public_candidates',
      'candidate_id,person_id,person_name,person_party,person_position,race_id,race_title,election_id,election_name,election_year,party,is_elected,election_result,source_name,source_url',
      { is_elected: 'eq.true' },
    ),
    fetchAllRows('public_races', 'race_id,race_type,region_name'),
  ]);
  const racesById = new Map(races.map((race) => [race.race_id, race]));
  const classifiedCandidates = candidates.map((candidate) => ({
    ...candidate,
    ...(racesById.get(candidate.race_id) ?? {}),
  }));
  const ticketRoles = presidentialTicketRoles();
  const executiveWins = classifiedCandidates
    .map((candidate) => ({ candidate, office: electedOffice(candidate, ticketRoles) }))
    .filter(({ office }) => office != null);
  const personIds = [...new Set(executiveWins.map(({ candidate }) => candidate.person_id))];
  const [people, claims] = await Promise.all([fetchPeople(personIds), fetchClaims(personIds)]);
  const peopleById = new Map(people.map((person) => [person.person_id, person]));
  const claimsByPerson = new Map();

  for (const claim of claims) {
    const personClaims = claimsByPerson.get(claim.person_id) ?? [];
    personClaims.push(claim);
    claimsByPerson.set(claim.person_id, personClaims);
  }

  const entries = personIds.map((personId) => {
    const person = peopleById.get(personId) ?? { person_id: personId };
    const personClaims = claimsByPerson.get(personId) ?? [];
    const claimTypes = new Set(personClaims.map((claim) => claim.claim_type));
    const wins = executiveWins
      .filter(({ candidate }) => candidate.person_id === personId)
      .map(({ candidate, office }) => ({
        officeType: office.officeType,
        officeName: office.officeName,
        electionYear: candidate.election_year,
        electionName: candidate.election_name,
        raceTitle: candidate.race_title,
        party: candidate.party ?? candidate.person_party,
        sourceName: candidate.source_name,
        sourceUrl: candidate.source_url,
      }))
      .sort((left, right) => Number(right.electionYear) - Number(left.electionYear));
    const latestWin = wins[0];
    const shouldBeCurrent = latestWin?.officeType === 'local_chief'
      ? Number(latestWin.electionYear) === localElectionYear
      : Number(latestWin?.electionYear) === nationalElectionYear;
    const currentOfficeText = normalizeTaiwanText(person.current_office_label);
    const hasMatchingCurrentExecutiveOffice = latestWin
      ? currentOfficeText.includes(normalizeTaiwanText(latestWin.officeName))
      : false;

    return {
      personId,
      name: person.name ?? executiveWins.find(({ candidate }) => candidate.person_id === personId)?.candidate.person_name,
      listStatus: person.list_status ?? null,
      listRole: person.list_role ?? null,
      currentOfficeLabel: person.current_office_label ?? null,
      shouldBeCurrent,
      currentExecutiveStatusMismatch: shouldBeCurrent !== hasMatchingCurrentExecutiveOffice,
      profile: {
        alias: person.alias ?? null,
        party: person.party ?? null,
        gender: person.gender ?? 'unknown',
        education: person.education ?? null,
        experience: person.experience ?? null,
        primaryPhotoUrl: person.primary_photo_url ?? null,
      },
      missing: profileMissing(person, claimTypes),
      wins,
      publicClaimSources: [...new Map(
        personClaims
          .filter((claim) => claim.source_url)
          .map((claim) => [claim.source_url, { sourceName: claim.source_name, sourceUrl: claim.source_url }]),
      ).values()],
    };
  }).sort((left, right) =>
    Number(right.currentExecutiveStatusMismatch) - Number(left.currentExecutiveStatusMismatch)
    || right.missing.length - left.missing.length
    || left.name.localeCompare(right.name, 'zh-Hant-TW'));

  const output = {
    schemaVersion: 1,
    name: 'elected-executive-profile-gaps',
    generatedAt: new Date().toISOString(),
    scope: 'Elected presidents, vice presidents, and county/city chiefs found in the local published election history.',
    summary: {
      personCount: entries.length,
      winCount: executiveWins.length,
      currentExecutiveStatusMismatchCount: entries.filter((entry) => entry.currentExecutiveStatusMismatch).length,
      missingBirthDateCount: entries.filter((entry) => entry.missing.includes('birth_date')).length,
      missingGenderCount: entries.filter((entry) => entry.missing.includes('gender')).length,
      missingEducationCount: entries.filter((entry) => entry.missing.includes('education')).length,
      missingExperienceCount: entries.filter((entry) => entry.missing.includes('experience')).length,
      missingLicensedPhotoCount: entries.filter((entry) => entry.missing.includes('licensed_photo')).length,
    },
    entries,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, ...output.summary }, null, 2));
}

main().catch((error) => {
  console.error(`elected executive profile report failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exit(1);
});
