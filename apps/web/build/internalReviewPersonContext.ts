type ReviewPersonRow = {
  id: string;
  name: string;
  alias: string | null;
  gender: string | null;
  party: string | null;
  position: string | null;
  district: string | null;
  education: string | null;
  experience: string | null;
};

type ReviewCanonicalPersonRow = {
  person_id: string;
  canonical_person_id: string;
};

type ReviewProfileClaimRow = {
  person_id: string;
  claim_value: string | null;
};

type ReviewCandidateRow = {
  id: string;
  person_id: string;
  party: string | null;
  candidate_no: string | null;
  election_result: string;
  race: {
    title: string;
    election: { year: number | null; name: string };
    region: { name: string } | null;
  };
};

export function buildReviewCanonicalPersonQuery(personIds: string[]) {
  const ids = personIds.map(encodeURIComponent).join(',');
  return `person_canonical_map?select=person_id,canonical_person_id&person_id=in.(${ids})&limit=100`;
}

export function canonicalPersonIdForReview(
  personId: string,
  canonicalRows: ReviewCanonicalPersonRow[],
) {
  return canonicalRows.find((row) => row.person_id === personId)?.canonical_person_id ?? personId;
}

export function buildReviewPersonContextQueries(personIds: string[]) {
  const ids = personIds.map(encodeURIComponent).join(',');

  return {
    people: `people?select=id,name,alias,gender,party,position,district,education,experience&id=in.(${ids})&limit=200`,
    birthDates: `person_claims?select=person_id,claim_value&person_id=in.(${ids})&claim_type=eq.birth_date&review_status=eq.verified&visibility=eq.public&is_public=eq.true&order=updated_at.desc&limit=1000`,
    genders: `person_claims?select=person_id,claim_value&person_id=in.(${ids})&claim_type=eq.gender&review_status=eq.verified&visibility=eq.public&is_public=eq.true&order=updated_at.desc&limit=1000`,
    candidates: `candidates?select=id,person_id,party,candidate_no,election_result,race:races!inner(title,election:elections!inner(year,name),region:regions(name))&person_id=in.(${ids})&order=updated_at.desc&limit=1000`,
  };
}

function normalizedGender(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'male' || normalized === '男') return 'male';
  if (normalized === 'female' || normalized === '女') return 'female';
  return null;
}

function verifiedGenderForReview(
  personIds: string[],
  genderClaims: ReviewProfileClaimRow[],
) {
  const genders = new Set(
    genderClaims
      .filter((claim) => personIds.includes(claim.person_id))
      .map((claim) => normalizedGender(claim.claim_value))
      .filter((gender): gender is 'male' | 'female' => gender !== null),
  );
  return genders.size === 1 ? Array.from(genders)[0] : null;
}

export function mapReviewPeople(
  rows: ReviewPersonRow[],
  sourcePersonIds = rows.map((row) => row.id),
  canonicalRows: ReviewCanonicalPersonRow[] = [],
  genderClaims: ReviewProfileClaimRow[] = [],
) {
  const peopleById = new Map(rows.map((row) => [row.id, row]));

  return sourcePersonIds.flatMap((sourcePersonId) => {
    const canonicalPersonId = canonicalPersonIdForReview(sourcePersonId, canonicalRows);
    const row = peopleById.get(canonicalPersonId) ?? peopleById.get(sourcePersonId);
    if (!row) return [];
    const storedGender = normalizedGender(row.gender);
    const verifiedGender = verifiedGenderForReview(
      Array.from(new Set([sourcePersonId, canonicalPersonId])),
      genderClaims,
    );

    return [{
      person_id: sourcePersonId,
      name: row.name,
      alias: row.alias,
      gender: storedGender ?? verifiedGender ?? row.gender,
      party: row.party,
      position: row.position,
      district: row.district,
      education: row.education,
      experience: row.experience,
      current_office_label: null,
      upcoming_candidate_label: null,
    }];
  });
}

export function mapReviewBirthDates(
  rows: ReviewProfileClaimRow[],
  sourcePersonIds: string[],
  canonicalRows: ReviewCanonicalPersonRow[],
) {
  return sourcePersonIds.flatMap((sourcePersonId) => {
    const canonicalPersonId = canonicalPersonIdForReview(sourcePersonId, canonicalRows);
    const row = rows.find((candidate) => candidate.person_id === sourcePersonId)
      ?? rows.find((candidate) => candidate.person_id === canonicalPersonId);
    return row ? [{ person_id: sourcePersonId, claim_value: row.claim_value }] : [];
  });
}

function mapReviewCandidate(row: ReviewCandidateRow, personId = row.person_id) {
  return {
    candidate_id: row.id,
    person_id: personId,
    election_year: row.race.election.year,
    election_name: row.race.election.name,
    race_title: row.race.title,
    region_name: row.race.region?.name ?? null,
    party: row.party,
    candidate_no: row.candidate_no,
    election_result: row.election_result,
  };
}

export function mapReviewCandidates(
  rows: ReviewCandidateRow[],
  sourcePersonIds?: string[],
  canonicalRows: ReviewCanonicalPersonRow[] = [],
) {
  if (!sourcePersonIds) return rows.map((row) => mapReviewCandidate(row));

  return sourcePersonIds.flatMap((sourcePersonId) => {
    const canonicalPersonId = canonicalPersonIdForReview(sourcePersonId, canonicalRows);
    const candidateIds = new Set<string>();
    return rows
      .filter((row) => row.person_id === sourcePersonId || row.person_id === canonicalPersonId)
      .filter((row) => {
        if (candidateIds.has(row.id)) return false;
        candidateIds.add(row.id);
        return true;
      })
      .map((row) => mapReviewCandidate(row, sourcePersonId));
  });
}
