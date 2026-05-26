import { getSupabasePublicClient } from './supabasePublicClient';

export type ReviewClaim = {
  claim_id: string;
  person_id: string | null;
  person_name: string | null;
  person_party: string | null;
  person_position: string | null;
  person_district: string | null;
  raw_name: string | null;
  claim_type: string;
  claim_value: string | null;
  confidence_level: 'A' | 'B' | 'C' | 'D';
  review_score: number;
  review_status: string;
  visibility: string;
  source_name: string | null;
  source_url: string | null;
  updated_at: string;
};

type ReviewClaimFilters = {
  sourceName?: string;
  claimType?: string;
};

type ReviewClaimResult = {
  claims: ReviewClaim[];
  error: string | null;
};

type PublicPersonReviewSummary = {
  person_id: string;
  name: string;
  party: string | null;
  position: string | null;
  district: string | null;
};

type ReviewAction = 'approve' | 'reject';

export async function fetchInternalReviewClaims(filters: ReviewClaimFilters): Promise<ReviewClaimResult> {
  const client = getSupabasePublicClient();
  if (!client) {
    return { claims: [], error: 'Supabase public env not configured.' };
  }

  let query = client
    .from('person_claim_review_queue')
    .select(
      'claim_id,person_id,raw_name,claim_type,claim_value,confidence_level,review_score,review_status,visibility,source_name,source_url,updated_at',
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

  const { data, error } = await query;
  if (error) {
    return { claims: [], error: error.message };
  }

  const rows = (data ?? []) as Omit<ReviewClaim, 'person_name' | 'person_party' | 'person_position' | 'person_district'>[];
  const personIds = Array.from(new Set(rows.map((claim) => claim.person_id).filter((id): id is string => Boolean(id))));
  let peopleById = new Map<string, PublicPersonReviewSummary>();

  if (personIds.length > 0) {
    const { data: people, error: peopleError } = await client
      .from('public_people')
      .select('person_id,name,party,position,district')
      .in('person_id', personIds);

    if (peopleError) {
      return { claims: [], error: peopleError.message };
    }

    peopleById = new Map((people ?? []).map((person) => [person.person_id, person as PublicPersonReviewSummary]));
  }

  return {
    claims: rows.map((claim) => {
      const person = claim.person_id ? peopleById.get(claim.person_id) : null;
      return {
        ...claim,
        person_name: person?.name ?? claim.raw_name ?? null,
        person_party: person?.party ?? null,
        person_position: person?.position ?? null,
        person_district: person?.district ?? null,
      };
    }),
    error: null,
  };
}

export async function reviewInternalClaim(claimId: string, action: ReviewAction): Promise<{ relatedUpdated: number; error: string | null }> {
  const response = await fetch('/internal-api/review-claim', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ claimId, action }),
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    return { relatedUpdated: 0, error: body?.error ?? response.statusText };
  }

  return { relatedUpdated: Number(body?.relatedUpdated ?? 0), error: null };
}
