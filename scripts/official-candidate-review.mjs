const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replaceAll('臺', '台')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function sourcePersonKey(record) {
  return `official-candidate:${record.candidateExternalId}`;
}

function claimKey(record) {
  return `official-candidacy:${record.candidateExternalId}`;
}

function assertLocalSupabase(config) {
  const hostname = new URL(config.supabaseUrl).hostname;
  if (!localHostnames.has(hostname)) {
    throw new Error(`Official candidate review writes are local-only; received Supabase host ${hostname}`);
  }
}

function suggestedPersonId(item) {
  return item.candidate?.person_id ?? item.person?.id ?? null;
}

function buildStagingRows(snapshot, plan, observedAt = new Date().toISOString()) {
  const sourcePeople = [];
  const claims = [];
  const suggestions = [];

  for (const item of plan.matched) {
    const { record, race } = item;
    const personId = suggestedPersonId(item);
    const payload = {
      schemaVersion: 1,
      candidateExternalId: record.candidateExternalId,
      personExternalId: record.personExternalId,
      candidacyStatus: snapshot.candidacyStatus,
      party: record.party,
      candidateNo: record.candidateNo,
      candidateNoProvided: record.candidateNoProvided,
      isIncumbent: record.isIncumbent,
      targetRace: { id: race.id, externalId: race.external_id, title: race.title },
      identitySuggestion: {
        selectedPersonId: personId,
        exactNamePersonIds: item.identityCandidates.map((person) => person.id),
      },
    };
    sourcePeople.push({
      source_person_key: sourcePersonKey(record),
      source_type: 'official_election',
      source_id: record.personExternalId,
      source_name: snapshot.source.name,
      source_url: snapshot.source.url,
      raw_name: record.personName,
      normalized_name: normalizeText(record.personName),
      party: record.party,
      normalized_party: normalizeText(record.party),
      position: race.title,
      district: race.title,
      election_year: snapshot.electionYear,
      external_person_id: record.personExternalId,
      external_record_id: record.candidateExternalId,
      source_payload: payload,
      confidence_suggestion: personId ? 'A' : 'D',
      ingest_batch_key: `cec-${snapshot.electionYear}-${snapshot.candidacyStatus}`,
      is_public: false,
      updated_at: observedAt,
    });
    claims.push({
      claim_key: claimKey(record),
      claim_type: 'candidacy',
      claim_value: `${snapshot.electionYear} ${race.title} ${snapshot.candidacyStatus}`,
      claim_json: payload,
      confidence_level: 'A',
      review_status: 'pending',
      visibility: 'review_only',
      source_name: snapshot.source.name,
      source_url: snapshot.source.url,
      observed_at: snapshot.source.publishedAt,
      is_public: false,
      updated_at: observedAt,
    });
    if (personId) {
      suggestions.push({
        sourcePersonKey: sourcePersonKey(record),
        personId,
        match_status: 'probable_match',
        score: 95,
        match_method: 'official_candidate_external_id_v1',
        match_reason: item.candidate
          ? 'Existing candidate external ID points to this person'
          : 'Existing person external ID matches the official snapshot',
        evidence_json: payload.identitySuggestion,
        updated_at: observedAt,
      });
    }
  }
  return { sourcePeople, claims, suggestions };
}

function validateReviewFile(raw, snapshot, plan) {
  const errors = [];
  if (raw?.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  const reviewedBy = String(raw?.reviewedBy ?? '').trim();
  if (!reviewedBy) errors.push('reviewedBy is required');
  const rawDecisions = Array.isArray(raw?.decisions) ? raw.decisions : [];
  if (rawDecisions.length === 0) errors.push('decisions must contain at least one reviewed record');
  const planByKey = new Map(plan.matched.map((item) => [item.record.candidateExternalId, item]));
  const seen = new Set();

  const decisions = rawDecisions.map((decision, index) => {
    const prefix = `decisions[${index}]`;
    const candidateExternalId = String(decision?.candidateExternalId ?? '').trim();
    const item = planByKey.get(candidateExternalId);
    if (!item) errors.push(`${prefix}.candidateExternalId is not in the snapshot`);
    if (seen.has(candidateExternalId)) errors.push(`${prefix}.candidateExternalId is duplicated`);
    seen.add(candidateExternalId);
    const personName = String(decision?.personName ?? '').trim();
    if (!personName || (item && personName !== item.record.personName)) {
      errors.push(`${prefix}.personName must match the snapshot record`);
    }
    const action = String(decision?.decision ?? '').trim();
    if (!['use_existing', 'create_new', 'reject'].includes(action)) {
      errors.push(`${prefix}.decision must be use_existing, create_new, or reject`);
    }
    const personId = decision?.personId == null ? null : String(decision.personId).trim();
    if (action === 'use_existing' && !personId) errors.push(`${prefix}.personId is required for use_existing`);
    if (action !== 'use_existing' && personId) errors.push(`${prefix}.personId is only allowed for use_existing`);
    const reviewedAt = String(decision?.reviewedAt ?? '').trim();
    if (!reviewedAt || Number.isNaN(Date.parse(reviewedAt))) errors.push(`${prefix}.reviewedAt must be a valid date`);

    if (item && action === 'use_existing') {
      const allowedIds = new Set([
        ...item.identityCandidates.map((person) => person.id),
        item.person?.id,
        item.candidate?.person_id,
      ].filter(Boolean));
      if (!allowedIds.has(personId)) errors.push(`${prefix}.personId is not an exact-name or external-ID candidate`);
      const candidateMatches = item.raceCandidates.filter((candidate) => candidate.person_id === personId);
      if (candidateMatches.length > 1) errors.push(`${prefix}.personId has multiple candidates in the target race`);
      if (item.candidate && item.candidate.person_id !== personId) {
        errors.push(`${prefix}.personId conflicts with the existing candidate external ID`);
      }
    }
    if (item && action === 'create_new' && (item.person || item.candidate)) {
      errors.push(`${prefix}.create_new is not allowed when the official external ID already exists`);
    }
    return {
      candidateExternalId,
      personName,
      decision: action,
      personId,
      reason: String(decision?.reason ?? '').trim() || null,
      reviewedAt,
      item,
    };
  });

  if (errors.length > 0) throw new Error(`Invalid official candidate review file:\n- ${errors.join('\n- ')}`);
  return { schemaVersion: 1, reviewedBy, decisions };
}

function restUrl(config, tableName) {
  return new URL(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`);
}

function headers(config, prefer) {
  return {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.serviceRoleKey}`,
    'content-type': 'application/json',
    ...(prefer ? { prefer } : {}),
  };
}

async function responseJson(response, label) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${label}: ${body?.message ?? response.statusText}`);
  return body;
}

async function upsertRows(config, tableName, rows, conflictKey) {
  if (rows.length === 0) return [];
  const url = restUrl(config, tableName);
  url.searchParams.set('on_conflict', conflictKey);
  const response = await fetch(url, {
    method: 'POST',
    headers: headers(config, 'resolution=merge-duplicates,return=representation'),
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(30000),
  });
  return responseJson(response, `Failed to upsert ${tableName}`);
}

async function insertRows(config, tableName, rows) {
  if (rows.length === 0) return [];
  const response = await fetch(restUrl(config, tableName), {
    method: 'POST',
    headers: headers(config, 'return=representation'),
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(30000),
  });
  return responseJson(response, `Failed to insert ${tableName}`);
}

async function fetchRows(config, tableName, select, filters = {}) {
  const url = restUrl(config, tableName);
  url.searchParams.set('select', select);
  for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: headers(config), signal: AbortSignal.timeout(30000) });
  return responseJson(response, `Failed to fetch ${tableName}`);
}

function quotePostgrestValue(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

async function fetchRowsByValues(config, tableName, select, column, values) {
  const unique = Array.from(new Set(values.filter(Boolean)));
  const rows = [];
  for (let index = 0; index < unique.length; index += 100) {
    const chunk = unique.slice(index, index + 100);
    rows.push(...await fetchRows(config, tableName, select, {
      [column]: `in.(${chunk.map(quotePostgrestValue).join(',')})`,
    }));
  }
  return rows;
}

async function patchById(config, tableName, id, row) {
  const url = restUrl(config, tableName);
  url.searchParams.set('id', `eq.${id}`);
  const response = await fetch(url, {
    method: 'PATCH',
    headers: headers(config, 'return=representation'),
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(30000),
  });
  return responseJson(response, `Failed to update ${tableName}`);
}

async function stageOfficialCandidateReview(config, snapshot, plan, rawSnapshot, observedAt = new Date().toISOString()) {
  assertLocalSupabase(config);
  if (plan.blocking.length > 0) throw new Error('Cannot stage a blocked official candidate import plan');
  const staging = buildStagingRows(snapshot, plan, observedAt);
  const sourceRows = await upsertRows(config, 'source_people', staging.sourcePeople, 'source_person_key');
  const sourceByKey = new Map(sourceRows.map((row) => [row.source_person_key, row]));
  await upsertRows(config, 'person_claims', staging.claims.map((row, index) => ({
    ...row,
    source_person_id: sourceByKey.get(staging.sourcePeople[index].source_person_key)?.id,
  })), 'claim_key');

  const existingMatches = await fetchRowsByValues(
    config,
    'person_identity_matches',
    'id,source_person_id,person_id,reviewed_at',
    'source_person_id',
    sourceRows.map((row) => row.id),
  );
  let suggestionCount = 0;
  for (const suggestion of staging.suggestions) {
    const source = sourceByKey.get(suggestion.sourcePersonKey);
    const existing = existingMatches.find((row) => row.source_person_id === source.id && row.person_id === suggestion.personId);
    if (existing?.reviewed_at) continue;
    const row = {
      source_person_id: source.id,
      person_id: suggestion.personId,
      match_status: suggestion.match_status,
      score: suggestion.score,
      match_method: suggestion.match_method,
      match_reason: suggestion.match_reason,
      evidence_json: suggestion.evidence_json,
      updated_at: suggestion.updated_at,
    };
    if (existing) await patchById(config, 'person_identity_matches', existing.id, row);
    else await insertRows(config, 'person_identity_matches', [row]);
    suggestionCount += 1;
  }

  await insertRows(config, 'raw_source_records', [{
    source_type: 'official_candidate_snapshot',
    source_name: snapshot.source.name,
    source_url: snapshot.source.url,
    fetched_at: snapshot.source.retrievedAt,
    raw_json: rawSnapshot,
    crawler_name: 'import-official-candidate-snapshot',
    notes: `Staged official candidate snapshot for review: ${snapshot.electionYear} ${snapshot.candidacyStatus}`,
  }]);
  return {
    stagedSourcePeople: sourceRows.length,
    stagedClaims: staging.claims.length,
    stagedIdentitySuggestions: suggestionCount,
    archivedRawSnapshots: 1,
  };
}

async function confirmIdentityMatch(config, sourcePersonId, personId, decision, reviewedBy) {
  const existing = await fetchRows(config, 'person_identity_matches', 'id', {
    source_person_id: `eq.${sourcePersonId}`,
    person_id: `eq.${personId}`,
  });
  const row = {
    source_person_id: sourcePersonId,
    person_id: personId,
    match_status: 'auto_matched',
    score: 100,
    match_method: 'manual_review',
    match_reason: decision.reason ?? 'Confirmed by manual official-candidate review',
    evidence_json: { candidateExternalId: decision.candidateExternalId, reviewDecision: decision.decision },
    reviewed_by: reviewedBy,
    reviewed_at: decision.reviewedAt,
    updated_at: decision.reviewedAt,
  };
  if (existing[0]) return patchById(config, 'person_identity_matches', existing[0].id, row);
  return insertRows(config, 'person_identity_matches', [row]);
}

async function applyReviewedOfficialCandidates(config, snapshot, review, candidateWriteRow) {
  assertLocalSupabase(config);
  const sourceRows = await fetchRowsByValues(
    config,
    'source_people',
    'id,source_person_key',
    'source_person_key',
    review.decisions.map((decision) => sourcePersonKey(decision.item.record)),
  );
  const sourceByKey = new Map(sourceRows.map((row) => [row.source_person_key, row]));
  let createdPeople = 0;
  let writtenCandidates = 0;
  let rejected = 0;

  for (const decision of review.decisions) {
    const { item } = decision;
    const source = sourceByKey.get(sourcePersonKey(item.record));
    if (!source) throw new Error(`Source person was not staged: ${decision.candidateExternalId}`);
    const claims = await fetchRows(config, 'person_claims', 'id', { claim_key: `eq.${claimKey(item.record)}` });
    if (!claims[0]) throw new Error(`Candidacy claim was not staged: ${decision.candidateExternalId}`);
    if (decision.decision === 'reject') {
      await patchById(config, 'person_claims', claims[0].id, {
        review_status: 'rejected', visibility: 'private', is_public: false,
        scoring_version: 'official-candidate-manual-review-v1',
        scoring_reasons: [{ reason: decision.reason ?? 'Rejected by reviewer', reviewedAt: decision.reviewedAt }],
        updated_at: decision.reviewedAt,
      });
      rejected += 1;
      continue;
    }

    let personId = decision.personId;
    if (decision.decision === 'create_new') {
      const people = await upsertRows(config, 'people', [{
        external_id: item.record.personExternalId,
        name: item.record.personName,
        party: item.record.party,
        election_year: snapshot.electionYear,
        district: item.race.title,
        source_url: snapshot.source.url,
        is_public: false,
        updated_at: decision.reviewedAt,
      }], 'external_id');
      personId = people[0].id;
      createdPeople += 1;
    }
    const existingCandidate = item.candidate
      ?? item.raceCandidates.find((candidate) => candidate.person_id === personId)
      ?? null;
    const personByExternalId = new Map([[item.record.personExternalId, { id: personId }]]);
    await upsertRows(config, 'candidates', [candidateWriteRow(
      snapshot,
      { record: item.record, race: item.race, candidate: existingCandidate },
      personByExternalId,
      decision.reviewedAt,
    )], 'external_id');
    await confirmIdentityMatch(config, source.id, personId, decision, review.reviewedBy);
    await patchById(config, 'person_claims', claims[0].id, {
      person_id: personId,
      review_status: 'verified',
      visibility: 'review_only',
      is_public: false,
      scoring_version: 'official-candidate-manual-review-v1',
      scoring_reasons: [{ reason: decision.reason ?? 'Confirmed by reviewer', reviewedAt: decision.reviewedAt }],
      updated_at: decision.reviewedAt,
    });
    writtenCandidates += 1;
  }
  return { reviewed: review.decisions.length, writtenCandidates, createdPeople, rejected };
}

export {
  applyReviewedOfficialCandidates,
  assertLocalSupabase,
  buildStagingRows,
  stageOfficialCandidateReview,
  validateReviewFile,
};
