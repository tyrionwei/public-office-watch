export type ReviewClaim = {
  claim_id: string;
  person_id: string | null;
  source_person_id: string | null;
  candidate_id: string | null;
  person_name: string | null;
  person_party: string | null;
  person_position: string | null;
  person_district: string | null;
  person_context: PersonReviewContext | null;
  raw_name: string | null;
  claim_type: string;
  claim_value: string | null;
  confidence_level: 'A' | 'B' | 'C' | 'D';
  review_score: number;
  review_status: string;
  visibility: string;
  source_name: string | null;
  source_url: string | null;
  scoring_reasons: string[];
  updated_at: string;
  claim_json?: Record<string, unknown>;
};

export type IdentityReviewCandidate = {
  personId: string;
  name: string;
  party: string | null;
  position: string | null;
  district: string | null;
  gender: string | null;
  birthDate: string | null;
  context: PersonReviewContext | null;
  matchStatus: string;
  score: number;
  reason: string | null;
  evidence: Record<string, unknown> | null;
};

export type IdentityReviewItem = {
  source_person_id: string;
  source_person_key: string;
  source_type: string;
  source_name: string;
  source_url: string | null;
  raw_name: string;
  gender: string | null;
  party: string | null;
  position: string | null;
  district: string | null;
  election_year: number | null;
  birth_date_text: string | null;
  confidence_suggestion: 'A' | 'B' | 'C' | 'D';
  candidate_count: number;
  best_match_score: number;
  review_status: string;
  candidates: IdentityReviewCandidate[];
  updated_at: string;
};

export type PersonReviewElection = {
  candidateId: string;
  electionYear: number | null;
  electionName: string;
  raceTitle: string;
  regionName: string | null;
  party: string | null;
  candidateNo: string | null;
  electionResult: string;
};

export type PersonReviewContext = {
  personId: string;
  name: string;
  alias: string | null;
  gender: string | null;
  birthDate: string | null;
  party: string | null;
  position: string | null;
  district: string | null;
  education: string | null;
  experience: string | null;
  currentOfficeLabel: string | null;
  upcomingCandidateLabel: string | null;
  elections: PersonReviewElection[];
};

export type PersonFeedbackReviewItem = {
  id: string;
  person_id: string;
  feedback_kind: 'supplement_request' | 'problem_report';
  section_key: string;
  problem_type: string | null;
  message: string | null;
  evidence_url: string | null;
  review_status: 'received' | 'reviewing' | 'verified' | 'rejected' | 'published';
  submission_count: number;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  person: {
    id: string;
    name: string;
    party: string | null;
    position: string | null;
    district: string | null;
  } | null;
};

export type PersonFeedbackReviewAction = 'start' | 'verify' | 'reject';

type ReviewClaimFilters = {
  sourceName?: string;
  claimType?: string;
  reviewStatus?: 'pending' | 'needs_more_evidence' | 'ready_for_publication' | '';
  personName?: string;
};

type ReviewClaimResult = {
  claims: ReviewClaim[];
  error: string | null;
};

type IdentityReviewResult = {
  items: IdentityReviewItem[];
  error: string | null;
};

type PublicPersonReviewSummary = {
  person_id: string;
  name: string;
  alias: string | null;
  gender: string | null;
  party: string | null;
  position: string | null;
  district: string | null;
  education: string | null;
  experience: string | null;
  current_office_label: string | null;
  upcoming_candidate_label: string | null;
};

type PublicCandidateReviewSummary = {
  candidate_id: string;
  person_id: string;
  election_year: number | null;
  election_name: string;
  race_title: string;
  region_name: string | null;
  party: string | null;
  candidate_no: string | null;
  election_result: string;
};

type ReviewAction = 'approve' | 'reject';
type IdentityReviewAction = 'approve' | 'reject' | 'create';

type ReviewClaimActionOptions = {
  platformText?: string;
  claimValue?: string;
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

async function fetchPersonReviewContexts(
  personIds: string[],
): Promise<{ peopleById: Map<string, PersonReviewContext>; error: string | null }> {
  if (personIds.length === 0) {
    return { peopleById: new Map(), error: null };
  }

  const response = await fetch('/internal-api/review-person-contexts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ personIds }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return { peopleById: new Map(), error: body?.error ?? response.statusText };
  }
  const peopleResult = { data: body?.people ?? [] };
  const birthDatesResult = { data: body?.birthDates ?? [] };
  const candidatesResult = { data: body?.candidates ?? [] };

  const birthDatesByPerson = new Map<string, string>();
  for (const row of birthDatesResult.data ?? []) {
    if (row.person_id && row.claim_value && !birthDatesByPerson.has(row.person_id)) {
      birthDatesByPerson.set(row.person_id, row.claim_value);
    }
  }

  const electionsByPerson = new Map<string, PersonReviewElection[]>();
  for (const row of (candidatesResult.data ?? []) as PublicCandidateReviewSummary[]) {
    const elections = electionsByPerson.get(row.person_id) ?? [];
    if (elections.length < 4) {
      elections.push({
        candidateId: row.candidate_id,
        electionYear: row.election_year,
        electionName: row.election_name,
        raceTitle: row.race_title,
        regionName: row.region_name,
        party: row.party,
        candidateNo: row.candidate_no,
        electionResult: row.election_result,
      });
      electionsByPerson.set(row.person_id, elections);
    }
  }

  const peopleById = new Map<string, PersonReviewContext>();
  for (const row of (peopleResult.data ?? []) as PublicPersonReviewSummary[]) {
    peopleById.set(row.person_id, {
      personId: row.person_id,
      name: row.name,
      alias: row.alias,
      gender: row.gender,
      birthDate: birthDatesByPerson.get(row.person_id) ?? null,
      party: row.party,
      position: row.position,
      district: row.district,
      education: row.education,
      experience: row.experience,
      currentOfficeLabel: row.current_office_label,
      upcomingCandidateLabel: row.upcoming_candidate_label,
      elections: electionsByPerson.get(row.person_id) ?? [],
    });
  }

  return { peopleById, error: null };
}

export async function fetchInternalReviewClaims(filters: ReviewClaimFilters): Promise<ReviewClaimResult> {
  const params = new URLSearchParams();
  if (filters.sourceName) params.set('sourceName', filters.sourceName);
  if (filters.claimType) params.set('claimType', filters.claimType);
  if (filters.reviewStatus) params.set('reviewStatus', filters.reviewStatus);
  if (filters.personName) params.set('personName', filters.personName);

  const response = await fetch(`/internal-api/review-claims?${params.toString()}`);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return { claims: [], error: body?.error ?? response.statusText };
  }

  const rows = (body?.claims ?? []) as Omit<ReviewClaim, 'person_name' | 'person_party' | 'person_position' | 'person_district' | 'person_context'>[];
  const personIds = Array.from(new Set(rows.map((claim) => claim.person_id).filter((id): id is string => Boolean(id))));
  const contextResult = await fetchPersonReviewContexts(personIds);
  if (contextResult.error) {
    return { claims: [], error: contextResult.error };
  }

  return {
    claims: rows.map((claim) => {
      const person = claim.person_id ? contextResult.peopleById.get(claim.person_id) : null;
      const targetPerson = objectValue(claim.claim_json?.targetPerson);
      const claimJsonPersonName =
        typeof claim.claim_json?.personName === 'string'
          ? claim.claim_json.personName
          : typeof targetPerson?.name === 'string'
            ? targetPerson.name
            : null;
      return {
        ...claim,
        person_name: person?.name ?? claim.raw_name ?? claimJsonPersonName,
        person_party: person?.party ?? null,
        person_position: person?.position ?? null,
        person_district: person?.district ?? null,
        person_context: person ?? null,
        scoring_reasons: Array.isArray(claim.scoring_reasons)
          ? claim.scoring_reasons.filter((reason): reason is string => typeof reason === 'string')
          : [],
      };
    }),
    error: null,
  };
}

export async function fetchInternalIdentityReviewItems(): Promise<IdentityReviewResult> {
  const response = await fetch('/internal-api/review-identities');
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return { items: [], error: body?.error ?? response.statusText };
  }
  const data = (body?.items ?? []) as IdentityReviewItem[];

  const candidatePersonIds = Array.from(new Set(
    data.flatMap((item) =>
      Array.isArray(item.candidates)
        ? item.candidates
          .map((candidate) => objectValue(candidate)?.personId)
          .filter((personId): personId is string => typeof personId === 'string')
        : [],
    ),
  ));
  const contextResult = await fetchPersonReviewContexts(candidatePersonIds);
  if (contextResult.error) {
    return { items: [], error: contextResult.error };
  }

  return {
    items: data.map((item) => ({
      ...(item as Omit<IdentityReviewItem, 'candidates'>),
      candidates: Array.isArray(item.candidates)
        ? item.candidates.map((candidate) => {
          const candidateRow = candidate as Omit<IdentityReviewCandidate, 'context'>;
          return {
            ...candidateRow,
            context: contextResult.peopleById.get(candidateRow.personId) ?? null,
          };
        })
        : [],
    })),
    error: null,
  };
}

export async function reviewInternalClaim(
  claimId: string,
  action: ReviewAction,
  options: ReviewClaimActionOptions = {},
): Promise<{
  relatedUpdated: number;
  relatedClaimIds: string[];
  claimValueChanged: boolean;
  personFieldUpdated: boolean;
  personFieldPreserved: boolean;
  error: string | null;
}> {
  const response = await fetch('/internal-api/review-claim', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ claimId, action, ...options }),
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      relatedUpdated: 0,
      relatedClaimIds: [],
      claimValueChanged: false,
      personFieldUpdated: false,
      personFieldPreserved: false,
      error: body?.error ?? response.statusText,
    };
  }

  return {
    relatedUpdated: Number(body?.relatedUpdated ?? 0),
    relatedClaimIds: Array.isArray(body?.relatedClaimIds) ? body.relatedClaimIds.map(String) : [],
    claimValueChanged: body?.claimValueChanged === true,
    personFieldUpdated: body?.personFieldUpdated === true,
    personFieldPreserved: body?.personFieldPreserved === true,
    error: null,
  };
}

export async function reviewInternalIdentityMatch(
  sourcePersonId: string,
  candidatePersonId: string | null,
  action: IdentityReviewAction,
): Promise<{ error: string | null }> {
  const response = await fetch('/internal-api/review-identity-match', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sourcePersonId, candidatePersonId, action }),
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    return { error: body?.error ?? response.statusText };
  }

  return { error: null };
}

export async function fetchInternalPersonFeedbackItems(): Promise<{
  items: PersonFeedbackReviewItem[];
  error: string | null;
}> {
  const response = await fetch('/internal-api/person-feedback');
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    return { items: [], error: body?.error ?? response.statusText };
  }

  return {
    items: Array.isArray(body?.items) ? body.items as PersonFeedbackReviewItem[] : [],
    error: null,
  };
}

export async function reviewInternalPersonFeedback(
  submissionId: string,
  action: PersonFeedbackReviewAction,
  note: string,
): Promise<{ reviewStatus: string | null; error: string | null }> {
  const response = await fetch('/internal-api/review-person-feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ submissionId, action, note }),
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    return { reviewStatus: null, error: body?.error ?? response.statusText };
  }

  return { reviewStatus: typeof body?.reviewStatus === 'string' ? body.reviewStatus : null, error: null };
}
