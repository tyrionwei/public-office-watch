type JsonObject = Record<string, unknown>;

type PartyCandidateSourcePerson = {
  source_person_key: string;
  party: string | null;
  source_name: string;
  source_url: string | null;
  source_payload: JsonObject | null;
};

type PartyCandidateMetadata = {
  externalId: string;
  raceId: string;
  candidacyStatus: 'party_nominee';
};

function objectValue(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
}

export function parsePartyCandidateReviewSource(source: PartyCandidateSourcePerson): PartyCandidateMetadata | null {
  if (!source.source_person_key.startsWith('party-candidate:')) return null;

  const payload = objectValue(source.source_payload);
  const targetRace = objectValue(payload?.targetRace);
  const sourceCandidateKey = String(payload?.sourceCandidateKey ?? '').trim();
  const raceId = String(targetRace?.id ?? '').trim();
  const candidacyStatus = String(payload?.candidacyStatus ?? '').trim();

  if (!sourceCandidateKey || !raceId || candidacyStatus !== 'party_nominee') {
    throw new Error('Party candidate source payload is incomplete or unsupported.');
  }

  return {
    externalId: `party-candidate:${sourceCandidateKey}`,
    raceId,
    candidacyStatus,
  };
}

export function buildPartyCandidateReviewWrite(
  source: PartyCandidateSourcePerson,
  personId: string,
  reviewedAt: string,
) {
  const metadata = parsePartyCandidateReviewSource(source);
  if (!metadata) return null;
  if (!source.party) throw new Error('Party candidate source is missing party.');

  return {
    candidate: {
      external_id: metadata.externalId,
      person_id: personId,
      race_id: metadata.raceId,
      party: source.party,
      registration_status: 'unknown',
      candidacy_status: metadata.candidacyStatus,
      election_result: 'pending',
      status_updated_at: reviewedAt,
      source_name: source.source_name,
      source_url: source.source_url,
      is_public: false,
      updated_at: reviewedAt,
    },
    sourcePatch: {
      is_public: false,
      updated_at: reviewedAt,
    },
    claimPatch: {
      person_id: personId,
      review_status: 'verified',
      visibility: 'review_only',
      is_public: false,
      scoring_version: 'party-candidate-internal-review-v1',
      updated_at: reviewedAt,
    },
  };
}

export function buildIdentityClaimLinkPatch(personId: string, reviewedAt: string) {
  if (!personId.trim()) throw new Error('Identity review requires a person id.');

  return {
    person_id: personId,
    updated_at: reviewedAt,
  };
}
