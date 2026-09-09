function isGeneratedRace(row) {
  if (['municipality_mayor', 'county_mayor'].includes(row.race_type)) {
    return /^planned-2026-local-from-cec-2022-local-mayor-\d{5}$/.test(row.external_id);
  }
  return ['city_councilor', 'county_councilor'].includes(row.race_type)
    && /^planned-2026-local-(?:from-cec-2022-local-councilor-(?:regional|mountain-indigenous|plain-indigenous)-\d{5}-\d{1,2}|official-\d{5}-\d{2})$/.test(row.external_id);
}

// A successful fetch is not proof of complete coverage. Missing rows are review
// candidates only; this plan never grants permission to hide an existing race.
export function planPlannedLocalRaceReconciliation({ electionId, currentRows, storedRows, source, sourceStatus }) {
  const currentIds = new Set(currentRows.filter(row => row.election_id === electionId).map(row => row.external_id));
  const missing = storedRows.filter(row => row.election_id === electionId && row.is_public && !currentIds.has(row.external_id));
  const owned = missing.filter(row => isGeneratedRace(row)
    && source?.name && source?.url
    && row.source_name === source.name && row.source_url === source.url);
  return {
    status: owned.length ? 'review_required' : 'preserved',
    policy: 'preserve_missing_rows',
    sourceStatus: sourceStatus ?? 'unknown',
    coverage: 'not_proven_complete',
    reason: 'absence_is_not_evidence_of_removal',
    automaticHideCount: 0,
    missingOwnedCount: owned.length,
    missingOwnedExternalIds: owned.map(row => row.external_id).sort().slice(0, 500),
    missingOwnedIdsTruncated: owned.length > 500,
    preservedOtherMissingCount: missing.length - owned.length,
  };
}

export function withPlannedLocalRaceReconciliation(report, reconciliation) {
  const needsReview = reconciliation.status === 'review_required';
  return {
    ...report,
    status: needsReview && report.status === 'ok' ? 'degraded' : report.status,
    needsAttention: Boolean(report.needsAttention || needsReview),
    plannedLocalRaceReconciliation: reconciliation,
  };
}
