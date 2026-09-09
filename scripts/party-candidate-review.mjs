import { partyCandidateRevision, partyCandidateRevisionContent, assertPartyCandidateRevision } from './party-candidate-revision.mjs';

const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replaceAll('臺', '台')
    .replace(/[\s()（）．。·、,，-]/g, '')
    .toLowerCase();
}

function sourcePersonKey(record, revision = null) {
  return `party-candidate:${record.sourceCandidateKey}${revision ? `:revision:${revision}` : ''}`;
}

function claimKey(record, revision = null) {
  return `party-candidacy:${record.sourceCandidateKey}${revision ? `:revision:${revision}` : ''}`;
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
    const payload = {
      schemaVersion: 2,
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

    const revision = partyCandidateRevision(payload, {
      raw_name: record.personName, party: snapshot.party, election_year: snapshot.electionYear,
      source_name: snapshot.source.name, source_url: record.profileUrl ?? snapshot.source.url,
    });
    payload.revision = revision;
    payload.baseSourcePersonKey = sourcePersonKey(record);
    payload.baseClaimKey = claimKey(record);
    const sourceKey = sourcePersonKey(record, revision);
    sourcePeople.push({
      source_person_key: sourceKey,
      is_public: false,
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
      claim_key: claimKey(record, revision),
      review_status: 'pending', visibility: 'review_only', is_public: false,
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
  const revisions = new Map(buildStagingRows(snapshot, plan).claims.map(row => [row.claim_json.sourceCandidateKey, row.claim_json.revision]));
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
    const contentRevision = String(decision?.contentRevision ?? '');
    if (item && contentRevision !== revisions.get(sourceCandidateKey)) errors.push(`${prefix}.contentRevision must match current snapshot`);
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
      contentRevision,
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

async function upsertRows(config, tableName, rows, conflictKey, resolution = 'ignore-duplicates') {
  if (rows.length === 0) return [];
  const url = restUrl(config, tableName);
  url.searchParams.set('on_conflict', conflictKey);
  const response = await fetch(url, {
    method: 'POST',
    headers: headers(config, `resolution=${resolution},return=representation`),
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(30000),
  });
  return responseJson(response, `Failed to upsert ${tableName}`);
}


async function fetchRows(config, tableName, select, filters = {}) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = restUrl(config, tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('order', 'id.asc');
    url.searchParams.set('limit', '1000');
    url.searchParams.set('offset', String(offset));
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    const response = await fetch(url, { headers: headers(config), signal: AbortSignal.timeout(30000) });
    const page = await responseJson(response, `Failed to fetch ${tableName}`);
    if (!Array.isArray(page)) throw new Error(`Invalid ${tableName} response`);
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
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


async function resolveStaging(config, snapshot, plan, observedAt) {
  const staging = buildStagingRows(snapshot, plan, observedAt);
  const historical = await fetchRowsByValues(config, 'source_people', '*', 'source_id', plan.matched.map(item => item.record.sourceCandidateKey));
  const oldClaims = await fetchRowsByValues(config, 'person_claims', '*', 'source_person_id', historical.map(row => row.id));
  for (const [index, item] of plan.matched.entries()) {
    const nextSource = staging.sourcePeople[index], nextClaim = staging.claims[index];
    const previous = historical.filter(row => row.source_person_key === sourcePersonKey(item.record)
      || row.source_person_key.startsWith(sourcePersonKey(item.record) + ':revision:'));
    const legacy = previous.find(row => row.source_person_key === sourcePersonKey(item.record));
    const claims = legacy ? oldClaims.filter(row => row.source_person_id === legacy.id && row.claim_key === claimKey(item.record)) : [];
    // Reuse legacy evidence only when both immutable documents contain the same content.
    if (legacy && claims.length === 1
      && partyCandidateRevisionContent(legacy.source_payload, legacy) === partyCandidateRevisionContent(nextSource.source_payload, nextSource)
      && partyCandidateRevisionContent(claims[0].claim_json, legacy) === partyCandidateRevisionContent(nextClaim.claim_json, nextSource)) {
      nextSource.source_person_key = legacy.source_person_key;
      nextClaim.claim_key = claims[0].claim_key;
    }
    if (previous.some(row => row.source_person_key !== nextSource.source_person_key)) {
      nextSource.source_payload.requiresManualReview = true;
      nextClaim.claim_json.requiresManualReview = true;
    }
    for (const suggestion of staging.suggestions) {
      if (suggestion.sourcePersonKey === sourcePersonKey(item.record, nextClaim.claim_json.revision)) suggestion.sourcePersonKey = nextSource.source_person_key;
    }
  }
  return staging;
}

async function stagePartyCandidateReview(config, snapshot, plan, observedAt = new Date().toISOString()) {
  assertLocalSupabase(config);
  if (plan.blocking.length > 0) throw new Error('Cannot stage a blocked party candidate import plan');
  const staging = await resolveStaging(config, snapshot, plan, observedAt);
  await upsertRows(config, 'source_people', staging.sourcePeople, 'source_person_key');
  const sourceRows = await fetchRowsByValues(config, 'source_people', '*', 'source_person_key', staging.sourcePeople.map(row => row.source_person_key));
  const sourceByKey = new Map(sourceRows.map(row => [row.source_person_key, row]));
  const claimRows = staging.claims.map((row, index) => {
    const expected = staging.sourcePeople[index], source = sourceByKey.get(expected.source_person_key);
    if (!source || partyCandidateRevisionContent(source.source_payload, source) !== partyCandidateRevisionContent(expected.source_payload, expected)) throw new Error('Staged source content differs from reviewed revision');
    return { ...row, source_person_id: source.id };
  });
  await upsertRows(config, 'person_claims', claimRows, 'claim_key');
  const persistedClaims = await fetchRowsByValues(config, 'person_claims', '*', 'claim_key', claimRows.map(row => row.claim_key));
  for (const [index, expected] of claimRows.entries()) {
    const claim = persistedClaims.find(row => row.claim_key === expected.claim_key);
    const source = sourceByKey.get(staging.sourcePeople[index].source_person_key);
    if (!claim || claim.source_person_id !== source.id || partyCandidateRevisionContent(claim.claim_json, source) !== partyCandidateRevisionContent(expected.claim_json, source)) throw new Error('Staged claim content differs from reviewed revision');
    assertPartyCandidateRevision(source, claim);
  }
  // Suggestions are insert-only; no refresh can undo a manual decision.
  let suggestionCount = 0;
  for (const suggestion of staging.suggestions) {
    const source = sourceByKey.get(suggestion.sourcePersonKey);
    const claim = persistedClaims.find(row => row.source_person_id === source.id && row.claim_type === 'candidacy');
    if (!['pending', 'needs_more_evidence'].includes(claim.review_status)) continue;
    const existing = await fetchRows(config, 'person_identity_matches', '*', { source_person_id: `eq.${source.id}` });
    if (existing.length) continue;
    const rows = await upsertRows(config, 'person_identity_matches', [{
      source_person_id: source.id, person_id: suggestion.personId,
      match_status: suggestion.match_status, score: suggestion.score,
      match_method: suggestion.match_method, match_reason: suggestion.match_reason,
      evidence_json: suggestion.evidence_json, updated_at: suggestion.updated_at,
    }], 'source_person_id,person_id');
    suggestionCount += rows.length;
  }
  return { stagedSourcePeople: sourceRows.length, stagedClaims: claimRows.length, stagedIdentitySuggestions: suggestionCount,
    revisionSelections: sourceRows.map(source => ({ sourcePersonKey: source.source_person_key, contentRevision: partyCandidateRevision(source.source_payload, source) })) };
}

async function patchExpected(config, tableName, before, row, fields) {
  if (!before.id || !before.updated_at) throw new Error(`Missing ${tableName} concurrency snapshot`);
  const url = restUrl(config, tableName);
  for (const key of ['id', 'updated_at', ...fields]) {
    if (!Object.hasOwn(before, key)) throw new Error(`Missing ${tableName}.${key} snapshot`);
    const value = before[key];
    url.searchParams.set(key, value === null ? 'is.null' : `eq.${typeof value === 'object' ? JSON.stringify(value) : value}`);
  }
  const response = await fetch(url, { method: 'PATCH', headers: headers(config, 'return=representation'), body: JSON.stringify(row), signal: AbortSignal.timeout(30000) });
  const changed = await responseJson(response, `Failed to conditionally update ${tableName}`);
  if (!Array.isArray(changed) || changed.length !== 1) throw new Error(`${tableName} changed since review; no approval recorded`);
  return changed[0];
}
async function insertOnce(config, table, row, key) {
  const found = await fetchRows(config, table, '*', { [key]: `eq.${row[key]}` });
  if (found.length === 1) return { row: found[0], created: false };
  if (found.length > 1) throw new Error(`Multiple ${table} rows share the review identity`);
  const inserted = await upsertRows(config, table, [row], key);
  const current = await fetchRows(config, table, '*', { [key]: `eq.${row[key]}` });
  if (current.length !== 1) throw new Error(`Expected one ${table} row after insert`);
  return { row: current[0], created: inserted.length === 1 };
}

async function applyReviewedPartyCandidates(config, snapshot, plan, inputReview) {
  assertLocalSupabase(config);
  if (plan.blocking.length) throw new Error('Cannot apply blocked party candidate plan');
  // Do not trust a caller-provided item or a review validated against an older snapshot.
  const review = validateReviewFile(inputReview, snapshot, plan);
  const staging = await resolveStaging(config, snapshot, plan);
  let createdPeople = 0, writtenCandidates = 0, rejected = 0, unchanged = 0;
  const revisionSelections = [];
  for (const decision of review.decisions) {
    const { item } = decision;
    const index = plan.matched.findIndex(row => row.record.sourceCandidateKey === decision.sourceCandidateKey);
    const expected = staging.sourcePeople[index], expectedClaim = staging.claims[index];
    const sources = await fetchRows(config, 'source_people', '*', { source_person_key: `eq.${expected.source_person_key}` });
    const source = sources[0];
    if (sources.length !== 1 || partyCandidateRevision(source.source_payload, source) !== decision.contentRevision) throw new Error('Staged source revision does not match review');
    const claims = await fetchRows(config, 'person_claims', '*', { claim_key: `eq.${expectedClaim.claim_key}` });
    let claim = claims[0];
    if (claims.length !== 1 || claim.source_person_id !== source.id || partyCandidateRevision(claim.claim_json, source) !== decision.contentRevision) throw new Error('Staged claim revision does not match review');
    assertPartyCandidateRevision(source, claim);
    if (claim.review_status === 'archived' || (claim.review_status === 'rejected' && decision.decision !== 'reject')) throw new Error('Terminal claim decision cannot be overwritten by replay');
    const matches = await fetchRows(config, 'person_identity_matches', '*', { source_person_id: `eq.${source.id}` });
    if (decision.decision === 'reject') {
      if (!['pending', 'needs_more_evidence', 'rejected'].includes(claim.review_status)) throw new Error('Verified claim cannot be rejected by an old review file');
      if (claim.review_status !== 'rejected') {
        claim = await patchExpected(config, 'person_claims', claim, {
          review_status: 'rejected', visibility: 'private', is_public: false,
          scoring_version: 'party-candidate-manual-review-v2',
          scoring_reasons: [{ reason: decision.reason ?? 'Rejected by reviewer', reviewedAt: decision.reviewedAt, reviewedBy: review.reviewedBy, contentRevision: decision.contentRevision }],
          updated_at: decision.reviewedAt,
        }, ['review_status', 'person_id', 'claim_json', 'visibility', 'is_public']);
        rejected += 1;
      } else unchanged += 1;
      for (const match of matches) {
        if (match.match_status === 'rejected_match') continue;
        if (match.reviewed_at) throw new Error('Identity decision changed; claim rejection preserved for review');
        await patchExpected(config, 'person_identity_matches', match, {
          match_status: 'rejected_match', reviewed_by: review.reviewedBy, reviewed_at: decision.reviewedAt, updated_at: decision.reviewedAt,
        }, ['match_status', 'reviewed_at', 'person_id']);
      }
      continue;
    }
    if (matches.some(match => match.match_status === 'rejected_match')) throw new Error('Rejected identity cannot be overwritten by replay');
    let personId = decision.personId;
    if (decision.decision === 'create_new') {
      const person = await insertOnce(config, 'people', {
        external_id: personExternalId(item.record), name: item.record.personName, party: snapshot.party,
        position: positionFor(item.record), election_year: snapshot.electionYear, district: districtFor(item.record),
        source_url: item.record.profileUrl ?? snapshot.source.url, is_public: false, updated_at: decision.reviewedAt,
      }, 'external_id');
      if (person.row.name !== item.record.personName) throw new Error('Existing source-scoped person differs from review');
      personId = person.row.id; createdPeople += Number(person.created);
    }
    if (claim.review_status === 'verified' && claim.person_id !== personId) throw new Error('Verified claim identifies another person');
    if (matches.length > 1 || matches.some(match => match.person_id !== personId)) throw new Error('Existing identity differs from reviewed person');
    const candidate = await insertOnce(config, 'candidates', {
      external_id: candidateExternalId(item.record), person_id: personId, race_id: item.race.id, party: snapshot.party,
      registration_status: 'unknown', candidacy_status: 'party_nominee', election_result: 'pending',
      is_incumbent: item.record.isIncumbent, status_updated_at: decision.reviewedAt,
      source_name: snapshot.source.name, source_url: item.record.profileUrl ?? snapshot.source.url,
      is_public: false, updated_at: decision.reviewedAt,
    }, 'external_id');
    if (candidate.row.person_id !== personId || candidate.row.race_id !== item.race.id || candidate.row.party !== snapshot.party) throw new Error('Existing candidate conflicts with review; preserved without modification');
    writtenCandidates += Number(candidate.created);
    const identityRow = {
      source_person_id: source.id, person_id: personId, match_status: 'auto_matched', score: 100,
      match_method: 'manual_review', match_reason: decision.reason ?? 'Confirmed by manual party-candidate review',
      evidence_json: { sourceCandidateKey: decision.sourceCandidateKey, contentRevision: decision.contentRevision, reviewDecision: decision.decision },
      reviewed_by: review.reviewedBy, reviewed_at: decision.reviewedAt, updated_at: decision.reviewedAt,
    };
    const existing = matches[0];
    if (!existing) {
      await upsertRows(config, 'person_identity_matches', [identityRow], 'source_person_id,person_id');
    } else if (existing.match_status !== 'auto_matched') {
      if (existing.reviewed_at) throw new Error('Identity has a newer manual decision');
      await patchExpected(config, 'person_identity_matches', existing, identityRow, ['match_status', 'reviewed_at', 'person_id']);
    }
    const finalMatches = await fetchRows(config, 'person_identity_matches', '*', { source_person_id: `eq.${source.id}` });
    if (finalMatches.length !== 1 || finalMatches[0].match_status !== 'auto_matched' || finalMatches[0].person_id !== personId) throw new Error('Identity confirmation incomplete; no claim approval recorded');
    if (claim.review_status !== 'verified') {
      await patchExpected(config, 'person_claims', claim, {
        person_id: personId, review_status: 'verified', visibility: 'review_only', is_public: false,
        scoring_version: 'party-candidate-manual-review-v2',
        scoring_reasons: [{ reason: decision.reason ?? 'Confirmed by reviewer', reviewedAt: decision.reviewedAt, reviewedBy: review.reviewedBy, contentRevision: decision.contentRevision }],
        updated_at: decision.reviewedAt,
      }, ['review_status', 'person_id', 'claim_json', 'visibility', 'is_public']);
    } else unchanged += 1;
    revisionSelections.push({ sourcePersonKey: source.source_person_key, contentRevision: decision.contentRevision });
  }
  return { reviewed: review.decisions.length, writtenCandidates, createdPeople, rejected, unchanged, revisionSelections };
}

function buildReviewTemplate(snapshot, plan) {
  const staging = buildStagingRows(snapshot, plan);
  return { schemaVersion: 1, party: snapshot.party, reviewedBy: '', decisions: plan.matched.map((item, index) => ({
    sourceCandidateKey: item.record.sourceCandidateKey, contentRevision: staging.claims[index].claim_json.revision,
    personName: item.record.personName, decision: '', personId: null, reason: '', reviewedAt: '',
  })) };
}

export {
  applyReviewedPartyCandidates,
  assertLocalSupabase,
  buildStagingRows,
  buildReviewTemplate,
  insertOnce,
  patchExpected,
  stagePartyCandidateReview,
  validateReviewFile,
};
