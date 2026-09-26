// Shared by registration and identity-review writers. A name is never identity evidence.
const grassrootsTypes = new Set(['village_chief', 'township_representative', 'township_representative_district']);
const higherTypes = new Set(['president', 'vice_president', 'legislator', 'party_list_legislator', 'municipality_mayor', 'county_mayor', 'city_councilor', 'county_councilor', 'township_mayor', 'legislative_district', 'councilor_district', 'local_chief', 'indigenous']);
export function isGrassrootsRace(race) {
  if (!race?.race_type) throw new Error('race_type is required before candidate identity writes');
  if (!grassrootsTypes.has(race.race_type) && !higherTypes.has(race.race_type)) {
    throw new Error(`Unsupported candidate race_type: ${race.race_type}; classify before identity writes`);
  }
  return grassrootsTypes.has(race.race_type);
}
export function isHigherLevelRace(race) { return higherTypes.has(race?.race_type); }
export function assertGrassrootsDecision(item, decision) {
  const grassroots = isGrassrootsRace(item.race);
  if (decision.decision === 'name_only' && !grassroots) throw new Error('name_only is only allowed for grassroots races');
  if (!grassroots || decision.decision === 'reject') return;
  if (decision.decision === 'name_only') {
    if (item.candidate?.person_id) throw new Error('name_only cannot clear an existing person link; review the existing identity');
    return;
  }
  if (decision.decision !== 'use_existing' || !String(decision.identityEvidence ?? '').trim()
      || !item.higherLevelPersonIds?.includes(decision.personId)) {
    throw new Error('Grassroots linkage requires reviewed identityEvidence and an existing higher-level candidacy; otherwise use name_only');
  }
}
export function candidateIdentityFields(planned, people) {
  const personId = people.get(planned.record.personExternalId)?.id ?? planned.candidate?.person_id ?? null;
  if (isGrassrootsRace(planned.race)) {
    const decision = planned.identityDecision;
    if (!decision) throw new Error('Grassroots writer requires an explicit reviewed name_only or higher-level identity decision');
    assertGrassrootsDecision(planned, decision);
    if (decision.decision === 'name_only') return { candidate_name: planned.record.personName, person_id: null };
    if (personId !== decision.personId) throw new Error('Reviewed person identity differs from candidate writer');
  }
  return { candidate_name: planned.record.personName, person_id: personId };
}


// Source-only rows may be retained privately, but must not auto-resolve identities.
export function isGrassrootsSource(row) {
  const payload = row?.sourcePayload ?? row?.source_payload ?? {};
  const fields = [row?.position, row?.normalizedRole, row?.normalized_role, row?.raceType, row?.race_type,
    payload.position, payload.normalizedRole, payload.normalized_role, payload.raceType, payload.race_type,
    payload.kind, payload.role, payload.race?.raceType, payload.race?.race_type,
    payload.targetRace?.raceType, payload.targetRace?.race_type];
  return fields.some(value => {
    const text = String(value ?? '');
    return grassrootsTypes.has(text) || /village[-_]chief|township[-_]representative|村里長|村長|里長|鄉鎮市民代表|鄉民代表|鎮民代表|市民代表|鄉鎮市代表/.test(text);
  });
}
export function assertSeedUsesReviewedGrassrootsImport(seed) {
  const races = new Map((seed.races ?? []).map(race => [race.externalId ?? race.external_id, race]));
  const redirect = () => { throw new Error('Grassroots seed writes require review-official-candidate-snapshot.mjs with name_only or reviewed higher-level identity'); };
  for (const candidate of seed.candidates ?? []) {
    const race = races.get(candidate.raceExternalId ?? candidate.race_external_id);
    if (isGrassrootsRace({ race_type: race?.raceType ?? race?.race_type })) redirect();
  }
  for (const person of seed.people ?? []) {
    if (isGrassrootsSource(person)) redirect();
  }
}
