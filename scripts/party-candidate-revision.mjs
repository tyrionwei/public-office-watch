import { createHash } from 'node:crypto';

const contentFields = [
  'sourceCandidateKey', 'candidacyStatus', 'nominationAnnouncedAt', 'profileUrl', 'photoUrl',
  'education', 'experience', 'platform', 'socialLinks', 'locationEvidence', 'locationEvidenceUrl',
  'isIncumbent', 'incumbencyEvidence', 'incumbencySourceUrl', 'targetRace',
];
function canonical(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === 'object') return Object.fromEntries(Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function partyCandidateRevisionContent(payload, source) {
  return JSON.stringify(canonical({
    ...Object.fromEntries(contentFields.map(key => [key, payload?.[key] ?? null])),
    personName: source.raw_name, party: source.party, electionYear: source.election_year,
    sourceName: source.source_name, sourceUrl: source.source_url,
  }));
}
export function partyCandidateRevision(payload, source) {
  return createHash('sha256').update(partyCandidateRevisionContent(payload, source)).digest('hex');
}
export function partyCandidateBaseKey(source) {
  const key = source.source_payload?.sourceCandidateKey;
  if (typeof key === 'string' && key && source.source_person_key === `party-candidate:${key}`) return `party-candidate:${key}`;
  if (typeof key === 'string' && key && source.source_person_key === `party-candidate:${key}:revision:${source.source_payload?.revision}`
      && /^[a-f0-9]{64}$/.test(source.source_payload?.revision ?? '')) return `party-candidate:${key}`;
  // Legacy payloads can omit the candidate key, but cannot masquerade as revisions.
  if (!key && /^party-candidate:.+/.test(source.source_person_key ?? '') && !source.source_person_key.includes(':revision:')) return source.source_person_key;
  throw new Error('Party source key and candidate identity disagree');
}
export function assertPartyCandidateRevision(source, claim) {
  partyCandidateBaseKey(source);
  if (!claim?.claim_json || claim.source_person_id !== source.id
      || partyCandidateRevisionContent(source.source_payload, source) !== partyCandidateRevisionContent(claim.claim_json, source)) {
    throw new Error('Party source and candidacy claim content revisions disagree');
  }
  if (source.source_payload?.schemaVersion !== 2) return;
  const revision = partyCandidateRevision(source.source_payload, source);
  if (source.source_payload.revision !== revision || claim?.claim_json?.revision !== revision
      || claim?.source_person_id !== source.id
      || partyCandidateRevision(claim.claim_json, source) !== revision) {
    throw new Error('Party source and candidacy claim content revisions disagree');
  }
}

// Multi-revision publication always names the reviewed content; timestamps are not authority.
export function selectPartyCandidateSources(sources, selections = []) {
  if (!Array.isArray(selections)) throw new Error('Revision selections must be an array');
  const groups = new Map();
  for (const source of sources) {
    const key = partyCandidateBaseKey(source);
    groups.set(key, [...(groups.get(key) ?? []), source]);
  }
  const selected = [], blocking = [], used = new Set();
  for (const [baseKey, versions] of groups) {
    const choices = selections.filter(row => versions.some(source => source.source_person_key === row.sourcePersonKey));
    if (versions.length === 1 && choices.length === 0) { selected.push(versions[0]); continue; }
    const source = choices.length === 1 && versions.find(row => row.source_person_key === choices[0].sourcePersonKey);
    if (!source || choices[0].contentRevision !== partyCandidateRevision(source.source_payload, source)) {
      blocking.push({ sourcePersonKey: baseKey, errors: ['Multiple source revisions require one explicit sourcePersonKey and matching contentRevision selection'] });
      continue;
    }
    used.add(choices[0]); selected.push(source);
  }
  for (const choice of selections) if (!used.has(choice)) blocking.push({ sourcePersonKey: choice?.sourcePersonKey, errors: ['Unknown, duplicate, or invalid revision selection'] });
  return { selected, blocking };
}
