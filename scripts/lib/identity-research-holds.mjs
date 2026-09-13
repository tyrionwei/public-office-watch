// Deferral changes research eligibility, never the identity comparison universe.
export function partitionIdentityResearchTargets(targets, holds) {
  const byId = new Map();
  for (const hold of holds) {
    if (hold.released_at) continue;
    const id = hold.canonical_person_id ?? hold.person_id;
    if (!id || !hold.reason || !hold.resume_condition) throw new Error('Invalid identity research hold');
    byId.set(id, hold);
  }
  const eligible = [], deferred = [];
  for (const target of targets) {
    const hold = byId.get(target.personId);
    if (hold) deferred.push({ ...target, identityStatus: 'awaiting_bulletin_evidence',
      reason: hold.reason, resumeCondition: hold.resume_condition });
    else eligible.push(target);
  }
  return { eligible, deferred, totalCount: targets.length };
}
