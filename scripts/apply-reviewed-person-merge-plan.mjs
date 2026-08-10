import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultPlanPath = path.join(repoRoot, 'data-sources', 'reviewed-person-merge-plan.json');

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
        return [
          line.slice(0, separatorIndex).trim(),
          line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, ''),
        ];
      }),
  );
}

function parseArgs(argv) {
  const options = { planPath: defaultPlanPath, write: false };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--plan') {
      options.planPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (argv[index] === '--write') {
      options.write = true;
      continue;
    }
    throw new Error(`Unsupported argument: ${argv[index]}`);
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
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

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

async function updateRows(tableName, params, values) {
  const url = restUrl(tableName);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: JSON.stringify(values),
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to update ${tableName}: ${body?.message ?? response.statusText}`);
  }

  return body;
}

async function callRpc(functionName, values = {}) {
  const response = await fetch(restUrl(`rpc/${functionName}`), {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(values),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const body = await response.json();
    throw new Error(`Failed to call ${functionName}: ${body?.message ?? response.statusText}`);
  }
}

function normalizeName(value) {
  const chinesePrefix = String(value ?? '').match(/^[\u3400-\u9fff]+/)?.[0] ?? '';
  return chinesePrefix
    .replace(/\s+/g, '')
    .replaceAll('姗', '姍');
}

function flattenPlan(plan) {
  const duplicateIds = new Set();

  return plan.groups.flatMap((group) => group.duplicatePersonIds.map((duplicatePersonId) => {
    if (duplicateIds.has(duplicatePersonId)) {
      throw new Error(`Duplicate person appears more than once in plan: ${duplicatePersonId}`);
    }
    duplicateIds.add(duplicatePersonId);
    return {
      expectedName: normalizeName(group.name),
      canonicalPersonId: group.canonicalPersonId,
      duplicatePersonId,
      evidence: group.evidence,
    };
  }));
}

async function main() {
  if (!serviceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for reviewed person merge decisions.');
  }

  const options = parseArgs(process.argv.slice(2));
  const plan = JSON.parse(fs.readFileSync(options.planPath, 'utf8'));
  if (plan.schemaVersion !== 1 || !Array.isArray(plan.groups)) {
    throw new Error('Reviewed person merge plan must use schemaVersion 1 and contain groups.');
  }
  const partyCorrections = plan.partyCorrections ?? [];
  if (!Array.isArray(partyCorrections)) {
    throw new Error('Reviewed person merge plan partyCorrections must be an array.');
  }

  const items = flattenPlan(plan);
  const personIds = [...new Set([
    ...items.flatMap((item) => [item.canonicalPersonId, item.duplicatePersonId]),
    ...partyCorrections.map((correction) => correction.personId),
  ])];
  const duplicatePersonIds = items.map((item) => item.duplicatePersonId);
  const [people, canonicalMap, decisions, partyAffiliations] = await Promise.all([
    fetchRows('people', 'id,name,party', { id: `in.(${personIds.join(',')})` }),
    fetchRows('person_canonical_map', 'person_id,canonical_person_id', { person_id: `in.(${personIds.join(',')})` }),
    fetchRows('person_merge_decisions', 'duplicate_person_id,canonical_person_id,status', {
      duplicate_person_id: `in.(${duplicatePersonIds.join(',')})`,
    }),
    partyCorrections.length > 0
      ? fetchRows('person_party_affiliations', 'id,person_id,party_name,normalized_party,source_name,source_url,source_payload', {
          person_id: `in.(${partyCorrections.map((correction) => correction.personId).join(',')})`,
        })
      : Promise.resolve([]),
  ]);
  const personById = new Map(people.map((person) => [person.id, person]));
  const canonicalByPersonId = new Map(canonicalMap.map((row) => [row.person_id, row.canonical_person_id]));
  const decisionsByDuplicateId = new Map();

  for (const decision of decisions) {
    decisionsByDuplicateId.set(
      decision.duplicate_person_id,
      [...(decisionsByDuplicateId.get(decision.duplicate_person_id) ?? []), decision],
    );
  }

  const rows = [];
  const alreadyApplied = [];

  for (const item of items) {
    const canonicalPerson = personById.get(item.canonicalPersonId);
    const duplicatePerson = personById.get(item.duplicatePersonId);
    if (!canonicalPerson || !duplicatePerson) {
      throw new Error(`Plan references missing person: ${item.canonicalPersonId} / ${item.duplicatePersonId}`);
    }
    if (normalizeName(canonicalPerson.name) !== item.expectedName || normalizeName(duplicatePerson.name) !== item.expectedName) {
      throw new Error(`Name mismatch for plan item ${item.expectedName}: ${canonicalPerson.name} / ${duplicatePerson.name}`);
    }

    const canonicalTarget = canonicalByPersonId.get(item.canonicalPersonId) ?? item.canonicalPersonId;
    const duplicateTarget = canonicalByPersonId.get(item.duplicatePersonId) ?? item.duplicatePersonId;
    if (canonicalTarget !== item.canonicalPersonId) {
      throw new Error(`Planned canonical person is already a duplicate: ${item.canonicalPersonId} -> ${canonicalTarget}`);
    }
    if (duplicateTarget === item.canonicalPersonId) {
      alreadyApplied.push(item);
      continue;
    }
    if (duplicateTarget !== item.duplicatePersonId) {
      throw new Error(`Duplicate person already maps elsewhere: ${item.duplicatePersonId} -> ${duplicateTarget}`);
    }

    const activeDecisions = (decisionsByDuplicateId.get(item.duplicatePersonId) ?? [])
      .filter((decision) => ['suggested', 'verified'].includes(decision.status));
    if (activeDecisions.length > 0) {
      throw new Error(`Duplicate person already has an active decision: ${item.duplicatePersonId}`);
    }

    rows.push({
      duplicate_person_id: item.duplicatePersonId,
      canonical_person_id: item.canonicalPersonId,
      status: 'verified',
      confidence_level: 'B',
      reason: 'manually reviewed same public figure across election years and office types',
      evidence_json: {
        rule: 'reviewed_cross_office_public_figure',
        expectedName: item.expectedName,
        ...item.evidence,
      },
      reviewed_by: plan.reviewedBy,
      reviewed_at: new Date().toISOString(),
    });
  }

  const partyCorrectionActions = [];
  const appliedPartyCorrections = [];
  for (const correction of partyCorrections) {
    const person = personById.get(correction.personId);
    if (!person || normalizeName(person.name) !== normalizeName(correction.expectedName)) {
      throw new Error(`Party correction person mismatch: ${correction.personId}`);
    }
    if (![correction.from, correction.to].includes(person.party)) {
      throw new Error(`Unexpected party for ${person.name}: ${person.party}`);
    }

    const incorrectAffiliations = partyAffiliations.filter((affiliation) => (
      affiliation.person_id === correction.personId
      && affiliation.party_name === correction.from
      && String(affiliation.source_name ?? '').startsWith(correction.sourceNamePrefix)
    ));
    if (person.party === correction.to && incorrectAffiliations.length === 0) {
      appliedPartyCorrections.push(correction);
      continue;
    }

    partyCorrectionActions.push({
      correction,
      personNeedsUpdate: person.party !== correction.to,
      affiliations: incorrectAffiliations,
    });
  }

  const inserted = options.write ? await insertRows('person_merge_decisions', rows) : [];
  let correctedPersonCount = 0;
  let correctedAffiliationCount = 0;
  if (options.write) {
    for (const action of partyCorrectionActions) {
      if (action.personNeedsUpdate) {
        const updatedPeople = await updateRows('people', { id: `eq.${action.correction.personId}` }, {
          party: action.correction.to,
        });
        correctedPersonCount += updatedPeople.length;
      }
      for (const affiliation of action.affiliations) {
        const updatedAffiliations = await updateRows('person_party_affiliations', { id: `eq.${affiliation.id}` }, {
          party_name: action.correction.to,
          normalized_party: action.correction.to,
          source_url: action.correction.sourceUrl,
          source_payload: {
            ...(affiliation.source_payload ?? {}),
            correctedAt: new Date().toISOString(),
            correctionReason: action.correction.reason,
          },
        });
        correctedAffiliationCount += updatedAffiliations.length;
      }
    }
  }

  const cacheRefreshRequired = options.write && (
    items.length > 0
    || partyCorrections.length > 0
  );
  if (cacheRefreshRequired) {
    await callRpc('refresh_public_people_list_cached');
  }

  console.log(JSON.stringify({
    status: 'ok',
    dryRun: !options.write,
    planPath: path.relative(repoRoot, options.planPath),
    groupCount: plan.groups.length,
    plannedDecisionCount: items.length,
    rowsToInsert: rows.length,
    alreadyAppliedCount: alreadyApplied.length,
    insertedCount: inserted.length,
    cacheRefreshed: cacheRefreshRequired,
    rows,
    partyCorrections: {
      plannedCount: partyCorrections.length,
      actionsRequired: partyCorrectionActions.length,
      alreadyAppliedCount: appliedPartyCorrections.length,
      correctedPersonCount,
      correctedAffiliationCount,
      actions: partyCorrectionActions.map((action) => ({
        personId: action.correction.personId,
        affiliationCount: action.affiliations.length,
      })),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
