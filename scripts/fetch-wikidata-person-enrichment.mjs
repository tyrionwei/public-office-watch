import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wikidataApiUrl = 'https://www.wikidata.org/w/api.php';
const wikidataUserAgent = 'public-office-watch/0.1 (https://github.com/tyrionwei/public-office-watch; person enrichment review-only)';
const defaultOutputPath = path.resolve('data-sources/person-enrichment-claims.seed.json');
const defaultProgressPath = path.resolve('data-sources/person-enrichment-progress.json');
const defaultSkippedPath = path.resolve('data-sources/person-enrichment-skipped.json');

const relationProperties = {
  P22: 'father',
  P25: 'mother',
  P26: 'spouse',
  P40: 'child',
  P3373: 'sibling',
};

const relationLabels = {
  father: '父親',
  mother: '母親',
  spouse: '配偶',
  child: '子女',
  sibling: '手足',
};

let lastWikidataRequestAt = 0;
const wikidataEntityCache = new Map();
const minMaxlagRetryMs = 5000;
const maxRetryDelayMs = 60000;

function parseArgs(argv) {
  const args = {
    outputPath: defaultOutputPath,
    progressPath: defaultProgressPath,
    skippedOutputPath: defaultSkippedPath,
    targetNamesPath: null,
    targetNamesFromSupabase: false,
    offset: 0,
    resume: false,
    maxPeople: 25,
    searchLimit: 3,
    requestDelayMs: 2500,
    retryCount: 5,
    dryRun: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--output') {
      args.outputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--progress-file') {
      args.progressPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--skipped-output') {
      args.skippedOutputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--target-names') {
      args.targetNamesPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--target-names-from-supabase') {
      args.targetNamesFromSupabase = true;
      continue;
    }

    if (arg === '--max-people') {
      args.maxPeople = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--offset') {
      args.offset = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--resume') {
      args.resume = true;
      continue;
    }

    if (arg === '--search-limit') {
      args.searchLimit = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--request-delay-ms') {
      args.requestDelayMs = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--retry-count') {
      args.retryCount = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  if (!Number.isFinite(args.maxPeople) || args.maxPeople <= 0) {
    throw new Error('--max-people must be a positive number.');
  }

  if (!Number.isFinite(args.offset) || args.offset < 0) {
    throw new Error('--offset must be zero or a positive number.');
  }

  return args;
}

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .replace(/[臺]/g, '台')
    .replace(/[‧·．・･•]/g, '')
    .replace(/[\s\u00A0\u3000]+/g, '');
}

function getBestMonolingual(values, languages = ['zh-tw', 'zh-hant', 'zh', 'en']) {
  for (const language of languages) {
    if (values?.[language]?.value) return values[language].value;
  }

  return Object.values(values ?? {})[0]?.value ?? null;
}

function targetFromRecord(record) {
  if (typeof record === 'string') {
    return { name: record.trim() };
  }

  if (record?.target) {
    return targetFromRecord(record.target);
  }

  if (record?.person) {
    return targetFromRecord(record.person);
  }

  if (!record || typeof record !== 'object') {
    return null;
  }

  const name = String(record.name ?? record.raw ?? record.personName ?? '').trim();
  if (!name) {
    return null;
  }

  return {
    personId: record.personId ?? record.person_id ?? null,
    name,
    gender: record.gender ?? 'unknown',
    party: record.party ?? '',
    position: record.position ?? '',
    district: record.district ?? '',
    education: record.education ?? '',
    experience: record.experience ?? '',
    missingSignals: Array.isArray(record.missingSignals) ? record.missingSignals : null,
    researchSignals: Array.isArray(record.researchSignals) ? record.researchSignals : [],
    rejectedWikidataQids: record.rejectedWikidataQids ?? record.rejected_wikidata_qids ?? [],
  };
}

function targetKey(target) {
  return `${target.personId ?? 'name'}:${normalizeName(target.name)}`;
}

function rejectedWikidataQidsForTarget(target) {
  return Array.from(new Set((target?.rejectedWikidataQids ?? []).map((qid) => String(qid).toUpperCase())));
}

function loadTargetNames(filePath) {
  if (!filePath) {
    throw new Error('Provide --target-names or --target-names-from-supabase.');
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const records = Array.isArray(parsed)
    ? parsed
    : parsed.wikidataRetryTargets ?? parsed.names ?? parsed.targets ?? parsed.people ?? parsed.skippedTargets ?? parsed.skipped ?? parsed.records;

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('Target names file must be a JSON array or an object with non-empty names/targets/skippedTargets.');
  }

  return records.map(targetFromRecord).filter((item) => item?.name);
}

async function loadTargetNamesFromSupabase(skippedPath = defaultSkippedPath) {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim() || process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !anonKey) {
    throw new Error('Set SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY to load target names from public_people.');
  }

  const people = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/people`);
    url.searchParams.set('select', 'person_id,name,gender,party,position,district,education,experience');
    url.searchParams.set('order', 'name.asc,person_id.asc');

    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
        range: `${offset}-${offset + pageSize - 1}`,
        'accept-profile': 'published',
      },
      signal: AbortSignal.timeout(60000),
    });
    const rows = await response.json();

    if (!response.ok || !Array.isArray(rows)) {
      throw new Error(`Failed to fetch published people targets: ${rows?.message ?? response.statusText}`);
    }

    people.push(...rows.map((row) => ({
      personId: row.person_id,
      name: row.name,
      gender: row.gender,
      party: row.party,
      position: row.position,
      district: row.district,
      education: row.education,
      experience: row.experience,
    })).filter((row) => row.name));

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  const skippedByKey = new Map();
  if (fs.existsSync(skippedPath)) {
    const skippedPayload = JSON.parse(fs.readFileSync(skippedPath, 'utf8'));
    for (const record of skippedPayload.skippedTargets ?? []) {
      const target = targetFromRecord(record);
      const rejectedWikidataQids = rejectedWikidataQidsForTarget(target);
      if (target && rejectedWikidataQids.length > 0) {
        skippedByKey.set(targetKey(target), rejectedWikidataQids);
      }
    }
  }

  const byName = new Map();
  for (const person of people) {
    const key = targetKey(person);
    if (!byName.has(key)) {
      byName.set(key, {
        ...person,
        rejectedWikidataQids: skippedByKey.get(key) ?? [],
      });
    }
  }

  return Array.from(byName.values());
}

async function wikidataGet(params) {
  const url = new URL(wikidataApiUrl);
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('maxlag', '5');

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': wikidataUserAgent,
      accept: 'application/json',
      'accept-encoding': 'gzip, deflate',
    },
    signal: AbortSignal.timeout(60000),
  });
  const text = await response.text();
  let payload;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Wikidata API returned non-JSON response: ${text.slice(0, 120)}`);
  }

  if (!response.ok || payload.error) {
    const errorCode = payload.error?.code ?? response.status;
    const errorInfo = payload.error?.info ?? response.statusText;
    const error = new Error(`Wikidata API failed: ${errorCode}: ${errorInfo}`);
    const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
    const reportedLag = Number(payload.error?.lag);

    error.wikidataErrorCode = String(errorCode).toLowerCase();
    error.httpStatus = response.status;

    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      error.retryAfterMs = retryAfter * 1000;
    }

    if (error.wikidataErrorCode === 'maxlag') {
      error.retryAfterMs = Math.max(
        error.retryAfterMs ?? 0,
        Number.isFinite(reportedLag) && reportedLag > 0 ? Math.ceil(reportedLag * 1000) : 0,
        minMaxlagRetryMs,
      );
    }

    throw error;
  }

  return payload;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function isRetryableWikidataError(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const errorCode = String(error?.wikidataErrorCode ?? '').toLowerCase();
  const status = Number(error?.httpStatus);

  return errorCode === 'maxlag'
    || errorCode === 'ratelimited'
    || status === 429
    || [500, 502, 503, 504].includes(status)
    || message.includes('too many requests')
    || message.includes('maxlag')
    || message.includes('non-json');
}

export function wikidataRetryDelayMs(error, args, attempt) {
  const exponentialDelay = Math.min(maxRetryDelayMs, args.requestDelayMs * (2 ** attempt));
  const serverDelay = Number(error?.retryAfterMs);
  const maxlagMinimum = String(error?.wikidataErrorCode ?? '').toLowerCase() === 'maxlag'
    || String(error?.message ?? '').toLowerCase().includes('maxlag')
    ? minMaxlagRetryMs
    : 0;

  return Math.max(
    exponentialDelay,
    Number.isFinite(serverDelay) && serverDelay > 0 ? serverDelay : 0,
    maxlagMinimum,
  );
}

async function wikidataGetWithRetry(params, args) {
  let lastError = null;

  for (let attempt = 0; attempt <= args.retryCount; attempt += 1) {
    try {
      const waitMs = Math.max(0, args.requestDelayMs - (Date.now() - lastWikidataRequestAt));

      if (waitMs > 0) {
        await sleep(waitMs);
      }

      lastWikidataRequestAt = Date.now();
      return await wikidataGet(params);
    } catch (error) {
      lastError = error;

      if (!isRetryableWikidataError(error)) {
        throw error;
      }

      if (attempt < args.retryCount) {
        await sleep(wikidataRetryDelayMs(error, args, attempt));
      }
    }
  }

  throw lastError;
}

async function searchEntity(name, limit, args) {
  const payload = await wikidataGetWithRetry({
    action: 'wbsearchentities',
    search: name,
    language: 'zh',
    uselang: 'zh',
    type: 'item',
    limit,
  }, args);

  return payload.search ?? [];
}

async function getEntities(ids, args) {
  if (ids.length === 0) return {};
  const uniqueIds = Array.from(new Set(ids));
  const missingIds = uniqueIds.filter((id) => !wikidataEntityCache.has(id));

  for (let index = 0; index < missingIds.length; index += 50) {
    const batchIds = missingIds.slice(index, index + 50);
    const payload = await wikidataGetWithRetry({
      action: 'wbgetentities',
      ids: batchIds.join('|'),
      props: 'labels|descriptions|aliases|claims|sitelinks',
      languages: 'zh-tw|zh-hant|zh|en',
    }, args);

    for (const [id, entity] of Object.entries(payload.entities ?? {})) {
      wikidataEntityCache.set(id, entity);
    }
  }

  return Object.fromEntries(uniqueIds
    .filter((id) => wikidataEntityCache.has(id))
    .map((id) => [id, wikidataEntityCache.get(id)]));
}

function entityIdFromClaim(claim) {
  return claim?.mainsnak?.datavalue?.value?.id ?? null;
}

function timeFromClaim(claim) {
  const time = claim?.mainsnak?.datavalue?.value?.time;
  if (!time) return null;
  return time.replace(/^\+/, '').slice(0, 10);
}

function timeFromQualifier(claim, property) {
  const time = claim?.qualifiers?.[property]?.[0]?.datavalue?.value?.time;
  if (!time) return null;
  return time.replace(/^\+/, '').slice(0, 10);
}

function claimEntityIds(entity, property) {
  return (entity.claims?.[property] ?? []).map(entityIdFromClaim).filter(Boolean);
}

function claimTimes(entity, property) {
  return (entity.claims?.[property] ?? []).map(timeFromClaim).filter(Boolean);
}

function normalizeGenderValue(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'male' || normalized === 'm' || normalized.includes('男')) return 'male';
  if (normalized === 'female' || normalized === 'f' || normalized.includes('女')) return 'female';
  return 'unknown';
}

function compactIdentityText(value) {
  return normalizeName(value).toLowerCase();
}

function identityTokens(value) {
  const normalized = compactIdentityText(value);
  if (!normalized || normalized === 'unknown') return [];
  return Array.from(new Set([
    normalized,
    ...normalized.split(/[;；,，、／/()（）\s]+/).filter((item) => item.length >= 2),
  ]));
}

function hasTokenOverlap(leftValues, rightValues) {
  const leftTokens = leftValues.flatMap(identityTokens);
  const rightText = rightValues.map(compactIdentityText).join(' ');

  return leftTokens.some((token) => token.length >= 2 && rightText.includes(token));
}

function entityGender(entity) {
  return genderFromEntityId(claimEntityIds(entity, 'P21')[0]) ?? 'unknown';
}

export function scoreEntityMatch(target, entity, searchResult, relatedEntities = {}) {
  const targetName = normalizeName(target.name);
  const labels = [
    getBestMonolingual(entity.labels),
    searchResult.label,
    ...(Object.values(entity.aliases ?? {}).flatMap((items) => items.map((item) => item.value))),
  ].filter(Boolean).map(normalizeName);

  const evidence = {
    normalizedName: labels.includes(targetName),
    gender: false,
    publicOfficeContext: false,
    position: false,
    education: false,
    experience: false,
    districtOrParty: false,
  };
  const reasons = [];
  const hardConflicts = [];
  let score = evidence.normalizedName ? 50 : 0;
  const targetGender = normalizeGenderValue(target.gender);
  const wikidataGender = entityGender(entity);

  if (evidence.normalizedName) reasons.push('normalized name matched');
  else hardConflicts.push('name did not match');

  const entityDescription = [
    getBestMonolingual(entity.descriptions),
    searchResult.description,
  ].filter(Boolean).join(' ');
  const educationLabels = labelsForIds(relatedEntities, claimEntityIds(entity, 'P69')).map((item) => item.label);
  const positionLabels = labelsForIds(relatedEntities, claimEntityIds(entity, 'P39')).map((item) => item.label);
  const occupationLabels = labelsForIds(relatedEntities, claimEntityIds(entity, 'P106')).map((item) => item.label);
  const wikidataEvidence = [entityDescription, ...positionLabels, ...occupationLabels, ...educationLabels];
  const corroboratingSignals = [];

  const hasPoliticalDescription =
    /政治|政黨|立法|議員|市長|縣長|總統|候選|minister|politician|legislator|mayor|president/i.test(entityDescription);

  if (targetGender === 'unknown') {
    reasons.push('target gender missing');
  } else if (wikidataGender === 'unknown') {
    reasons.push('Wikidata gender missing');
  } else if (wikidataGender !== targetGender) {
    hardConflicts.push(`gender mismatch: target=${targetGender}, wikidata=${wikidataGender}`);
  } else {
    evidence.gender = true;
    score += 25;
    reasons.push('gender matched');
  }

  evidence.publicOfficeContext = hasPoliticalDescription;
  if (hasPoliticalDescription) {
    score += 10;
    reasons.push('political/public-office context matched');
  } else {
    reasons.push('missing political/public-office description');
  }

  if (hasTokenOverlap([target.position], wikidataEvidence)) {
    evidence.position = true;
    score += 10;
    corroboratingSignals.push('position matched');
  }

  if (hasTokenOverlap([target.education], educationLabels)) {
    evidence.education = true;
    score += 10;
    corroboratingSignals.push('education matched');
  }

  if (hasTokenOverlap([target.experience], [...positionLabels, ...occupationLabels])) {
    evidence.experience = true;
    score += 10;
    corroboratingSignals.push('experience matched');
  }

  if (hasTokenOverlap([target.district, target.party], [entityDescription])) {
    evidence.districtOrParty = true;
    score += 5;
    corroboratingSignals.push('district or party hint matched');
  }

  if (corroboratingSignals.length === 0) reasons.push('missing corroborating identity signal');
  else reasons.push(...corroboratingSignals);

  const evidenceCount = Object.values(evidence).filter(Boolean).length;
  const reviewEligible = evidence.normalizedName && hardConflicts.length === 0;
  const matched = reviewEligible
    && evidence.publicOfficeContext
    && corroboratingSignals.length > 0;

  return {
    matched,
    reviewEligible,
    score: Math.min(100, score),
    evidenceCount,
    evidence,
    hardConflicts,
    reasons,
    gender: wikidataGender,
    corroboratingSignals,
  };
}

function sourceUrlFor(qid) {
  return `https://www.wikidata.org/wiki/${qid}`;
}

function identityCandidateFor(candidate) {
  return {
    wikidataQid: candidate.result.id,
    label: getBestMonolingual(candidate.entity?.labels) ?? candidate.result.label ?? null,
    description: getBestMonolingual(candidate.entity?.descriptions) ?? candidate.result.description ?? null,
    sourceUrl: sourceUrlFor(candidate.result.id),
    score: candidate.match.score,
    evidenceCount: candidate.match.evidenceCount ?? 0,
    evidence: candidate.match.evidence ?? {},
    corroboratingSignals: candidate.match.corroboratingSignals ?? [],
    hardConflicts: candidate.match.hardConflicts ?? [],
    reasons: candidate.match.reasons ?? [],
    reviewEligible: Boolean(candidate.match.reviewEligible),
    reviewRoute: 'codex_identity_review',
    manualReviewRequired: false,
  };
}

function claimRecord({ target, qid, claimType, claimValue, claimJson = {}, sourceUrl = sourceUrlFor(qid), matchEvidence = null }) {
  return {
    personId: target.personId ?? null,
    personName: target.name,
    claimType,
    claimValue,
    claimJson: {
      ...claimJson,
      wikidataQid: qid,
      identityMatch: matchEvidence,
    },
    confidenceLevel: 'C',
    reviewStatus: 'pending',
    visibility: 'review_only',
    sourceId: 'wikidata-person-enrichment',
    sourceName: 'Wikidata 人物補充資料',
    sourceUrl,
  };
}

function genderFromEntityId(entityId) {
  if (entityId === 'Q6581097') return 'male';
  if (entityId === 'Q6581072') return 'female';
  return null;
}

function labelsForIds(entities, ids) {
  return ids.map((id) => ({ id, label: getBestMonolingual(entities[id]?.labels), description: getBestMonolingual(entities[id]?.descriptions) }))
    .filter((item) => item.label);
}

function partyAffiliations(entity, relatedEntities) {
  return (entity.claims?.P102 ?? [])
    .map((claim) => {
      const partyQid = entityIdFromClaim(claim);
      const label = getBestMonolingual(relatedEntities[partyQid]?.labels);
      if (!partyQid || !label) return null;
      return {
        partyQid,
        partyName: label,
        startDate: timeFromQualifier(claim, 'P580'),
        endDate: timeFromQualifier(claim, 'P582'),
      };
    })
    .filter(Boolean);
}

function needsClaim(target, claimType) {
  return !Array.isArray(target.missingSignals)
    || target.missingSignals.includes(claimType)
    || target.researchSignals?.includes(claimType);
}

function buildClaimsForTarget({ target, entity, qid, relatedEntities, matchEvidence }) {
  const claims = [];
  const gender = genderFromEntityId(claimEntityIds(entity, 'P21')[0]);
  const birthDate = claimTimes(entity, 'P569')[0] ?? null;
  const education = labelsForIds(relatedEntities, claimEntityIds(entity, 'P69')).map((item) => item.label);
  const positions = labelsForIds(relatedEntities, claimEntityIds(entity, 'P39')).map((item) => item.label);
  const occupations = labelsForIds(relatedEntities, claimEntityIds(entity, 'P106')).map((item) => item.label);
  const parties = partyAffiliations(entity, relatedEntities);

  if (needsClaim(target, 'external_id')) {
    claims.push(claimRecord({ target, qid, claimType: 'external_id', claimValue: `wikidata:${qid}`, matchEvidence }));
  }

  if (gender && needsClaim(target, 'gender')) {
    claims.push(claimRecord({ target, qid, claimType: 'gender', claimValue: gender, matchEvidence }));
  }

  if (birthDate && needsClaim(target, 'birth_date')) {
    claims.push(claimRecord({ target, qid, claimType: 'birth_date', claimValue: birthDate, matchEvidence }));
  }

  if (education.length > 0 && needsClaim(target, 'education')) {
    claims.push(claimRecord({ target, qid, claimType: 'education', claimValue: Array.from(new Set(education)).join('；'), matchEvidence }));
  }

  if ((positions.length > 0 || occupations.length > 0) && needsClaim(target, 'experience')) {
    claims.push(claimRecord({
      target,
      qid,
      claimType: 'experience',
      claimValue: Array.from(new Set([...positions, ...occupations])).slice(0, 12).join('；'),
      claimJson: { positions, occupations },
      matchEvidence,
    }));
  }

  for (const party of needsClaim(target, 'party_affiliation') ? parties : []) {
    claims.push(claimRecord({
      target,
      qid,
      claimType: 'party_affiliation',
      claimValue: party.partyName,
      claimJson: {
        partyQid: party.partyQid,
        startDate: party.startDate,
        endDate: party.endDate,
        explicitDateSource: Boolean(party.startDate || party.endDate),
      },
      matchEvidence,
    }));
  }

  for (const [property, relationType] of needsClaim(target, 'family_relation') ? Object.entries(relationProperties) : []) {
    for (const relative of labelsForIds(relatedEntities, claimEntityIds(entity, property))) {
      claims.push(claimRecord({
        target,
        qid,
        claimType: 'family_relation',
        claimValue: `${relationLabels[relationType]}：${relative.label}`,
        sourceUrl: sourceUrlFor(relative.id),
        claimJson: {
          relationType,
          relationLabel: relationLabels[relationType],
          relativeQid: relative.id,
          relativeName: relative.label,
          relativeDescription: relative.description ?? null,
        },
        matchEvidence,
      }));
    }
  }

  return claims;
}

function mergeClaims(existingPayload, newClaims) {
  const existingClaims = existingPayload.personClaims ?? [];
  const keyFor = (claim) =>
    claim.claimKey ??
    [
      claim.personId ?? claim.personName,
      claim.claimType,
      claim.claimValue,
      claim.claimJson?.wikidataQid,
      claim.claimJson?.relativeQid,
    ].filter(Boolean).join('|');
  const byKey = new Map(existingClaims.map((claim) => [keyFor(claim), claim]));

  for (const claim of newClaims) {
    byKey.set(keyFor(claim), claim);
  }

  return {
    schemaVersion: existingPayload.schemaVersion ?? 1,
    name: existingPayload.name ?? 'person-enrichment-claims',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: existingPayload.notes ?? 'Reviewed-source supplemental person claims. Wikidata/Wikipedia-derived records are review-only by default.',
    personClaims: Array.from(byKey.values()),
  };
}

function readProgress(progressPath) {
  if (!fs.existsSync(progressPath)) {
    return { nextOffset: 0 };
  }

  return JSON.parse(fs.readFileSync(progressPath, 'utf8'));
}

function writeProgress(progressPath, progress) {
  fs.writeFileSync(progressPath, `${JSON.stringify(progress, null, 2)}\n`);
}

function writeSkippedTargets(skippedPath, skippedTargets, resolvedTargets) {
  const existingPayload = fs.existsSync(skippedPath)
    ? JSON.parse(fs.readFileSync(skippedPath, 'utf8'))
    : { skippedTargets: [] };
  const resolvedKeys = new Set(resolvedTargets.map(targetKey));
  const byKey = new Map();

  for (const skipped of existingPayload.skippedTargets ?? []) {
    const target = targetFromRecord(skipped);
    if (!target) continue;
    if (resolvedKeys.has(targetKey(target)) && rejectedWikidataQidsForTarget(target).length === 0) continue;
    byKey.set(targetKey(target), skipped);
  }

  for (const skipped of skippedTargets) {
    const key = targetKey(skipped.target);
    const existing = byKey.get(key);
    byKey.set(targetKey(skipped.target), {
      target: skipped.target,
      name: skipped.target.name,
      reason: skipped.reason,
      checkedAt: new Date().toISOString(),
      reviewStatus: skipped.reviewStatus ?? existing?.reviewStatus ?? 'pending',
      identityCandidates: skipped.identityCandidates?.length > 0
        ? skipped.identityCandidates
        : existing?.identityCandidates ?? [],
      nextAction: skipped.nextAction ?? existing?.nextAction ?? null,
    });
  }

  const nextPayload = {
    schemaVersion: existingPayload.schemaVersion ?? 1,
    name: existingPayload.name ?? 'person-enrichment-skipped-targets',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: existingPayload.notes ?? 'Targets that did not produce confident Wikidata enrichment claims. This file can be reused with --target-names.',
    skippedTargets: Array.from(byKey.values()).sort((left, right) => String(left.name).localeCompare(String(right.name), 'zh-Hant-TW')),
  };

  fs.writeFileSync(skippedPath, `${JSON.stringify(nextPayload, null, 2)}\n`);
}

async function main() {
  const args = parseArgs(process.argv);
  const progress = args.resume ? readProgress(args.progressPath) : { nextOffset: args.offset };
  const offset = args.resume ? Number(progress.nextOffset ?? 0) : args.offset;
  const targets = (args.targetNamesFromSupabase ? await loadTargetNamesFromSupabase(args.skippedOutputPath) : loadTargetNames(args.targetNamesPath)).slice(
    offset,
    offset + args.maxPeople,
  );
  const allClaims = [];
  const skipped = [];
  const resolvedTargets = [];
  const results = [];

  for (const target of targets) {
    try {
      const searchResults = await searchEntity(target.name, args.searchLimit, args);
      const entities = await getEntities(searchResults.map((result) => result.id), args);
      const candidates = [];
      const candidateRelatedIds = searchResults.flatMap((result) => {
        const entity = entities[result.id];
        if (!entity) return [];
        return [
          ...claimEntityIds(entity, 'P21'),
          ...claimEntityIds(entity, 'P69'),
          ...claimEntityIds(entity, 'P39'),
          ...claimEntityIds(entity, 'P106'),
          ...claimEntityIds(entity, 'P102'),
        ];
      });
      const candidateRelatedEntities = await getEntities(candidateRelatedIds, args);

      for (const result of searchResults) {
        if (target.rejectedWikidataQids?.includes(result.id)) {
          candidates.push({
            result,
            entity: null,
            relatedEntities: {},
            match: { matched: false, score: 0, reasons: ['previously rejected Wikidata QID'] },
          });
          continue;
        }

        const entity = entities[result.id];
        if (!entity) continue;
        const match = scoreEntityMatch(target, entity, result, candidateRelatedEntities);
        candidates.push({ result, entity, relatedEntities: candidateRelatedEntities, match });
      }

      const matched = candidates
        .filter((candidate) => candidate.match.matched)
        .sort((left, right) => right.match.score - left.match.score)[0];

      if (!matched) {
        const identityCandidates = candidates
          .filter((candidate) => candidate.entity && candidate.match.evidence?.normalizedName)
          .sort((left, right) => right.match.evidenceCount - left.match.evidenceCount || right.match.score - left.match.score)
          .slice(0, args.searchLimit)
          .map(identityCandidateFor);
        const status = identityCandidates.length > 0 ? 'identity_review_required' : 'no_candidate_found';
        const reason = identityCandidates.length > 0
          ? 'Wikidata identity candidates require downstream review'
          : 'no matching Wikidata identity candidate found';
        skipped.push({
          target,
          reason,
          reviewStatus: 'pending',
          identityCandidates,
          nextAction: identityCandidates.length > 0 ? 'review evidence conditions and resolve identity before applying claims' : null,
        });
        results.push({
          personId: target.personId,
          name: target.name,
          status,
          claimCount: 0,
          identityCandidateCount: identityCandidates.length,
          reason,
        });
        continue;
      }

      const entity = matched.entity;
      const qid = matched.result.id;
      const relatedIds = [
        ...claimEntityIds(entity, 'P21'),
        ...claimEntityIds(entity, 'P69'),
        ...claimEntityIds(entity, 'P39'),
        ...claimEntityIds(entity, 'P106'),
        ...claimEntityIds(entity, 'P102'),
        ...Object.keys(relationProperties).flatMap((property) => claimEntityIds(entity, property)),
      ];
      const relatedEntities = await getEntities(relatedIds, args);
      const targetClaims = buildClaimsForTarget({
        target,
        entity,
        qid,
        relatedEntities,
        matchEvidence: {
          version: 'wikidata-identity-v2',
          status: 'matched',
          score: matched.match.score,
          reasons: matched.match.reasons,
          targetGender: normalizeGenderValue(target.gender),
          wikidataGender: matched.match.gender,
          corroboratingSignals: matched.match.corroboratingSignals,
        },
      });
      allClaims.push(...targetClaims);
      resolvedTargets.push(target);
      results.push({
        personId: target.personId,
        name: target.name,
        status: targetClaims.length > 0 ? 'claims_generated' : 'matched_no_claims',
        claimCount: targetClaims.length,
        reason: null,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      skipped.push({
        target,
        reason,
      });
      results.push({
        personId: target.personId,
        name: target.name,
        status: 'source_error',
        claimCount: 0,
        reason,
      });
    }
  }

  const existingPayload = fs.existsSync(args.outputPath)
    ? JSON.parse(fs.readFileSync(args.outputPath, 'utf8'))
    : { personClaims: [] };
  const nextPayload = mergeClaims(existingPayload, allClaims);

  if (!args.dryRun) {
    fs.writeFileSync(args.outputPath, `${JSON.stringify(nextPayload, null, 2)}\n`);
    writeSkippedTargets(args.skippedOutputPath, skipped, resolvedTargets);
    writeProgress(args.progressPath, {
      nextOffset: offset + targets.length,
      lastOffset: offset,
      lastTargetCount: targets.length,
      lastTargetNames: targets.map((target) => target.name),
      lastNewClaimCount: allClaims.length,
      lastSkippedCount: skipped.length,
      lastResults: results,
      updatedAt: new Date().toISOString(),
    });
  }

  const sourceErrorCount = results.filter((result) => result.status === 'source_error').length;
  const noConfidentMatchCount = results.filter((result) => result.status === 'no_confident_match').length;
  const identityReviewRequiredCount = results.filter((result) => result.status === 'identity_review_required').length;
  const noCandidateFoundCount = results.filter((result) => result.status === 'no_candidate_found').length;
  console.log(JSON.stringify({
    status: sourceErrorCount > 0 ? 'partial' : 'ok',
    targetCount: targets.length,
    targetNames: targets.map((target) => target.name),
    offset,
    nextOffset: offset + targets.length,
    newClaimCount: allClaims.length,
    skippedCount: skipped.length,
    sourceErrorCount,
    noConfidentMatchCount,
    identityReviewRequiredCount,
    noCandidateFoundCount,
    results,
    outputPath: args.outputPath,
    skippedOutputPath: args.skippedOutputPath,
    dryRun: args.dryRun,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`wikidata person enrichment fetch failed: ${message}`);
    process.exit(1);
  });
}
