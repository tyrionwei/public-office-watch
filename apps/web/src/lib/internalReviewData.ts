import { getSupabasePublicClient } from './supabasePublicClient';

export type ReviewClaim = {
  claim_id: string;
  person_id: string | null;
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
  reviewStatus?: 'pending' | 'needs_more_evidence' | '';
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

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

async function fetchPersonReviewContexts(
  personIds: string[],
): Promise<{ peopleById: Map<string, PersonReviewContext>; error: string | null }> {
  const client = getSupabasePublicClient();
  if (!client || personIds.length === 0) {
    return { peopleById: new Map(), error: null };
  }

  const [peopleResult, birthDatesResult, candidatesResult] = await Promise.all([
    client
      .from('public_people')
      .select(
        'person_id,name,alias,gender,party,position,district,education,experience,current_office_label,upcoming_candidate_label',
      )
      .in('person_id', personIds),
    client
      .from('public_person_claims')
      .select('person_id,claim_value')
      .in('person_id', personIds)
      .eq('claim_type', 'birth_date'),
    client
      .from('public_candidates')
      .select(
        'candidate_id,person_id,election_year,election_name,race_title,region_name,party,candidate_no,election_result',
      )
      .in('person_id', personIds)
      .order('election_year', { ascending: false, nullsFirst: false }),
  ]);

  const error = peopleResult.error ?? birthDatesResult.error ?? candidatesResult.error;
  if (error) {
    return { peopleById: new Map(), error: error.message };
  }

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
  const client = getSupabasePublicClient();
  if (!client) {
    return { claims: [], error: 'Supabase public env not configured.' };
  }

  let query = client
    .from('person_claim_review_queue')
    .select(
      'claim_id,person_id,raw_name,claim_type,claim_value,claim_json,confidence_level,review_score,review_status,visibility,source_name,source_url,scoring_reasons,updated_at',
    )
    .order('review_score', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(200);

  if (filters.sourceName) {
    query = query.eq('source_name', filters.sourceName);
  }

  if (filters.claimType) {
    query = query.eq('claim_type', filters.claimType);
  }

  if (filters.reviewStatus) {
    query = query.eq('review_status', filters.reviewStatus);
  }

  const { data, error } = await query;
  if (error) {
    return { claims: [], error: error.message };
  }

  const rows = (data ?? []) as Omit<ReviewClaim, 'person_name' | 'person_party' | 'person_position' | 'person_district' | 'person_context'>[];
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
  const client = getSupabasePublicClient();
  if (!client) {
    return { items: [], error: 'Supabase public env not configured.' };
  }

  const { data, error } = await client
    .from('person_identity_review_queue')
    .select(
      'source_person_id,source_person_key,source_type,source_name,source_url,raw_name,gender,party,position,district,election_year,birth_date_text,confidence_suggestion,candidate_count,best_match_score,review_status,candidates,updated_at',
    )
    .order('best_match_score', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) {
    return { items: [], error: error.message };
  }

  const candidatePersonIds = Array.from(new Set(
    (data ?? []).flatMap((item) =>
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
    items: (data ?? []).map((item) => ({
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

export async function reviewInternalClaim(claimId: string, action: ReviewAction): Promise<{ relatedUpdated: number; relatedClaimIds: string[]; error: string | null }> {
  const response = await fetch('/internal-api/review-claim', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ claimId, action }),
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    return { relatedUpdated: 0, relatedClaimIds: [], error: body?.error ?? response.statusText };
  }

  return {
    relatedUpdated: Number(body?.relatedUpdated ?? 0),
    relatedClaimIds: Array.isArray(body?.relatedClaimIds) ? body.relatedClaimIds.map(String) : [],
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
