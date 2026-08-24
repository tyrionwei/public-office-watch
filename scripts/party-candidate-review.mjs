const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replaceAll('臺', '台')
    .replace(/[\s()（）．。·、,，-]/g, '')
    .toLowerCase();
}

function sourcePersonKey(record) {
  return `party-candidate:${record.sourceCandidateKey}`;
}

function claimKey(record) {
  return `party-candidacy:${record.sourceCandidateKey}`;
}

function personExternalId(record) {
  return `party-candidate-person:${record.sourceCandidateKey}`;
}

function candidateExternalId(record) {
  return `party-candidate:${record.sourceCandidateKey}`;
}

function positionFor(record) {
  if (record.raceType === 'municipality_mayor') return '直轄市長候選人';
  if (record.raceType === 'county_mayor') return '縣市長候選人';
  if (record.raceType === 'city_councilor') return '直轄市議員候選人';
  if (record.raceType === 'county_councilor') return '縣市議員候選人';
  if (record.raceType === 'township_mayor') return '鄉鎮市區長候選人';
  if (record.raceType === 'township_representative_district') return '鄉鎮市區民代表候選人';
  return '村里長候選人';
}

function normalizedRoleFor(record) {
  if (record.raceType === 'township_mayor') return 'township_chief';
  if (record.raceType === 'township_representative_district') return 'township_representative';
  if (record.raceType === 'village_chief') return 'local_chief';
  return record.raceType.endsWith('_mayor') ? 'mayor' : 'councilor';
}

function districtFor(record) {
  return [
    record.regionName,
    record.localityName,
    record.villageName,
    record.districtName,
  ].filter(Boolean).join('');
}

function confidenceFor(identityResolution) {
  if (identityResolution === 'high_confidence_match') return 'A';
  if (identityResolution === 'probable_match') return 'B';
  if (identityResolution === 'needs_identity_review') return 'C';
  return 'D';
}

function scoreFor(identityResolution) {
  return identityResolution === 'high_confidence_match' ? 90 : 70;
}

function matchStatusFor(identityResolution) {
  return identityResolution === 'high_confidence_match' ? 'probable_match' : 'possible_match';
}

function assertLocalSupabase(config) {
  const hostname = new URL(config.supabaseUrl).hostname;
  if (!localHostnames.has(hostname)) {
    throw new Error(`Party candidate review writes are local-only; received Supabase host ${hostname}`);
  }
}

function buildStagingRows(snapshot, plan, observedAt = new Date().toISOString()) {
  const sourcePeople = [];
  const claims = [];
  const suggestions = [];

  for (const item of plan.matched) {
    const { record, race, identityResolution, selectedGroup } = item;
    const confidence = confidenceFor(identityResolution);
    const sourceKey = sourcePersonKey(record);
    const payload = {
      schemaVersion: 1,
      sourceCandidateKey: record.sourceCandidateKey,
      candidacyStatus: record.candidacyStatus,
      nominationAnnouncedAt: record.nominationAnnouncedAt,
      profileUrl: record.profileUrl,
      photoUrl: record.photoUrl,
      education: record.education,
      experience: record.experience,
      platform: record.platform,
      socialLinks: record.socialLinks,
      locationEvidence: record.locationEvidence,
      locationEvidenceUrl: record.locationEvidenceUrl,
      isIncumbent: record.isIncumbent,
      incumbencyEvidence: record.incumbencyEvidence,
      incumbencySourceUrl: record.incumbencySourceUrl,
      targetRace: {
        id: race.id,
        title: race.title,
        raceType: record.raceType,
        regionName: record.regionName,
        localityName: record.localityName,
        villageName: record.villageName,
        districtName: record.districtName,
      },
      identitySuggestion: {
        resolution: identityResolution,
        selectedCanonicalPersonId: selectedGroup?.canonicalPersonId ?? null,
        canonicalCandidates: item.canonicalGroups.map((group) => ({
          canonicalPersonId: group.canonicalPersonId,
          personIds: group.people.map((person) => person.id),
          evidence: group.evidence,
        })),
      },
    };

    sourcePeople.push({
      source_person_key: sourceKey,
      source_type: 'official_site',
      source_id: record.sourceCandidateKey,
      source_name: snapshot.source.name,
      source_url: record.profileUrl ?? snapshot.source.url,
      raw_name: record.personName,
      normalized_name: normalizeText(record.personName),
      party: snapshot.party,
      normalized_party: normalizeText(snapshot.party),
      position: positionFor(record),
      normalized_role: normalizedRoleFor(record),
      district: districtFor(record),
      normalized_region: normalizeText(record.regionName),
      election_year: snapshot.electionYear,
      external_record_id: record.sourceCandidateKey,
      source_payload: payload,
      confidence_suggestion: confidence,
      ingest_batch_key: `${normalizeText(snapshot.party)}-${snapshot.electionYear}-party-nominees`,
      updated_at: observedAt,
    });

    claims.push({
      claim_key: claimKey(record),
      claim_type: 'candidacy',
      claim_value: `${snapshot.electionYear} ${districtFor(record)} ${positionFor(record)}`,
      claim_json: payload,
      confidence_level: confidence,
      source_name: snapshot.source.name,
      source_url: record.profileUrl ?? snapshot.source.url,
      observed_at: record.nominationAnnouncedAt ?? snapshot.source.publishedAt ?? observedAt,
      updated_at: observedAt,
    });

    if (selectedGroup && ['high_confidence_match', 'probable_match'].includes(identityResolution)) {
      suggestions.push({
        sourcePersonKey: sourceKey,
        personId: selectedGroup.canonicalPersonId,
        match_status: matchStatusFor(identityResolution),
        score: scoreFor(identityResolution),
        match_method: 'party_candidate_identity_v1',
        match_reason: `Official party nominee; evidence: ${selectedGroup.evidence.join(', ') || 'exact name only'}`,
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
  const party = String(raw?.party ?? '').trim();
  if (party !== snapshot.party) errors.push(`party must match the snapshot party: ${snapshot.party}`);
  const reviewedBy = String(raw?.reviewedBy ?? '').trim();
  if (!reviewedBy) errors.push('reviewedBy is required');
  const rawDecisions = Array.isArray(raw?.decisions) ? raw.decisions : [];
  if (rawDecisions.length === 0) errors.push('decisions must contain at least one reviewed record');

  const planByKey = new Map(plan.matched.map((item) => [item.record.sourceCandidateKey, item]));
  const seen = new Set();
  const decisions = rawDecisions.map((decision, index) => {
    const prefix = `decisions[${index}]`;
    const sourceCandidateKey = String(decision?.sourceCandidateKey ?? '').trim();
    if (!planByKey.has(sourceCandidateKey)) errors.push(`${prefix}.sourceCandidateKey is not in the snapshot`);
    const personName = String(decision?.personName ?? '').trim();
    const item = planByKey.get(sourceCandidateKey);
    if (!personName || (item && personName !== item.record.personName)) {
      errors.push(`${prefix}.personName must match the snapshot record`);
    }
    if (seen.has(sourceCandidateKey)) errors.push(`${prefix}.sourceCandidateKey is duplicated`);
    seen.add(sourceCandidateKey);
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
      const allowedPersonIds = new Set(item.canonicalGroups.map((group) => group.canonicalPersonId));
      if (!allowedPersonIds.has(personId)) {
        errors.push(`${prefix}.personId is not one of the exact-name identity candidates`);
      }
    }
    return {
      sourceCandidateKey,
      personName,
      decision: action,
      personId,
      reason: String(decision?.reason ?? '').trim() || null,
      reviewedAt,
      item,
    };
  });

  if (errors.length > 0) throw new Error(`Invalid party candidate review file:\n- ${errors.join('\n- ')}`);
  return { schemaVersion: 1, reviewedBy, party, decisions };
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
  const response = await fetch(url, {
    headers: headers(config),
    signal: AbortSignal.timeout(30000),
  });
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

async function stagePartyCandidateReview(config, snapshot, plan, observedAt = new Date().toISOString()) {
  assertLocalSupabase(config);
  if (plan.blocking.length > 0) throw new Error('Cannot stage a blocked party candidate import plan');
  const staging = buildStagingRows(snapshot, plan, observedAt);
  const sourceRows = await upsertRows(config, 'source_people', staging.sourcePeople, 'source_person_key');
  const sourceByKey = new Map(sourceRows.map((row) => [row.source_person_key, row]));
  const claimRows = staging.claims.map((row, index) => ({
    ...row,
    source_person_id: sourceByKey.get(staging.sourcePeople[index].source_person_key)?.id,
  }));
  await upsertRows(config, 'person_claims', claimRows, 'claim_key');

  const sourceIds = sourceRows.map((row) => row.id);
  const existingMatches = await fetchRowsByValues(
    config,
    'person_identity_matches',
    'id,source_person_id,person_id,match_status,reviewed_at',
    'source_person_id',
    sourceIds,
  );
  const matchesBySource = new Map();
  for (const row of existingMatches) {
    matchesBySource.set(row.source_person_id, [...(matchesBySource.get(row.source_person_id) ?? []), row]);
  }

  let suggestionCount = 0;
  for (const suggestion of staging.suggestions) {
    const source = sourceByKey.get(suggestion.sourcePersonKey);
    const existingForSource = matchesBySource.get(source.id) ?? [];
    if (existingForSource.some((row) => row.match_status === 'auto_matched')) continue;
    const existing = existingForSource.find((row) => row.person_id === suggestion.personId);
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
    if (existing?.reviewed_at) continue;
    if (existing) await patchById(config, 'person_identity_matches', existing.id, row);
    else await insertRows(config, 'person_identity_matches', [row]);
    suggestionCount += 1;
  }

  return {
    stagedSourcePeople: sourceRows.length,
    stagedClaims: claimRows.length,
    stagedIdentitySuggestions: suggestionCount,
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
    match_reason: decision.reason ?? 'Confirmed by manual party-candidate review',
    evidence_json: {
      sourceCandidateKey: decision.sourceCandidateKey,
      reviewDecision: decision.decision,
    },
    reviewed_by: reviewedBy,
    reviewed_at: decision.reviewedAt,
    updated_at: decision.reviewedAt,
  };
  if (existing[0]) return patchById(config, 'person_identity_matches', existing[0].id, row);
  return insertRows(config, 'person_identity_matches', [row]);
}

async function applyReviewedPartyCandidates(config, snapshot, plan, review) {
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
    if (!source) throw new Error(`Source person was not staged: ${decision.sourceCandidateKey}`);
    const claims = await fetchRows(config, 'person_claims', 'id', { claim_key: `eq.${claimKey(item.record)}` });
    if (!claims[0]) throw new Error(`Candidacy claim was not staged: ${decision.sourceCandidateKey}`);

    if (decision.decision === 'reject') {
      await patchById(config, 'person_claims', claims[0].id, {
        review_status: 'rejected',
        visibility: 'private',
        is_public: false,
        scoring_version: 'party-candidate-manual-review-v1',
        scoring_reasons: [{ reason: decision.reason ?? 'Rejected by reviewer', reviewedAt: decision.reviewedAt }],
        updated_at: decision.reviewedAt,
      });
      rejected += 1;
      continue;
    }

    let personId = decision.personId;
    if (decision.decision === 'create_new') {
      const people = await upsertRows(config, 'people', [{
        external_id: personExternalId(item.record),
        name: item.record.personName,
        party: snapshot.party,
        position: positionFor(item.record),
        election_year: snapshot.electionYear,
        district: districtFor(item.record),
        source_url: item.record.profileUrl ?? snapshot.source.url,
        is_public: false,
        updated_at: decision.reviewedAt,
      }], 'external_id');
      personId = people[0].id;
      createdPeople += 1;
    }

    await confirmIdentityMatch(config, source.id, personId, decision, review.reviewedBy);
    await upsertRows(config, 'candidates', [{
      external_id: candidateExternalId(item.record),
      person_id: personId,
      race_id: item.race.id,
      party: snapshot.party,
      registration_status: 'unknown',
      candidacy_status: 'party_nominee',
      election_result: 'pending',
      is_incumbent: item.record.isIncumbent,
      status_updated_at: decision.reviewedAt,
      source_name: snapshot.source.name,
      source_url: item.record.profileUrl ?? snapshot.source.url,
      is_public: false,
      updated_at: decision.reviewedAt,
    }], 'external_id');
    await patchById(config, 'person_claims', claims[0].id, {
      person_id: personId,
      review_status: 'verified',
      visibility: 'review_only',
      is_public: false,
      scoring_version: 'party-candidate-manual-review-v1',
      scoring_reasons: [{ reason: decision.reason ?? 'Confirmed by reviewer', reviewedAt: decision.reviewedAt }],
      updated_at: decision.reviewedAt,
    });
    writtenCandidates += 1;
  }

  return { reviewed: review.decisions.length, writtenCandidates, createdPeople, rejected };
}

export {
  applyReviewedPartyCandidates,
  assertLocalSupabase,
  buildStagingRows,
  stagePartyCandidateReview,
  validateReviewFile,
};
