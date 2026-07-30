import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

function parseArgs(argv) {
  const options = { write: false, migrationPath: null };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') {
      options.write = true;
      continue;
    }

    if (arg === '--migration') {
      options.migrationPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  return options;
}

const localEnv = readLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY;

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
    if (body.length < pageSize) {
      return rows;
    }
  }
}

async function insertRows(tableName, rows) {
  if (rows.length === 0) {
    return [];
  }

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

function sqlValue(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function renderMergeDecisionSql(rows) {
  if (rows.length === 0) throw new Error('No cross-year person merge decisions to render.');
  const values = rows.map((row) => `    (${[
    row.duplicate_person_id,
    row.canonical_person_id,
    row.confidence_level,
    row.reason,
    JSON.stringify(row.evidence_json),
    row.reviewed_by,
  ].map(sqlValue).join(', ')})`).join(',\n');

  return `-- Generated verified historical CEC person merge decisions.

CREATE TEMP TABLE _historical_cec_person_merges_20260730 (
    duplicate_person_id UUID PRIMARY KEY,
    canonical_person_id UUID NOT NULL,
    confidence_level TEXT NOT NULL,
    reason TEXT NOT NULL,
    evidence_json JSONB NOT NULL,
    reviewed_by TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _historical_cec_person_merges_20260730 (
    duplicate_person_id, canonical_person_id, confidence_level,
    reason, evidence_json, reviewed_by
) VALUES
${values};

DO \$verify\$
BEGIN
    IF (SELECT COUNT(*) FROM _historical_cec_person_merges_20260730) <> ${rows.length} THEN
        RAISE EXCEPTION 'Historical CEC person merge input count mismatch';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM _historical_cec_person_merges_20260730 input
        LEFT JOIN people duplicate ON duplicate.id = input.duplicate_person_id
        LEFT JOIN people canonical ON canonical.id = input.canonical_person_id
        WHERE duplicate.id IS NULL
           OR canonical.id IS NULL
           OR input.duplicate_person_id = input.canonical_person_id
    ) THEN
        RAISE EXCEPTION 'Historical CEC person merge input identity mismatch';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM _historical_cec_person_merges_20260730 input
        JOIN person_merge_decisions existing
          ON existing.duplicate_person_id = input.duplicate_person_id
         AND existing.status IN ('suggested', 'verified')
        WHERE existing.canonical_person_id <> input.canonical_person_id
    ) THEN
        RAISE EXCEPTION 'Historical CEC person merge gained a conflicting active decision';
    END IF;
END
\$verify\$;

INSERT INTO person_merge_decisions (
    duplicate_person_id, canonical_person_id, status, confidence_level,
    reason, evidence_json, reviewed_by, reviewed_at, updated_at
)
SELECT
    input.duplicate_person_id,
    input.canonical_person_id,
    'verified',
    input.confidence_level,
    input.reason,
    input.evidence_json,
    input.reviewed_by,
    NOW(),
    NOW()
FROM _historical_cec_person_merges_20260730 input
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = input.duplicate_person_id
      AND existing.status IN ('suggested', 'verified')
);

DO \$verify\$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _historical_cec_person_merges_20260730 input
        JOIN person_merge_decisions decision
          ON decision.duplicate_person_id = input.duplicate_person_id
         AND decision.canonical_person_id = input.canonical_person_id
         AND decision.status = 'verified'
    ) <> ${rows.length} THEN
        RAISE EXCEPTION 'Historical CEC person merge result mismatch';
    END IF;
END
\$verify\$;

SELECT published.promote(NULL);
`;
}

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .replaceAll('台', '臺')
    .replace(/\s+/g, '');
}

function normalizeCandidateName(value) {
  return normalizeText(value)
    .toLocaleLowerCase('en-US')
    .replace(/[．‧・·]/g, '');
}

function electionYear(candidate) {
  const value = `${candidate.election_name ?? ''} ${candidate.race_title ?? ''}`;
  const match = value.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function officeKind(candidate) {
  const value = `${candidate.election_name ?? ''} ${candidate.race_title ?? ''}`;

  if (value.includes('總統副總統')) return 'president';
  if (value.includes('立法委員')) return 'legislator';
  if (value.includes('議員選舉')) return 'councilor';
  if (/(?:市民代表|鄉民代表|鎮民代表|區民代表|代表)選舉/.test(value)) return 'representative';
  if (/[村里]長選舉/.test(value)) return 'village_chief';
  if (/(?:縣市長|[縣市鄉鎮區]長)選舉/.test(value)) return 'local_executive';
  return null;
}

function officeArea(candidate) {
  const title = normalizeText(candidate.race_title);
  const election = normalizeText(candidate.election_name);
  const region = normalizeText(candidate.region_name);
  const source = title || region || election;

  return source
    .replace(/^(19|20)\d{2}年/, '')
    .replace(/第\d+屆/g, '')
    .replace(/總統副總統全國選舉|總統副總統選舉/g, '全國')
    .replace(/立法委員選舉/g, '')
    .replace(/縣市長選舉/g, '')
    .replace(/[縣市]長選舉/g, '')
    .replace(/[鄉鎮區]長選舉/g, '')
    .replace(/(?:區域|平地原住民|山地原住民)?議員選舉/g, '')
    .replace(/市民代表選舉|鄉民代表選舉|鎮民代表選舉|區民代表選舉|代表選舉/g, '')
    .replace(/[村里]長選舉/g, '')
    .replace(/選舉$/, '')
    .replace(/第0+(\d+)/g, '第$1')
    .trim();
}

function canonicalOfficeArea(kind, area) {
  if (kind !== 'representative') {
    return area;
  }

  return area.replace(
    /（(?:平地|山地|直轄市)?原住民）|(?:平地|山地|直轄市)?原住民/g,
    '原住民',
  );
}

function numberedOrUnnumberedDistrict(candidate) {
  const year = electionYear(candidate);
  const kind = officeKind(candidate);
  if (!year || !['legislator', 'councilor', 'representative'].includes(kind)) {
    return null;
  }

  const area = canonicalOfficeArea(kind, officeArea(candidate));
  const numberedMatch = area.match(/^(.+)第(\d+)選舉區$/);
  if (numberedMatch) {
    return {
      scopeKey: [year, kind, numberedMatch[1]].join('|'),
      jurisdiction: numberedMatch[1],
      districtNumber: Number(numberedMatch[2]),
      isUnnumbered: false,
    };
  }

  const unnumberedMatch = area.match(/^(.+(?:縣|市|區|鄉|鎮))選舉區$/);
  if (!unnumberedMatch) {
    return null;
  }

  return {
    scopeKey: [year, kind, unnumberedMatch[1]].join('|'),
    jurisdiction: unnumberedMatch[1],
    districtNumber: null,
    isUnnumbered: true,
  };
}

function buildSingleDistrictScopes(candidates) {
  const scopes = new Map();

  for (const candidate of candidates) {
    const identity = numberedOrUnnumberedDistrict(candidate);
    if (!identity) continue;

    const scope = scopes.get(identity.scopeKey) ?? {
      numbers: new Set(),
      hasUnnumbered: false,
    };
    if (identity.isUnnumbered) {
      scope.hasUnnumbered = true;
    } else {
      scope.numbers.add(identity.districtNumber);
    }
    scopes.set(identity.scopeKey, scope);
  }

  return new Set(
    [...scopes.entries()]
      .filter(([, scope]) => (
        scope.hasUnnumbered
        && scope.numbers.size === 1
        && scope.numbers.has(1)
      ))
      .map(([scopeKey]) => scopeKey),
  );
}

function sameElectionOfficeArea(candidate, singleDistrictScopes) {
  const kind = officeKind(candidate);
  const area = canonicalOfficeArea(kind, officeArea(candidate));
  const identity = numberedOrUnnumberedDistrict(candidate);

  if (
    identity
    && singleDistrictScopes.has(identity.scopeKey)
    && (identity.isUnnumbered || identity.districtNumber === 1)
  ) {
    return `${identity.jurisdiction}第1選舉區`;
  }

  return area;
}

function isDetailedLocalArea(kind, area) {
  if (kind === 'village_chief') {
    return /(?:縣|市).+(?:區|鄉|鎮|市).+[村里]$/.test(area);
  }
  if (kind === 'representative') {
    return /(?:縣|市).+(?:區|鄉|鎮|市)第\d+選舉區(?:（[^）]+）|原住民)?$/.test(area);
  }
  if (kind === 'councilor') {
    return /^(?:.+縣|.+市)第\d+選舉區(?:（[^）]+）)?$/.test(area);
  }
  if (kind === 'local_executive') {
    return /(?:縣|市).+(?:區|鄉|鎮|市)$/.test(area);
  }
  return false;
}

function isExactElectionArea(kind, area) {
  if (isDetailedLocalArea(kind, area)) {
    return true;
  }
  if (kind === 'president') {
    return area === '全國';
  }
  if (kind === 'legislator') {
    return /^(?:(?:.+縣|.+市)第\d+選舉區(?:（[^）]+）)?|全國不分區及僑居國外國民|平地原住民|山地原住民|全國(?:（[^）]+）)?)$/.test(area);
  }
  if (kind === 'local_executive') {
    return /^(?:.+縣|.+市)$/.test(area);
  }
  return false;
}

function candidateGroupKey(candidate) {
  const name = normalizeCandidateName(candidate.person_name);
  const party = normalizeText(candidate.party || candidate.person_party);
  const kind = officeKind(candidate);
  const area = canonicalOfficeArea(kind, officeArea(candidate));

  if (!name || !kind || !area) {
    return null;
  }

  if (isDetailedLocalArea(kind, area)) {
    return [name, kind, area].join('|');
  }

  if (!party || party === '無黨籍' || party === '未知政黨') return null;
  return [name, party, kind, area].join('|');
}

function sameElectionCandidateGroupKey(candidate, singleDistrictScopes) {
  const year = electionYear(candidate);
  const name = normalizeCandidateName(candidate.person_name);
  const kind = officeKind(candidate);
  const area = sameElectionOfficeArea(candidate, singleDistrictScopes);

  if (!year || !name || !kind || !isExactElectionArea(kind, area)) {
    return null;
  }

  return ['same-election', year, name, kind, area].join('|');
}

function decisionPairKey(leftPersonId, rightPersonId) {
  return [leftPersonId, rightPersonId].sort().join('|');
}

function compactCandidate(candidate) {
  return {
    candidateId: candidate.candidate_id,
    candidateExternalId: candidate.candidate_external_id,
    personId: candidate.person_id,
    personName: candidate.person_name,
    electionName: candidate.election_name,
    raceTitle: candidate.race_title,
    regionName: candidate.region_name,
    party: candidate.party,
    candidateNo: candidate.candidate_no,
    isElected: candidate.is_elected,
    voteCount: candidate.vote_count,
  };
}

export function buildCoreCandidateRows(dataset) {
  const peopleById = new Map(dataset.people.map((person) => [person.id, person]));
  const racesById = new Map(dataset.races.map((race) => [race.id, race]));
  const electionsById = new Map(dataset.elections.map((election) => [election.id, election]));
  const regionsById = new Map(dataset.regions.map((region) => [region.id, region]));
  const personCanonicalIds = new Map(
    dataset.personCanonicalMap.map((row) => [row.person_id, row.canonical_person_id]),
  );
  const raceCanonicalIds = new Map(
    dataset.raceCanonicalMap.map((row) => [row.race_id, row.canonical_race_id]),
  );
  const electionCanonicalIds = new Map(
    dataset.electionCanonicalMap.map((row) => [row.election_id, row.canonical_election_id]),
  );

  return dataset.candidates.map((candidate) => {
    const personId = personCanonicalIds.get(candidate.person_id) ?? candidate.person_id;
    const person = peopleById.get(personId) ?? peopleById.get(candidate.person_id);
    const raceId = raceCanonicalIds.get(candidate.race_id) ?? candidate.race_id;
    const race = racesById.get(raceId) ?? racesById.get(candidate.race_id);
    const electionId = race
      ? electionCanonicalIds.get(race.election_id) ?? race.election_id
      : null;
    const election = electionId ? electionsById.get(electionId) : null;
    const region = race?.region_id ? regionsById.get(race.region_id) : null;

    if (!person || !race || !election) return null;
    return {
      candidate_id: candidate.id,
      candidate_external_id: candidate.external_id,
      person_id: personId,
      person_name: person.name,
      person_party: person.party,
      election_name: election.name,
      race_title: race.title,
      region_name: region?.name ?? null,
      party: candidate.party,
      candidate_no: candidate.candidate_no,
      is_elected: candidate.is_elected,
      vote_count: candidate.vote_count,
      is_historical_cec: String(candidate.external_id ?? '').startsWith('cec-historical-candidate-'),
    };
  }).filter(Boolean);
}

function personCompleteness(person) {
  if (!person) return 0;
  const externalId = String(person.external_id ?? '');
  const isSourceScopedHistorical = externalId.startsWith('cec-historical-person-')
    || externalId.startsWith('cec-historical-unresolved-person-');
  let score = person.is_public ? 100 : 0;
  if (externalId.startsWith('cec-') && !isSourceScopedHistorical) score += 20;
  if (person.gender && person.gender !== 'unknown') score += 5;
  if (person.position) score += 5;
  if (person.district) score += 3;
  if (person.party) score += 2;
  if (person.external_id) score += 1;
  return score;
}

function chooseCanonicalPersonId(personIds, personById, canonicalPersonByPersonId) {
  const canonicalIds = [...new Set(personIds.map((personId) => canonicalPersonByPersonId.get(personId) ?? personId))];

  return canonicalIds
    .slice()
    .sort((left, right) => {
      const leftPerson = personById.get(left);
      const rightPerson = personById.get(right);
      return personCompleteness(rightPerson) - personCompleteness(leftPerson) || left.localeCompare(right);
    })[0];
}

function birthDatesConflict(personIds, birthDatesByPersonId) {
  const dateSets = personIds
    .map((personId) => [...new Set(birthDatesByPersonId.get(personId) ?? [])])
    .filter((dates) => dates.length > 0);

  for (let leftIndex = 0; leftIndex < dateSets.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < dateSets.length; rightIndex += 1) {
      const compatible = dateSets[leftIndex].some((left) => dateSets[rightIndex].some((right) => {
        if (left === right) return true;
        const leftYear = left.match(/^(19|20)\d{2}/)?.[0];
        const rightYear = right.match(/^(19|20)\d{2}/)?.[0];
        if (!leftYear || leftYear !== rightYear) return false;
        return left.endsWith('-01-01') || right.endsWith('-01-01');
      }));
      if (!compatible) return true;
    }
  }

  return false;
}

export function buildRows(candidateGroups, personById, canonicalPersonByPersonId, birthDatesByPersonId, existingDecisions) {
  const activeDuplicatePersonIds = new Set(
    existingDecisions
      .filter((decision) => ['suggested', 'verified'].includes(decision.status))
      .map((decision) => decision.duplicate_person_id),
  );
  const terminalDecisionKeys = new Set(
    existingDecisions
      .filter((decision) => ['verified', 'rejected', 'archived'].includes(decision.status))
      .map((decision) => decisionPairKey(decision.duplicate_person_id, decision.canonical_person_id)),
  );
  const candidateRowsByDuplicateId = new Map();
  const skipped = [];
  const duplicatePersonConflicts = [];

  for (const [key, candidates] of candidateGroups) {
    if (!candidates.some((candidate) => candidate.is_historical_cec)) {
      continue;
    }
    const sameElectionMatch = key.startsWith('same-election|');
    const years = new Set(candidates.map(electionYear).filter(Boolean));
    const personIds = [...new Set(candidates.map((candidate) => candidate.person_id).filter(Boolean))];

    if (personIds.length < 2 || (!sameElectionMatch && years.size < 2)) {
      continue;
    }

    const knownCandidateNumbers = new Set(
      candidates
        .map((candidate) => String(candidate.candidate_no ?? '').trim())
        .filter(Boolean),
    );
    const hasMissingCandidateNumber = candidates.some(
      (candidate) => !String(candidate.candidate_no ?? '').trim(),
    );

    if (sameElectionMatch && knownCandidateNumbers.size > 1) {
      skipped.push({
        reason: 'conflicting candidate numbers in the same election area',
        key,
        candidates: candidates.map(compactCandidate),
      });
      continue;
    }

    const canonicalPersonIds = [...new Set(
      personIds.map((personId) => canonicalPersonByPersonId.get(personId) ?? personId),
    )];
    const knownGenders = new Set(
      canonicalPersonIds
        .map((personId) => personById.get(personId)?.gender)
        .filter((gender) => gender && gender !== 'unknown'),
    );
    const hasBirthDateConflict = birthDatesConflict(canonicalPersonIds, birthDatesByPersonId);
    const peopleByYear = new Map();
    for (const candidate of candidates) {
      const year = electionYear(candidate);
      if (!year) continue;
      const personId = canonicalPersonByPersonId.get(candidate.person_id) ?? candidate.person_id;
      peopleByYear.set(year, new Set([...(peopleByYear.get(year) ?? []), personId]));
    }

    const hasAmbiguousSameYearCandidates = !sameElectionMatch
      && [...peopleByYear.values()].some((ids) => ids.size > 1);

    if (knownGenders.size > 1 || hasBirthDateConflict || hasAmbiguousSameYearCandidates) {
      skipped.push({
        reason: 'identity conflict or ambiguous same-year candidates',
        key,
        candidates: candidates.map(compactCandidate),
      });
      continue;
    }

    const canonicalPersonId = chooseCanonicalPersonId(personIds, personById, canonicalPersonByPersonId);
    if (!canonicalPersonId) {
      skipped.push({ reason: 'missing canonical person', key, candidates: candidates.map(compactCandidate) });
      continue;
    }

    for (const personId of personIds) {
      const duplicatePersonId = canonicalPersonByPersonId.get(personId) ?? personId;

      if (duplicatePersonId === canonicalPersonId) {
        continue;
      }

      if (activeDuplicatePersonIds.has(duplicatePersonId)) {
        skipped.push({ reason: 'duplicate person already has active decision', key, duplicatePersonId, canonicalPersonId });
        continue;
      }

      if (terminalDecisionKeys.has(decisionPairKey(duplicatePersonId, canonicalPersonId))) {
        skipped.push({ reason: 'pair already has terminal decision', key, duplicatePersonId, canonicalPersonId });
        continue;
      }

      const kind = officeKind(candidates[0]);
      const area = officeArea(candidates[0]);
      const detailedLocalMatch = isDetailedLocalArea(kind, area);
      const row = {
        duplicate_person_id: duplicatePersonId,
        canonical_person_id: canonicalPersonId,
        status: 'verified',
        confidence_level: sameElectionMatch && hasMissingCandidateNumber ? 'C' : 'B',
        reason: sameElectionMatch
          ? 'same name, election year, office type, and exact constituency with no conflicting known candidate number'
          : detailedLocalMatch
            ? 'same name and complete local constituency across election years; records consolidated under the preferred canonical person'
            : 'same name, same party, same office type, and same constituency across election years',
        evidence_json: {
          rule: sameElectionMatch
            ? 'same_election_exact_area_compatible_candidate_number'
            : detailedLocalMatch
              ? 'cross_year_exact_local_area'
              : 'cross_year_same_name_party_office_area',
          key,
          officeKind: kind,
          candidateNumbers: [...knownCandidateNumbers],
          hasMissingCandidateNumber,
          canonicalSelection: canonicalPersonIds.map((personId) => ({
            personId,
            completeness: personCompleteness(personById.get(personId)),
          })),
          candidates: candidates.map(compactCandidate),
        },
        reviewed_by: sameElectionMatch
          ? 'system:same-election-candidate-person-merge'
          : 'system:cross-year-candidate-person-merge',
        reviewed_at: new Date().toISOString(),
      };
      candidateRowsByDuplicateId.set(duplicatePersonId, [
        ...(candidateRowsByDuplicateId.get(duplicatePersonId) ?? []),
        row,
      ]);
    }
  }

  const rows = [];
  for (const [duplicatePersonId, candidateRows] of candidateRowsByDuplicateId) {
    const canonicalIds = new Set(candidateRows.map((row) => row.canonical_person_id));

    if (canonicalIds.size > 1) {
      duplicatePersonConflicts.push({ duplicatePersonId, candidateRows });
      continue;
    }

    rows.push(candidateRows[0]);
  }

  return { rows, skipped, duplicatePersonConflicts };
}

async function main() {
  if (!serviceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for cross-year candidate person merge decisions.');
  }

  const options = parseArgs(process.argv.slice(2));
  const [coreCandidates, people, races, elections, regions, birthDateClaims, canonicalMapRows, raceCanonicalMap, electionCanonicalMap, existingDecisions] = await Promise.all([
    fetchRows('candidates', 'id,external_id,person_id,race_id,party,candidate_no,is_elected,vote_count', { order: 'id.asc' }),
    fetchRows('people', 'id,name,gender,party,position,district,external_id,is_public', { order: 'id.asc' }),
    fetchRows('races', 'id,election_id,region_id,title', { order: 'id.asc' }),
    fetchRows('elections', 'id,name', { order: 'id.asc' }),
    fetchRows('regions', 'id,name', { order: 'id.asc' }),
    fetchRows('public_person_claims', 'claim_id,person_id,claim_value,claim_json', {
      claim_type: 'eq.birth_date',
      order: 'claim_id.asc',
    }),
    fetchRows('person_canonical_map', 'person_id,canonical_person_id', { order: 'person_id.asc' }),
    fetchRows('race_canonical_map', 'race_id,canonical_race_id', { order: 'race_id.asc' }),
    fetchRows('election_canonical_map', 'election_id,canonical_election_id', { order: 'election_id.asc' }),
    fetchRows('person_merge_decisions', 'id,duplicate_person_id,canonical_person_id,status', { order: 'id.asc' }),
  ]);
  const candidates = buildCoreCandidateRows({
    candidates: coreCandidates,
    people,
    races,
    elections,
    regions,
    personCanonicalMap: canonicalMapRows,
    raceCanonicalMap,
    electionCanonicalMap,
  });
  const personById = new Map(people.map((person) => [person.id, person]));
  const birthDatesByPersonId = new Map();
  for (const claim of birthDateClaims) {
    const value = String(claim.claim_value ?? claim.claim_json?.value ?? '').trim();
    if (!value) continue;
    birthDatesByPersonId.set(claim.person_id, [
      ...(birthDatesByPersonId.get(claim.person_id) ?? []),
      value,
    ]);
  }
  const canonicalPersonByPersonId = new Map(
    canonicalMapRows.map((row) => [row.person_id, row.canonical_person_id]),
  );
  const candidateGroups = new Map();
  const singleDistrictScopes = buildSingleDistrictScopes(candidates);

  for (const candidate of candidates) {
    const key = candidateGroupKey(candidate);
    if (key) {
      candidateGroups.set(key, [...(candidateGroups.get(key) ?? []), candidate]);
    }

    const sameElectionKey = sameElectionCandidateGroupKey(candidate, singleDistrictScopes);
    if (sameElectionKey) {
      candidateGroups.set(sameElectionKey, [
        ...(candidateGroups.get(sameElectionKey) ?? []),
        candidate,
      ]);
    }
  }

  const { rows, skipped, duplicatePersonConflicts } = buildRows(
    candidateGroups,
    personById,
    canonicalPersonByPersonId,
    birthDatesByPersonId,
    existingDecisions,
  );
  let inserted = [];

  if (options.migrationPath) {
    fs.mkdirSync(path.dirname(options.migrationPath), { recursive: true });
    fs.writeFileSync(options.migrationPath, renderMergeDecisionSql(rows));
  }

  if (options.write) {
    for (const rowsChunk of chunk(rows, 500)) {
      inserted = [...inserted, ...await insertRows('person_merge_decisions', rowsChunk)];
    }
  }

  const rowsByOfficeKind = rows.reduce((counts, row) => {
    const kind = row.evidence_json.officeKind ?? 'unknown';
    counts[kind] = (counts[kind] ?? 0) + 1;
    return counts;
  }, {});

  console.log(JSON.stringify({
    status: 'ok',
    dryRun: !options.write,
    candidateCount: candidates.length,
    groupedCandidateIdentityCount: candidateGroups.size,
    rowsToInsert: rows.length,
    skippedCount: skipped.length,
    duplicatePersonConflictCount: duplicatePersonConflicts.length,
    insertedCount: inserted.length,
    outputMigration: options.migrationPath ? path.relative(repoRoot, options.migrationPath) : null,
    rowsByOfficeKind,
    houRows: rows.filter((row) => row.evidence_json.key.startsWith('侯友宜|')),
    sampleRows: rows.slice(0, 10),
    sampleSkipped: skipped.slice(0, 10),
    sampleDuplicatePersonConflicts: duplicatePersonConflicts.slice(0, 10),
  }, null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
