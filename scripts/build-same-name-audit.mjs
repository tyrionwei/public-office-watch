import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acceptedOfficialProfileClaim, datePrecision } from './lib/official-profile-policy.mjs';

const norm = value => String(value ?? '').normalize('NFKC').replace(/\s/g, '')
  .replace(/[．.·‧﹒]/g, '·').replaceAll('臺', '台').toLowerCase();
const unique = xs => [...new Set(xs.filter(Boolean))];
const key = (a, b) => [a, b].sort().join('|');
const grassrootsTypes = new Set(['village_chief', 'township_representative', 'township_representative_district']);
const grassrootsPosition = /村里長|村長|里長|鄉民代表|鎮民代表|市民代表|鄉鎮市民代表|代表會/;
const higherPosition = /立法委員|立委|縣議員|市議員|縣長|市長|鄉長|鎮長|總統|部長|議會|國民大會|國大代表/;
const gender = value => ({ male: 'male', 男: 'male', female: 'female', 女: 'female' }[value] ?? null);
const compatible = (a, b) => a === b || a.startsWith(b + '-') || b.startsWith(a + '-');

export function buildSameNameAudit(data) {
  const people = new Map(data.people.map(p => [p.id, p]));
  const canonical = new Map(data.canonical.map(p => [p.person_id, p.canonical_person_id]));
  const canon = id => canonical.get(id) ?? id;
  const endpoints = new Map();
  for (const p of data.people) {
    const id = canon(p.id);
    if (!people.has(id)) throw new Error(`Missing canonical person ${id}`);
    if (!endpoints.has(id)) endpoints.set(id, { id, name: people.get(id).name, members: [], candidates: [], claims: [], holds: [], impact: {} });
    endpoints.get(id).members.push(p);
  }
  for (const c of data.candidates ?? []) endpoints.get(canon(c.person_id))?.candidates.push(c);
  for (const c of data.claims ?? []) endpoints.get(canon(c.person_id))?.claims.push(c);
  for (const h of data.holds ?? []) if (!h.released_at) endpoints.get(canon(h.person_id))?.holds.push(h);
  for (const row of data.claimCounts ?? []) {
    const target = endpoints.get(canon(row.person_id));
    if (target) target.impact[row.claim_type] = (target.impact[row.claim_type] ?? 0) + Number(row.count);
  }
  const publicIds = new Set(data.publicIds ?? []);
  for (const e of endpoints.values()) {
    const roles = unique(e.candidates.map(c => c.race_type));
    const positions = e.members.map(p => p.position ?? '');
    const hasHigherRecord = roles.some(r => !grassrootsTypes.has(r) && r !== 'referendum') || positions.some(p => higherPosition.test(p));
    const hasGrassrootsRecord = roles.some(r => grassrootsTypes.has(r)) || positions.some(p => grassrootsPosition.test(p));
    e.scope = e.members.every(p => /^測試人物/.test(p.name)) ? 'synthetic_fixture'
      : hasGrassrootsRecord && !hasHigherRecord ? 'deferred_grassroots_only' : 'included';
    e.hasHigherRecord = hasHigherRecord;
    e.public = publicIds.has(e.id);
    e.births = unique(e.claims.filter(c => c.claim_type === 'birth_date' && c.review_status === 'verified' && acceptedOfficialProfileClaim(c))
      .map(c => String(c.claim_value ?? c.claim_json?.value ?? '')));
    e.genders = unique(e.members.map(p => gender(p.gender)));
    e.stableIds = unique(e.claims.filter(c => c.claim_type === 'external_id' && c.review_status === 'verified'
      && /^wikidata:Q\d+$/.test(c.claim_value ?? '') && c.claim_json?.stablePersonIdReview?.status === 'verified'
      && c.claim_json?.stablePersonIdReview?.independentEvidence === true && String(c.claim_json?.stablePersonIdReview?.evidenceUrl ?? '').trim())
      .map(c => c.claim_value));
  }
  const decisionsByPair = new Map();
  for (const d of data.decisions ?? []) {
    const k = key(canon(d.duplicate_person_id), canon(d.canonical_person_id));
    if (!decisionsByPair.has(k)) decisionsByPair.set(k, []);
    decisionsByPair.get(k).push(d);
  }
  const names = new Map();
  for (const p of data.people) {
    const n = norm(p.name);
    if (!names.has(n)) names.set(n, { normalizedName: n, rawIds: [], endpointIds: new Set() });
    names.get(n).rawIds.push(p.id); names.get(n).endpointIds.add(canon(p.id));
  }
  const pairs = [], groups = [], resolved = [], excluded = [];
  for (const group of names.values()) {
    if (group.rawIds.length < 2) continue;
    const allIds = [...group.endpointIds];
    const ids = allIds.filter(id => endpoints.get(id).scope === 'included');
    const summary = { ...group, endpointIds: allIds, includedEndpointIds: ids,
      excludedEndpointIds: allIds.filter(id => !ids.includes(id)) };
    if (ids.length < 2) {
      (allIds.length === 1 && ids.length === 1 ? resolved : excluded).push(summary);
      continue;
    }
    groups.push(summary);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = endpoints.get(ids[i]), b = endpoints.get(ids[j]);
      const decisions = decisionsByPair.get(key(a.id, b.id)) ?? [];
      const birthConflict = [...a.births, ...b.births].some((v, k, vs) => vs.slice(k + 1).some(w => !compatible(v, w)));
      const genderConflict = unique([...a.genders, ...b.genders]).length > 1;
      const stableConflict = unique([...a.stableIds, ...b.stableIds]).length > 1;
      const sharedStableIds = a.stableIds.filter(id => b.stableIds.includes(id));
      const sharedFullBirth = a.births.some(d => datePrecision(d) === 'day' && b.births.includes(d));
      const sameKnownGender = a.genders.length === 1 && b.genders.length === 1 && a.genders[0] === b.genders[0];
      const urls = e => unique([...e.members.map(p => p.source_url), ...e.candidates.map(c => c.source_url)]);
      const sharedSpecificUrls = urls(a).filter(u => urls(b).includes(u) && !/data\.gov\.tw\/dataset|\/data\/json\/cand\/|bulletin\.cec\.gov\.tw|\.pdf(?:$|\?)/i.test(u));
      const conflict = birthConflict || genderConflict || stableConflict;
      const category = decisions.some(d => d.status === 'rejected') ? 'existing_rejected'
        : decisions.some(d => d.status === 'archived') ? 'existing_archived'
        : conflict ? 'identity_conflict'
        : sharedStableIds.length ? 'reviewed_stable_identity_match'
        : sharedFullBirth && sameKnownGender ? 'official_birth_gender_match_for_review'
        : sharedSpecificUrls.length ? 'shared_person_source_for_review' : 'insufficient_identity_evidence';
      pairs.push({ pairKey: key(a.id, b.id), name: group.normalizedName, personIds: [a.id, b.id], category,
        evidence: { birthConflict, genderConflict, stableConflict, sharedStableIds, sharedFullBirth, sameKnownGender, sharedSpecificUrls },
        activeHoldIds: [...a.holds, ...b.holds].map(h => h.id),
        existingDecisions: decisions.map(d => ({ id: d.id, status: d.status, reason: d.reason })),
        publicEndpoints: Number(a.public) + Number(b.public),
        candidateRecords: a.candidates.length + b.candidates.length,
        sensitiveClaimCounts: { family_relation: (a.impact.family_relation ?? 0) + (b.impact.family_relation ?? 0), legal_case: (a.impact.legal_case ?? 0) + (b.impact.legal_case ?? 0) },
        action: 'comparison_only_no_merge',
      });
    }
  }
  const relatedIds = new Set(groups.flatMap(g => g.includedEndpointIds));
  const canonicalIdentityConflicts = [...endpoints.values()].filter(e => e.scope === 'included' && e.members.length > 1)
    .map(e => ({ personId: e.id, name: e.name, memberIds: e.members.map(p => p.id),
      officialBirthConflict: e.births.some((v, i, vs) => vs.slice(i + 1).some(w => !compatible(v, w))),
      genderConflict: e.genders.length > 1, reviewedStableIdConflict: e.stableIds.length > 1,
      action: 'review_existing_mapping_no_change' }))
    .filter(e => e.officialBirthConflict || e.genderConflict || e.reviewedStableIdConflict);
  const resultEndpoints = [...relatedIds].map(id => {
    const e = endpoints.get(id);
    return { ...e, claims: e.claims.filter(c => ['birth_date', 'external_id'].includes(c.claim_type)),
      candidates: e.candidates.sort((a, b) => a.year - b.year) };
  });
  const count = values => Object.fromEntries(unique(values).map(k => [k, values.filter(v => v === k).length]));
  return { asOf: '2026-10-17', scope: '完整本機人物與既有來源快照；全年度，不限2026；排除只有村里長或代表級紀錄者',
    databaseWrites: 0, productionRead: false,
    summary: { rawPeople: data.people.length, canonicalPeople: endpoints.size,
      endpointScope: count([...endpoints.values()].map(e => e.scope)), rawSameNameGroups: [...names.values()].filter(g => g.rawIds.length > 1).length,
      alreadyResolvedGroups: resolved.length, excludedGroups: excluded.length, unresolvedGroups: groups.length,
      canonicalEndpointsInComparison: relatedIds.size, pairs: pairs.length, categories: count(pairs.map(p => p.category)),
      pairsWithActiveHolds: pairs.filter(p => p.activeHoldIds.length).length,
      bothPublicPairs: pairs.filter(p => p.publicEndpoints === 2).length,
      existingCanonicalConflictSignals: canonicalIdentityConflicts.length },
    groups, pairs, endpoints: resultEndpoints, resolved, excluded, canonicalIdentityConflicts,
    limitations: ['罕見姓名、同政黨、同選區與選舉紀錄鍵均不獨立證明同人。',
      '完整生日／性別吻合仍為人工複核候選，不能據此自動合併。',
      '既有暫緩、rejected、archived決定保留；未重新下載受阻來源或解除暫緩。',
      '純身份比對；不搬移候選／司法／親屬資料，不改公開狀態。',
      '沒有較高級別證據的村里長／代表端點不因同名於高級別人物而自動納入。'] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: build-same-name-audit.mjs SNAPSHOT.json OUTPUT_DIR');
  const result = buildSameNameAudit(JSON.parse(fs.readFileSync(input, 'utf8')));
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'audit.json'), JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(result.summary, null, 2) + '\n');
  console.log(JSON.stringify(result.summary));
}
