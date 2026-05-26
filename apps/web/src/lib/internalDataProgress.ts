import { getSupabasePublicClient } from './supabasePublicClient';

type PublicPersonRow = {
  person_id: string;
  name: string;
  gender: string | null;
  education: string | null;
  experience: string | null;
};

type PublicClaimRow = {
  claim_id: string;
  person_id: string;
  claim_type: string;
  claim_value: string | null;
  claim_json: Record<string, unknown> | null;
  source_name: string | null;
};

type ReviewClaimRow = {
  claim_id: string;
  person_id: string | null;
  claim_type: string;
  source_name: string | null;
  review_score: number;
};

export type DataProgressMetric = {
  key: string;
  label: string;
  current: number;
  total: number;
  note: string;
};

export type DataProgressSummary = {
  peopleTotal: number;
  publicClaimTotal: number;
  pendingClaimTotal: number;
  wikidataExternalIdPeople: number;
  sensitivePendingTotal: number;
  metrics: DataProgressMetric[];
  pendingByType: Array<{ type: string; count: number }>;
  pendingBySource: Array<{ source: string; count: number }>;
  missingCorePeople: Array<{ personId: string; name: string; missing: string[] }>;
  error: string | null;
};

const sensitiveClaimTypes = new Set(['legal_case', 'family_relation']);

function percentReady(current: number, total: number) {
  return total > 0 ? Math.round((current / total) * 100) : 0;
}

function countBy<T>(rows: T[], keyFor: (row: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyFor(row) || '未分類';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ type: key, source: key, count }))
    .sort((left, right) => right.count - left.count);
}

function hasClaim(claims: PublicClaimRow[], personId: string, claimType: string) {
  return claims.some((claim) => claim.person_id === personId && claim.claim_type === claimType);
}

export async function fetchInternalDataProgress(): Promise<DataProgressSummary> {
  const client = getSupabasePublicClient();
  if (!client) {
    return {
      peopleTotal: 0,
      publicClaimTotal: 0,
      pendingClaimTotal: 0,
      wikidataExternalIdPeople: 0,
      sensitivePendingTotal: 0,
      metrics: [],
      pendingByType: [],
      pendingBySource: [],
      missingCorePeople: [],
      error: 'Supabase public env not configured.',
    };
  }

  const [peopleResult, publicClaimsResult, reviewClaimsResult] = await Promise.all([
    client.from('public_people').select('person_id,name,gender,education,experience').limit(10000),
    client.from('public_person_claims').select('claim_id,person_id,claim_type,claim_value,claim_json,source_name').limit(10000),
    client.from('person_claim_review_queue').select('claim_id,person_id,claim_type,source_name,review_score').limit(10000),
  ]);

  const error = peopleResult.error?.message ?? publicClaimsResult.error?.message ?? reviewClaimsResult.error?.message ?? null;
  const people = (peopleResult.data ?? []) as PublicPersonRow[];
  const publicClaims = (publicClaimsResult.data ?? []) as PublicClaimRow[];
  const reviewClaims = (reviewClaimsResult.data ?? []) as ReviewClaimRow[];
  const total = people.length;
  const wikidataExternalIdPeople = new Set(
    publicClaims
      .filter((claim) => claim.claim_type === 'external_id' && String(claim.claim_value ?? '').startsWith('wikidata:'))
      .map((claim) => claim.person_id),
  ).size;

  const withGender = people.filter((person) => person.gender && person.gender !== 'unknown').length;
  const withEducation = people.filter((person) => person.education || hasClaim(publicClaims, person.person_id, 'education')).length;
  const withExperience = people.filter((person) => person.experience || hasClaim(publicClaims, person.person_id, 'experience')).length;
  const sensitivePendingTotal = reviewClaims.filter((claim) => sensitiveClaimTypes.has(claim.claim_type)).length;
  const pendingByType = countBy(reviewClaims, (claim) => claim.claim_type).map(({ type, count }) => ({ type, count }));
  const pendingBySource = countBy(reviewClaims, (claim) => claim.source_name).map(({ source, count }) => ({ source, count }));
  const missingCorePeople = people
    .map((person) => ({
      personId: person.person_id,
      name: person.name,
      missing: [
        person.gender && person.gender !== 'unknown' ? null : '性別',
        hasClaim(publicClaims, person.person_id, 'external_id') ? null : '外部 ID',
        person.education || hasClaim(publicClaims, person.person_id, 'education') ? null : '學歷',
        person.experience || hasClaim(publicClaims, person.person_id, 'experience') ? null : '經歷',
      ].filter((value): value is string => Boolean(value)),
    }))
    .filter((person) => person.missing.length > 0)
    .slice(0, 25);

  return {
    peopleTotal: total,
    publicClaimTotal: publicClaims.length,
    pendingClaimTotal: reviewClaims.length,
    wikidataExternalIdPeople,
    sensitivePendingTotal,
    metrics: [
      { key: 'gender', label: '性別', current: withGender, total, note: `${percentReady(withGender, total)}% 已補齊` },
      { key: 'wikidata', label: 'Wikidata 外部 ID', current: wikidataExternalIdPeople, total, note: `${percentReady(wikidataExternalIdPeople, total)}% 已確認` },
      { key: 'education', label: '學歷', current: withEducation, total, note: `${percentReady(withEducation, total)}% 已補齊` },
      { key: 'experience', label: '經歷', current: withExperience, total, note: `${percentReady(withExperience, total)}% 已補齊` },
    ],
    pendingByType,
    pendingBySource,
    missingCorePeople,
    error,
  };
}
