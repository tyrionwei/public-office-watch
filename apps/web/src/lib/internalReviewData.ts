import { getSupabasePublicClient } from './supabasePublicClient';

export type ReviewClaim = {
  claim_id: string;
  person_id: string | null;
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
  return { claims: (data ?? []) as ReviewClaim[], error: error?.message ?? null };
}
