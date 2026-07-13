import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .replaceAll('台', '臺')
    .replace(/\s+/g, '');
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
  if (value.includes('縣市長') || value.includes('市長') || value.includes('縣長')) return 'local_executive';
  if (value.includes('鄉長') || value.includes('鎮長')) return 'local_executive';
  if (value.includes('議員')) return 'councilor';
  if (value.includes('代表')) return 'representative';
  if (value.includes('村長') || value.includes('里長')) return 'village_chief';
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
    .replace(/[鄉鎮]長選舉/g, '')
    .replace(/議員選舉/g, '')
    .replace(/市民代表選舉|鄉民代表選舉|鎮民代表選舉|代表選舉/g, '')
    .replace(/[村里]長選舉/g, '')
    .replace(/選舉/g, '')
    .trim();
}

function candidateGroupKey(candidate) {
  const name = normalizeText(candidate.person_name);
  const party = normalizeText(candidate.party || candidate.person_party);
  const kind = officeKind(candidate);
  const area = officeArea(candidate);

  if (!name || !party || !kind || !area || party === '無黨籍' || party === '未知政黨') {
    return null;
  }

  return [name, party, kind, area].join('|');
}

function decisionPairKey(leftPersonId, rightPersonId) {
  return [leftPersonId, rightPersonId].sort().join('|');
}

function compactCandidate(candidate) {
  return {
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

function chooseCanonicalPersonId(personIds, personById, canonicalPersonByPersonId) {
  const canonicalIds = [...new Set(personIds.map((personId) => canonicalPersonByPersonId.get(personId) ?? personId))];

  return canonicalIds
    .slice()
    .sort((left, right) => {
      const leftPerson = personById.get(left);
      const rightPerson = personById.get(right);
      const leftIsCec = leftPerson?.external_id?.startsWith('cec-') ? 1 : 0;
      const rightIsCec = rightPerson?.external_id?.startsWith('cec-') ? 1 : 0;

      if (leftIsCec !== rightIsCec) {
        return rightIsCec - leftIsCec;
      }

      return left.localeCompare(right);
    })[0];
}

function buildRows(candidateGroups, personById, canonicalPersonByPersonId, existingDecisions) {
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
    const years = new Set(candidates.map(electionYear).filter(Boolean));
    const personIds = [...new Set(candidates.map((candidate) => candidate.person_id).filter(Boolean))];

    if (years.size < 2 || personIds.length < 2) {
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

      const row = {
        duplicate_person_id: duplicatePersonId,
        canonical_person_id: canonicalPersonId,
        status: 'verified',
        confidence_level: 'B',
        reason: 'same name, same party, same office type, and same constituency across election years',
        evidence_json: {
          rule: 'cross_year_same_name_party_office_area',
          key,
          candidates: candidates.map(compactCandidate),
        },
        reviewed_by: 'system:cross-year-candidate-person-merge',
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
  const [candidates, people, canonicalMapRows, existingDecisions] = await Promise.all([
    fetchRows(
      'public_candidates',
      'person_id,person_name,person_party,election_name,race_title,region_name,party,candidate_no,is_elected,vote_count',
    ),
    fetchRows('people', 'id,name,party,position,district,external_id,is_public'),
    fetchRows('person_canonical_map', 'person_id,canonical_person_id'),
    fetchRows('person_merge_decisions', 'duplicate_person_id,canonical_person_id,status'),
  ]);
  const personById = new Map(people.map((person) => [person.id, person]));
  const canonicalPersonByPersonId = new Map(
    canonicalMapRows.map((row) => [row.person_id, row.canonical_person_id]),
  );
  const candidateGroups = new Map();

  for (const candidate of candidates) {
    const key = candidateGroupKey(candidate);
    if (!key) {
      continue;
    }

    candidateGroups.set(key, [...(candidateGroups.get(key) ?? []), candidate]);
  }

  const { rows, skipped, duplicatePersonConflicts } = buildRows(
    candidateGroups,
    personById,
    canonicalPersonByPersonId,
    existingDecisions,
  );
  let inserted = [];

  if (options.write) {
    for (const rowsChunk of chunk(rows, 500)) {
      inserted = [...inserted, ...await insertRows('person_merge_decisions', rowsChunk)];
    }
  }

  console.log(JSON.stringify({
    status: 'ok',
    dryRun: !options.write,
    candidateCount: candidates.length,
    groupedCandidateIdentityCount: candidateGroups.size,
    rowsToInsert: rows.length,
    skippedCount: skipped.length,
    duplicatePersonConflictCount: duplicatePersonConflicts.length,
    insertedCount: inserted.length,
    houRows: rows.filter((row) => row.evidence_json.key.startsWith('侯友宜|')),
    sampleRows: rows.slice(0, 10),
    sampleSkipped: skipped.slice(0, 10),
    sampleDuplicatePersonConflicts: duplicatePersonConflicts.slice(0, 10),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
